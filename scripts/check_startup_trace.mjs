// Functional diagnostics, not a performance experiment. Own isolated browser only.
// node scripts/check_startup_trace.mjs URL CHROMIUM PUPPETEER_ENTRY OUTPUT_DIR
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeStartupTrace } from './startup-trace-analysis.mjs';
import { failNextConfig } from './browser_fault.mjs';
const [url, chrome, driver, output] = process.argv.slice(2);
if (!url || !chrome || !driver || !output) throw new Error('Pass URL, Chromium, puppeteer entry, output directory.');
const { launch } = await import(pathToFileURL(resolve(driver)).href);
const browser = await launch({ executablePath: chrome, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
await mkdir(output, { recursive: true });
const receipts = [];
try {
  for (const kind of ['happy', 'failed_init', 'cancel_parallel_init']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    page.setDefaultTimeout(30000);
    try {
      await page.evaluateOnNewDocument(() => {
        window.__traceAttempts = []; window.__traceMetadata = null; window.__traceResources = [];
        window.addEventListener('homesafe-startup-trace', ({detail}) => {
          const generation = detail?.window_trace?.generation;
          if (!generation) return;
          let attempt = window.__traceAttempts.find(item => item.generation === generation);
          if (!attempt) { attempt = {generation}; window.__traceAttempts.push(attempt); }
          attempt.window_trace = detail.window_trace;
          if (detail.worker_trace?.generation === generation) attempt.worker_trace = detail.worker_trace;
        });
        const Native = window.Worker;
        window.__traceWorkers = {created:0,active:new Set()};
        window.Worker = class extends Native {
          constructor(...args) {
            super(...args); window.__traceWorkers.created++; window.__traceWorkers.active.add(this);
            this.addEventListener('message', ({data}) => {
              if (data?.ok && data.result?.core_hash) {
                window.__traceMetadata = data.result; window.__traceResources = data.startup_resources;
              }
            });
          }
          terminate() { window.__traceWorkers.active.delete(this); return super.terminate(); }
        };
      });
      let heldScene, cdp;
      if (kind === 'failed_init') {
        const config = await (await fetch(new URL('engine/config.json', url))).json();
        await failNextConfig(page, 'config.json', { ...config, pyodideIndexURL:'./missing-runtime/' });
      }
      if (kind === 'cancel_parallel_init') {
        cdp = await page.createCDPSession();
        cdp.on('Fetch.requestPaused', event => {
          if (!heldScene) heldScene = event.requestId;
          else void cdp.send('Fetch.continueRequest', {requestId:event.requestId});
        });
        await cdp.send('Fetch.enable', { patterns:[{urlPattern:'*/engine/scene-before.json',requestStage:'Request'}] });
      }
      await page.goto(url, {waitUntil:'domcontentloaded'});
      let previous = null;
      if (kind === 'failed_init') {
        await page.waitForSelector('[aria-label="检查结果"] [role="alert"]');
        previous = await page.evaluate(() => structuredClone(window.__traceAttempts[0]));
        assert.equal(previous.window_trace.status, 'failed');
        assert.equal(previous.worker_trace.status, 'failed');
        assert.equal(await page.evaluate(() => window.__traceWorkers.active.size), 0);
        await click('重建 Worker 并重试');
      }
      if (kind === 'cancel_parallel_init') {
        await page.waitForFunction(() => window.__traceWorkers.created === 1);
        const sceneDeadline = Date.now() + 10000;
        while (!heldScene && Date.now() < sceneDeadline) await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(heldScene, 'Scene request must be held before cancellation');
        await click('取消加载');
        previous = await page.evaluate(() => structuredClone(window.__traceAttempts[0]));
        assert.equal(previous.window_trace.status, 'cancelled');
        assert.equal(await page.evaluate(() => window.__traceWorkers.active.size), 0);
        await cdp.send('Fetch.continueRequest', {requestId:heldScene}).catch(() => {});
        await click('重建 Worker 并重试');
      }
      await page.waitForFunction(() => document.querySelector('.report .hash') &&
        window.__traceAttempts.at(-1)?.window_trace?.events.some(event => event.phase === 'edit_eligible'));
      const data = await page.evaluate(() => ({ attempts:window.__traceAttempts, metadata:window.__traceMetadata,
        resources:window.__traceResources, workers:{created:window.__traceWorkers.created,active:window.__traceWorkers.active.size} }));
      const analysis = analyzeStartupTrace(data.attempts.at(-1), data.metadata, true);
      assert.equal(data.workers.active, 1);
      assert.equal(data.workers.created, kind === 'happy' ? 1 : 2);
      if (previous) {
        assert.deepEqual(data.attempts[0], previous, 'Old failed/cancelled attempt must not be mutated by retry');
        assert.equal(data.attempts.at(-1).generation, 2);
        assert.equal(data.attempts.at(-1).worker_trace.generation, 2);
      }
      assert.doesNotMatch(JSON.stringify(data.attempts), /https?:|missing-runtime|scene_id|object_ids|password|api_key/);
      assert.doesNotMatch(JSON.stringify(data.resources), /https?:|\.glb|\?/);
      const before = await page.$eval('.report .hash', node => node.textContent);
      await page.select('.toolbar select', 'chair'); await page.click('button[aria-label="向前移动"]');
      await page.waitForFunction(hash => document.querySelector('.report .hash')?.textContent &&
        document.querySelector('.report .hash').textContent !== hash, {}, before);
      assert.deepEqual(pageErrors, []);
      receipts.push({case:kind,status:'PASS',...data,analysis});
      async function click(label) {
        assert.equal(await page.evaluate(text => {
          const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
          if (!button || button.disabled) return false; button.click(); return true;
        }, label), true);
      }
    } catch (error) {
      await writeFile(resolve(output, `${kind}-failure.txt`), String(error)+'\n'+await page.evaluate(() => document.body.innerText));
      throw error;
    } finally { await context.close(); }
  }
  const manifest = await (await fetch(new URL('preview-manifest.json',url))).arrayBuffer();
  const result = {status:'PASS',scope:'ISOLATED_CHROMIUM_LOCALHOST_TRACE_FUNCTIONAL_NOT_PERFORMANCE',
    source_base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    distribution_manifest_sha256:createHash('sha256').update(new Uint8Array(manifest)).digest('hex'),
    browser:await browser.version(),executed_at:new Date().toISOString(),receipts,
    limits:['Faults intentionally injected through page-only CDP; no natural outage claim.',
      'No timing target claim from this functional run; full fixed profile/overhead experiment separate.',
      'Private models, public hosting, Edge/Safari NOT_RUN.']};
  await writeFile(resolve(output,'trace-functional.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,cases:receipts.map(item=>item.case),browser:result.browser}));
} finally {await browser.close();}
