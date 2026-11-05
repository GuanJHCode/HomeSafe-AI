// Serve the staged Vite app and pass its URL, Chrome binary, and optionally a
// locally installed puppeteer-core entry point. No browser or packages are downloaded.
// node scripts/check_web_preview.mjs http://127.0.0.1:4173/ /path/to/chrome /path/to/puppeteer-core.js
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { failNextConfig } from './browser_fault.mjs';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME, retainFailedDownloads } from './web_download.mjs';

const [url, chrome, puppeteerEntry] = process.argv.slice(2);
const expectedRealAssets = Number(process.env.HOMESAFE_EXPECT_REAL_ASSETS || 0);
const expectedAssetLabel = process.env.HOMESAFE_ASSET_PROVENANCE === 'procedural'
  ? '程序生成模型已加载' : 'Lux3D 模型已加载';
if (!url || !chrome) throw new Error('Pass the application URL and Chrome executable, plus a puppeteer-core entry point if needed.');
const puppeteer = await import(puppeteerEntry
  ? pathToFileURL(resolve(puppeteerEntry)).href
  : 'puppeteer-core');

const canvas = 'canvas[aria-label="样例客厅三维场景"]';
const resultPanel = '[aria-label="检查结果"]';
const position = '[data-testid="selected-position"]';
const conflict = '[data-testid="layout-comparison"].conflict';
const challengeSummary = '[data-testid="challenge-summary"]';
const labels = {
  child: '儿童视角', elder: '老人视角', overview: '俯看客厅',
  undo: '撤销', redo: '重做', reset: '重置', export: '导出 JSON', challenge: '窗边挑战',
};

const chairBefore = { x: 5.3, z: 3.3 };
const chairConflict = { x: 3, z: 2 };
const chairImproved = { x: 3, z: 0.6 };
const cabinet = { x: 0.5, z: 3.3 };
const overviewEye = [-2.76, 5.16, -3.92];
const launch = puppeteer.launch ?? puppeteer.default.launch;
const browser = await launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ...(process.env.CI ? ['--no-sandbox'] : [])],
});
const downloadPath = await mkdtemp(join(tmpdir(), 'homesafe-web-'));
let recording;
let cdp;
let downloadHarness;
let passed = false;
let retainedDownloads;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  if (process.env.HOMESAFE_VIDEO_PATH) {
    // Optional genuine browser frames of this development regression, not a final submission video.
    recording = await page.screencast({ path: resolve(process.env.HOMESAFE_VIDEO_PATH) });
  }
  page.setDefaultTimeout(60_000);
  const pageErrors = [];
  let workerCount = 0;
  page.on('workercreated', () => workerCount++);
  page.on('pageerror', error => pageErrors.push(error.message));
  cdp = await page.createCDPSession();
  downloadHarness = await createJsonDownloadHarness({ browser, cdp, downloadPath });

  const opened = performance.now();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'App URL responds successfully');
  await ready();
  await page.waitForSelector(canvas, { visible: true });
  const coldReadyMs = performance.now() - opened;
  const snapshotRecords = [];
  const initialSnapshot = await downloadSceneSnapshot('initial');
  assertPositionFromSnapshot(initialSnapshot, 'chair', chairBefore);
  if (expectedRealAssets) {
    await assertModelsLoaded();
    if (process.env.HOMESAFE_EVIDENCE_DIR) {
      await mkdir(process.env.HOMESAFE_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: resolve(process.env.HOMESAFE_EVIDENCE_DIR, 'real-models.png'), fullPage: true });
    }
    // The chair is covered by pointer dragging below; exercise the second real
    // model independently through the existing keyboard-accessible controls.
    await page.select('.toolbar select', 'cabinet');
    const cabinetStart = await currentHash();
    await page.click('button[aria-label="向前移动"]');
    await ready();
    assertPosition(await visibleText(position), { x: cabinet.x, z: cabinet.z - 0.25 });
    const cabinetMoved = await currentHash();
    assert.notEqual(cabinetMoved, cabinetStart);
    await click('旋转 45°'); await ready();
    assert.notEqual(await currentHash(), cabinetMoved);
    assertPosition(await visibleText(position), { x: cabinet.x, z: cabinet.z - 0.25 });
    await click(labels.undo); await ready();
    await click(labels.undo); await ready();
    assertPosition(await visibleText(position), cabinet);
    await click(labels.reset); await ready();
    await assertModelsLoaded();
  }

  await dragChair(chairBefore, chairConflict);
  await ready();
  assertPosition(await visibleText(position), chairConflict);
  assert.match(await visibleText(conflict), /双角色取舍/);
  assert.match(await visibleText(conflict), /新增已触发\s*·\s*老人/);
  assert.match(await visibleText(conflict), /不再触发\s*·\s*儿童/);

  await click(labels.child);
  assert.equal(await visibleText(`${resultPanel} h2`), '儿童检查');
  assert.equal(await page.$eval(canvas, node => node.dataset.role), 'child');
  await click(labels.elder);
  assert.equal(await visibleText(`${resultPanel} h2`), '老人检查');
  assert.equal(await page.$eval(canvas, node => node.dataset.role), 'elder');
  const layoutReport = await downloadReport();
  assert.ok(finding(layoutReport, 'R001', 'child', 'not_triggered'));
  assert.ok(finding(layoutReport, 'R005', 'elder', 'triggered'));
  assert.equal(layoutReport.comparison.conflict, true);
  const layoutSnapshot = await downloadSceneSnapshot('layout');
  assert.equal(layoutSnapshot.assessment.input_hash, layoutReport.input_hash);
  assertPositionFromSnapshot(layoutSnapshot, 'chair', chairConflict);

  await click(labels.overview);
  await dragChair(chairConflict, cabinet);
  await ready();
  const rejected = await visibleText('[data-testid="placement-rejected"]');
  assert.match(rejected, /已恢复最后合法位置/);
  assertPosition(await visibleText(position), chairConflict);
  assert.equal(await currentHash(), layoutReport.input_hash);
  await page.select('.toolbar select', '');
  const restoredChair = project([chairConflict.x, 0.4, chairConflict.z], await canvasBounds());
  await page.mouse.click(restoredChair.x, restoredChair.y);
  assert.equal(await page.$eval(canvas, node => node.dataset.selected), 'chair');

  await click(labels.undo);
  await ready();
  assertPosition(await visibleText(position), chairBefore);
  assert.ok(await page.$$eval('button:disabled', (buttons, label) =>
    buttons.some(button => button.textContent.trim() === label), labels.undo));
  await click(labels.redo);
  await ready();
  assertPosition(await visibleText(position), chairConflict);
  await click(labels.reset);
  await ready();
  assertPosition(await visibleText(position), chairBefore);
  const resetHash = await currentHash();
  await click('旋转 45°');
  await ready();
  assertPosition(await visibleText(position), chairBefore);
  assert.notEqual(await currentHash(), resetHash);
  const freePracticeHash = await currentHash();

  await click(labels.challenge);
  await ready();
  await dragChair(chairBefore, chairImproved);
  await ready();
  assertPosition(await visibleText(position), chairImproved);
  const summary = await visibleText(challengeSummary);
  assert.match(summary, /本关布局目标已完成/);
  const challengeReport = await downloadReport();
  const challengeSnapshot = await downloadSceneSnapshot('challenge');
  assertPositionFromSnapshot(challengeSnapshot, 'chair', chairImproved);
  assert.equal(challengeSnapshot.assessment.input_hash, challengeReport.input_hash);
  const remaining = status => challengeReport.findings.filter(item => item.status === status).length;
  assert.match(summary, new RegExp(`仍有${remaining('triggered')}项已触发、${remaining('needs_review')}项待核查`));
  assert.match(summary, new RegExp(`未覆盖 ${challengeReport.unsupportedDomains.length} 类`));

  const evidenceDir = process.env.HOMESAFE_EVIDENCE_DIR;
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: resolve(evidenceDir, 'challenge.png'), fullPage: true });
  }

  await page.emulateMediaType('print');
  assert.equal(await currentHash(), challengeReport.input_hash);
  assert.match(await visibleText('.report'), /未覆盖/);
  const printable = await page.pdf({ format: 'A4', printBackground: true });
  assert.ok(printable.length > 1000, 'Print layout produces a nonempty PDF');
  if (evidenceDir) await writeFile(resolve(evidenceDir, 'action-list.pdf'), printable);
  await page.emulateMediaType('screen');

  await click(labels.undo);
  await ready();
  assertPosition(await visibleText(position), chairBefore);
  await click(labels.reset);
  await ready();
  assert.match(await visibleText(challengeSummary), /本关布局目标尚未完成/);

  await click('柜体主挑战');
  await ready();
  if (expectedRealAssets) await assertModelsLoaded();
  await page.select('.toolbar select', 'chair');
  assert.equal(await page.$eval('button[aria-label="向左移动"]', node => node.disabled), true,
    'The tutorial chair is locked during the cabinet challenge');
  await page.select('.toolbar select', 'cabinet');
  const mainStart = { x: 5.3, z: 3.3 };
  const mainConflict = { x: 4.8, z: 2.5 };
  assertPosition(await visibleText(position), mainStart);
  await dragObject('cabinet', mainStart, mainConflict, 0.8);
  await ready();
  assertPosition(await visibleText(position), mainConflict);
  assert.match(await visibleText(conflict), /双角色取舍/);
  assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 1 步 · 非法尝试 0 次 · 目标调整引发取舍 1 次/);
  const legalMainHash = await currentHash();
  await dragObject('cabinet', mainConflict, cabinet, 0.8);
  await ready();
  assert.match(await visibleText('[data-testid="placement-rejected"]'), /已恢复最后合法位置/);
  assertPosition(await visibleText(position), mainConflict);
  assert.equal(await currentHash(), legalMainHash);
  assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 1 步 · 非法尝试 1 次 · 目标调整引发取舍 1 次/);
  await click(labels.undo); await ready();
  assertPosition(await visibleText(position), mainStart);
  assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 2 步 · 非法尝试 1 次 · 目标调整引发取舍 1 次/);

  const mainLayouts = [];
  for (const target of [{ x: 4.5, z: 3.2 }, { x: 3.2, z: 3.2 }, { x: 4.8, z: 0.8 }]) {
    await click(labels.reset); await ready();
    assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 0 步 · 非法尝试 0 次 · 目标调整引发取舍 0 次/);
    await dragObject('cabinet', mainStart, target, 0.8); await ready();
    assertPosition(await visibleText(position), target);
    assert.match(await visibleText(challengeSummary), /本关布局目标已完成/);
    assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 1 步/);
    const report = await downloadReport();
    for (const rule of ['R001', 'R005']) {
      assert.ok(report.findings.some(item => item.rule_id === rule && item.object_ids.includes('cabinet') && item.status === 'not_triggered'));
    }
    assert.ok(report.findings.some(item => item.rule_id === 'R003' && item.object_ids.includes('cabinet') && item.status === 'needs_review'));
    mainLayouts.push({ target, input_hash: report.input_hash });
  }
  assert.equal(new Set(mainLayouts.map(item => item.input_hash)).size, 3);
  await click('旋转 45°'); await ready();
  assert.match(await visibleText(challengeSummary), /本关布局目标已完成/);
  assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 2 步/);
  if (evidenceDir) await page.screenshot({ path: resolve(evidenceDir, 'main-challenge.png'), fullPage: true });
  await click('自由布置'); await ready();
  assert.equal(await currentHash(), freePracticeHash, 'Free practice retains its separate accepted layout');
  await page.select('.toolbar select', 'cabinet');
  assert.equal(await page.$eval('button[aria-label="向左移动"]', node => node.disabled), false);
  await click(labels.challenge); await ready();
  assert.match(await visibleText(challengeSummary), /本关布局目标尚未完成/);
  assert.match(await visibleText('[data-testid="challenge-counts"]'), /操作 0 步 · 非法尝试 0 次 · 目标调整引发取舍 0 次/);

  const warmOpened = performance.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await page.waitForSelector(canvas, { visible: true });
  const warmReadyMs = performance.now() - warmOpened;
  if (expectedRealAssets) await assertModelsLoaded();

  const config = await page.evaluate(async () =>
    (await fetch(new URL('engine/config.json', location.href))).json());
  const fault = await failNextConfig(page, 'engine/config.json', {
    ...config, pyodideIndexURL: 'vendor/intentional-missing-runtime/',
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`${resultPanel} [role="alert"]`);
  assert.equal(fault.used(), true);
  assert.equal(await page.$('.report .hash'), null, 'Failure cannot display a stale report');
  const failedDocument = await page.evaluate(() => performance.timeOrigin);
  const failedWorkers = workerCount;
  await click('重建 Worker 并重试');
  await ready();
  assert.equal(await page.evaluate(() => performance.timeOrigin), failedDocument, 'Recovery needs no page refresh');
  if (expectedRealAssets) await assertModelsLoaded();
  assert.ok(workerCount > failedWorkers, 'Recovery creates a new real Worker');
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({
    scope: 'REAL_CHROME_PREVIEW', url, browser: await browser.version(),
    cold_ready_ms: Math.round(coldReadyMs), warm_ready_ms: Math.round(warmReadyMs),
    ruleset: challengeReport.ruleset_version,
    result: 'PASS',
    expected_real_assets: expectedRealAssets,
    asset_provenance: expectedRealAssets ? (process.env.HOMESAFE_ASSET_PROVENANCE || 'lux3d_web') : 'none',
    main_challenge_layouts: mainLayouts,
    scene_snapshots: snapshotRecords,
    cases: [
      'real pointer drag and one-entry undo', 'invalid placement rebound',
      'child and elder views', 'layout conflict', 'redo, reset and rotation',
      'challenge remaining findings and coverage', 'JSON and printable action checklist',
      'downloaded scene snapshots independently recompute in native Python',
      'cabinet main challenge: three distinct legal solutions and rotation',
      'main challenge invalid rebound, Python counters, undo/reset and fixed objects',
      'tutorial/main/free practice transitions preserve separate layouts',
      'refresh', 'real Worker recovery without refresh',
    ],
  }, null, 2));
  passed = true;

  async function ready() {
    await page.waitForFunction((panel) => {
      const results = document.querySelector(panel);
      return results?.getAttribute('aria-busy') === 'false' &&
        (document.querySelector('.report .hash') || results.querySelector('[role="alert"]'));
    }, {}, resultPanel);
    const failure = await page.$eval(resultPanel, node => node.querySelector('[role="alert"]')?.textContent);
    assert.ok(!failure, failure);
  }

  async function assertModelsLoaded() {
    await page.waitForFunction(count => document.body.textContent.includes(`已加载 ${count} 件模型`), {}, expectedRealAssets);
    for (const id of ['chair', 'cabinet']) {
      await page.select('.toolbar select', id);
      await page.waitForFunction(label => document.body.textContent.includes(label), {}, expectedAssetLabel);
    }
  }

  async function click(label) {
    const handle = await page.waitForFunction((label) =>
      [...document.querySelectorAll('button')].find(button =>
        button.textContent?.trim() === label && !button.disabled),
    {}, label);
    await handle.asElement().click();
    await handle.dispose();
  }

  async function visibleText(selector) {
    await page.waitForSelector(selector, { visible: true });
    return page.$eval(selector, node => node.textContent.trim().replace(/\s+/g, ' '));
  }

  async function currentHash() {
    return (await visibleText('.report .hash')).split(' ').at(-1);
  }

  async function downloadReport() {
    const { json: report } = await downloadHarness.capture({
      click: () => click(labels.export), filenamePattern: REPORT_FILENAME,
    });
    assert.equal(report.input_hash, await currentHash());
    assert.equal(report.source_kind, 'synthetic_demo');
    assert.match(await visibleText('.report'), new RegExp(`布局 v${report.scene_revision}\\b`));
    assert.ok(report.actions.onSite.every(item => item.status === 'triggered'));
    assert.ok(report.actions.information.every(item => item.status === 'needs_review'));
    return report;
  }

  function assertPositionFromSnapshot(snapshot, id, target) {
    const object = snapshot.scene.objects.find(item => item.id === id);
    assert.ok(object, 'Snapshot retains canonical scene objects');
    assert.ok(Math.abs(object.position.x - target.x) < 0.05);
    assert.ok(Math.abs(object.position.z - target.z) < 0.05);
  }

  async function downloadSceneSnapshot(label) {
    const { filename, path, raw, json: snapshot } = await downloadHarness.capture({
      click: () => click('导出场景快照'), filenamePattern: SNAPSHOT_FILENAME,
    });
    assert.equal(snapshot.assessment.input_hash, await currentHash());
    assert.equal(snapshot.assessment.scene_revision, snapshot.scene.revision);
    assert.equal(snapshot.source_kind, 'synthetic_demo');
    assert.equal(snapshot.includes_asset_bytes, false);
    // Verify actual downloaded inputs with the same authoritative Python core;
    // a UI-presented hash string alone cannot establish reproducibility.
    const verification = JSON.parse(execFileSync(process.env.HOMESAFE_PYTHON || 'python3',
      [fileURLToPath(new URL('./check_scene_snapshot.py', import.meta.url)), path], { encoding: 'utf8' }));
    assert.equal(verification.result, 'MATCHES_CURRENT_CORE');
    snapshotRecords.push({ label, filename, verification });
    if (process.env.HOMESAFE_EVIDENCE_DIR) {
      await mkdir(process.env.HOMESAFE_EVIDENCE_DIR, { recursive: true });
      await writeFile(resolve(process.env.HOMESAFE_EVIDENCE_DIR, `snapshot-${label}.json`), raw);
    }
    return snapshot;
  }

  async function canvasBounds() {
    return page.$eval(canvas, node => {
      node.scrollIntoView({ block: 'center' });
      const { left, top, width, height } = node.getBoundingClientRect();
      return { left, top, width, height };
    });
  }

  async function dragChair(from, to) {
    return dragObject('chair', from, to, 0.4);
  }

  async function dragObject(id, from, to, hitHeight) {
    const bounds = await canvasBounds();
    const start = project([from.x, hitHeight, from.z], bounds);
    // The input controller uses the ground-plane delta. Project the endpoint from
    // the initial pointer ray's floor intersection so the chair reaches the target.
    const eyeHeight = overviewEye[1];
    const groundFactor = eyeHeight / (eyeHeight - hitHeight);
    const groundX = overviewEye[0] + (from.x - overviewEye[0]) * groundFactor;
    const groundZ = overviewEye[2] + (from.z - overviewEye[2]) * groundFactor;
    const end = project([groundX + to.x - from.x, 0, groundZ + to.z - from.z], bounds);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    assert.equal(await page.$eval(canvas, node => node.dataset.selected), id);
    assert.equal(await page.$eval(canvas, node => node.dataset.dragging), 'true');
    await page.mouse.move(end.x, end.y, { steps: 12 });
    assertPosition(await visibleText(position), from);
    await page.mouse.up();
  }
} finally {
  if (!passed) retainedDownloads = await retainFailedDownloads(downloadPath, process.env.HOMESAFE_EVIDENCE_DIR);
  if (recording) await recording.stop();
  downloadHarness?.close();
  await cdp?.detach().catch(() => {});
  await browser.close();
  if (passed) await rm(downloadPath, { recursive: true, force: true });
  else {
    await retainFailedDownloads(downloadPath, process.env.HOMESAFE_EVIDENCE_DIR,
      { announce: false, destination: retainedDownloads });
  }
}

function finding(report, rule, role, status) {
  return report.findings.find(item =>
    item.rule_id === rule && item.role === role && item.status === status &&
    item.object_ids.includes('chair'));
}

function assertPosition(text, expected) {
  const values = text.match(/x (-?\d+\.\d+) 米 · z (-?\d+\.\d+) 米/);
  assert.ok(values, text);
  assert.ok(Math.abs(Number(values[1]) - expected.x) <= 0.03, text);
  assert.ok(Math.abs(Number(values[2]) - expected.z) <= 0.03, text);
}

// Projection for the initial overview of the standard 6×4 m fixture.
function project(point, bounds) {
  const forward = unit(difference([3, 0.45, 2.24], overviewEye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const offset = difference(point, overviewEye);
  const scale = bounds.height / (2 * Math.tan(24 * Math.PI / 180) * dot(offset, forward));
  return {
    x: bounds.left + bounds.width / 2 + scale * dot(offset, right),
    y: bounds.top + bounds.height / 2 - scale * dot(offset, up),
  };
}

function difference(a, b) { return a.map((value, i) => value - b[i]); }
function dot(a, b) { return a.reduce((sum, value, i) => sum + value * b[i], 0); }
function unit(a) { return a.map(value => value / Math.hypot(...a)); }
function cross([x, y, z], [a, b, c]) { return [y * c - z * b, z * a - x * c, x * b - y * a]; }
