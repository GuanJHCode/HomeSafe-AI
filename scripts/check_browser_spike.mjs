// Run against the actual same-origin spike, including a hosted subpath.
// node scripts/check_browser_spike.mjs http://127.0.0.1:8080/ /path/to/chrome /path/to/puppeteer-core.js
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, chrome, puppeteerEntry] = process.argv.slice(2);
if (!entry || !chrome) throw new Error('Pass the spike URL and Chrome executable.');
const url = new URL(entry);
url.searchParams.set('runtime', 'same-origin');
const { launch } = await import(puppeteerEntry
  ? pathToFileURL(resolve(puppeteerEntry)).href
  : 'puppeteer-core');
const browser = await launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  const navigation = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  assert.ok(navigation?.ok(), 'Spike URL did not load');
  const read = async predicate => {
    const handle = await page.waitForFunction(`(() => {
      try {
        const data = JSON.parse(document.querySelector('#output').textContent);
        return (${predicate})(data) && data;
      } catch { return false; }
    })()`);
    const result = await handle.jsonValue();
    await handle.dispose();
    return result;
  };
  async function initialize() {
    const start = performance.now();
    await page.click('#init');
    const reply = await read('data => !!data.result?.core_hash || !!data.error');
    assert.ok(!reply.error, reply.error);
    assert.equal(reply.result.pyodide, '314.0.6');
    assert.equal(reply.result.pydantic, '2.12.5');
    assert.match(reply.result.core_hash, /^[a-f0-9]{64}$/);
    return { ...reply.result, wall_ms: Math.round(performance.now() - start) };
  }
  const cold = await initialize();
  await page.click('#examples');
  const { results } = await read('data => Array.isArray(data.results)');
  assert.deepEqual(results.map(result => [result.name, result.matches_expected]),
    [['before', true], ['conflict', true], ['improved', true]]);
  const warm = await initialize();
  assert.equal(warm.core_hash, cold.core_hash);

  await page.click('#challenge');
  const { states } = await read('data => Array.isArray(data.states)');
  const [before, conflict, improved, undo, reset] = states;
  assert.deepEqual(states.map(state => state.name), ['before', 'conflict', 'improved', 'undo', 'reset']);
  assert.equal(conflict.conflict_events, 1);
  assert.equal(improved.status, 'goal_met');
  assert.equal(undo.input_hash, conflict.input_hash);
  assert.equal(reset.input_hash, before.input_hash);
  assert.equal(reset.steps, 0);
  const expected = await page.evaluate(async () => {
    const response = await fetch(new URL('examples/assessment-improved.json', location.href));
    return response.json();
  });
  const remaining = status => expected.findings.filter(finding => finding.status === status).length;
  assert.equal(improved.remaining_triggered, remaining('triggered'));
  assert.equal(improved.remaining_needs_review, remaining('needs_review'));
  assert.deepEqual(improved.unsupported_domains, expected.unsupported_domains);
  assert.deepEqual(improved.coverage, expected.coverage);
  assert.match(improved.summary, new RegExp(`仍有${improved.remaining_triggered}项已触发、${improved.remaining_needs_review}项待核查`));

  const network = await page.evaluate(async () => {
    const names = ['rule-worker.mjs', 'vendor/pyodide/pyodide.mjs', 'vendor/pyodide/pyodide.asm.wasm'];
    return Promise.all(names.map(async path => {
      const response = await fetch(new URL(path, location.href), { method: 'HEAD' });
      return { path, url: response.url, status: response.status, mime: response.headers.get('content-type') };
    }));
  });
  for (const resource of network) {
    assert.equal(resource.status, 200);
    assert.equal(new URL(resource.url).origin, url.origin);
    assert.match(resource.mime, resource.path.endsWith('.wasm')
      ? /^application\/wasm\b/ : /^(?:application|text)\/(?:java|ecma)script\b/);
  }
  let failNextConfig = true;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (failNextConfig && new URL(request.url()).pathname.endsWith('/config.same-origin.json')) {
      failNextConfig = false;
      void request.respond({
        contentType: 'application/json',
        body: JSON.stringify({ pyodideIndexURL: './vendor/intentional-missing-runtime/' }),
      });
    } else {
      void request.continue();
    }
  });
  await page.click('#init');
  await read('data => !!data.error && !!data.retry');
  assert.equal(failNextConfig, false);
  assert.equal(await page.$eval('#examples', button => button.disabled), true);
  const recovered = await initialize();
  assert.equal(recovered.core_hash, cold.core_hash);
  await page.click('#examples');
  assert.ok((await read('data => Array.isArray(data.results)')).results.every(result => result.matches_expected));

  console.log(JSON.stringify({
    scope: 'REAL_CHROME_BROWSER_SPIKE',
    url: url.href,
    browser: await browser.version(),
    user_agent: await page.evaluate(() => navigator.userAgent),
    cold, warm, recovered, results, states, network,
    worker_recovery: 'PASS',
  }, null, 2));
} finally {
  await browser.close();
}
