// Genuine, repeatable browser interaction. Rule conclusions are read from actual
// downloads and replayed through Python, never recomputed or injected here.
// Every output is private, even when testing the public placeholder preview.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { privateOutputPath } from './private_asset_inputs.mjs';
import { loadPrivateMaterialInputs, attachPrivateMaterialInputs } from './private_materials_inputs.mjs';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME } from './web_download.mjs';
import { SCENE_BOUNDARY, RULE_BOUNDARY } from '../apps/web/src/domain/DemoContent.ts';
import { checkLocalReviewTransport } from './local_review_transport.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  ...Object.fromEntries(['url', 'chrome', 'driver', 'python', 'output', 'expected-head',
    'private-models', 'source-receipt'].map(name => [name, { type: 'string' }])),
  recording: { type: 'boolean', default: false },
  'local-review': { type: 'boolean', default: false },
} });
for (const name of ['url', 'chrome', 'driver', 'python', 'output', 'expected-head']) assert.ok(values[name], `Required --${name}`);
const url = new URL(values.url);
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
  && url.pathname.endsWith('/preview/'), 'Use the loopback /preview/ only');
const output = await privateOutputPath(root, values.output);
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git(['rev-parse', 'HEAD']), values['expected-head']);
const roots = ['apps/web/src', 'apps/web/index.html', 'apps/web/package.json', 'apps/web/package-lock.json',
  'reference/homesafe_core', 'contracts/frontend', 'scripts/check_web_risk_case.mjs',
  'scripts/check_deployment.py', 'scripts/check_scene_snapshot.py', 'scripts/check_lux3d_source_bundle.py',
  'scripts/private_materials_inputs.mjs', 'scripts/private_asset_inputs.mjs', 'scripts/web_download.mjs',
  'scripts/capture_ffmpeg_fast.py', 'scripts/local_review_transport.mjs',
  'scripts/serve_local_asset_review.py', 'review-assets/2026-11-09/local-review.json'];
const paths = flags => execFileSync('git', ['ls-files', ...flags, '-z', '--', ...roots], { cwd: root })
  .toString().split('\0').filter(Boolean);
const sourceFiles = [...new Set([...paths([]), ...paths(['--others', '--exclude-standard'])])].sort();
const hash = raw => createHash('sha256').update(raw).digest('hex');
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, hash(await readFile(resolve(root, path)))])));
const sourceStatus = git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...roots]);
// A run against uncommitted source is useful during development but is labelled
// as such. Final delivery reruns this against a frozen source commit.
const privateInputs = values['private-models'] ? await loadPrivateMaterialInputs(values['private-models']) : null;
assert.ok(!(privateInputs && values['local-review']), 'Choose local review or the historical private overlay');
assert.equal(Boolean(values['source-receipt']), Boolean(privateInputs), 'Private model runs require their source receipt');
let sourceReceipt;
if (privateInputs) {
  const bytes = await readFile(resolve(values['source-receipt']));
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.status, 'PASS_RETAINED_FILE_CONSISTENCY');
  assert.equal(receipt.platform_attestation_verified, false);
  assert.equal(receipt.public_redistribution_approved, false);
  for (const model of privateInputs.evidence.models) {
    const original = receipt.models.find(item => item.object_id === model.id);
    assert.equal(original?.original_model.sha256, model.original_sha256);
    assert.ok(original.reference_image.sha256 && original.source_record.sha256);
  }
  sourceReceipt = { sha256: hash(bytes), receipt };
}
assert.deepEqual(JSON.parse(await readFile(resolve(root, 'apps/web/dist/engine/assets.json'))), []);
await mkdir(output, { recursive: true });
const transport = values['local-review'] ? await checkLocalReviewTransport(url.href) : JSON.parse(execFileSync(values.python, [resolve(root, 'scripts/check_deployment.py'),
  '--url', url.href, '--dist', resolve(root, 'apps/web/dist'), '--output', resolve(output, 'loopback-transport.json'),
  '--allow-local-http'], { cwd: root, encoding: 'utf8' }));
assert.equal(transport.result, 'PASS');
assert.equal(transport.scope, values['local-review'] ? 'LOCAL_REVIEW_HTTP_BYTES_ONLY' : 'LOCAL_HTTP_TRANSPORT_ONLY');
if (values['local-review']) assert.equal(transport.manifest.config_sha256,
  hash(await readFile(resolve(root, 'review-assets/2026-11-09/local-review.json'))), 'Served calibration config must match this checkout');
if (values['local-review']) assert.equal(transport.manifest.source_head, values['expected-head'],
  'Restart the review server for the expected source commit');
if (values['local-review']) await persistTransport();
async function persistTransport() { await writeFile(resolve(output, 'loopback-transport.json'), JSON.stringify(transport, null, 2) + '\n'); }
const { default: puppeteer } = await import(pathToFileURL(resolve(values.driver)).href);
const browser = await puppeteer.launch({ executablePath: resolve(values.chrome), headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const page = await browser.newPage();
await page.setViewport({ width: 1480, height: 1100, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
const errors = [], phases = [], external = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  const address = new URL(request.url());
  if (['http:', 'https:'].includes(address.protocol) && address.origin !== url.origin) external.push(address.origin);
});
let binding, downloads, recording, started, completed = false;
const persist = (name, data) => writeFile(resolve(output, name), JSON.stringify(data, null, 2) + '\n');
try {
  if (privateInputs) binding = await attachPrivateMaterialInputs(page, url.href, privateInputs);
  const cdp = await page.createCDPSession();
  downloads = await createJsonDownloadHarness({ browser, cdp, downloadPath: output });
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok()); await ready();
  await page.waitForSelector('canvas[aria-label="样例客厅三维场景"]');
  if (privateInputs || values['local-review']) await page.waitForFunction(() => /已加载 2 件模型/.test(document.querySelector('.scene-panel')?.textContent)
    && !/件加载中|件加载失败/.test(document.querySelector('.scene-panel')?.textContent));
  else assert.match(await text('.scene-panel'), /已加载 0 件模型/);
  if (values['local-review']) assert.match(await text('[data-testid="local-asset-review"]'), /许可未核实/);
  assert.equal(await text('[data-testid="capability-boundary"]'), SCENE_BOUNDARY);
  await page.click('[data-testid="risk-case-guide"] summary');
  assert.equal(await page.$$eval('[data-testid="risk-case-guide"] li', nodes => nodes.length), 5);
  await page.click('[data-testid="risk-case-guide"] summary');
  started = performance.now();
  if (values.recording) recording = await page.screencast({ path: resolve(output, 'browser-original.webm'), fps: 25,
    ffmpegPath: resolve(root, 'scripts/capture_ffmpeg_fast.py') });

  await page.click('[data-testid="start-risk-case"]'); await ready();
  await page.click('[data-testid="asset-source-boundary"] summary');
  assert.match(await text('[data-testid="asset-source-boundary"]'), privateInputs || values['local-review'] ? /来源标签.*分别核对/ : /占位形状/);
  const initial = await capture('01-initial', 'chair', 'triggered', 'not_triggered');
  assert.match(initial.counts, /操作 0 步.*非法尝试 0 次/);
  await drag({ x: 5.3, z: 3.3 }, { x: 3, z: 2 }, 0.4); await ready();
  const conflict = await capture('02-tradeoff', 'chair', 'not_triggered', 'triggered');
  assert.match(conflict.comparison, /双角色取舍/);
  const conflictHash = conflict.input_hash;
  await click('儿童视角'); await click('老人视角');
  assert.equal(await currentHash(), conflictHash, 'Camera and role focus must preserve input');
  await click('俯看客厅');
  await click('撤销'); await ready();
  await capture('03-undo', 'chair', 'triggered', 'not_triggered');
  // Reset while already in the same mode and with a focused finding/camera.
  await page.click('.finding-list .finding-title');
  await page.click('[data-testid="start-risk-case"]'); await ready();
  const restarted = await capture('04-same-mode-restart', 'chair', 'triggered', 'not_triggered');
  assert.match(restarted.counts, /操作 0 步.*非法尝试 0 次.*取舍 0 次/);
  await drag({ x: 5.3, z: 3.3 }, { x: 3, z: 0.6 }, 0.4); await ready();
  const improved = await capture('05-window-goal', 'chair', 'not_triggered', 'not_triggered');
  assert.match(improved.summary, /本关布局目标已完成/);
  assert.equal(improved.report.findings.find(f => f.rule_id === 'R002').status, 'needs_review');
  assert.ok(improved.report.actions.information.some(f => f.rule_id === 'R002' && /防护/.test(f.action)));
  assert.ok(improved.report.actions.onSite.length > 0, 'Other current triggered findings remain actionable');
  assert.ok(improved.report.unsupportedDomains.length > 0);
  assert.ok((await text('.report')).includes(RULE_BOUNDARY));
  assert.ok((await text('.report')).includes(SCENE_BOUNDARY));
  await page.emulateMediaType('print');
  assert.equal(await page.$eval('.case-guide', node => getComputedStyle(node).display), 'none', 'Print must exclude the interactive guide');
  assert.notEqual(await page.$eval('.report', node => getComputedStyle(node).display), 'none', 'Print must retain the actual action list');
  await page.pdf({ path: resolve(output, 'window-action-list.pdf'), format: 'A4', printBackground: true });
  await page.emulateMediaType('screen');

  await click('柜体主挑战'); await ready();
  await page.select('.toolbar select', 'cabinet');
  await capture('06-cabinet-initial', 'cabinet', 'triggered', 'not_triggered');
  await drag({ x: 5.3, z: 3.3 }, { x: 4.5, z: 3.2 }, 0.8); await ready();
  await click('旋转 45°'); await ready();
  const cabinet = await capture('07-cabinet-goal', 'cabinet', 'not_triggered', 'not_triggered');
  assert.match(cabinet.summary, /本关布局目标已完成/);
  await drag({ x: 4.5, z: 3.2 }, { x: -1, z: 3.2 }, 0.8); await ready();
  assert.equal(await currentHash(), cabinet.input_hash, 'Rejected placement must preserve accepted input');
  assert.match(await text('[data-testid="placement-rejected"]'), /已恢复最后合法位置/);
  const rejected = await capture('08-invalid-rebound', 'cabinet', 'not_triggered', 'not_triggered');
  assert.match(rejected.counts, /非法尝试 1 次/);
  assert.equal(rejected.report.findings.find(f => f.rule_id === 'R003').status, 'needs_review');
  assert.ok(rejected.report.actions.information.some(f => f.rule_id === 'R003' && /固定/.test(f.action)));
  // Open exactly the downloaded bytes in an independent same-origin text viewer.
  // This is an export inspection, not a product import or filesystem viewer.
  const exported = await readFile(resolve(output, '08-invalid-rebound-report.json'), 'utf8');
  const blob = await page.evaluate(raw => {
    const pre = document.createElement('pre'); pre.textContent = raw;
    const html = '<!doctype html><meta charset="utf-8"><title>导出文件独立预览</title>'
      + '<p>刚下载的行动清单：独立文字预览，不是产品导入功能。</p>' + pre.outerHTML;
    return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  }, exported);
  const viewer = await browser.newPage();
  await viewer.goto(blob);
  assert.equal(await viewer.$eval('pre', node => node.textContent), exported);
  await viewer.screenshot({ path: resolve(output, '09-export-preview.png') });
  await viewer.close(); await page.evaluate(address => URL.revokeObjectURL(address), blob);
  if (recording) { await recording.stop(); recording = null; }
  await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 1 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile horizontal overflow');
  await page.click('[data-testid="start-risk-case"]'); await ready();
  await capture('10-mobile-restart', 'chair', 'triggered', 'not_triggered');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  if (binding) {
    assert.deepEqual(binding.errors, []); assert.deepEqual(binding.blockedExternal, []);
    for (const m of privateInputs.evidence.models) assert.ok(binding.requests.some(r => r.id === m.id && r.sha256 === m.sha256));
    await privateInputs.verifyUnchanged();
  }
  for (const [path, sha] of Object.entries(sourceHashes)) assert.equal(hash(await readFile(resolve(root, path))), sha, 'Source changed during run');
  assert.equal(git(['rev-parse', 'HEAD']), values['expected-head']);
  await persist('result.json', { status: values['local-review'] ? 'PASS_LOCAL_REVIEW_REPEATABLE_RISK_CASE' : 'PASS_PRIVATE_REPEATABLE_RISK_CASE', recorded_at: new Date().toISOString(),
    source: { head: values['expected-head'], source_status: sourceStatus, frozen_source: !sourceStatus, source_files_sha256: sourceHashes,
      dist_manifest_sha256: hash(await readFile(resolve(root, 'apps/web/dist/preview-manifest.json'))) },
    browser: await browser.version(), automation: 'Actual mouse drag, visible controls and browser downloads; no synthetic assessment injection',
    source_receipt: sourceReceipt, private_models: privateInputs?.evidence ?? null,
    local_review: values['local-review'] ? transport.manifest : null,
    binding: binding ? { requests: binding.requests, overlays: binding.overlays, errors: binding.errors, external: binding.externalRequests } : null,
    phases, checks: { canonical_snapshot_replay: 'PASS_EVERY_PHASE', all_exported_findings_match_python: true, local_transport: transport.result, export_bytes_opened: true,
      same_mode_restart: true, mobile_restart: true, original_bytes_unchanged: Boolean(privateInputs || values['local-review']),
      public_distribution_approved: false, performance: 'NOT_MEASURED_BY_THIS_WORKFLOW' }, errors, external });
  completed = true;
  console.log(JSON.stringify({ status: values['local-review'] ? 'PASS_LOCAL_REVIEW_REPEATABLE_RISK_CASE' : 'PASS_PRIVATE_REPEATABLE_RISK_CASE', phases: phases.length, real_models: Boolean(privateInputs || values['local-review']), output }));
} catch (error) {
  await persist('failure.json', { error: String(error), stack: error.stack, phases, errors, external });
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (recording) await recording.stop().catch(() => {});
  downloads?.close(); await binding?.close(); await browser.close();
  if (!completed) console.error('Incomplete evidence retained at ' + output);
}

async function ready() {
  await page.waitForFunction(() => document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false'
    && !!document.querySelector('.report .hash'));
  assert.equal(await page.$eval('[aria-label="检查结果"]', node => node.querySelector('[role="alert"]')?.textContent ?? null), null);
}
async function text(selector) { return page.$eval(selector, node => node.textContent.trim().replace(/\s+/g, ' ')); }
async function currentHash() { return (await text('.report .hash')).split(' ').at(-1); }
async function click(label) {
  const handle = await page.waitForFunction(value => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === value && !button.disabled), {}, label);
  await handle.asElement().click(); await handle.dispose();
}
async function capture(name, object, child, elder) {
  const download = async (label, filenamePattern, suffix) => {
    const record = await downloads.capture({ click: () => click(label), filenamePattern });
    await writeFile(resolve(output, `${name}-${suffix}.json`), record.raw);
    return record;
  };
  const report = await download('导出 JSON', REPORT_FILENAME, 'report');
  const snapshot = await download('导出场景快照', SNAPSHOT_FILENAME, 'snapshot');
  const verification = JSON.parse(execFileSync(values.python, [resolve(root, 'scripts/check_scene_snapshot.py'), snapshot.path], { cwd: root, encoding: 'utf8' }));
  assert.equal(verification.result, 'MATCHES_CURRENT_CORE');
  assert.equal(report.json.input_hash, snapshot.json.assessment.input_hash);
  assert.equal(report.json.input_hash, await currentHash());
  assert.equal(report.json.scene_revision, snapshot.json.scene.revision);
  const canonical = JSON.parse(execFileSync(values.python, ['-c',
    'import json,sys;sys.path.insert(0,"reference");from homesafe_core.engine import RuleEngine;from homesafe_core.validation import validate_scene;print(RuleEngine().evaluate(validate_scene(json.load(sys.stdin)["scene"])).model_dump_json())'],
  { cwd: root, encoding: 'utf8', input: snapshot.raw }));
  assert.equal(report.json.findings.length, canonical.findings.length);
  for (const finding of canonical.findings) {
    const exported = report.json.findings.find(item => item.key === finding.key);
    assert.ok(exported, 'Every canonical finding is in the actual export');
    for (const [field, value] of Object.entries(finding)) assert.deepEqual(exported[field], value, `${name} canonical ${finding.key}.${field}`);
  }
  for (const [rule, role, status] of [['R001', 'child', child], ['R005', 'elder', elder]]) {
    assert.equal(report.json.findings.find(f => f.rule_id === rule && f.profile_id === role && f.object_ids.includes(object))?.status, status,
      `${name} ${rule} ${object}`);
  }
  const phase = { name, seconds: (performance.now() - started) / 1000, input_hash: report.json.input_hash,
    revision: report.json.scene_revision, summary: await text('[data-testid="challenge-summary"]'),
    counts: await text('[data-testid="challenge-counts"]'), comparison: await page.$('[data-testid="layout-comparison"]')
      ? await text('[data-testid="layout-comparison"]') : '',
    report: report.json, snapshot: snapshot.json, canonical_replay: verification,
    downloads: { report: report.filename, snapshot: snapshot.filename } };
  phases.push(phase); await persist(name + '-evidence.json', phase);
  console.log(JSON.stringify({ phase: name, seconds: Number(phase.seconds.toFixed(2)), child, elder }));
  // Viewport only: full-page screenshots resize the live canvas in Chromium.
  await page.$eval('.viewport', node => node.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: resolve(output, name + '.png') });
  if (values['local-review']) {
    const canvas = await page.$('canvas[aria-label="样例客厅三维场景"]');
    await canvas.screenshot({ path: resolve(output, name + '-scene.png') });
    const summaries = await page.$('.role-summaries');
    await summaries.screenshot({ path: resolve(output, name + '-roles.png') });
    if (await page.$('[data-testid="layout-comparison"]')) {
      await (await page.$('[data-testid="layout-comparison"]')).screenshot({ path: resolve(output, name + '-comparison.png') });
    }
  }
  return phase;
}
async function drag(from, to, height) {
  const box = await page.$eval('canvas[aria-label="样例客厅三维场景"]', node => {
    node.scrollIntoView({ block: 'center' });
    const { left, top, width, height } = node.getBoundingClientRect(); return { left, top, width, height };
  });
  const eye = [-2.76, 5.16, -3.92];
  const diff = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const unit = a => a.map(v => v / Math.hypot(...a));
  const cross = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
  const forward = unit(diff([3, 0.45, 2.24], eye)), right = unit(cross(forward, [0, 1, 0])), up = cross(right, forward);
  const project = p => {
    const offset = diff(p, eye), scale = box.height / (2 * Math.tan(24 * Math.PI / 180) * dot(offset, forward));
    return { x: box.left + box.width / 2 + scale * dot(offset, right), y: box.top + box.height / 2 - scale * dot(offset, up) };
  };
  const start = project([from.x, height, from.z]), factor = eye[1] / (eye[1] - height);
  const end = project([eye[0] + (from.x - eye[0]) * factor + to.x - from.x, 0,
    eye[2] + (from.z - eye[2]) * factor + to.z - from.z]);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  assert.equal(await page.$eval('canvas', node => node.dataset.dragging), 'true', 'Actual pointer drag must start');
  await page.mouse.move(end.x, end.y, { steps: 16 }); await page.mouse.up();
}
