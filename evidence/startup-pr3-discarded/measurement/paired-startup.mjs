// Experiment-only. Import or --validate never starts a browser. --run is explicit and one-shot.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, totalmem, platform, arch } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { safeResourceTimings } from './measurement/browser-spike/startup-trace.mjs';
import { analyzeStartupTrace } from './measurement/scripts/startup-trace-analysis.mjs';
const ROOT = dirname(fileURLToPath(import.meta.url));
const ORDER = [['A', 'B'], ['B', 'A'], ['A', 'B'], ['B', 'A'], ['A', 'B']];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const readOptional = path => { try { return readFileSync(path, 'utf8').trim(); } catch { return 'UNAVAILABLE'; } };
export function validateRegistration(reg) {
  assert.equal(reg.schema_version, 1);
  assert.ok(typeof reg.experiment_id === 'string' && reg.experiment_id.trim());
  assert.ok(['instrumentation_overhead', 'optimization'].includes(reg.purpose));
  assert.deepEqual(reg.pair_order, ORDER);
  assert.ok(typeof reg.baseline_definition === 'string' && reg.baseline_definition.trim());
  assert.ok(typeof reg.single_change === 'string' && reg.single_change.trim());
  assert.ok(typeof reg.trace_comparability_note === 'string' && reg.trace_comparability_note.trim());
  for (const key of ['A', 'B']) {
    const t = reg.treatments[key];
    const url = new URL(t.url);
    assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Explicit loopback URLs only');
    assert.ok(url.pathname.endsWith('/') && !url.search && !url.hash && !url.username && !url.password);
    assert.ok(['optional', 'required'].includes(t.trace_mode));
    assert.ok(typeof t.source_revision === 'string' && t.source_revision.trim());
    for (const field of ['source_fingerprint_sha256', 'lock_sha256', 'dist_manifest_sha256', 'core_hash'])
      assert.match(t[field], HASH, `${key}.${field}`);
  }
  assert.equal(reg.treatments.B.trace_mode, 'required', 'Instrumented candidate must require traces');
  assert.ok(reg.expected_runtime?.pyodide && reg.expected_runtime?.pydantic, 'Explicit same runtime versions required for both treatments');
  assert.ok(reg.chrome.executable && reg.chrome.expected_version);
  assert.ok(reg.driver.path);
  assert.match(reg.driver.sha256, HASH);
  assert.match(reg.harness_sha256, HASH);
  assert.match(reg.measurement_fingerprints_sha256, HASH);
  return reg;
}
export function stats(values) {
  assert.ok(values.length && values.every(Number.isFinite));
  const sorted = [...values].sort((a,b) => a-b);
  return { count: values.length, min: sorted[0], max: sorted.at(-1), p50: sorted[Math.ceil(sorted.length*.5)-1], p95: sorted[Math.ceil(sorted.length*.95)-1] };
}
export function decide(purpose, samples, pairs) {
  const complete = samples.length === 10 && samples.every(s => s.status === 'PASS') && pairs.length === 5 && pairs.every(p => p.status === 'PASS');
  if (!complete) return { valid_complete_comparison: false, recommendation: 'INCOMPLETE_OR_FAILED_NO_ADOPTION', optimization_gate: 'NOT_EVALUABLE', eligible_for_adoption_review: false };
  const savings = stats(pairs.map(p => p.saving_ms));
  const improving = pairs.filter(p => p.saving_ms > 0).length;
  if (purpose === 'instrumentation_overhead') return { valid_complete_comparison: true, purpose,
    paired_B_minus_A_overhead_ms: stats(pairs.map(p => -p.saving_ms)),
    recommendation: 'OVERHEAD_REPORTED_ONLY', optimization_gate: 'NOT_APPLICABLE', eligible_for_adoption_review: false };
  return { valid_complete_comparison: true, purpose, improving_pairs: improving, paired_saving_ms: savings,
    eligible_for_adoption_review: improving >= 4 && savings.p50 >= 100,
    optimization_gate: improving >= 4 && savings.p50 >= 100 ? 'PASS' : 'FAIL',
    recommendation: improving >= 4 && savings.p50 >= 100 ? 'ELIGIBLE_FOR_INDEPENDENT_ADOPTION_REVIEW' : 'DISCARD_OPTIMIZATION' };
}
export function invalidateForCleanup(result, error) {
  result.status = 'FAILED_BROWSER_CLEANUP'; result.cleanup_error = error.message;
  result.decision = { ...(result.decision ?? {}), valid_complete_comparison: false,
    eligible_for_adoption_review: false, optimization_gate: 'NOT_EVALUABLE', recommendation: 'FAILED_CLEANUP_NO_ADOPTION' };
}
function verifyFrozenMeasurement(reg) {
  const fingerprintsBytes = readFileSync(`${ROOT}/measurement-fingerprints.json`);
  assert.equal(sha(fingerprintsBytes), reg.measurement_fingerprints_sha256);
  const fp = JSON.parse(fingerprintsBytes);
  for (const [rel, digest] of Object.entries(fp.files)) assert.equal(sha(readFileSync(`${ROOT}/measurement/${rel}`)), digest, `Frozen helper/probe changed: ${rel}`);
  assert.equal(sha(readFileSync(fileURLToPath(import.meta.url))), reg.harness_sha256, 'Harness changed since registration');
  assert.equal(sha(readFileSync(reg.driver.path)), reg.driver.sha256, 'Driver entry changed');
  return fp;
}
async function captureDistribution(treatment) {
  const response = await fetch(new URL('preview-manifest.json', treatment.url), { signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `Distribution manifest HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha(bytes), treatment.dist_manifest_sha256, 'Served distribution differs from preregistration');
  const coreResponse = await fetch(new URL('engine/python/manifest.json', treatment.url), { signal: AbortSignal.timeout(15000) });
  assert.ok(coreResponse.ok);
  const coreBytes = Buffer.from(await coreResponse.arrayBuffer());
  const core = JSON.parse(coreBytes);
  assert.equal(core.bundle_sha256, treatment.core_hash, 'Served core differs from preregistration');
  return { dist_manifest_sha256: sha(bytes), manifest: JSON.parse(bytes), core_manifest_sha256: sha(coreBytes), core_manifest: core };
}
export async function runExperiment(regPath, output) {
  const registrationBytes = readFileSync(regPath);
  const registration = validateRegistration(JSON.parse(registrationBytes));
  const fingerprints = verifyFrozenMeasurement(registration);
  // Persistent claim is tied to exact preregistration; changing output cannot repeat this registration.
  const claimPath = `${resolve(regPath)}.run-claim`;
  closeSync(openSync(claimPath, 'wx'));
  closeSync(openSync(output, 'wx'));
  const result = { scope: 'ISOLATED_PREREGISTERED_STARTUP_COMPARISON', status: 'STARTING',
    started_at: new Date().toISOString(), registration, registration_sha256: sha(registrationBytes),
    measurement_fingerprints: fingerprints, harness_sha256: registration.harness_sha256,
    device: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logical_cpus: cpus().length, memory_bytes: totalmem(),
      requested_renderer: 'SwiftShader flags; no observed GPU identity claim',
      cgroup_cpu_max: readOptional('/sys/fs/cgroup/cpu.max'), cgroup_memory_max: readOptional('/sys/fs/cgroup/memory.max') },
    method: 'Fixed AB/BA/AB/BA/AB; one Chromium; ten sequential fresh contexts; no warm reload, extra hot Worker, retries or sample exclusion. Exact frozen production rAF predicate and real accepted edit; confirmation includes automation scheduling. Nearest-rank percentiles.',
    predefined_optimization_gate: { improving_pairs: 4, median_saving_ms: 100, applies_to: 'optimization only' },
    limits: ['Ten cold attempts only; hot150ms gate NOT_RUN by this harness; final original enforce required.',
      'Fresh browser contexts do not clear OS cache or all shared process state.',
      'Only synthetic localhost scene; real GLB, public network, Edge and Safari NOT_RUN.',
      'Trace stages may overlap; use thread epochs and analyzer, never sum marginal percentiles.',
      'No population statistical-significance claim. Source revision/fingerprint/lock declarations are pre-registered provenance; served distribution/core hashes and actual UI core are verified.'],
    distributions: {}, samples: [], pairs: [] };
  const persist = () => writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  persist();
  let browser;
  try {
    for (const key of ['A', 'B']) result.distributions[key] = await captureDistribution(registration.treatments[key]);
    persist();
    const { launch } = await import(pathToFileURL(resolve(registration.driver.path)).href);
    browser = await launch({ executablePath: registration.chrome.executable, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
    result.browser = await browser.version();
    assert.equal(result.browser, registration.chrome.expected_version, 'Browser version differs from registration');
    result.status = 'RUNNING'; persist();
    for (const [pairIndex, order] of ORDER.entries()) {
      for (const [orderIndex, label] of order.entries()) {
        const treatment = registration.treatments[label];
        const sample = { ordinal: result.samples.length + 1, pair: pairIndex + 1, within_pair_order: orderIndex + 1,
          treatment: label, trace_mode: treatment.trace_mode, cache: 'fresh_context', status: 'STARTING', stage: 'context' };
        result.samples.push(sample); persist();
        let context, page;
        try {
          context = await browser.createBrowserContext();
          page = await context.newPage();
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
          sample.stage = 'navigation';
          const response = await page.goto(treatment.url, { waitUntil: 'domcontentloaded' });
          assert.ok(response && response.ok(), `Preview navigation failed: ${response?.status()}`);
          sample.stage = 'editable_and_actual_edit';
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
          Object.assign(sample, measured, confirmed, { initial_input_hash: previous.trim() });
          sample.stage = 'resources_and_trace';
          sample.resources = await page.evaluate(safeResourceTimings, { base: treatment.url });
          // Preserve raw diagnostics before the analyzer can reject malformed/missing trace.
          persist();
          sample.startup_analysis = analyzeStartupTrace(measured.startup_traces.at(-1), measured.ui_worker.metadata, treatment.trace_mode === 'required');
          assert.equal(measured.ui_worker.metadata.core_hash, treatment.core_hash);
          assert.equal(measured.ui_worker.metadata.pyodide, registration.expected_runtime.pyodide, 'Actual UI Pyodide must match');
          assert.equal(measured.ui_worker.metadata.pydantic, registration.expected_runtime.pydantic, 'Actual UI Pydantic must match');
          assert.notEqual(sample.initial_input_hash, sample.accepted_input_hash);
          assert.ok(confirmed.first_edit_confirmed_ms >= measured.first_editable_ms);
          sample.status = 'PASS'; sample.stage = 'complete';
        } catch (error) {
          sample.status = 'FAIL'; sample.error = { name: error.name, message: error.message, stack: error.stack };
          if (page && !page.isClosed()) {
            try { sample.failure_measurement = await page.evaluate(() => window.__measurement ?? null); } catch {}
            try { sample.failure_resources = await page.evaluate(safeResourceTimings, { base: treatment.url }); } catch {}
          }
        } finally {
          try { if (context) await context.close(); }
          catch (error) { sample.status = 'FAIL'; sample.cleanup_error = error.message; }
          persist();
        }
      }
      const pairSamples = result.samples.filter(s => s.pair === pairIndex + 1);
      const a = pairSamples.find(s => s.treatment === 'A'), b = pairSamples.find(s => s.treatment === 'B');
      const pair = { pair: pairIndex + 1, order, status: 'FAIL' };
      if (a.status === 'PASS' && b.status === 'PASS') {
        pair.same_initial_hash = a.initial_input_hash === b.initial_input_hash;
        pair.same_edited_hash = a.accepted_input_hash === b.accepted_input_hash;
        pair.saving_ms = a.first_editable_ms - b.first_editable_ms;
        pair.confirmed_saving_ms = a.first_edit_confirmed_ms - b.first_edit_confirmed_ms;
        pair.status = pair.same_initial_hash && pair.same_edited_hash ? 'PASS' : 'FAIL';
        if (pair.status === 'FAIL') pair.error = 'Canonical initial/edited input hashes differ';
      } else pair.error = 'One or both fixed attempts failed; no replacement sample';
      result.pairs.push(pair); persist();
    }
    assert.equal(result.samples.length, 10);
    result.decision = decide(registration.purpose, result.samples, result.pairs);
    result.summary = {};
    for (const key of ['A', 'B']) {
      const samples = result.samples.filter(s => s.treatment === key);
      result.summary[key] = samples.every(s => s.status === 'PASS') ? {
        first_editable_ms: stats(samples.map(s => s.first_editable_ms)),
        first_edit_confirmed_ms: stats(samples.map(s => s.first_edit_confirmed_ms)),
        rules_ready_ms: stats(samples.map(s => s.rules_ready_ms)),
        first_editable_p95_le_3000_ms: stats(samples.map(s => s.first_editable_ms)).p95 <= 3000,
        cold_rules_p95_le_12000_ms: stats(samples.map(s => s.rules_ready_ms)).p95 <= 12000,
        hot_evaluation_p95_le_150_ms: 'NOT_RUN',
      } : { status: 'INCOMPLETE_NO_SUCCESS_ONLY_PERCENTILE', failed_attempts: samples.filter(s => s.status !== 'PASS').length };
    }
    result.status = result.decision.valid_complete_comparison ? 'COMPLETED' : 'FAILED_FIXED_COMPARISON';
  } catch (error) {
    result.status = 'FAILED_SETUP_OR_HARNESS';
    result.error = { name: error.name, message: error.message, stack: error.stack };
    result.unattempted_schedule = ORDER.flatMap((order, pair) => order.map((treatment, within) => ({ pair: pair + 1, within_pair_order: within + 1, treatment }))).slice(result.samples.length);
  } finally {
    try { if (browser) await browser.close(); }
    catch (error) { invalidateForCleanup(result, error); }
    result.finished_at = new Date().toISOString(); persist();
  }
  console.log(JSON.stringify({ output, status: result.status, decision: result.decision, summary: result.summary }, null, 2));
  if (result.status !== 'COMPLETED') process.exitCode = 1;
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, registrationPath, output] = process.argv.slice(2);
  assert.ok(['--validate', '--run'].includes(command), 'No implicit run: use --validate registration.json or --run registration.json output.json');
  assert.ok(registrationPath);
  if (command === '--validate') {
    const reg = validateRegistration(JSON.parse(readFileSync(registrationPath)));
    verifyFrozenMeasurement(reg);
    console.log('VALID_REGISTRATION_ONLY; NO_NETWORK; NO_BROWSER; NO_RESULT_CREATED');
  } else {
    assert.ok(output, 'Explicit output required');
    await runExperiment(registrationPath, output);
  }
}
