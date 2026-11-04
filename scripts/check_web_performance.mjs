// Isolated local-session measurements of an explicitly supplied preview. No deployment or uploads.
// node scripts/check_web_performance.mjs URL CHROMIUM PUPPETEER_ENTRY
import assert from 'node:assert/strict';
import { safeResourceTimings } from '../browser-spike/startup-trace.mjs';
import { analyzeStartupTrace } from './startup-trace-analysis.mjs';
import { cpus, totalmem, platform, arch } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [url, chrome, driver, budgetMode = "report", traceMode = "optional"] = process.argv.slice(2);
assert.ok(["optional", "required"].includes(traceMode), "Trace mode must be optional or required");
assert.ok(["report", "enforce"].includes(budgetMode), "Budget mode must be report or enforce");
if (!url || !chrome || !driver) throw new Error('Pass preview URL, isolated Chromium and puppeteer-core entry.');
const { launch } = await import(pathToFileURL(resolve(driver)).href);
const browser = await launch({ executablePath: chrome, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const samples = [];
try {
  // Each context starts with an empty browser cache; warm reload reuses that context.
  for (let trial = 0; trial < 5; trial++) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
      page.setDefaultTimeout(120000);
      await page.evaluateOnNewDocument(() => {
        window.__measurement = { first_observation_ms: null, rules_ready_ms: null, first_editable_ms: null,
          startup_traces: [], long_tasks: [], long_tasks_supported: false };
        window.addEventListener('homesafe-startup-trace', event => {
          try {
            const detail = event.detail;
            const generation = detail?.window_trace?.generation;
            if (!Number.isSafeInteger(generation) || generation <= 0) return;
            const attempts = window.__measurement.startup_traces;
            let attempt = attempts.find(item => item.generation === generation);
            if (!attempt) { attempt = { generation }; attempts.push(attempt); }
            attempt.window_trace = detail.window_trace;
            if (detail.worker_trace?.generation === generation) attempt.worker_trace = detail.worker_trace;
            if (attempts.length > 8) attempts.splice(0, attempts.length - 8);
          } catch { /* Observer failure must not affect readiness. */ }
        });
        try {
          if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
            const observer = new PerformanceObserver(list => {
              try {
                for (const entry of list.getEntries()) {
                  if (window.__measurement.long_tasks.length >= 96) break;
                  if (Number.isFinite(entry.startTime) && Number.isFinite(entry.duration))
                    window.__measurement.long_tasks.push({ start_ms: entry.startTime,
                      start_epoch_ms: performance.timeOrigin + entry.startTime, duration_ms: entry.duration });
                }
              } catch { /* No task attribution/URLs or application changes. */ }
            });
            observer.observe({ type: 'longtask', buffered: true });
            window.__measurement.long_tasks_supported = true;
          }
        } catch { /* Unsupported browser diagnostics are explicitly unavailable. */ }
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
                  startup_resources: data.startup_resources ?? [],
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
      for (const cache of ['cold', 'warm']) {
        const response = cache === 'cold'
          ? await page.goto(url, { waitUntil: 'domcontentloaded' })
          : await page.reload({ waitUntil: 'domcontentloaded' });
        assert.ok(response && (response.ok() || (cache === 'warm' && response.status() === 304)),
          `Preview navigation failed: ${response?.status()}`);
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
        const resources = await page.evaluate(safeResourceTimings, { base: url });
        const traceAnalysis = analyzeStartupTrace(measured.startup_traces.at(-1), measured.ui_worker.metadata, traceMode === 'required');
        samples.push({ trial: trial + 1, cache, ...measured, ...confirmed, resources, startup_analysis: traceAnalysis });
      }
      if (trial === 0) {
        // A separate real module Worker exercises the canonical engine; does not alter UI/history.
        const engine = await page.evaluate(async () => {
          const base = new URL('.', location.href).href;
          const config = await (await fetch(new URL('engine/config.json', base))).json();
          const scene = await (await fetch(new URL('engine/scene-before.json', base))).json();
          const worker = new Worker(new URL('engine/rule-worker.mjs', base), { type: 'module' });
          let id = 0;
          const request = (op, payload) => new Promise((resolve, reject) => {
            const requestId = ++id;
            const start = performance.now();
            const timer = setTimeout(() => { cleanup(); reject(new Error('Measurement Worker timeout')); }, 120000);
            const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', fail); };
            const fail = () => { cleanup(); reject(new Error('Measurement Worker failed')); };
            const receive = ({ data }) => {
              if (data.id !== requestId) return;
              cleanup();
              if (!data.ok) reject(new Error(data.error?.message || 'Evaluation failed'));
              else resolve({ data, roundtrip_ms: performance.now() - start });
            };
            worker.addEventListener('message', receive); worker.addEventListener('error', fail);
            worker.postMessage({ id: requestId, op, payload, clientRevision: requestId });
          });
          try {
            const init = await request('init', { config, base });
            const evaluations = [];
            for (let index = 0; index < 33; index++) {
              const reply = await request('evaluate', { scene });
              if (index >= 3) evaluations.push({ evaluation_ms: reply.data.evaluation_ms,
                roundtrip_ms: reply.roundtrip_ms, input_hash: reply.data.result.input_hash });
            }
            return { metadata: init.data.result, warmup_count: 3, samples: evaluations };
          } finally { worker.terminate(); }
        });
        assert.equal(new Set(engine.samples.map(sample => sample.input_hash)).size, 1);
        samples[0].engine = engine;
      }
    } finally { await context.close(); }
  }
  const stats = values => {
    assert.ok(values.length && values.every(value => Number.isFinite(value) && value >= 0));
    const sorted = [...values].sort((a, b) => a - b);
    return { count: values.length, min: sorted[0], max: sorted.at(-1), p50: sorted[Math.ceil(sorted.length * .5) - 1],
      p95: sorted[Math.ceil(sorted.length * .95) - 1] };
  };
  const cold = samples.filter(sample => sample.cache === 'cold');
  const warm = samples.filter(sample => sample.cache === 'warm');
  const engine = samples[0].engine;
  delete samples[0].engine;
  const summary = {
    first_observation: stats(cold.map(sample => sample.first_observation_ms)),
    cold_first_editable: stats(cold.map(sample => sample.first_editable_ms)),
    warm_first_editable: stats(warm.map(sample => sample.first_editable_ms)),
    cold_first_edit_confirmed: stats(cold.map(sample => sample.first_edit_confirmed_ms)),
    cold_document_to_worker: stats(cold.map(sample => sample.ui_worker.created_ms)),
    cold_init_request_roundtrip: stats(cold.map(sample => sample.ui_worker.init_received_ms - sample.ui_worker.init_sent_ms)),
    cold_worker_initialization: stats(cold.map(sample => sample.ui_worker.metadata.total_ready_ms)),
    cold_worker_init_received: stats(cold.map(sample => sample.ui_worker.init_received_ms)),
    cold_after_worker_to_editable: stats(cold.map(sample => sample.first_editable_ms - sample.ui_worker.init_received_ms)),
    cold_rules_ready: stats(cold.map(sample => sample.rules_ready_ms)),
    warm_rules_ready: stats(warm.map(sample => sample.rules_ready_ms)),
    hot_evaluation: stats(engine.samples.map(sample => sample.evaluation_ms)),
    hot_roundtrip: stats(engine.samples.map(sample => sample.roundtrip_ms)),
  };
  const targets = { first_editable_p95_le_3000_ms: summary.cold_first_editable.p95 <= 3000,
    cold_rules_le_12000_ms: summary.cold_rules_ready.p95 <= 12000,
    hot_evaluation_p95_le_150_ms: summary.hot_evaluation.p95 <= 150 };
  console.log(JSON.stringify({ scope: 'ISOLATED_BROWSER_MEASUREMENT', url, measured_at: new Date().toISOString(),
    browser: await browser.version(), device: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
      logical_cpus: cpus().length, memory_bytes: totalmem(), requested_renderer: 'SwiftShader software rendering (launch flags; not observed GPU identity)' },
    network: 'No throttling; only the supplied URL/network was measured. No other-network claim.',
    method: 'Five fresh contexts and paired cached reloads; rAF selects chair through DOM change event and measures enabled movement with accepted report, idle evaluation and rendered canvas. Every sample clicks move and requires a changed accepted hash. Confirmation time includes harness scheduling and is reported separately. Nearest-rank percentiles; 30 real Worker evaluations after 3 warmups.',
    limits: ['First observation is diagnostic only; the 3s target uses cold first-editable p95. Every sample verifies an actual accepted edit.', 'Placeholder model scene; real Lux3D load/render/release performance NOT_RUN.',
      'Fresh contexts isolate browser cache, not operating-system caches or all runtime process reuse.',
      'Localhost results do not establish anonymous HTTPS or public performance.', 'Chrome only; Edge and Safari NOT_RUN.'],
    budget_mode: budgetMode, trace_mode: traceMode,
    trace_method: 'Bounded passive application marks plus allowlisted Resource Timing and unattributed Window long tasks. Separate Window/Worker epochs. Stage intervals may overlap; do not add stage p95s or equate residuals to compilation. Observation overhead must be measured against the same uninstrumented baseline.',
    targets, summary, samples, engine }, null, 2));
  if (budgetMode === 'enforce' && Object.values(targets).some(pass => !pass)) process.exitCode = 1;
} finally { await browser.close(); }
