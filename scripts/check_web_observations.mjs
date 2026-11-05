// Isolated real-browser acceptance of explicit free-practice observation edits.
// node scripts/check_web_observations.mjs URL CHROMIUM PUPPETEER_ENTRY [OUTPUT_DIR]
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME, retainFailedDownloads } from './web_download.mjs';

const [url, chrome, driver, output] = process.argv.slice(2);
if (!url || !chrome || !driver) throw new Error('Pass URL, isolated Chromium and installed Puppeteer entry');
const { default: puppeteer } = await import(pathToFileURL(resolve(driver)).href);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const downloads = await mkdtemp(join(tmpdir(), 'homesafe-observation-'));
let cdp;
let downloadHarness;
let passed = false;
let retainedDownloads;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  cdp = await page.createCDPSession();
  downloadHarness = await createJsonDownloadHarness({ browser, cdp, downloadPath: downloads });
  assert.ok((await page.goto(url, { waitUntil: 'domcontentloaded' }))?.ok());
  await ready();
  await page.select('.toolbar select', 'cabinet');
  await page.click('button[aria-label="向前移动"]'); await ready();
  assert.equal(await disabled('撤销'), false);
  const before = await report();
  await click('补充模拟资料'); await ready();
  assert.equal(await page.$eval('select[aria-label="假设状态"]', node => node.value), 'unknown');
  await page.select('select[aria-label="资料项目"]', 'cabinet:anchored');
  const editable = await page.$$eval('select[aria-label="资料项目"] option', nodes => nodes.map(node => node.value));
  assert.ok(editable.includes('window:protection_reported'));
  assert.ok(!editable.some(field => /dimensions|traits|reach|height/.test(field)));
  await page.select('select[aria-label="假设状态"]', 'yes');
  assert.equal(await disabled('保存资料并重建基线'), true, 'Explicit baseline acknowledgement is required');
  await save();
  const confirmed = await report();
  assert.notEqual(confirmed.input_hash, before.input_hash);
  assert.deepEqual(confirmed.comparison.changeKinds, ['observation']);
  assert.equal(confirmed.actions.layout.length, 0);
  assert.ok(confirmed.actions.observations.length > 0);
  assert.equal(confirmed.comparison.conflict, false);
  const anchored = observation(confirmed);
  assert.equal(anchored.value, true);
  assert.equal(anchored.source_kind, 'simulated');
  assert.equal(anchored.verification_state, 'provided');
  assert.ok(anchored.observed_at);
  const cabinetFindingText = await page.$$eval('.finding', nodes => nodes
    .find(node => node.querySelector('.finding-title')?.textContent?.includes('柜体固定'))?.textContent);
  assert.match(cabinetFindingText, /当前条件未触发.*当前输入条件未触发；仍需现场复核。/s);
  assert.doesNotMatch(cabinetFindingText, /布局调整后重新核查/);
  const snapshot = await report('导出场景快照');
  assert.equal(snapshot.format, 'homesafe_scene_snapshot');
  assert.equal(snapshot.assessment.input_hash, confirmed.input_hash);
  assert.deepEqual(snapshot.scene.objects.find(object => object.id === 'cabinet').properties.anchored, anchored);
  assert.equal(await disabled('撤销'), true);
  assert.equal(await disabled('重做'), true);
  assert.match(await text('[data-testid="observation-baseline"]'), /不是空间整改/);
  assert.match(await text('[data-testid="layout-comparison"]'), /资料更新前后比较/);
  assert.match(await text('.report'), /模拟资料.*未做现场确认/s);
  assert.equal(await disabled('保存资料并重建基线'), true, 'No-op update cannot be resubmitted');
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'confirmed-observations.png'), fullPage: true });
    await page.pdf({ path: resolve(output, 'confirmed-observations.pdf'), format: 'A4', printBackground: true });
    await writeFile(resolve(output, 'confirmed-scene-snapshot.json'), JSON.stringify(snapshot, null, 2));
  }

  // New layout history is relative to the explicit data baseline.
  await page.click('button[aria-label="向前移动"]'); await ready();
  await click('撤销'); await ready();
  assert.equal((await report()).input_hash, confirmed.input_hash);
  await page.click('button[aria-label="向前移动"]'); await ready();
  await click('重置'); await ready();
  const reset = await report();
  assert.equal(reset.input_hash, confirmed.input_hash);
  assert.deepEqual(observation(reset), anchored);
  assert.equal(await disabled('撤销'), true);
  assert.equal(await disabled('重做'), true);
  await click('柜体主挑战'); await ready();
  assert.equal(await page.$('[aria-label="模拟资料补充"]'), null);
  const challenge = await report();
  assert.equal(observation(challenge).value, null, 'Challenge retains original unknown data, not practice edits');
  assert.match(await text('[data-testid="challenge-counts"]'), /操作 0 步/);
  await click('退出挑战并补充资料'); await ready();
  assert.equal((await report()).input_hash, confirmed.input_hash);
  assert.equal(await page.$('[data-testid="challenge-counts"]'), null);

  await page.select('select[aria-label="资料项目"]', 'cabinet:anchored');
  await page.select('select[aria-label="假设状态"]', 'no'); await save();
  const negative = await report();
  assert.equal(observation(negative).value, false);
  assert.ok(negative.findings.some(item => item.rule_id === 'R003' && item.status === 'triggered'));
  assert.equal(negative.actions.layout.length, 0);
  await page.select('select[aria-label="假设状态"]', 'unknown'); await save();
  const unknown = await report();
  assert.equal(observation(unknown).value, null);
  assert.equal(observation(unknown).source_kind, 'unknown');
  assert.ok(unknown.findings.some(item => item.rule_id === 'R003' && item.status === 'needs_review'));
  assert.ok(unknown.comparison.becameUnknown.length > 0);
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'observation-practice.png'), fullPage: true });
    await writeFile(resolve(output, 'confirmed-report.json'), JSON.stringify(confirmed, null, 2));
    await page.pdf({ path: resolve(output, 'observation-checklist.pdf'), format: 'A4', printBackground: true });
  }
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  assert.equal(observation(await report()).value, null);
  assert.equal(await page.$('[data-testid="observation-baseline"]'), null);
  assert.deepEqual(errors, []);
  const result = { result: 'PASS', scope: 'ISOLATED_LOCAL_BROWSER_SIMULATED_OBSERVATIONS', browser: await browser.version(), url,
    cases: ['unknown/true/false round trip', 'explicit baseline acknowledgement', 'layout history cleared and rebuilt; undo/reset preserve data baseline',
      'no spatial-remediation credit', 'Python-derived editable fields', 'challenge exit and immutable challenge baseline',
      'JSON and scene snapshot observation provenance', 'printable checklist', 'refresh resets practice'],
    hashes: { before: before.input_hash, confirmed: confirmed.input_hash, false: negative.input_hash, unknown: unknown.input_hash } };
  if (output) await writeFile(resolve(output, 'observations.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  passed = true;

  async function ready() {
    await page.waitForFunction(() => document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false'
      && (document.querySelector('.report .hash') || document.querySelector('[aria-label="检查结果"] [role="alert"]')));
    const failure = await page.$eval('[aria-label="检查结果"]', node => node.querySelector('[role="alert"]')?.textContent);
    assert.ok(!failure, failure);
  }
  async function click(label) {
    const handle = await page.waitForFunction(label => [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === label && !node.disabled), {}, label);
    await handle.asElement().click(); await handle.dispose();
  }
  async function disabled(label) {
    return page.evaluate(label => [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === label)?.disabled, label);
  }
  async function text(selector) { return page.$eval(selector, node => node.textContent); }
  async function save() {
    await page.click('input[aria-label="确认重建资料基线"]');
    await click('保存资料并重建基线'); await ready();
  }
  async function report(label = '导出 JSON') {
    const { json: result } = await downloadHarness.capture({
      click: () => click(label),
      filenamePattern: label === '导出场景快照' ? SNAPSHOT_FILENAME : REPORT_FILENAME,
    });
    assert.ok((await text('.report .hash')).includes(result.input_hash ?? result.assessment.input_hash));
    return result;
  }
  function observation(report) { return report.property_observations.find(item => item.object_id === 'cabinet').properties.anchored; }
} finally {
  if (!passed) retainedDownloads = await retainFailedDownloads(downloads, output);
  downloadHarness?.close();
  await cdp?.detach().catch(() => {});
  await browser.close();
  if (passed) await rm(downloads, { recursive: true, force: true });
  else await retainFailedDownloads(downloads, output, { announce: false, destination: retainedDownloads });
}
