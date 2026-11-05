// Private-loopback real asset fault checks. Never serves or writes input GLB files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { privateOutputPath } from './private_asset_inputs.mjs';

const [url, chrome, driver, requested] = process.argv.slice(2);
if (!url || !chrome || !driver || !requested) throw new Error('Pass private URL, Chromium, driver and new output');
const base = new URL(url);
assert.equal(base.hostname, '127.0.0.1');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = await privateOutputPath(root, requested);
const descriptors = await (await fetch(new URL('engine/assets.json', base))).json();
assert.equal(descriptors.length, 2, 'This check requires two real intake descriptors');
const records = [];
for (const id of ['chair', 'cabinet']) {
  const asset = descriptors.find(item => item.asset_id.endsWith(`-${id}`));
  assert.ok(asset, `Missing ${id} descriptor`);
  const address = new URL(asset.render_url, base);
  assert.equal(address.origin, base.origin);
  const raw = Buffer.from(await (await fetch(address)).arrayBuffer());
  assert.equal(createHash('sha256').update(raw).digest('hex'), asset.content_hash);
  records.push({ id, asset, address: address.href, raw });
}
await mkdir(output, { recursive: true });
const { default: puppeteer } = await import(pathToFileURL(resolve(driver)).href);
const browser = await puppeteer.launch({ executablePath: resolve(chrome), headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const checks = [], pageErrors = [];
let activePage;
try {
  for (const id of ['chair', 'cabinet']) {
    for (const kind of ['http503', 'integrity']) {
      const page = await browser.newPage(); activePage = page; page.setDefaultTimeout(60000);
      await page.setViewport({ width: 1280, height: 1000 });
      page.on('pageerror', error => pageErrors.push(error.message));
      const cdp = await page.createCDPSession();
      const attempts = { chair: 0, cabinet: 0 };
      let injected = false;
      cdp.on('Fetch.requestPaused', event => {
        const record = records.find(item => item.address === event.request.url);
        if (!record) return void cdp.send('Fetch.continueRequest', { requestId: event.requestId });
        attempts[record.id]++;
        if (record.id !== id || injected) {
          return void cdp.send('Fetch.continueRequest', { requestId: event.requestId });
        }
        injected = true;
        const body = kind === 'http503' ? Buffer.from('controlled private model failure') : Buffer.from(record.raw);
        if (kind === 'integrity') body[body.length - 1] ^= 1;
        void cdp.send('Fetch.fulfillRequest', { requestId: event.requestId,
          responseCode: kind === 'http503' ? 503 : 200,
          responseHeaders: [{ name: 'Content-Type', value: kind === 'http503' ? 'text/plain' : 'model/gltf-binary' }],
          body: body.toString('base64') });
      });
      await cdp.send('Fetch.enable', { patterns: records.map(record => ({ urlPattern: record.address, requestStage: 'Request' })) });
      await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page);
      await page.waitForFunction(() => /已加载 1 件模型/.test(document.body.innerText) &&
        /1 件加载失败，保留占位模型/.test(document.body.innerText));
      await page.waitForNetworkIdle({ idleTime: 150 });
      assert.equal(injected, true);
      assert.deepEqual(attempts, { chair: 1, cabinet: 1 }, 'No automatic failed-model request');
      await page.select('.toolbar select', id);
      assert.match(await page.$eval('.scene-panel', node => node.innerText), /模型加载失败，当前使用占位模型/);
      const hash = await inputHash(page), position = await selectedPosition(page);
      if (kind === 'http503') await page.screenshot({ path: resolve(output, `${id}-failed.png`), fullPage: true });
      await click(page, '重试失败模型'); await loaded(page);
      assert.equal(await inputHash(page), hash, 'Retry must preserve accepted input');
      assert.equal(await selectedPosition(page), position);
      assert.match(await page.$eval('.scene-panel', node => node.innerText), /Lux3D 模型已加载|程序生成模型已加载/);
      assert.equal(attempts[id], 2, 'One explicit retry makes one fresh request');
      assert.equal(attempts[id === 'chair' ? 'cabinet' : 'chair'], 1, 'Successful model is not downloaded again');
      checks.push({ id, fault: kind, status: 'PASS', attempts, accepted_hash: hash,
        failed_placeholder_visible: true, retry_preserves_pose_and_hash: true });
      await cdp.detach(); await page.close(); activePage = undefined;
    }
  }
  const page = await browser.newPage(); activePage = page; page.setDefaultTimeout(60000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page); await loaded(page);
  const before = await inputHash(page);
  await page.select('.toolbar select', 'chair');
  await page.click('[aria-label="向前移动"]'); await ready(page);
  assert.match(await selectedPosition(page), /z 3.05/);
  await page.select('.toolbar select', 'cabinet');
  await page.click('[aria-label="向右移动"]'); await ready(page);
  assert.match(await selectedPosition(page), /x 0.75/);
  assert.notEqual(await inputHash(page), before);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal((await page.$$('.role-summaries button')).length, 2);
  await page.screenshot({ path: resolve(output, 'narrow-real-models.png'), fullPage: true });
  checks.push({ status: 'PASS', case: '375px real chair/cabinet button moves and no horizontal overflow',
    viewport: { width: 375, height: 812 }, real_device: false });
  await page.setViewport({ width: 1280, height: 1000 });
  const hash = await inputHash(page);
  assert.equal(await page.evaluate(() => {
    window.__privateOldCanvas = document.querySelector('.viewport canvas');
    const extension = window.__privateOldCanvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  }), true);
  await page.waitForSelector('[data-testid="renderer-failure"]');
  assert.equal(await inputHash(page), hash);
  await click(page, '重试 3D 显示'); await loaded(page);
  await page.waitForFunction(() => !document.querySelector('[data-testid="renderer-failure"]'));
  assert.equal(await page.evaluate(() => document.querySelector('.viewport canvas') !== window.__privateOldCanvas), true);
  assert.equal(await inputHash(page), hash);
  await page.screenshot({ path: resolve(output, 'renderer-recovered.png'), fullPage: true });
  checks.push({ status: 'PASS', case: 'actual WebGL context loss and explicit reconstruction reloads two models preserving input',
    fault_injection: 'WEBGL_lose_context.loseContext()' });
  assert.deepEqual(pageErrors, []);
  const provenance = records.every(record => record.asset.provenance_summary === 'lux3d_web') ? 'lux3d_web' : 'procedural';
  const result = { status: 'PASS', scope: provenance === 'lux3d_web' ? 'PRIVATE_LOOPBACK_LUX3D_RESILIENCE' : 'PRIVATE_LOOPBACK_PROCEDURAL_RESILIENCE',
    source_kind: provenance, browser: await browser.version(),
    executed_at: new Date().toISOString(), assets: records.map(({ id, asset, raw }) => ({
      id, sha256: asset.content_hash, bytes: raw.length, provenance: asset.provenance_summary })), checks,
    public_deployment: 'NOT_RUN', physical_mobile_or_edge_safari: 'NOT_RUN', rights_status: 'PENDING' };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ status: 'FAIL', error: String(error) }, null, 2) + '\n');
  if (activePage) await activePage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }

async function ready(page) {
  await page.waitForFunction(() => !!document.querySelector('.report') &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
}
async function loaded(page) {
  await page.waitForFunction(() => /已加载 2 件模型/.test(document.body.innerText) &&
    !document.body.innerText.includes('件加载失败'));
}
async function click(page, label) {
  assert.equal(await page.evaluate(text => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
    if (!button || button.disabled) return false;
    button.click(); return true;
  }, label), true, `Enabled ${label}`);
}
async function inputHash(page) { return page.$eval('.report .hash', node => node.textContent); }
async function selectedPosition(page) { return page.$eval('[data-testid="selected-position"]', node => node.textContent); }
