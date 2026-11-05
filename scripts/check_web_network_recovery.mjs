// Controlled Chromium network interruption. This does not test offline cold
// startup, a public network, or a service worker.
// node scripts/check_web_network_recovery.mjs URL CHROMIUM PUPPETEER_ENTRY OUTPUT_DIR
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME, retainFailedDownloads } from './web_download.mjs';

const [url, executablePath, entry, output] = process.argv.slice(2);
if (!url || !executablePath || !entry || !output) {
  throw new Error('Pass URL, isolated Chromium, puppeteer-core entry, and output directory');
}
const { default: puppeteer } = await import(pathToFileURL(resolve(entry)).href);
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const downloadPath = await mkdtemp(join(tmpdir(), 'homesafe-network-download-'));
const networkEvents = [];
const pageErrors = [];
const stages = [];
const navigationResponses = [];
const documentRequests = [];
const initialBootstrap = [];
let page;
let firstPage;
let cdp;
let firstCdp;
let harness;
let passed = false;
let retainedDownloads;

function watchNetwork(session, target) {
  const requests = new Map();
  const documents = new Map(), extra = new Map(), requestExtra = new Map();
  session.on('Network.requestWillBeSent', event => {
    requests.set(event.requestId, event.request.url);
    if (event.type !== 'Document') return;
    const record = { target, url: event.request.url,
      request_headers: selectedHeaders(event.request.headers),
      request_extra_headers: requestExtra.get(event.requestId) ?? {}, ...extra.get(event.requestId) };
    documents.set(event.requestId, record); documentRequests.push(record);
  });
  session.on('Network.requestWillBeSentExtraInfo', event => {
    const headers = selectedHeaders(event.headers); requestExtra.set(event.requestId, headers);
    const record = documents.get(event.requestId); if (record) record.request_extra_headers = headers;
  });
  session.on('Network.responseReceived', event => {
    const record = documents.get(event.requestId);
    if (record) Object.assign(record, { response_status: event.response.status,
      response_headers: selectedHeaders(event.response.headers), from_disk_cache: event.response.fromDiskCache ?? false });
  });
  session.on('Network.responseReceivedExtraInfo', event => {
    const info = { extra_status: event.statusCode, extra_headers: selectedHeaders(event.headers) };
    extra.set(event.requestId, info);
    const record = documents.get(event.requestId); if (record) Object.assign(record, info);
  });
  session.on('Network.loadingFailed', event => networkEvents.push({
    target, url: requests.get(event.requestId) ?? null, error: event.errorText,
    blocked_reason: event.blockedReason ?? null,
  }));
}
function selectedHeaders(headers = {}) {
  const names = new Set(['date', 'last-modified', 'cache-control', 'expires', 'etag', 'age',
    'if-modified-since', 'if-none-match', 'pragma']);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => names.has(name.toLowerCase()))
    .map(([name, value]) => [name.toLowerCase(), value]));
}
function recordNavigation(target, response) {
  navigationResponses.push({ target, requested_url: url, actual_url: response?.url() ?? null,
    status: response?.status() ?? null, status_text: response?.statusText() ?? null,
    ok: response?.ok() ?? false, from_cache: response?.fromCache() ?? null,
    from_service_worker: response?.fromServiceWorker() ?? null,
    headers: selectedHeaders(response?.headers()) });
}
async function emulateOffline(session, enabled) {
  await session.send('Network.emulateNetworkConditions', {
    offline: enabled, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
}
async function ready(target) {
  await target.waitForFunction(() => !!document.querySelector('.report') &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
}
async function failed(target) {
  await target.waitForFunction(() => document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false' &&
    !!document.querySelector('[aria-label="检查结果"] [role="alert"]') &&
    !document.querySelector('.report'));
}
async function click(target, label) {
  const clicked = await target.evaluate(text => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, label);
  assert.equal(clicked, true, 'Enabled button ' + label);
}
async function state(target) {
  return target.evaluate(() => ({
    hash: document.querySelector('.report .hash')?.textContent?.split(' ').at(-1) ?? null,
    revision: document.querySelector('.findings-panel .revision')?.textContent ?? null,
    position: document.querySelector('[data-testid="selected-position"]')?.textContent?.trim() ?? null,
    busy: document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy'),
    failure: document.querySelector('[aria-label="检查结果"] [role="alert"]')?.textContent?.trim() ?? null,
  }));
}
async function changedHash(target, oldHash) {
  await target.waitForFunction(previous => {
    const node = document.querySelector('.report .hash');
    return node && node.textContent?.split(' ').at(-1) !== previous &&
      document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false';
  }, {}, oldHash);
  return (await state(target)).hash;
}
async function capture(label, pattern) {
  const result = await harness.capture({
    click: () => click(page, label),
    filenamePattern: pattern,
  });
  return result;
}
function assertSameReportAndSnapshot(report, snapshot, hash) {
  assert.equal(report.input_hash, hash);
  assert.equal(snapshot.assessment.input_hash, hash);
  assert.equal(snapshot.assessment.scene_revision, snapshot.scene.revision);
  assert.equal(report.scene_revision, snapshot.scene.revision);
  assert.equal(report.ruleset_version, snapshot.assessment.ruleset_version);
  assert.ok(report.findings.some(item => item.status === 'needs_review'), 'Unknown inputs remain reviewable');
  assert.ok(report.actions.information.every(item => item.status === 'needs_review'));
}
function assertDisconnected(target, address) {
  assert.ok(networkEvents.some(event => event.target === target &&
    event.url === address && event.error === 'net::ERR_INTERNET_DISCONNECTED'),
  target + ' must show a real CDP request failure for ' + address);
}
async function failureEvidence(error) {
  const context = { error: String(error), stack: error?.stack ?? null, stages, networkEvents, pageErrors,
    navigation: { responses: navigationResponses, documents: documentRequests }, initialBootstrap };
  for (const [name, target] of [['main', page], ['initial', firstPage]]) {
    if (!target || target.isClosed()) continue;
    try { context[name] = await state(target); } catch (cause) { context[name] = String(cause); }
    try { await target.screenshot({ path: resolve(output, 'failure-' + name + '.png'), fullPage: true }); }
    catch (cause) { context[name + '_screenshot'] = String(cause); }
  }
  await writeFile(resolve(output, 'failure.json'), JSON.stringify(context, null, 2) + '\n');
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  await page.setViewport({ width: 1280, height: 1000 });
  page.on('pageerror', error => pageErrors.push({ page: 'main', error: error.message }));
  await page.evaluateOnNewDocument(() => {
    window.__networkPrintCalls = 0;
    window.print = () => { window.__networkPrintCalls++; };
  });
  // This wrapper observes actual Worker lifecycle and requests. It does not
  // replace the Worker or its network path.
  await page.evaluateOnNewDocument(() => {
    const NativeWorker = window.Worker;
    window.__networkWorkers = [];
    window.__networkActive = new Set();
    window.__networkRequests = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.__networkWorkers.push(this);
        window.__networkActive.add(this);
      }
      terminate() {
        window.__networkActive.delete(this);
        return super.terminate();
      }
      postMessage(message, ...args) {
        window.__networkRequests.push({ op: message.op,
          chairZ: message.payload?.scene?.objects?.find(item => item.id === 'chair')?.position?.z ?? null });
        return super.postMessage(message, ...args);
      }
    };
  });
  cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  watchNetwork(cdp, 'page');
  harness = await createJsonDownloadHarness({ browser, cdp, downloadPath });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  recordNavigation('main', response);
  assert.ok(response?.ok(), 'Online initial document must load');
  await ready(page);
  const worker = page.workers().find(item => item.url().includes('/engine/rule-worker.mjs'));
  assert.ok(worker?.client, 'Actual module Worker CDP session is available');
  const workerCdp = worker.client;
  await workerCdp.send('Network.enable');
  await workerCdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  watchNetwork(workerCdp, 'worker');
  const initial = await state(page);
  await page.select('.toolbar select', 'chair');
  await page.click('[aria-label="向前移动"]');
  const onlineHash = await changedHash(page, initial.hash);
  stages.push({ stage: 'online_accepted', hash: onlineHash });

  // Page-level CDP emulation is also observed at the actual Worker target:
  // both independent no-store fetches must fail with a CDP loadingFailed event.
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await emulateOffline(cdp, true);
  const configUrl = new URL('engine/config.json', url).href;
  const probeUrl = new URL('engine/config.json?network-probe=offline', url).href;
  const pageProbe = await page.evaluate(async address => {
    try { return (await fetch(address, { cache: 'no-store' })).status; }
    catch (error) { return String(error); }
  }, probeUrl);
  const workerProbe = await worker.evaluate(async address => {
    try { return (await fetch(address, { cache: 'no-store' })).status; }
    catch (error) { return String(error); }
  }, probeUrl);
  assert.match(pageProbe, /Failed to fetch/);
  assert.match(workerProbe, /Failed to fetch/);
  assertDisconnected('page', probeUrl);
  assertDisconnected('worker', probeUrl);
  stages.push({ stage: 'real_offline', pageProbe, workerProbe });

  await page.click('[aria-label="向前移动"]');
  const offlineHash = await changedHash(page, onlineHash);
  await click(page, '撤销');
  await page.waitForFunction(expected => document.querySelector('.report .hash')?.textContent?.includes(expected) &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false', {}, onlineHash);
  assert.equal((await state(page)).hash, onlineHash);
  await click(page, '重做');
  await page.waitForFunction(expected => document.querySelector('.report .hash')?.textContent?.includes(expected) &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false', {}, offlineHash);
  const offline = await state(page);
  assert.equal(offline.hash, offlineHash);
  const offlineReport = (await capture('导出 JSON', REPORT_FILENAME)).json;
  const offlineSnapshot = await capture('导出场景快照', SNAPSHOT_FILENAME);
  assertSameReportAndSnapshot(offlineReport, offlineSnapshot.json, offlineHash);
  const observations = offlineReport.property_observations.flatMap(item => Object.values(item.properties));
  assert.ok(observations.some(item => item.value === true && item.verification_state === 'provided'));
  assert.ok(observations.some(item => item.value === false && item.verification_state === 'provided'));
  assert.ok(observations.some(item => item.value === null && item.verification_state === 'unknown'),
    'Unknown source data must remain unknown while offline');
  await click(page, '打印清单');
  assert.equal(await page.evaluate(() => window.__networkPrintCalls), 1,
    'Offline print action is available for the accepted report');
  const verification = JSON.parse(execFileSync(process.env.HOMESAFE_PYTHON || 'python3',
    [fileURLToPath(new URL('./check_scene_snapshot.py', import.meta.url)), offlineSnapshot.path],
    { encoding: 'utf8' }));
  assert.equal(verification.result, 'MATCHES_CURRENT_CORE');
  await writeFile(resolve(output, 'offline-report.json'), JSON.stringify(offlineReport, null, 2) + '\n');
  await writeFile(resolve(output, 'offline-snapshot.json'), offlineSnapshot.raw);
  stages.push({ stage: 'offline_edit_undo_redo_export', hash: offlineHash,
    revision: offlineReport.scene_revision, workerRequests: await page.evaluate(() => window.__networkRequests.length) });

  // A terminal Worker fault creates the retry affordance. The fault is test
  // injection; the subsequent retry uses real offline network emulation.
  const requestsBeforeFault = await page.evaluate(() => {
    const old = window.__networkWorkers.at(-1);
    old.terminate();
    old.dispatchEvent(new Event('error'));
    return window.__networkRequests.length;
  });
  await page.click('[aria-label="向前移动"]');
  await failed(page);
  assert.equal(await page.evaluate(() => window.__networkRequests.length), requestsBeforeFault,
    'The rejected proposal was never posted to the dead Worker');
  assert.equal((await state(page)).position, offline.position);
  await click(page, '重建 Worker 并重试');
  await failed(page);
  const offlineRetry = await state(page);
  assert.match(offlineRetry.failure, /Failed to fetch/);
  assert.equal(offlineRetry.hash, null, 'Offline retry cannot expose the old report');
  assertDisconnected('page', configUrl);
  assert.equal(await page.evaluate(() => window.__networkActive.size), 0);
  assert.equal(await page.evaluate(() => window.__networkWorkers.length), 1,
    'Window config fetch fails before any new Worker is created');
  stages.push({ stage: 'offline_retry_failed', failure: offlineRetry.failure });

  // Hold the online recovery config request to exercise explicit cancellation,
  // then try again on a fresh Worker.
  await emulateOffline(cdp, false);
  let heldConfig;
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/engine/config.json*', requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', event => { heldConfig = event.requestId; });
  await click(page, '重建 Worker 并重试');
  await page.waitForFunction(() => !!document.querySelector('button') &&
    [...document.querySelectorAll('button')].some(item => item.textContent?.trim() === '取消加载'));
  const holdDeadline = Date.now() + 3000;
  while (!heldConfig && Date.now() < holdDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(heldConfig, 'Online retry config request must be held before cancellation');
  await click(page, '取消加载');
  await failed(page);
  assert.match((await state(page)).failure, /已取消加载/);
  await cdp.send('Fetch.continueRequest', { requestId: heldConfig }).catch(() => {});
  await cdp.send('Fetch.disable');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal((await state(page)).hash, null, 'The cancelled config request cannot publish a report');
  assert.equal(await page.evaluate(() => window.__networkWorkers.length), 1,
    'Cancellation before config returns must not create a Worker');
  stages.push({ stage: 'cancelled_recovery', workers: 1 });

  await click(page, '重建 Worker 并重试');
  await ready(page);
  const restored = await state(page);
  assert.equal(restored.hash, offlineHash, 'Retry evaluates the last accepted scene without replaying failed proposal');
  assert.equal(restored.position, offline.position);
  assert.equal(await page.evaluate(() => window.__networkWorkers.length), 2);
  assert.equal(await page.evaluate(() => window.__networkActive.size), 1);
  const restoredReport = (await capture('导出 JSON', REPORT_FILENAME)).json;
  assert.equal(restoredReport.input_hash, offlineReport.input_hash);
  assert.equal(restoredReport.scene_revision, offlineReport.scene_revision);
  assert.equal(restoredReport.ruleset_version, offlineReport.ruleset_version);
  assert.deepEqual(restoredReport.findings.map(item => [item.key, item.status]),
    offlineReport.findings.map(item => [item.key, item.status]));
  assert.deepEqual(restoredReport.property_observations, offlineReport.property_observations,
    'True, false, unknown values and their source metadata survive network recovery');
  await click(page, '撤销');
  await page.waitForFunction(expected => document.querySelector('.report .hash')?.textContent?.includes(expected) &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false', {}, onlineHash);
  await click(page, '重做');
  await page.waitForFunction(expected => document.querySelector('.report .hash')?.textContent?.includes(expected) &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false', {}, offlineHash);
  stages.push({ stage: 'online_restored_fresh_worker', hash: restored.hash,
    revision: restoredReport.scene_revision });

  // A new document can be loaded online while its first config request is
  // held. Going offline before that request continues tests initial app
  // startup failure, without claiming that the HTML itself works offline.
  firstPage = await browser.newPage();
  firstPage.setDefaultTimeout(30_000);
  firstPage.on('pageerror', error => pageErrors.push({ page: 'initial', error: error.message }));
  firstCdp = await firstPage.createCDPSession();
  await firstCdp.send('Network.enable');
  await firstCdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  watchNetwork(firstCdp, 'initial-page');
  let firstHeld;
  firstCdp.on('Fetch.requestPaused', event => { firstHeld = event.requestId; });
  await firstCdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/engine/config.json*', requestStage: 'Request' }] });
  // Register before navigation and read complete JSON bodies. Header-only
  // network-idle accounting cannot prove parallel bootstrap bodies finished.
  const bootstrapBodies = ['engine/scene-before.json', 'engine/scene-main-challenge.json', 'engine/assets.json']
    .map(async path => {
      const address = new URL(path, url).href;
      try {
        const resource = await firstPage.waitForResponse(item => item.url() === address);
        assert.ok(resource.ok(), `Bootstrap resource must load: ${address}`);
        await resource.json();
        const result = { url: address, status: resource.status(), body_complete: true };
        initialBootstrap.push(result); return result;
      } catch (error) {
        const result = { url: address, body_complete: false, error: String(error) };
        initialBootstrap.push(result); return result;
      }
    });
  const firstResponse = await firstPage.goto(url, { waitUntil: 'domcontentloaded' });
  recordNavigation('initial', firstResponse);
  assert.ok(firstResponse?.ok());
  const firstDeadline = Date.now() + 3000;
  while (!firstHeld && Date.now() < firstDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(firstHeld, 'First startup config request must be held');
  // Only config may remain in flight before the intended offline failure.
  for (const resource of await Promise.all(bootstrapBodies)) {
    assert.equal(resource.body_complete, true, `Bootstrap body incomplete: ${resource.url}: ${resource.error ?? ''}`);
  }
  await emulateOffline(firstCdp, true);
  await firstCdp.send('Fetch.continueRequest', { requestId: firstHeld });
  await firstCdp.send('Fetch.disable');
  await failed(firstPage);
  const firstFailed = await state(firstPage);
  assert.match(firstFailed.failure, /Failed to fetch/);
  assert.equal(firstPage.workers().length, 0);
  assertDisconnected('initial-page', configUrl);
  stages.push({ stage: 'initial_config_offline_failed', failure: firstFailed.failure });
  await emulateOffline(firstCdp, false);
  await click(firstPage, '重建 Worker 并重试');
  await ready(firstPage);
  assert.equal(firstPage.workers().length, 1, 'Explicit online retry starts a real Worker');
  stages.push({ stage: 'initial_online_retry_ready', hash: (await state(firstPage)).hash });

  assert.deepEqual(pageErrors, []);
  const receipt = { result: 'PASS', scope: 'ISOLATED_CHROMIUM_LOCALHOST_NETWORK_INTERRUPTION',
    url, browser: await browser.version(), executed_at: new Date().toISOString(), stages,
    networkEvents, navigation: { responses: navigationResponses, documents: documentRequests }, initialBootstrap,
    snapshotVerification: verification.result,
    faultInjection: 'Terminal Worker error, config-request holds, and print-call counting are test injection; offline transport is CDP Network emulation with observed failed requests in page and Worker targets.',
    limitations: ['Loaded session only; no offline cold start or service worker',
      'localhost Chromium only; not a public/other network, Safari, or Edge',
      'Offline explicit retry fails at window config fetch before a new Worker/WASM download'],
  };
  await writeFile(resolve(output, 'network-recovery.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  passed = true;
} catch (error) {
  console.error('NETWORK_NAVIGATION_DIAGNOSTICS ' + JSON.stringify({ responses: navigationResponses, documents: documentRequests, initialBootstrap }));
  try { await failureEvidence(error); } catch (cause) { console.error('Could not preserve failure context:', cause); }
  throw error;
} finally {
  if (!passed) retainedDownloads = await retainFailedDownloads(downloadPath, output);
  harness?.close();
  await firstCdp?.detach().catch(() => {});
  await cdp?.detach().catch(() => {});
  await browser.close();
  if (passed) await rm(downloadPath, { recursive: true, force: true });
  else await retainFailedDownloads(downloadPath, output, { announce: false, destination: retainedDownloads });
}
