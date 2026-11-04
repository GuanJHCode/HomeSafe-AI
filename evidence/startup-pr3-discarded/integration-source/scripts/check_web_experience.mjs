// Isolated browser checks for T05/T07. Localhost results do not certify public hosting.
// node scripts/check_web_experience.mjs URL CHROMIUM PUPPETEER_ENTRY OUTPUT_DIR
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [url, executablePath, entry, outputDirectory] = process.argv.slice(2);
if (!url || !executablePath || !entry || !outputDirectory) throw new Error('Pass URL, Chromium, puppeteer-core entry and output directory.');
const { default: puppeteer } = await import(pathToFileURL(resolve(entry)).href);
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const downloads = await mkdtemp(join(tmpdir(), 'homesafe-ux-'));
await mkdir(outputDirectory, { recursive: true });
let page;
try {
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await page.setViewport({ width: 1280, height: 1000 });
  const proceduralGlb = triangleFixture();
  const fixtureScene = await (await fetch(new URL('engine/scene-before.json', url))).json();
  fixtureScene.objects.find(object => object.id === 'chair').asset_id = 'procedural-retry-chair';
  const fixtureAsset = {
    asset_id: 'procedural-retry-chair', content_hash: createHash('sha256').update(proceduralGlb).digest('hex'),
    render_url: 'assets/public/procedural-retry.glb', provenance_summary: 'procedural',
    calibration: { reviewed: true, revision: 1, strategy: 'runtime_axis_fit',
      orientation: { x: 0, y: 0, z: 0, w: 1 }, pivot_offset_after_rotation: { x: 0.5, y: 0, z: 1.5 },
      normalized_bounds_m: { width: 1, height: 2, depth: 3 } },
  };
  let fixtureMode = false, modelAttempts = 0;
  let heldConfig;
  let hold = true;
  // Target only page fetches; global interception can deadlock Worker startup.
  cdp.on('Fetch.requestPaused', event => {
    const path = new URL(event.request.url).pathname;
    const fulfill = (body, contentType = 'application/json') => cdp.send('Fetch.fulfillRequest', {
      requestId: event.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: contentType }],
      body: Buffer.from(body).toString('base64'),
    });
    if (fixtureMode && path.endsWith('/engine/scene-before.json')) {
      void fulfill(JSON.stringify(fixtureScene));
    } else if (fixtureMode && path.endsWith('/engine/assets.json')) {
      void fulfill(JSON.stringify([fixtureAsset]));
    } else if (fixtureMode && path.endsWith('/assets/public/procedural-retry.glb')) {
      modelAttempts++;
      if (modelAttempts === 1) void cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Failed' });
      else void fulfill(proceduralGlb, 'model/gltf-binary');
    } else if (hold && path.endsWith('/engine/config.json')) heldConfig = event.requestId;
    else void cdp.send('Fetch.continueRequest', { requestId: event.requestId });
  });
  await cdp.send('Fetch.enable', { patterns: ['*/engine/config.json', '*/engine/scene-before.json',
    '*/engine/assets.json', '*/assets/public/procedural-retry.glb'].map(urlPattern => ({ urlPattern, requestStage: 'Request' })) });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // This existing case exercises adopted UI cancellation. The lightweight
  // pre-adoption loader has its own cancellation regression.
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="检查结果"] button')]
    .some(button => button.textContent === '取消加载'));
  const configDeadline = Date.now() + 10000;
  while (!heldConfig && Date.now() < configDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(heldConfig, 'Startup must request runtime config within 10 seconds');
  await click('取消加载');
  await page.waitForFunction(() => document.body.textContent.includes('已取消加载。重试将重新加载规则'));
  assert.equal(await page.$('.report'), null, 'Cancelled startup must not expose an old report');
  hold = false;
  await cdp.send('Fetch.continueRequest', { requestId: heldConfig }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await page.$('.report'), null, 'A late startup response cannot publish a report');
  await click('重建 Worker 并重试');
  await ready();

  const baselineHash = await page.$eval('.hash', node => node.textContent);
  const summaryBefore = await page.$$eval('.role-summaries button', nodes => nodes.map(node => node.textContent));
  assert.equal(summaryBefore.length, 2);
  assert.match(summaryBefore[0], /儿童.*已触发/s);
  assert.match(summaryBefore[1], /老人.*已触发/s);
  const camera = await page.$eval('.viewport canvas', node => node.dataset.role);
  await page.click('.role-summaries button:nth-child(2)');
  assert.equal(await page.$eval('[aria-label="检查结果"] h2', node => node.textContent), '老人检查');
  assert.equal(await page.$eval('.viewport canvas', node => node.dataset.role), camera);
  assert.equal(await page.$eval('.hash', node => node.textContent), baselineHash);
  assert.deepEqual(await page.$$eval('.role-summaries button', nodes => nodes.map(node => node.textContent)), summaryBefore);

  await click('导出 JSON');
  await waitDownloads(1);
  await click('导出 JSON');
  const filenames = await waitDownloads(2);
  assert.notEqual(filenames[0], filenames[1]);
  const reports = await Promise.all(filenames.map(name => readFile(join(downloads, name), 'utf8').then(JSON.parse)));
  assert.deepEqual(reports[0], reports[1], 'Repeated names differ but accepted report bytes agree');
  assert.ok(baselineHash.includes(reports[0].input_hash));

  await page.setViewport({ width: 375, height: 812 });
  await page.select('.toolbar select', 'chair');
  await page.click('button[aria-label="向前移动"]');
  await ready();
  assert.match(await page.$eval('[data-testid="selected-position"]', node => node.textContent), /z 3.05/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal page overflow at 375px');
  assert.equal((await page.$$('.role-summaries button')).length, 2);
  await page.screenshot({ path: resolve(outputDirectory, 'narrow-screen.png'), fullPage: true });
  await page.emulateMediaType('print');
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  assert.ok(pdf.length > 1000);
  await writeFile(resolve(outputDirectory, 'action-list.pdf'), pdf);
  await page.emulateMediaType('screen');
  fixtureMode = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await page.waitForFunction(() => document.body.textContent.includes('1 件加载失败，保留占位模型'));
  const fixtureHash = await page.$eval('.hash', node => node.textContent);
  await click('重试失败模型');
  await page.waitForFunction(() => document.body.textContent.includes('已加载 1 件模型'));
  await page.select('.toolbar select', 'chair');
  assert.match(await page.$eval('.scene-panel', node => node.textContent), /程序生成模型已加载/);
  assert.equal(await page.$eval('.hash', node => node.textContent), fixtureHash);
  assert.equal(modelAttempts, 2, 'Explicit retry issues one fresh download');
  assert.deepEqual(errors, []);
  const result = {
    status: 'PASS', scope: 'ISOLATED_CHROMIUM_LOCALHOST_ONLY', url,
    browser: await browser.version(), executed_at: new Date().toISOString(),
    checks: ['startup cancel', 'late startup response discarded', 'fresh Worker retry',
      'simultaneous dual-role summaries', 'role focus preserves camera and report hash',
      'repeated-download unique names with equal content', '375px button move and no overflow', 'print PDF',
      'procedural model failed download then explicit retry loads without altering report hash'],
    filenames, procedural_model_retry: 'PASS', real_asset_retry: 'NOT_RUN', public_deployment: 'NOT_RUN',
  };
  await writeFile(resolve(outputDirectory, 'experience.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));

  async function click(label) {
    const clicked = await page.evaluate(text => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
      if (!button || button.disabled) return false;
      button.click(); return true;
    }, label);
    assert.equal(clicked, true, `Button ${label} enabled`);
  }
  async function ready() {
    await page.waitForFunction(() => !!document.querySelector('.report') &&
      document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
  }
  async function waitDownloads(count) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const files = (await readdir(downloads)).filter(name => name.endsWith('.json'));
      if (files.length >= count) return files;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Expected ${count} complete downloads`);
  }
} catch (error) {
  if (page) await writeFile(resolve(outputDirectory, 'failure.txt'), String(error) + '\n' + await page.evaluate(() => document.body.innerText));
  throw error;
} finally {
  await browser.close();
  await rm(downloads, { recursive: true, force: true });
}

// A three-vertex procedural GLB only; it is not a Lux3D model or a visual-quality fixture.
function triangleFixture() {
  const positions = new Float32Array([0, 0, 0, 1, 2, 0, 0, 0, 3]);
  const json = JSON.stringify({ asset: { version: '2.0', generator: 'HomeSafe procedural retry fixture' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,2,3] }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }], buffers: [{ byteLength: positions.byteLength }] });
  const padded = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const glb = Buffer.alloc(28 + padded.length + positions.byteLength);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); glb.set(padded, 20);
  glb.writeUInt32LE(positions.byteLength, 20 + padded.length); glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  glb.set(new Uint8Array(positions.buffer), 28 + padded.length);
  return glb;
}
