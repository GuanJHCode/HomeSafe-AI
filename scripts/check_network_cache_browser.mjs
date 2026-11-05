// Deterministic HTTP revalidation regression for the controlled-network harness.
// Uses only the built placeholder dist, isolated Chromium and loopback HTTP.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const [chrome, driver, requested] = process.argv.slice(2);
if (!chrome || !driver || !requested) throw new Error('Pass Chromium, driver and a new output directory');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'apps/web/dist'), output = resolve(requested);
await access(output).then(() => { throw new Error('Output already exists'); }, error => {
  if (error.code !== 'ENOENT') throw error;
});
assert.deepEqual(JSON.parse(await readFile(resolve(dist, 'engine/assets.json'), 'utf8')), [],
  'Cache fixture requires the placeholder-only build');
await mkdir(output, { recursive: true });
const original = await readFile(resolve(root, 'scripts/check_web_network_recovery.mjs'), 'utf8');
const disable = "  await firstCdp.send('Network.setCacheDisabled', { cacheDisabled: true });\n";
assert.equal(original.split(disable).length - 1, 1, 'Expected one secondary-page cache setup');
// Replay only the former ordering. Do not weaken any navigation/offline/retry
// assertions. The extra import rewrites merely locate helpers from this private copy.
const replay = original.replace(disable, '').replace('  await emulateOffline(firstCdp, true);',
  disable + '  await emulateOffline(firstCdp, true);')
  .replace("from './web_download.mjs'", `from ${JSON.stringify(pathToFileURL(resolve(root, 'scripts/web_download.mjs')).href)}`)
  .replace("fileURLToPath(new URL('./check_scene_snapshot.py', import.meta.url))",
    JSON.stringify(resolve(root, 'scripts/check_scene_snapshot.py')));
const replayPath = resolve(output, 'old-order-replay.mjs');
await writeFile(replayPath, replay);

const documentRequests = [], cases = [], delayedBodies = [];
const delayedOnce = new Set();
const lastModified = 'Wed, 01 Jan 2020 00:00:00 GMT';
let scenario = '';
const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.zip': 'application/zip' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const document = pathname === '/preview/';
  const record = document ? { scenario, if_modified_since: req.headers['if-modified-since'] ?? null,
    if_none_match: req.headers['if-none-match'] ?? null, cache_control: req.headers['cache-control'] ?? null } : undefined;
  if (record) documentRequests.push(record);
  try {
    if (!pathname.startsWith('/preview/')) { res.writeHead(404); res.end(); return; }
    if (document && ['http404', 'http500'].includes(scenario)) {
      const status = scenario === 'http404' ? 404 : 500; record.status = status;
      res.writeHead(status, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><title>Controlled document failure</title>'); return;
    }
    const name = document ? 'index.html' : decodeURIComponent(pathname.slice('/preview/'.length));
    const path = resolve(dist, name);
    if (!path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(path);
    if (document) {
      const etag = '"' + createHash('sha256').update(body).digest('hex') + '"';
      const headers = { 'Content-Type': 'text/html', 'Cache-Control': 'max-age=0, must-revalidate',
        'Last-Modified': lastModified, ETag: etag };
      if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === lastModified) {
        record.status = 304; res.writeHead(304, headers); res.end(); return;
      }
      record.status = 200; res.writeHead(200, { ...headers, 'Content-Length': body.length });
    } else {
      res.writeHead(200, { 'Content-Type': mimes[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-store', 'Content-Length': body.length });
      if (scenario === 'slow-bootstrap-body' && pathname.endsWith('/engine/assets.json') &&
          documentRequests.filter(item => item.scenario === scenario).length === 2 && !delayedOnce.has(pathname)) {
        delayedOnce.add(pathname);
        const delayed = { path: pathname, headers_sent_at: new Date().toISOString(), body_finished: false };
        delayedBodies.push(delayed); res.write(body.subarray(0, 1));
        // Controlled fixture latency, not a sleep used to make the product test pass.
        await new Promise(done => setTimeout(done, 1000));
        res.end(body.subarray(1)); delayed.body_finished = true;
        delayed.body_finished_at = new Date().toISOString(); return;
      }
    }
    res.end(body);
  } catch (error) {
    if (record) record.status = 404;
    if (!res.headersSent) res.writeHead(404); res.end();
  }
});
try {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  for (const name of ['old-order', 'pre-navigation-disabled', 'slow-bootstrap-body', 'http404', 'http500']) {
    scenario = name;
    const folder = resolve(output, name), start = documentRequests.length;
    const script = name === 'old-order' ? replayPath : resolve(root, 'scripts/check_web_network_recovery.mjs');
    const run = await execute(script, url, folder);
    const documents = documentRequests.slice(start);
    const receipt = JSON.parse(await readFile(resolve(folder, run.code === 0 ? 'network-recovery.json' : 'failure.json'), 'utf8'));
    cases.push({ name, exit_code: run.code, browser: receipt.browser ?? null, documents, stage_count: receipt.stages.length,
      navigation: receipt.navigation, snapshot_verification: receipt.snapshotVerification ?? null });
    if (name === 'old-order') {
      assert.equal(run.code, 1, 'Former order must fail the unchanged success assertion');
      assert.deepEqual(documents.map(item => item.status), [200, 304]);
      assert.equal(receipt.navigation.responses.at(-1).status, 304);
      assert.equal(receipt.navigation.responses.at(-1).ok, false);
      assert.equal(receipt.stages.length, 6);
    } else if (['pre-navigation-disabled', 'slow-bootstrap-body'].includes(name)) {
      assert.equal(run.code, 0, 'Pre-navigation cache setup must pass the entire harness');
      assert.deepEqual(documents.map(item => item.status), [200, 200]);
      assert.equal(documents[1].if_none_match, null); assert.equal(documents[1].if_modified_since, null);
      assert.equal(receipt.navigation.responses.at(-1).status, 200);
      assert.equal(receipt.stages.length, 8);
      assert.equal(receipt.snapshotVerification, 'MATCHES_CURRENT_CORE');
      for (const target of ['page', 'worker', 'initial-page']) {
        assert.ok(receipt.networkEvents.some(event => event.target === target && event.error === 'net::ERR_INTERNET_DISCONNECTED'));
      }
      assert.equal(receipt.initialBootstrap.length, 3);
      assert.ok(receipt.initialBootstrap.every(item => item.body_complete));
      if (name === 'slow-bootstrap-body') {
        assert.equal(delayedBodies.length, 1); assert.equal(delayedBodies[0].body_finished, true);
      }
    } else {
      const expected = name === 'http404' ? 404 : 500;
      assert.equal(run.code, 1, 'Real error documents must remain rejected');
      assert.equal(receipt.navigation.responses[0].status, expected);
      assert.equal(receipt.navigation.responses[0].ok, false);
      assert.ok(run.stderr.includes('NETWORK_NAVIGATION_DIAGNOSTICS'), 'HTTP diagnostics must survive missing artifacts');
    }
  }
  const result = { result: 'PASS', scope: 'DETERMINISTIC_LOOPBACK_CACHE_REVALIDATION',
    browser: cases.find(item => item.name === 'pre-navigation-disabled').browser,
    executed_at: new Date().toISOString(), current_script_sha256: createHash('sha256').update(original).digest('hex'),
    replay_source_sha256: createHash('sha256').update(replay).digest('hex'),
    replay: 'Current script with secondary cache disable moved back after navigation; helper imports relocated only',
    cache_fixture: 'HTML max-age=0,must-revalidate; fixed Last-Modified and content ETag; only conditional requests return304',
    cases, delayedBodies, original_ci_status: '304_HIGH_CONFIDENCE_INFERENCE_ORIGINAL_ARTIFACT_NOT_AVAILABLE',
    public_deployment: 'NOT_RUN', performance: 'NOT_MEASURED' };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(resolve(output, 'regression-failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), cases, documentRequests }, null, 2) + '\n');
  throw error;
} finally { await new Promise(done => server.close(done)); }

async function execute(script, url, folder) {
  await mkdir(folder);
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script, url, resolve(chrome), resolve(driver), folder],
      { cwd: root, timeout: 180000, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', async code => {
      try {
        await writeFile(resolve(folder, 'stdout.txt'), stdout); await writeFile(resolve(folder, 'stderr.txt'), stderr);
        done({ code, stderr });
      } catch (error) { reject(error); }
    });
  });
}
