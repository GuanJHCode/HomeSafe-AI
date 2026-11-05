// Isolated browser regression for the accepted-report gate during pointer drag.
// node scripts/check_web_draft_export.mjs URL CHROMIUM PUPPETEER_ENTRY [--observe]
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME, retainFailedDownloads } from './web_download.mjs';

const [url, executablePath, entry, mode] = process.argv.slice(2);
if (!url || !executablePath || !entry) throw new Error('Pass URL, isolated Chromium and puppeteer-core entry');
const { default: puppeteer } = await import(pathToFileURL(resolve(entry)).href);
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const downloadPath = await mkdtemp(join(tmpdir(), 'homesafe-draft-export-'));
let cdp;
let harness;
let passed = false;
let retainedDownloads;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  cdp = await page.createCDPSession();
  harness = await createJsonDownloadHarness({ browser, cdp, downloadPath });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.__draftPrintCalls = 0; window.print = () => { window.__draftPrintCalls++; }; });
  const downloadEvents = [];
  cdp.on('Browser.downloadWillBegin', event => downloadEvents.push(event));
  const ready = () => page.waitForFunction(() => !!document.querySelector('.report') &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
  await ready();
  const expectedModels = Number(process.env.HOMESAFE_EXPECT_REAL_ASSETS || 0);
  if (expectedModels) {
    await page.waitForFunction(expected => document.body.innerText.includes(`已加载 ${expected} 件模型`), {}, expectedModels);
  }
  const beforeHash = await page.$eval('.report .hash', node => node.textContent);
  const bounds = await page.$eval('.viewport canvas', node => {
    node.scrollIntoView({ block: 'center' });
    const { left, top, width, height } = node.getBoundingClientRect();
    return { left, top, width, height };
  });
  const eye = [-2.76, 5.16, -3.92];
  const difference = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const unit = a => a.map(value => value / Math.hypot(...a));
  const cross = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
  const forward = unit(difference([3, 0.45, 2.24], eye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const offset = difference([5.3, 0.4, 3.3], eye);
  const scale = bounds.height / (2 * Math.tan(24 * Math.PI / 180) * dot(offset, forward));
  const start = { x: bounds.left + bounds.width / 2 + scale * dot(offset, right),
    y: bounds.top + bounds.height / 2 - scale * dot(offset, up) };

  const viewState = () => page.evaluate(() => {
    const report = document.querySelector('.report');
    const visible = !!report && getComputedStyle(report).display !== 'none' && report.getClientRects().length > 0;
    return { dragging: document.querySelector('.viewport canvas')?.dataset.dragging === 'true',
      reportVisible: visible, outputButtonsVisible: [...document.querySelectorAll('.report button')]
        .filter(button => !button.disabled && button.getClientRects().length > 0).length };
  });
  const beginDrag = async () => { await page.mouse.move(start.x, start.y); await page.mouse.down(); };
  const moveDrag = async () => page.mouse.move(start.x - 45, start.y + 20, { steps: 6 });
  await beginDrag();
  const held = await viewState();
  await moveDrag();
  const during = await viewState();
  assert.equal(during.dragging, true, 'A real pointer drag must be previewing an unaccepted pose');
  if (mode === '--observe') {
    const { json } = await harness.capture({
      click: () => page.evaluate(() => [...document.querySelectorAll('.report button')]
        .find(button => button.textContent?.trim() === '导出 JSON')?.click()),
      filenamePattern: REPORT_FILENAME,
    });
    await page.mouse.up();
    await ready();
    const afterHash = await page.$eval('.report .hash', node => node.textContent);
    console.log(JSON.stringify({ result: 'OBSERVED_BEFORE_FIX', held, during,
      exported_hash: json.input_hash, before_hash: beforeHash, after_hash: afterHash }, null, 2));
  } else {
    assert.equal(held.dragging, true);
    assert.equal(held.reportVisible, false, 'Pointer hold closes output before a visible move');
    assert.equal(held.outputButtonsVisible, 0);
    assert.equal(during.reportVisible, false, 'Unaccepted visual preview must hide the accepted report');
    assert.equal(during.outputButtonsVisible, 0, 'No report output may be visible during preview');
    const eventCount = downloadEvents.length;
    await page.evaluate(() => {
      for (const label of ['导出 JSON', '导出场景快照', '打印清单']) {
        [...document.querySelectorAll('.report button')].find(button => button.textContent?.trim() === label)?.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(downloadEvents.length, eventCount, 'Hidden button callbacks cannot download a stale report or snapshot');
    assert.equal(await page.evaluate(() => window.__draftPrintCalls), 0, 'Hidden print callback cannot print stale report');

    await page.evaluate(() => document.querySelector('.viewport canvas')
      .dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    await page.waitForFunction(() => document.querySelector('.report')?.getClientRects().length > 0);
    assert.equal(await page.$eval('.report .hash', node => node.textContent), beforeHash);
    await page.mouse.up();

    await beginDrag(); await moveDrag();
    assert.equal((await viewState()).reportVisible, false);
    await page.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === '老人视角')?.click());
    await page.waitForFunction(() => document.querySelector('.report')?.getClientRects().length > 0);
    assert.equal(await page.$eval('.report .hash', node => node.textContent), beforeHash);
    await page.mouse.up();
    await page.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === '俯看客厅')?.click());

    await beginDrag(); await moveDrag();
    assert.equal((await viewState()).reportVisible, false);
    await page.mouse.up();
    await ready();
    const afterHash = await page.$eval('.report .hash', node => node.textContent);
    assert.notEqual(afterHash, beforeHash, 'A legal release accepts a new Python-derived input hash');
    const report = await harness.capture({ click: () => page.evaluate(() => [...document.querySelectorAll('.report button')]
      .find(button => button.textContent?.trim() === '导出 JSON')?.click()), filenamePattern: REPORT_FILENAME });
    const snapshot = await harness.capture({ click: () => page.evaluate(() => [...document.querySelectorAll('.report button')]
      .find(button => button.textContent?.trim() === '导出场景快照')?.click()), filenamePattern: SNAPSHOT_FILENAME });
    assert.ok(afterHash.includes(report.json.input_hash));
    assert.equal(snapshot.json.assessment.input_hash, report.json.input_hash);
    await page.evaluate(() => [...document.querySelectorAll('.report button')]
      .find(button => button.textContent?.trim() === '打印清单')?.click());
    assert.equal(await page.evaluate(() => window.__draftPrintCalls), 1);
    console.log(JSON.stringify({ result: 'PASS', scope: 'ISOLATED_CHROMIUM_DRAFT_EXPORT_GUARD',
      browser: await browser.version(), before_hash: beforeHash, after_hash: afterHash,
      expected_loaded_assets: expectedModels, source_kind: process.env.HOMESAFE_ASSET_PROVENANCE || 'placeholder',
      checks: ['pointer hold and preview hide all output', 'hidden callbacks cannot export JSON/snapshot or print',
        'pointercancel and view change restore accepted report',
        'legal release restores current JSON/snapshot/print'] }, null, 2));
  }
  passed = true;
} finally {
  const keepDownloads = !passed || mode === '--observe';
  const evidenceDir = process.env.HOMESAFE_EVIDENCE_DIR
    ? resolve(process.env.HOMESAFE_EVIDENCE_DIR, 'draft-export') : undefined;
  if (keepDownloads) retainedDownloads = await retainFailedDownloads(downloadPath, evidenceDir);
  harness?.close();
  await cdp?.detach().catch(() => {});
  await browser.close();
  if (keepDownloads) await retainFailedDownloads(downloadPath, evidenceDir,
    { announce: false, destination: retainedDownloads });
  else await rm(downloadPath, { recursive: true, force: true });
}
