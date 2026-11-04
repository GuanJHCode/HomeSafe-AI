// Real isolated browser recovery checks. Test-only Worker tracking stays in this harness.
// node scripts/check_web_recovery.mjs URL CHROMIUM PUPPETEER_ENTRY OUTPUT_DIR
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [url, executablePath, entry, output] = process.argv.slice(2);
if (!url || !executablePath || !entry || !output) throw new Error('Pass URL, Chromium, puppeteer entry, output directory.');
const { default: puppeteer } = await import(pathToFileURL(resolve(entry)).href);
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
await mkdir(output, { recursive: true });
const page = await browser.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.evaluateOnNewDocument(() => {
    const NativeWorker = window.Worker;
    window.__recoveryWorkers = [];
    window.__recoveryActive = new Set();
    window.__recoveryRequests = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); window.__recoveryWorkers.push(this); window.__recoveryActive.add(this); }
      terminate() { window.__recoveryActive.delete(this); return super.terminate(); }
      postMessage(message, ...args) {
        window.__recoveryRequests.push(message.op);
        return super.postMessage(message, ...args);
      }
    };
  });
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  const initialHash = await hash();
  await page.select('.toolbar select', 'chair');
  await click('老人视角');
  await page.click('[aria-label="向前移动"]'); await ready();
  const movedHash = await hash();
  assert.notEqual(movedHash, initialHash);
  assert.match(await position(), /z 3.05/);
  const lost = await page.evaluate(() => {
    const canvas = document.querySelector('.viewport canvas');
    window.__oldRecoveryCanvas = canvas;
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  assert.equal(lost, true, 'A real WebGL context-loss extension must be available');
  await page.waitForSelector('[data-testid="renderer-failure"]', { timeout: 3000 });
  assert.equal(await hash(), movedHash, 'Context loss preserves current report');
  await page.screenshot({ path: resolve(output, 'context-lost.png'), fullPage: true });
  await page.click('[aria-label="向前移动"]'); await ready();
  assert.match(await position(), /z 2.80/);
  const fallbackHash = await hash();
  await click('重试 3D 显示');
  await page.waitForFunction(() => !document.querySelector('[data-testid="renderer-failure"]'));
  assert.equal(await page.evaluate(() => document.querySelector('.viewport canvas') !== window.__oldRecoveryCanvas), true);
  assert.equal(await page.$eval('.viewport canvas', node => node.dataset.role), 'elder');
  assert.equal(await page.$eval('.toolbar select', node => node.value), 'chair');
  assert.equal(await hash(), fallbackHash);
  await click('撤销'); await ready(); assert.equal(await hash(), movedHash);
  await click('撤销'); await ready(); assert.equal(await hash(), initialHash);
  await click('重做'); await ready(); assert.equal(await hash(), movedHash);

  const sentBeforeCrash = await crashIdleWorker();
  await page.click('[aria-label="向前移动"]');
  await failed();
  assert.match(await position(), /z 3.05/, 'Unaccepted proposal must not replace last legal pose');
  assert.equal(await page.evaluate(() => window.__recoveryRequests.length), sentBeforeCrash, 'Dead Worker receives no request');
  await click('重建 Worker 并重试'); await ready();
  assert.equal(await hash(), movedHash, 'Workspace retry preserves last accepted scene');
  assert.match(await position(), /z 3.05/);
  await click('撤销'); await ready(); assert.equal(await hash(), initialHash, 'Undo history survives Worker retry');

  await click('窗边挑战'); await ready();
  await page.select('.toolbar select', 'chair');
  await page.click('[aria-label="向前移动"]'); await ready();
  assert.match(await page.$eval('[data-testid="challenge-counts"]', node => node.textContent), /操作 1 步/);
  await crashIdleWorker();
  await page.click('[aria-label="向前移动"]'); await failed();
  assert.match(await page.$eval('[aria-label="检查结果"]', node => node.textContent), /重试会从本关初始布局开始/);
  await click('重建 Worker 并重试'); await ready();
  assert.match(await position(), /z 3.30/);
  assert.match(await page.$eval('[data-testid="challenge-counts"]', node => node.textContent), /操作 0 步/);
  await page.evaluateOnNewDocument(() => {
    const nativeContext = HTMLCanvasElement.prototype.getContext;
    window.__allowWebglCreation = false;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (!window.__allowWebglCreation && kind.startsWith('webgl')) return null;
      return nativeContext.call(this, kind, ...args);
    };
  });
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await page.waitForSelector('[data-testid="renderer-failure"]');
  const noRendererHash = await hash();
  assert.equal(await page.$('.viewport canvas'), null);
  await page.select('.toolbar select', 'chair');
  await page.click('[aria-label="向前移动"]'); await ready();
  const initialFallbackHash = await hash();
  assert.notEqual(initialFallbackHash, noRendererHash);
  await page.evaluate(() => { window.__allowWebglCreation = true; });
  await click('重试 3D 显示');
  await page.waitForFunction(() => !!document.querySelector('.viewport canvas') && !document.querySelector('[data-testid="renderer-failure"]'));
  assert.equal(await hash(), initialFallbackHash);
  const sceneFault = await page.createCDPSession();
  let heldScene = null, failScene = true;
  sceneFault.on('Fetch.requestPaused', event => {
    if (failScene) heldScene = event.requestId;
    else void sceneFault.send('Fetch.continueRequest', { requestId: event.requestId });
  });
  await sceneFault.send('Fetch.enable', { patterns: [{ urlPattern: '*/engine/scene-before.json', requestStage: 'Request' }] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__recoveryWorkers.length === 1);
  const sceneDeadline = Date.now() + 3000;
  while (!heldScene && Date.now() < sceneDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(heldScene, 'Scene response remains held until parallel Worker starts');
  failScene = false;
  await sceneFault.send('Fetch.fulfillRequest', { requestId: heldScene, responseCode: 503,
    body: Buffer.from('recovery test scene failure').toString('base64') });
  await page.waitForSelector('[aria-label="检查结果"] [role="alert"]');
  await page.waitForFunction(() => window.__recoveryActive.size === 0, { timeout: 3000 });
  assert.equal(await page.$('.report'), null, 'Terminal startup error cannot expose a report');
  assert.equal(await page.$eval('[aria-label="检查结果"]', node => node.getAttribute('aria-busy')), 'false');
  await page.evaluate(() => { window.__allowWebglCreation = true; });
  await click('重建 Worker 并重试'); await ready();
  assert.equal(await page.evaluate(() => window.__recoveryWorkers.length), 2);
  assert.equal(await page.evaluate(() => window.__recoveryActive.size), 1, 'Only the fresh retry Worker remains active');
  await sceneFault.detach();
  assert.deepEqual(errors, []);
  const receipt = { status: 'PASS', scope: 'ISOLATED_CHROMIUM_LOCALHOST_RECOVERY', url,
    executed_at: new Date().toISOString(), browser: await browser.version(),
    checks: ['real WebGL context lost visible warning', 'button fallback keeps evaluating',
      'explicit renderer reconstruction preserves layout/hash/selection/view/history',
      'idle Worker crash rejects next action without posting', 'failed proposal never accepted/replayed',
      'workspace Worker retry preserves scene and undo history', 'challenge retry explicitly resets scene and counters',
      'initial WebGL creation failure supports buttons and explicit renderer retry',
      'scene 503 after parallel Worker starts terminates that Worker; explicit retry uses one fresh Worker'],
    fault_injection: {
      context_loss: 'WEBGL_lose_context.loseContext() on actual WebGL2 context',
      worker: 'test terminates actual Worker then dispatches terminal error event; not a naturally occurring browser crash',
      initial_renderer: 'test getContext returns null for WebGL until explicit retry; original native getContext then restored by test gate',
      parallel_startup: 'page-only CDP holds scene response until Worker creation, then returns HTTP503',
    },
    real_assets: 'NOT_RUN', public_host: 'NOT_RUN', edge_safari: 'NOT_RUN' };
  await writeFile(resolve(output, 'recovery.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  await writeFile(resolve(output, 'failure.txt'), String(error) + '\n' + await page.evaluate(() => document.body.innerText));
  throw error;
} finally { await browser.close(); }
async function click(text) {
  const clicked = await page.evaluate(label => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === label);
    if (!button || button.disabled) return false;
    button.click(); return true;
  }, text);
  assert.equal(clicked, true, `Enabled button ${text}`);
}
async function ready() {
  await page.waitForFunction(() => !!document.querySelector('.report') &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
}
async function failed() {
  await page.waitForFunction(() => !document.querySelector('.report') &&
    document.querySelector('[aria-label="检查结果"]')?.textContent.includes('Worker crashed'), { timeout: 3000 });
}
async function hash() { return page.$eval('.hash', node => node.textContent); }
async function position() { return page.$eval('[data-testid="selected-position"]', node => node.textContent); }
async function crashIdleWorker() {
  return page.evaluate(() => {
    const worker = window.__recoveryWorkers.at(-1);
    worker.terminate();
    worker.dispatchEvent(new Event('error'));
    return window.__recoveryRequests.length;
  });
}
