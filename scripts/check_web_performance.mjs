// Read-only measurements of an explicitly supplied preview. No deployment or uploads.
// node scripts/check_web_performance.mjs URL CHROMIUM PUPPETEER_ENTRY
import assert from 'node:assert/strict';
import { cpus, totalmem, platform, arch } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [url, chrome, driver] = process.argv.slice(2);
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
        window.__measurement = { first_observation_ms: null, rules_ready_ms: null };
        function inspect() {
          const measure = window.__measurement;
          const canvas = document.querySelector('canvas[aria-label="样例客厅三维场景"]');
          const viewButton = document.querySelector('[aria-label="观察视角"] button:not(:disabled)');
          if (measure.first_observation_ms === null && canvas?.width > 0 && viewButton)
            measure.first_observation_ms = performance.now();
          const ready = document.querySelector('[aria-label="检查结果"][aria-busy="false"]');
          if (measure.rules_ready_ms === null && ready && document.querySelector('.report .hash'))
            measure.rules_ready_ms = performance.now();
          if (measure.first_observation_ms === null || measure.rules_ready_ms === null) requestAnimationFrame(inspect);
        }
        requestAnimationFrame(inspect);
      });
      for (const cache of ['cold', 'warm']) {
        const response = cache === 'cold'
          ? await page.goto(url, { waitUntil: 'domcontentloaded' })
          : await page.reload({ waitUntil: 'domcontentloaded' });
        assert.ok(response && (response.ok() || (cache === 'warm' && response.status() === 304)),
          `Preview navigation failed: ${response?.status()}`);
        await page.waitForFunction(() => window.__measurement.rules_ready_ms !== null);
        samples.push({ trial: trial + 1, cache, ...await page.evaluate(() => window.__measurement) });
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
    cold_rules_ready: stats(cold.map(sample => sample.rules_ready_ms)),
    warm_rules_ready: stats(warm.map(sample => sample.rules_ready_ms)),
    hot_evaluation: stats(engine.samples.map(sample => sample.evaluation_ms)),
    hot_roundtrip: stats(engine.samples.map(sample => sample.roundtrip_ms)),
  };
  console.log(JSON.stringify({ scope: 'ISOLATED_BROWSER_MEASUREMENT', url, measured_at: new Date().toISOString(),
    browser: await browser.version(), device: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
      logical_cpus: cpus().length, memory_bytes: totalmem(), requested_renderer: 'SwiftShader software rendering (launch flags; not observed GPU identity)' },
    network: 'No throttling; only the supplied URL/network was measured. No other-network claim.',
    method: 'Five fresh contexts and paired cached reloads; rAF detects visible canvas/view controls and accepted report; nearest-rank percentiles. 30 sequential real Worker evaluations after 3 warmups.',
    limits: ['Observation-ready is camera controls, not furniture editing.', 'Placeholder model scene; real Lux3D load/render/release performance NOT_RUN.',
      'Localhost results do not establish anonymous HTTPS or public performance.', 'Chrome only; Edge and Safari NOT_RUN.'],
    targets: { first_observation_le_3000_ms: summary.first_observation.p95 <= 3000,
      cold_rules_le_12000_ms: summary.cold_rules_ready.p95 <= 12000,
      hot_evaluation_p95_le_150_ms: summary.hot_evaluation.p95 <= 150 }, summary, samples, engine }, null, 2));
} finally { await browser.close(); }
