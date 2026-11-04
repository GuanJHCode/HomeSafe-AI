import assert from 'node:assert/strict';
import test from 'node:test';
import { StartupTrace, safeResourceTimings } from './startup-trace.mjs';

test('thread epochs align without subtracting relative clocks; overlapping spans remain separate', async () => {
  let windowNow = 500, workerNow = 5;
  const windowTrace = new StartupTrace({ thread: 'window', generation: 7, timeOrigin: 1000, now: () => windowNow });
  const workerTrace = new StartupTrace({ thread: 'worker', generation: 7, timeOrigin: 1490, now: () => workerNow });
  windowTrace.mark('init_sent'); workerTrace.mark('init_enqueued');
  const runtime = workerTrace.start('load_pyodide'); workerNow = 10;
  const fetch = workerTrace.start('core_fetch'); workerNow = 25; fetch(); workerNow = 35; runtime();
  assert.equal(workerTrace.snapshot().events[0].start_epoch_ms - windowTrace.snapshot().events[0].start_epoch_ms, -5);
  assert.deepEqual(workerTrace.snapshot().events.slice(1).map(event => event.duration_ms), [15, 30]);
  assert.equal(workerTrace.snapshot().events[2].end_epoch_ms, 1525);
});

test('trace is bounded, snapshots detached and failure/retry generations cannot mix', async () => {
  let now = 0;
  const trace = new StartupTrace({ thread: 'worker', generation: 1, now: () => ++now, timeOrigin: 100 });
  const error = new Error('sensitive URL?key=secret');
  await assert.rejects(trace.measure('runtime_module', async () => { throw error; }), value => value === error);
  trace.identify({ core_hash: 'a'.repeat(64), password: 'secret', pyodide: '314.0.6' });
  trace.mark('secret arbitrary phase'); trace.finish('failed');
  const prior = trace.snapshot(); trace.mark('init_received'); trace.identify({ input_hash: 'b'.repeat(64) });
  assert.deepEqual(trace.snapshot(), prior);
  const next = new StartupTrace({ thread: 'worker', generation: 2, now: () => ++now, timeOrigin: 100 });
  assert.equal(next.snapshot().events.length, 0);
  assert.equal(JSON.stringify(prior).includes('secret'), false);
  prior.events.length = 0; assert.ok(trace.snapshot().events.length > 0);
  for (let i = 0; i < 100; i++) next.mark('init_enqueued');
  assert.equal(next.snapshot().events.length, 96); assert.equal(next.snapshot().truncated, true);
});

test('resource diagnostics allow only owned runtime/build paths and never expose URL/query/model names', () => {
  const row = name => ({ name, startTime: 1, duration: 2, transferSize: 5, serverTiming: ['secret'] });
  const result = safeResourceTimings({ base: 'https://example.test/preview/', timeOrigin: 100,
    entries: [row('https://example.test/preview/engine/config.json?token=secret'),
      row('https://example.test/preview/assets/index-123.js'),
      row('https://example.test/preview/assets/public/private-name.glb'),
      row('https://other.test/preview/engine/config.json'),
      row('https://example.test/private/engine/config.json')] });
  assert.deepEqual(result.map(item => item.label), ['config', 'app_js']);
  assert.equal(result[0].start_epoch_ms, 101);
  assert.doesNotMatch(JSON.stringify(result), /secret|https|private|serverTiming/);
});

test('malformed numeric fields cannot smuggle strings into diagnostic snapshots', async () => {
  const { sanitizeTraceSnapshot } = await import('./startup-trace.mjs');
  const trace = new StartupTrace({ thread: 'worker', generation: 1, timeOrigin: 100, now: () => 1 });
  const snapshot = trace.snapshot();
  snapshot.events.push({ phase: 'core_fetch', kind: 'span', start_ms: 0, end_ms: 'secret'.repeat(10000), status: 'ok' });
  assert.equal(sanitizeTraceSnapshot(snapshot, 1, 'worker').events.length, 0);
  assert.deepEqual(safeResourceTimings({ base: 'https://example.test/', timeOrigin: 100,
    entries: [{name:'https://example.test/engine/config.json',startTime:'secret'}] }), []);
});

test('broken recorder/clock cannot block callbacks or swallow their real errors', async (context) => {
  const { createStartupTrace } = await import('./startup-trace.mjs');
  context.mock.method(StartupTrace.prototype, 'snapshot', () => { throw new Error('diagnostic failure'); });
  context.mock.method(StartupTrace.prototype, 'mark', () => { throw new Error('diagnostic failure'); });
  const trace = createStartupTrace({ thread: 'worker', generation: 3, now: () => { throw new Error('clock failed'); } });
  trace.mark('init_enqueued'); trace.finish('failed');
  assert.equal(trace.snapshot(), null);
  assert.equal(await trace.measure('core_fetch', async () => 42), 42);
  assert.equal(trace.measureSync('canonical_import', () => 43), 43);
  const actual = new Error('real failure');
  await assert.rejects(trace.measure('core_fetch', async () => { throw actual; }), value => value === actual);
});
