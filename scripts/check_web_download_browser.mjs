// Small real-Chromium regression for the shared JSON download protocol.
// node scripts/check_web_download_browser.mjs CHROMIUM PUPPETEER_ENTRY [OUTPUT_DIR]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJsonDownloadHarness, retainFailedDownloads } from './web_download.mjs';

const [executablePath, entry, outputDirectory] = process.argv.slice(2);
if (!executablePath || !entry) throw new Error('Pass Chromium and puppeteer-core entry');
const { default: puppeteer } = await import(pathToFileURL(resolve(entry)).href);
const server = createServer((request, response) => {
  if (request.url === '/slow') {
    response.writeHead(200, { 'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="partial.json"', 'Content-Length': '1048576' });
    response.write('{"partial":');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><button id="export">Export</button><a id="slow" href="/slow">Partial</a><script>
    let sequence = 0;
    document.querySelector('#export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ sequence: ++sequence })], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'same.json'; document.body.append(link);
      link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  </script>`);
});
const downloads = await mkdtemp(join(tmpdir(), 'homesafe-download-browser-'));
let browser;
let cdp;
let harness;
let passed = false;
let retainedDownloads;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await puppeteer.launch({ executablePath, headless: true,
    args: [...(process.env.CI ? ['--no-sandbox'] : [])] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  cdp = await page.createCDPSession();
  harness = await createJsonDownloadHarness({ browser, cdp, downloadPath: downloads });
  const otherPage = await browser.newPage();
  await otherPage.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  const otherCdp = await otherPage.createCDPSession();
  await assert.rejects(createJsonDownloadHarness({ browser, cdp: otherCdp, downloadPath: downloads }),
    /already owns this browser/i);
  await otherCdp.detach();
  await otherPage.close();
  // An old, empty suggested-name file must not be selected.
  await writeFile(join(downloads, 'same.json'), '');
  const first = await harness.capture({ click: () => page.click('#export'), filenamePattern: /^same\.json$/ });
  const second = await harness.capture({ click: () => page.click('#export'), filenamePattern: /^same\.json$/ });
  assert.deepEqual([first.json, second.json], [{ sequence: 1 }, { sequence: 2 }]);
  assert.equal(first.filename, second.filename);
  assert.notEqual(first.guid, second.guid);
  assert.equal(basename(first.path), first.guid);
  assert.equal(basename(second.path), second.guid);
  assert.equal(await readFile(first.path, 'utf8'), first.raw);
  assert.equal(await readFile(second.path, 'utf8'), second.raw);
  assert.equal(cdp.listenerCount('Browser.downloadWillBegin'), 0);
  assert.equal(cdp.listenerCount('Browser.downloadProgress'), 0);
  const browserVersion = await browser.version();
  await assert.rejects(harness.capture({ click: () => page.click('#slow'),
    filenamePattern: /^partial\.json$/, completeTimeoutMs: 300 }), /completion timed out/i);
  const partialName = (await readdir(downloads)).find(name => name.endsWith('.crdownload'));
  assert.ok(partialName, 'Chromium exposes a partial GUID download before browser close');
  const partialBytes = await readFile(join(downloads, partialName), 'utf8');
  assert.equal(partialBytes, '{"partial":');
  const safeDirectory = await mkdtemp(join(tmpdir(), 'homesafe-download-safe-copy-'));
  const retained = await retainFailedDownloads(downloads, safeDirectory, { announce: false });
  assert.equal(await readFile(join(retained, partialName), 'utf8'), partialBytes);
  assert.match(await readFile(join(retained, 'download-events.jsonl'), 'utf8'), /completion timed out/);
  await browser.close();
  assert.equal(await readFile(join(retained, partialName), 'utf8'), partialBytes,
    'The pre-close copy survives Chromium cleanup of an incomplete download');
  await rm(safeDirectory, { recursive: true, force: true });
  const result = { result: 'PASS', scope: 'ISOLATED_LOCAL_CHROMIUM_DOWNLOAD_PROTOCOL',
    browser: browserVersion, filenames: [first.filename, second.filename],
    guids: [first.guid, second.guid], checks: ['completed GUID files', 'same-name consecutive exports',
      'early empty suggested-name file ignored', 'second page cannot override browser download behavior',
      'listeners released',
      'incomplete GUID bytes retained before Chromium closes'] };
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, 'download-browser.json'), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
  passed = true;
} finally {
  if (!passed) retainedDownloads = await retainFailedDownloads(downloads, outputDirectory);
  harness?.close();
  await cdp?.detach().catch(() => {});
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  if (passed) await rm(downloads, { recursive: true, force: true });
  else await retainFailedDownloads(downloads, outputDirectory, { announce: false, destination: retainedDownloads });
}
