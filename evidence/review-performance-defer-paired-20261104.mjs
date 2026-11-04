// Fixed one-shot AB/BA experiment. No production files are changed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, totalmem, platform, arch } from 'node:os';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const [baselineUrl, deferredUrl, chrome, driver, output] = process.argv.slice(2);
assert.ok(baselineUrl && deferredUrl && chrome && driver && output, 'Pass baseline URL, deferred URL, Chromium, Puppeteer entry, result JSON');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = JSON.parse(readFileSync(`${root}/paired-source-fingerprint.json`, 'utf8'));
const provenance = JSON.parse(readFileSync(`${root}/experiment-provenance.json`, 'utf8'));
const probe = readFileSync('/workspace/HomeSafe-AI-continuation/scripts/check_web_performance.mjs', 'utf8');
assert.equal(sha(probe), fingerprint.production_probe_sha256, 'Production measurement source changed');
assert.equal(baselineUrl, fingerprint.baseline_url);
const urls = { baseline: baselineUrl, deferred: deferredUrl };
const distributions = {};
for (const treatment of ['baseline', 'deferred']) {
  const response = await fetch(new URL('preview-manifest.json', urls[treatment]));
  assert.ok(response.ok, `${treatment} manifest must be served`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const expected = treatment === 'baseline' ? provenance.source_distribution_manifest_sha256 : provenance.experimental_distribution_manifest_sha256;
  assert.equal(sha(bytes), expected, `${treatment} distribution changed`);
  const coreResponse = await fetch(new URL('engine/python/manifest.json', urls[treatment]));
  assert.ok(coreResponse.ok);
  const core = await coreResponse.json();
  distributions[treatment] = { url: urls[treatment], manifest_sha256: sha(bytes), core_hash: core.bundle_sha256 };
}
assert.notEqual(distributions.baseline.core_hash, distributions.deferred.core_hash);
assert.equal(distributions.deferred.core_hash, provenance.core_bundle_sha256);
const plannedPairs = Array.from({ length: 5 }, (_, index) => ({ pair: index + 1,
  order: index % 2 === 0 ? ['baseline', 'deferred'] : ['deferred', 'baseline'] }));
const result = {
  scope: 'ISOLATED_FINAL_FIXED_PAIRED_DEFER_BUILD_EXPERIMENT', status: 'IN_PROGRESS',
  started_at: new Date().toISOString(), planned_pairs: plannedPairs,
  predefined_decision: { minimum_improving_pairs: 4, minimum_paired_median_saving_ms: 100,
    separate_candidate_first_editable_p95_target_ms: 3000, automatic_production_promotion: false },
  source_fingerprint: fingerprint, harness_sha256: sha(readFileSync(fileURLToPath(import.meta.url))), distributions,
  device: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logical_cpus: cpus().length, memory_bytes: totalmem(),
    requested_renderer: 'SwiftShader software rendering (launch flags; not observed GPU identity)' },
  method: 'Exactly five AB/BA/AB/BA/AB pairs, one shared Chromium, ten sequential fresh contexts. Exact production rAF editable predicate and real move/hash confirmation. No cached reload, extra Worker or hot evaluation phase. Nearest-rank percentiles. Confirmation time includes harness scheduling.',
  limits: ['Fresh contexts isolate browser cache, not OS caches or all process reuse.', 'Only localhost Chrome and placeholder scene measured; no public HTTPS, real Lux3D, Edge or Safari claim.', 'Five fixed pairs provide bounded evidence, not a statistical population estimate.'],
  samples: [], pairs: [],
};
// Prevent accidental repeat/overwrite of the pre-registered final run.
closeSync(openSync(output, 'wx'));
const persist = () => writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
persist();
let browser;
try {
  const { launch } = await import(pathToFileURL(resolve(driver)).href);
  browser = await launch({ executablePath: chrome, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
  result.browser = await browser.version();
  for (const pair of plannedPairs) {
    for (const [orderIndex, treatment] of pair.order.entries()) {
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
        page.setDefaultTimeout(120000);
      await page.evaluateOnNewDocument(() => {
        window.__measurement = { first_observation_ms: null, rules_ready_ms: null, first_editable_ms: null };
        // Passive test instrumentation of the actual application Worker (not the
        // separate warm engine probe). Messages and product state are untouched.
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(workerUrl, options) {
            super(workerUrl, options);
            const createdMs = performance.now();
            let initSentMs = null;
            const nativePost = this.postMessage.bind(this);
            this.postMessage = (message, ...rest) => {
              if (message?.op === 'init' && initSentMs === null) initSentMs = performance.now();
              return nativePost(message, ...rest);
            };
            this.addEventListener('message', ({ data }) => {
              const result = data?.result;
              if (!window.__measurement.ui_worker && data?.ok && result?.core_hash &&
                  result?.pyodide && Number.isFinite(result.total_ready_ms)) {
                window.__measurement.ui_worker = {
                  created_ms: createdMs, init_sent_ms: initSentMs,
                  init_received_ms: performance.now(), metadata: result,
                };
              }
            });
          }
        };
        function inspect() {
          const measure = window.__measurement;
          const canvas = document.querySelector('canvas[aria-label="样例客厅三维场景"]');
          const viewButton = document.querySelector('[aria-label="观察视角"] button:not(:disabled)');
          if (measure.first_observation_ms === null && canvas?.width > 0 && viewButton)
            measure.first_observation_ms = performance.now();
          const ready = document.querySelector('[aria-label="检查结果"][aria-busy="false"]');
          if (measure.rules_ready_ms === null && ready && document.querySelector('.report .hash'))
            measure.rules_ready_ms = performance.now();
          // Select a movable object through the same DOM event as a user. Merely seeing
          // the canvas or a stale report cannot satisfy the editing readiness metric.
          const select = document.querySelector('.toolbar select');
          if (select && !select.disabled && select.value !== 'chair') {
            select.value = 'chair';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const move = document.querySelector('button[aria-label="向前移动"]');
          if (measure.first_editable_ms === null && ready && canvas?.width > 0 &&
              document.querySelector('.report .hash')?.textContent?.trim() &&
              select?.value === 'chair' && move && !move.disabled &&
              !document.querySelector('[data-testid="renderer-failure"]'))
            measure.first_editable_ms = performance.now();
          if (measure.first_observation_ms === null || measure.rules_ready_ms === null ||
              measure.first_editable_ms === null) requestAnimationFrame(inspect);
        }
        requestAnimationFrame(inspect);
      });
        const response = await page.goto(urls[treatment], { waitUntil: 'domcontentloaded' });
        assert.ok(response && response.ok(), `Preview navigation failed: ${response?.status()}`);
        await page.waitForFunction(() => window.__measurement.first_editable_ms !== null);
        const measured = await page.evaluate(() => window.__measurement);
        assert.ok(measured.ui_worker && Number.isFinite(measured.ui_worker.init_sent_ms),
          'Actual application Worker initialization metadata and request time must be observed');
        // Prove the measured controls actually submit and accept a new canonical result.
        const previous = await page.$eval('.report .hash', node => node.textContent);
        await page.click('button[aria-label="向前移动"]');
        await page.waitForFunction(hash => {
          const panel = document.querySelector('[aria-label="检查结果"]');
          const current = document.querySelector('.report .hash')?.textContent;
          return panel?.getAttribute('aria-busy') === 'false' && current && current !== hash &&
            !document.querySelector('button[aria-label="向前移动"]').disabled;
        }, {}, previous);
        const confirmed = await page.evaluate(() => ({
          first_edit_confirmed_ms: performance.now(),
          accepted_input_hash: document.querySelector('.report .hash').textContent.trim(),
        }));
        assert.equal(measured.ui_worker.metadata.core_hash, distributions[treatment].core_hash, 'Actual UI used expected core');
        assert.ok(confirmed.first_edit_confirmed_ms >= measured.first_editable_ms);
        assert.notEqual(confirmed.accepted_input_hash, previous.trim());
        result.samples.push({ pair: pair.pair, within_pair_order: orderIndex + 1, treatment,
          initial_input_hash: previous.trim(), ...measured, ...confirmed });
        persist();
      } finally { await context.close(); }
    }
    const baseline = result.samples.find(sample => sample.pair === pair.pair && sample.treatment === 'baseline');
    const deferred = result.samples.find(sample => sample.pair === pair.pair && sample.treatment === 'deferred');
    assert.equal(baseline.initial_input_hash, deferred.initial_input_hash, 'Same initial canonical input');
    assert.equal(baseline.accepted_input_hash, deferred.accepted_input_hash, 'Same real edit canonical input');
    result.pairs.push({ pair: pair.pair, order: pair.order,
      baseline_first_editable_ms: baseline.first_editable_ms, deferred_first_editable_ms: deferred.first_editable_ms,
      saving_ms: baseline.first_editable_ms - deferred.first_editable_ms,
      confirmed_saving_ms: baseline.first_edit_confirmed_ms - deferred.first_edit_confirmed_ms });
    persist();
  }
  assert.equal(result.samples.length, 10, 'All ten actual accepted edits required');
  assert.equal(result.pairs.length, 5);
  const stats = values => {
    assert.ok(values.length && values.every(Number.isFinite));
    const sorted = [...values].sort((a, b) => a - b);
    return { count: values.length, min: sorted[0], max: sorted.at(-1),
      p50: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1] };
  };
  result.summary = {};
  for (const treatment of ['baseline', 'deferred']) {
    const samples = result.samples.filter(sample => sample.treatment === treatment);
    result.summary[treatment] = {
      first_editable: stats(samples.map(sample => sample.first_editable_ms)),
      first_edit_confirmed: stats(samples.map(sample => sample.first_edit_confirmed_ms)),
      document_to_worker: stats(samples.map(sample => sample.ui_worker.created_ms)),
      init_received: stats(samples.map(sample => sample.ui_worker.init_received_ms)),
      worker_initialization: stats(samples.map(sample => sample.ui_worker.metadata.total_ready_ms)),
      after_worker_to_editable: stats(samples.map(sample => sample.first_editable_ms - sample.ui_worker.init_received_ms)),
    };
  }
  const saving = stats(result.pairs.map(pair => pair.saving_ms));
  const improvingPairs = result.pairs.filter(pair => pair.saving_ms > 0).length;
  result.decision = { improving_pairs: improvingPairs, paired_saving_ms: saving,
    passes_predefined_benefit_gate: improvingPairs >= 4 && saving.p50 >= 100,
    candidate_first_editable_p95_le_3000_ms: result.summary.deferred.first_editable.p95 <= 3000,
    actual_accepted_edits: result.samples.length, same_initial_and_edited_hash_in_every_pair: true,
    recommendation: improvingPairs >= 4 && saving.p50 >= 100 ? 'ELIGIBLE_FOR_INDEPENDENT_ADOPTION_REVIEW' : 'DISCARD_EXPERIMENT' };
  result.status = 'COMPLETED';
  result.finished_at = new Date().toISOString();
  persist();
  console.log(JSON.stringify({ output, status: result.status, summary: result.summary, decision: result.decision }, null, 2));
} catch (error) {
  result.status = 'FAILED';
  result.error = { message: error.message, stack: error.stack };
  persist();
  throw error;
} finally { if (browser) await browser.close(); }
