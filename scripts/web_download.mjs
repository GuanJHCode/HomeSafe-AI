import { appendFile, cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

// The application supplies these names when it creates each JSON Blob download.
const stamp = String.raw`\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z`;
export const REPORT_FILENAME = new RegExp(`^homesafe-action-list-v\\d+-[a-f0-9]{12}-${stamp}-\\d+\\.json$`);
export const SNAPSHOT_FILENAME = new RegExp(`^homesafe-scene-v\\d+-[a-f0-9]{12}-${stamp}-\\d+\\.json$`);
const GUID = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const browserOwners = new WeakMap();

// Browser.setDownloadBehavior is browser-wide. Only one harness may own a browser;
// within it, each capture is scoped to the current main frame and GUID.
export async function createJsonDownloadHarness({ browser, cdp, downloadPath }) {
  if ((typeof browser !== 'object' || browser === null) && typeof browser !== 'function') {
    throw new TypeError('A browser identity is required for download ownership');
  }
  if (browserOwners.has(browser)) throw new Error('A download harness already owns this browser');
  const owner = {};
  browserOwners.set(browser, owner); // Reserve synchronously before the CDP setup call.
  const directory = resolve(downloadPath);
  try {
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allowAndName', downloadPath: directory, eventsEnabled: true,
    });
  } catch (error) {
    if (browserOwners.get(browser) === owner) browserOwners.delete(browser);
    throw error;
  }
  let closed = false;
  let unusable = false;
  let active = null;
  const seenGuids = new Set();

  return {
    async capture({ click, filenamePattern, startTimeoutMs = 10_000, completeTimeoutMs = 10_000,
      clickTimeoutMs = 10_000 }) {
      if (closed) throw new Error('Download harness closed');
      if (unusable) throw new Error('Download harness requires a fresh page after an incomplete download');
      if (active) throw new Error('A download capture is already active for this page');
      if (typeof click !== 'function' || !(filenamePattern instanceof RegExp)) {
        throw new TypeError('capture requires click and filenamePattern');
      }
      if (!(startTimeoutMs > 0) || !(completeTimeoutMs > 0) || !(clickTimeoutMs > 0)) {
        throw new RangeError('Download timeouts must be positive');
      }
      const pattern = new RegExp(filenamePattern.source, filenamePattern.flags.replace(/[gy]/g, ''));
      const trace = { expected_filename: pattern.source, frame_id: null, events: [], result: null };
      let rejectAbort;
      const abort = new Promise((_, reject) => { rejectAbort = reject; });
      const request = { abort: rejectAbort };
      active = request; // Reserve and arm abort before frame lookup.
      let startTimer;
      let completionTimer;
      let clickTimer;
      let onBegin;
      let onProgress;
      let finished = false;
      try {
        startTimer = setTimeout(() => request.abort(new Error(
          `Download start timed out after ${startTimeoutMs} ms: ${pattern}`)), startTimeoutMs);
        const { frameTree } = await Promise.race([cdp.send('Page.getFrameTree'), abort]);
        if (closed) throw new Error('Download harness closed');
        const frameId = frameTree?.frame?.id;
        if (!frameId) throw new Error('Could not identify the download page frame');
        trace.frame_id = frameId;

        let selected;
        const earlyProgress = new Map();
        let resolveDownload;
        const download = new Promise(resolvePromise => {
          resolveDownload = resolvePromise;
        });
        let terminalState;
        const applyProgress = event => {
          if (terminalState) return;
          if (event.state === 'canceled') {
            terminalState = 'canceled';
            clearTimeout(completionTimer);
            request.abort(new Error(`Download canceled: ${selected.suggestedFilename} (GUID ${selected.guid})`));
          } else if (event.state === 'completed') {
            terminalState = 'completed';
            clearTimeout(completionTimer);
            resolveDownload(selected);
          }
        };
        onBegin = event => {
          trace.events.push({ kind: 'willBegin', guid: event.guid, frame_id: event.frameId,
            suggested_filename: event.suggestedFilename });
          if (seenGuids.has(event.guid)) return;
          seenGuids.add(event.guid);
          if (event.frameId !== frameId || !pattern.test(event.suggestedFilename ?? '')) return;
          if (!GUID.test(event.guid)) {
            request.abort(new Error(`Invalid download GUID for ${event.suggestedFilename}`));
            return;
          }
          if (selected) {
            request.abort(new Error(`Ambiguous downloads for ${pattern}: ${selected.guid} and ${event.guid}`));
            return;
          }
          selected = event;
          clearTimeout(startTimer);
          completionTimer = setTimeout(() => request.abort(new Error(
            `Download completion timed out after ${completeTimeoutMs} ms: ${event.suggestedFilename} (GUID ${event.guid})`)), completeTimeoutMs);
          const prior = earlyProgress.get(event.guid);
          if (prior) applyProgress(prior);
        };
        onProgress = event => {
          trace.events.push({ kind: 'progress', guid: event.guid, state: event.state,
            received_bytes: event.receivedBytes, total_bytes: event.totalBytes });
          if (selected?.guid === event.guid) applyProgress(event);
          else if ((event.state === 'canceled' || event.state === 'completed') && !earlyProgress.has(event.guid)) {
            earlyProgress.set(event.guid, event);
          }
        };
        cdp.on('Browser.downloadWillBegin', onBegin);
        cdp.on('Browser.downloadProgress', onProgress);
        // Click may settle before or after the download. Both must succeed.
        clickTimer = setTimeout(() => request.abort(new Error(
          `Download click timed out after ${clickTimeoutMs} ms: ${pattern}`)), clickTimeoutMs);
        const clicked = Promise.resolve().then(click).finally(() => clearTimeout(clickTimer));
        const [, event] = await Promise.race([Promise.all([clicked, download]), abort]);
        finished = true;
        const path = join(directory, event.guid);
        let raw;
        try { raw = await readFile(path, 'utf8'); }
        catch (cause) { throw new Error(`Completed download could not be read: ${path}`, { cause }); }
        if (!raw) throw new Error(`Completed download contains empty JSON: ${path}`);
        let json;
        try { json = JSON.parse(raw); }
        catch (cause) { throw new Error(`Completed download contains invalid JSON: ${path}`, { cause }); }
        trace.result = 'completed_and_parsed';
        return { guid: event.guid, filename: event.suggestedFilename, path, raw, json };
      } catch (error) {
        // A late event after a failed click or timeout cannot safely be assigned to
        // a later same-name click. The caller must use a fresh page/session to retry.
        if (!finished && !closed) unusable = true;
        trace.result = String(error);
        throw error;
      } finally {
        clearTimeout(startTimer);
        clearTimeout(completionTimer);
        clearTimeout(clickTimer);
        if (onBegin) cdp.off('Browser.downloadWillBegin', onBegin);
        if (onProgress) cdp.off('Browser.downloadProgress', onProgress);
        active = null;
        try { await appendFile(join(directory, 'download-events.jsonl'), JSON.stringify(trace) + '\n'); }
        catch (error) { console.error(`Could not preserve download event trace in ${directory}: ${error}`); }
      }
    },
    close() {
      if (closed) return;
      closed = true;
      active?.abort?.(new Error('Download harness closed'));
      if (browserOwners.get(browser) === owner) browserOwners.delete(browser);
    },
  };
}

// Keep original GUID-named bytes after any harness or semantic assertion failure.
// CI passes an artifact directory; local runs without one retain their temp path.
export async function retainFailedDownloads(downloadPath, evidenceDirectory, { announce = true, destination } = {}) {
  let location;
  try {
    if (destination) {
      location = resolve(destination);
    } else if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      location = await mkdtemp(join(resolve(evidenceDirectory), 'failed-downloads-'));
    } else {
      location = await mkdtemp(join(tmpdir(), 'homesafe-failed-downloads-'));
    }
    await cp(downloadPath, location, { recursive: true, force: true });
  } catch (error) {
    console.error(`Could not copy failed downloads from ${downloadPath}: ${error}`);
    try {
      location = await mkdtemp(join(tmpdir(), 'homesafe-failed-downloads-'));
      await cp(downloadPath, location, { recursive: true, force: true });
    } catch (fallbackError) {
      console.error(`Could not make independent failed-download copy: ${fallbackError}`);
      location = downloadPath;
    }
  }
  if (announce) console.error(`Download artifacts retained at ${location}`);
  return location;
}
