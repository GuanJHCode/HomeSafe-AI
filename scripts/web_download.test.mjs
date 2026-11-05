import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME, retainFailedDownloads } from './web_download.mjs';

const guid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

class FakeCDP extends EventEmitter {
  calls = [];
  async send(command, params) {
    this.calls.push({ command, params });
    if (command === 'Page.getFrameTree') return { frameTree: { frame: { id: 'app-frame' } } };
    return {};
  }
  begin(id, filename = 'report.json', frameId = 'app-frame') {
    this.emit('Browser.downloadWillBegin', { guid: guid(id), suggestedFilename: filename, frameId, url: 'blob:http://localhost/report' });
  }
  progress(id, state) {
    this.emit('Browser.downloadProgress', { guid: guid(id), state, receivedBytes: 12, totalBytes: 12 });
  }
}

async function fixture(run) {
  const downloadPath = await mkdtemp(join(tmpdir(), 'homesafe-download-test-'));
  const cdp = new FakeCDP();
  const browser = {};
  const harness = await createJsonDownloadHarness({ browser, cdp, downloadPath });
  const capture = (click, options = {}) => harness.capture({ click, filenamePattern: /^report\.json$/,
    startTimeoutMs: 60, completeTimeoutMs: 60, ...options });
  try { await run({ browser, cdp, harness, capture, downloadPath }); }
  finally { harness.close(); await rm(downloadPath, { recursive: true, force: true }); }
}

test('an early empty final file is not parsed until CDP confirms completion', () => fixture(async ({ cdp, capture, downloadPath }) => {
  const path = join(downloadPath, guid(1));
  await writeFile(path, '');
  await writeFile(join(downloadPath, 'report.json'), '');
  let complete;
  const pending = capture(async () => {
    cdp.begin(1);
    complete = new Promise(resolve => setTimeout(resolve, 15)).then(async () => {
      await writeFile(path, '{"value":1}');
      cdp.progress(1, 'completed');
    });
  });
  let result;
  try { result = await pending; } finally { await complete; }
  assert.deepEqual(result.json, { value: 1 });
  assert.equal(result.path, path);
  assert.equal(result.filename, 'report.json');
  assert.equal(await readFile(path, 'utf8'), '{"value":1}');
}));

test('completion before start and duplicate events bind to one GUID', () => fixture(async ({ cdp, capture, downloadPath }) => {
  await writeFile(join(downloadPath, guid(2)), '{"fast":true}');
  const result = await capture(() => {
    cdp.progress(2, 'completed');
    cdp.begin(2);
    cdp.begin(2);
    cdp.progress(2, 'completed');
  });
  assert.deepEqual(result.json, { fast: true });
  assert.equal(result.guid, guid(2));
}));

test('a duplicate terminal event cannot overturn the first completed state', () => fixture(async ({ cdp, capture, downloadPath }) => {
  await writeFile(join(downloadPath, guid(19)), '{"complete":true}');
  const result = await capture(() => {
    cdp.begin(19);
    cdp.progress(19, 'completed');
    cdp.progress(19, 'canceled');
  });
  assert.equal(result.json.complete, true);
}));

test('other frames, other filenames, and unrelated progress cannot claim a download', () => fixture(async ({ cdp, capture, downloadPath }) => {
  await writeFile(join(downloadPath, guid(3)), '{"wrong":true}');
  await writeFile(join(downloadPath, guid(4)), '{"right":true}');
  const result = await capture(() => {
    cdp.begin(3, 'report.json', 'other-frame');
    cdp.progress(3, 'completed');
    cdp.begin(5, 'other.json');
    cdp.progress(5, 'completed');
    cdp.begin(4);
    cdp.progress(4, 'completed');
  });
  assert.equal(result.guid, guid(4));
  assert.deepEqual(result.json, { right: true });
}));

test('same suggested filename works for sequential downloads because paths use GUIDs', () => fixture(async ({ cdp, capture, downloadPath }) => {
  for (const id of [6, 7]) await writeFile(join(downloadPath, guid(id)), `{"id":${id}}`);
  const first = await capture(() => { cdp.begin(6); cdp.progress(6, 'completed'); });
  const second = await capture(() => {
    cdp.begin(6); cdp.progress(6, 'completed'); // Late duplicate from prior capture.
    cdp.begin(7); cdp.progress(7, 'completed');
  });
  assert.equal(first.filename, second.filename);
  assert.notEqual(first.path, second.path);
  assert.deepEqual([first.json, second.json], [{ id: 6 }, { id: 7 }]);
}));

test('unsafe concurrent captures are rejected without disturbing the first', () => fixture(async ({ cdp, capture, downloadPath }) => {
  await writeFile(join(downloadPath, guid(8)), '{"id":8}');
  const first = capture(() => { cdp.begin(8); });
  await assert.rejects(capture(() => { throw new Error('must not click'); }), /already active/i);
  cdp.progress(8, 'completed');
  assert.equal((await first).json.id, 8);
}));

test('two matching starts are rejected as ambiguous', () => fixture(async ({ cdp, capture }) => {
  await assert.rejects(capture(() => { cdp.begin(9); cdp.begin(10); }), /ambiguous/i);
}));

test('cancel and start timeout fail clearly and require a fresh page', async () => {
  await fixture(async ({ cdp, capture, downloadPath }) => {
    await assert.rejects(capture(() => { cdp.begin(11); cdp.progress(11, 'canceled'); }), /canceled/i);
    await assert.rejects(capture(() => {}), /fresh page/i);
    assert.match(await readFile(join(downloadPath, 'download-events.jsonl'), 'utf8'), /Download canceled/);
  });
  await fixture(async ({ capture }) => {
    await assert.rejects(capture(() => {}, { startTimeoutMs: 12 }), /start.*timed out/i);
  });
});

test('completion timeout and corrupt JSON preserve the raw artifact', async () => {
  await fixture(async ({ cdp, capture, downloadPath }) => {
    await writeFile(join(downloadPath, guid(12)), 'partial');
    await assert.rejects(capture(() => { cdp.begin(12); }, { completeTimeoutMs: 12 }), /completion.*timed out/i);
    assert.equal(await readFile(join(downloadPath, guid(12)), 'utf8'), 'partial');
  });
  await fixture(async ({ cdp, capture, downloadPath }) => {
    await writeFile(join(downloadPath, guid(13)), '{invalid');
    await assert.rejects(capture(() => { cdp.begin(13); cdp.progress(13, 'completed'); }), /invalid JSON.*000000000013/i);
    assert.equal(await readFile(join(downloadPath, guid(13)), 'utf8'), '{invalid');
  });
  await fixture(async ({ cdp, capture, downloadPath }) => {
    await writeFile(join(downloadPath, guid(16)), '');
    await assert.rejects(capture(() => { cdp.begin(16); cdp.progress(16, 'completed'); }), /empty JSON.*000000000016/i);
    assert.equal(await readFile(join(downloadPath, guid(16)), 'utf8'), '');
  });
});

test('failed click releases subscriptions and a fresh harness can retry', async () => {
  await fixture(async ({ cdp, capture }) => {
    await assert.rejects(capture(() => { throw new Error('button missing'); }), /button missing/);
    assert.equal(cdp.listenerCount('Browser.downloadWillBegin'), 0);
    assert.equal(cdp.listenerCount('Browser.downloadProgress'), 0);
  });
  await fixture(async ({ cdp, capture, downloadPath }) => {
    await writeFile(join(downloadPath, guid(14)), '{"retried":true}');
    assert.equal((await capture(() => { cdp.begin(14); cdp.progress(14, 'completed'); })).json.retried, true);
  });
});

test('close aborts an active capture and removes listeners', () => fixture(async ({ cdp, harness, capture }) => {
  const pending = capture(() => {});
  await new Promise(resolve => setImmediate(resolve));
  harness.close();
  await assert.rejects(pending, /closed/i);
  assert.equal(cdp.listenerCount('Browser.downloadWillBegin'), 0);
  assert.equal(cdp.listenerCount('Browser.downloadProgress'), 0);
}));

test('a completed download cannot wait forever for a stuck click promise', () => fixture(async ({ cdp, capture, downloadPath }) => {
  await writeFile(join(downloadPath, guid(15)), '{"ready":true}');
  await assert.rejects(capture(() => {
    cdp.begin(15);
    cdp.progress(15, 'completed');
    return new Promise(() => {});
  }, { clickTimeoutMs: 12 }), /click timed out/i);
  assert.equal(cdp.listenerCount('Browser.downloadWillBegin'), 0);
}));

test('close and start deadline also bound a stalled frame lookup', async () => {
  await fixture(async ({ cdp, harness, capture }) => {
    cdp.send = async command => command === 'Page.getFrameTree' ? new Promise(() => {}) : {};
    const pending = capture(() => {});
    await new Promise(resolve => setImmediate(resolve));
    harness.close();
    await assert.rejects(pending, /closed/i);
  });
  await fixture(async ({ cdp, capture }) => {
    cdp.send = async command => command === 'Page.getFrameTree' ? new Promise(() => {}) : {};
    await assert.rejects(capture(() => {}, { startTimeoutMs: 12 }), /start timed out/i);
  });
});

test('browser behavior uses GUID filenames and report/snapshot names stay distinct', () => fixture(async ({ cdp }) => {
  assert.deepEqual(cdp.calls[0], { command: 'Browser.setDownloadBehavior',
    params: { behavior: 'allowAndName', downloadPath: cdp.calls[0].params.downloadPath, eventsEnabled: true } });
  const suffix = 'v12-123456789abc-2026-11-05T02-10-30-123Z-7.json';
  assert.match(`homesafe-action-list-${suffix}`, REPORT_FILENAME);
  assert.doesNotMatch(`homesafe-scene-${suffix}`, REPORT_FILENAME);
  assert.match(`homesafe-scene-${suffix}`, SNAPSHOT_FILENAME);
  assert.doesNotMatch('other.json', SNAPSHOT_FILENAME);
}));

test('one browser rejects a second harness before it changes global download behavior', () => fixture(async ({ browser, cdp, harness, downloadPath }) => {
  const second = new FakeCDP();
  await assert.rejects(createJsonDownloadHarness({ browser, cdp: second, downloadPath }), /already owns this browser/i);
  assert.equal(second.calls.length, 0);
  harness.close();
  const replacement = await createJsonDownloadHarness({ browser, cdp: second, downloadPath });
  harness.close(); // A stale close must not release the replacement owner.
  await assert.rejects(createJsonDownloadHarness({ browser, cdp, downloadPath }), /already owns this browser/i);
  replacement.close();
}));

test('concurrent factory setup reserves ownership and setup failure rolls it back', async () => {
  const browser = {};
  const cdp = new FakeCDP();
  const downloadPath = await mkdtemp(join(tmpdir(), 'homesafe-download-ownership-'));
  try {
    let releaseSetup;
    cdp.send = async command => {
      if (command === 'Browser.setDownloadBehavior') return new Promise(resolve => { releaseSetup = resolve; });
      return { frameTree: { frame: { id: 'app-frame' } } };
    };
    const pending = createJsonDownloadHarness({ browser, cdp, downloadPath });
    await assert.rejects(createJsonDownloadHarness({ browser, cdp: new FakeCDP(), downloadPath }), /already owns/i);
    releaseSetup({});
    (await pending).close();
    const failing = new FakeCDP();
    failing.send = async () => { throw new Error('CDP setup failed'); };
    await assert.rejects(createJsonDownloadHarness({ browser, cdp: failing, downloadPath }), /CDP setup failed/);
    (await createJsonDownloadHarness({ browser, cdp: new FakeCDP(), downloadPath })).close();
  } finally { await rm(downloadPath, { recursive: true, force: true }); }
});

test('failed run copies GUID bytes into the evidence directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'homesafe-download-evidence-'));
  try {
    const downloadPath = join(root, 'downloads');
    const outputDirectory = join(root, 'evidence');
    await mkdir(downloadPath);
    await writeFile(join(downloadPath, guid(17)), '{partial');
    const location = await retainFailedDownloads(downloadPath, outputDirectory);
    assert.match(location, new RegExp(`^${outputDirectory}/failed-downloads-`));
    assert.equal(await readFile(join(location, guid(17)), 'utf8'), '{partial');
    assert.equal(await readFile(join(downloadPath, guid(17)), 'utf8'), '{partial');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('local failure copies partial bytes outside Chromium download directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'homesafe-download-local-'));
  let retained;
  try {
    await writeFile(join(root, `${guid(18)}.crdownload`), '{"partial":');
    retained = await retainFailedDownloads(root);
    assert.notEqual(retained, root);
    assert.equal(await readFile(join(retained, `${guid(18)}.crdownload`), 'utf8'), '{"partial":');
    await rm(root, { recursive: true, force: true }); // Simulates Chromium deleting its managed directory.
    assert.equal(await readFile(join(retained, `${guid(18)}.crdownload`), 'utf8'), '{"partial":');
  } finally {
    await rm(root, { recursive: true, force: true });
    if (retained) await rm(retained, { recursive: true, force: true });
  }
});
