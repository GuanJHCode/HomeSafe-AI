// Serve the staged Vite app and pass its URL, Chrome binary, and optionally a
// locally installed puppeteer-core entry point. No browser or packages are downloaded.
// node scripts/check_web_preview.mjs http://127.0.0.1:4173/ /path/to/chrome /path/to/puppeteer-core.js
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { failNextConfig } from './browser_fault.mjs';

const [url, chrome, puppeteerEntry] = process.argv.slice(2);
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
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60_000);
  const pageErrors = [];
  let workerCount = 0;
  page.on('workercreated', () => workerCount++);
  page.on('pageerror', error => pageErrors.push(error.message));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });

  const opened = performance.now();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'App URL responds successfully');
  await ready();
  await page.waitForSelector(canvas, { visible: true });
  const coldReadyMs = performance.now() - opened;

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

  await click(labels.challenge);
  await ready();
  await dragChair(chairBefore, chairImproved);
  await ready();
  assertPosition(await visibleText(position), chairImproved);
  const summary = await visibleText(challengeSummary);
  assert.match(summary, /本关布局目标已完成/);
  const challengeReport = await downloadReport();
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

  const warmOpened = performance.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await page.waitForSelector(canvas, { visible: true });
  const warmReadyMs = performance.now() - warmOpened;

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
  assert.ok(workerCount > failedWorkers, 'Recovery creates a new real Worker');
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({
    scope: 'REAL_CHROME_PREVIEW', url, browser: await browser.version(),
    cold_ready_ms: Math.round(coldReadyMs), warm_ready_ms: Math.round(warmReadyMs),
    ruleset: challengeReport.ruleset_version,
    result: 'PASS',
    cases: [
      'real pointer drag and one-entry undo', 'invalid placement rebound',
      'child and elder views', 'layout conflict', 'redo, reset and rotation',
      'challenge remaining findings and coverage', 'JSON and printable action checklist',
      'refresh', 'real Worker recovery without refresh',
    ],
  }, null, 2));

  async function ready() {
    await page.waitForFunction((panel) => {
      const results = document.querySelector(panel);
      return results?.getAttribute('aria-busy') === 'false' &&
        (document.querySelector('.report .hash') || results.querySelector('[role="alert"]'));
    }, {}, resultPanel);
    const failure = await page.$eval(resultPanel, node => node.querySelector('[role="alert"]')?.textContent);
    assert.ok(!failure, failure);
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
    const before = new Set(await readdir(downloadPath));
    await click(labels.export);
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
      const file = (await readdir(downloadPath)).find(name => name.endsWith('.json') && !before.has(name));
      if (file) {
        const report = JSON.parse(await readFile(join(downloadPath, file), 'utf8'));
        assert.equal(report.input_hash, await currentHash());
        assert.equal(report.source_kind, 'synthetic_demo');
        assert.match(await visibleText('.report'), new RegExp(`布局 v${report.scene_revision}\\b`));
        assert.ok(report.actions.onSite.every(item => item.status === 'triggered'));
        assert.ok(report.actions.information.every(item => item.status === 'needs_review'));
        // CDP may reuse a filename. Remove only this harness-owned temporary file
        // so a repeated export of the same layout can be observed independently.
        await rm(join(downloadPath, file));
        return report;
      }
      await delay(50);
    }
    throw new Error('JSON download did not complete');
  }

  async function canvasBounds() {
    return page.$eval(canvas, node => {
      node.scrollIntoView({ block: 'center' });
      const { left, top, width, height } = node.getBoundingClientRect();
      return { left, top, width, height };
    });
  }

  async function dragChair(from, to) {
    const bounds = await canvasBounds();
    const start = project([from.x, 0.4, from.z], bounds);
    // The input controller uses the ground-plane delta. Project the endpoint from
    // the initial pointer ray's floor intersection so the chair reaches the target.
    const eyeHeight = overviewEye[1];
    const groundFactor = eyeHeight / (eyeHeight - 0.4);
    const groundX = overviewEye[0] + (from.x - overviewEye[0]) * groundFactor;
    const groundZ = overviewEye[2] + (from.z - overviewEye[2]) * groundFactor;
    const end = project([groundX + to.x - from.x, 0, groundZ + to.z - from.z], bounds);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    assert.equal(await page.$eval(canvas, node => node.dataset.selected), 'chair');
    assert.equal(await page.$eval(canvas, node => node.dataset.dragging), 'true');
    await page.mouse.move(end.x, end.y, { steps: 12 });
    assertPosition(await visibleText(position), from);
    await page.mouse.up();
  }
} finally {
  await browser.close();
  await rm(downloadPath, { recursive: true, force: true });
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
