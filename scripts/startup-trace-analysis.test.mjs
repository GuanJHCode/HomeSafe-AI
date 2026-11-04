import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalUnionMs, analyzeStartupTrace } from './startup-trace-analysis.mjs';
import { StartupTrace } from '../browser-spike/startup-trace.mjs';

test('overlapping initialization stages use wall-time union, not their sum', () => {
  assert.equal(intervalUnionMs([[0, 10], [2, 8], [8, 20], [25, 30]]), 25);
  assert.equal(intervalUnionMs([]), 0);
  assert.throws(() => intervalUnionMs([[5, 2]]));
});
test('uninstrumented baseline remains measurable while required candidate tracing fails closed', () => {
  assert.equal(analyzeStartupTrace(undefined, {}, false).status, 'NOT_AVAILABLE');
  assert.throws(() => analyzeStartupTrace(undefined, {}, true), /must provide both/);
});

test('required traces reject missing lifecycle marks and wrongly typed or incomplete phases', () => {
  const identity = {core_hash:'a'.repeat(64), input_hash:'b'.repeat(64), pyodide:'0.29.3', pydantic:'2.11.7'};
  const window = new StartupTrace({thread:'window',generation:1,timeOrigin:1000,now:()=>30});
  const worker = new StartupTrace({thread:'worker',generation:1,timeOrigin:1001,now:()=>30});
  for (const phase of ['attempt_started','worker_created','init_sent','init_received','first_evaluation_accepted','edit_eligible']) window.mark(phase, 1);
  for (const phase of ['config_fetch','scene_fetch','renderer_create']) window.interval(phase, 1, 2);
  const lifecycle = ['worker_module_evaluated','init_enqueued','init_handler_started','init_reply_ready'];
  for (const phase of lifecycle) worker.mark(phase, 1);
  const spans = ['runtime_module','load_pyodide','ensure_package','pydantic_import','core_fetch','core_hash',
    'bundle_join_wait','unpack','canonical_import','dispatcher_bind','first_evaluation'];
  for (const phase of spans) worker.interval(phase, 1, 2);
  for (const trace of [window,worker]) { trace.identify(identity); trace.finish('ready'); }
  const attempt = {window_trace:window.snapshot(),worker_trace:worker.snapshot()};
  assert.equal(analyzeStartupTrace(attempt,identity,true).status,'AVAILABLE');
  for (const phase of lifecycle) {
    const missing = structuredClone(attempt);
    missing.worker_trace.events = missing.worker_trace.events.filter(event => event.phase !== phase);
    assert.throws(() => analyzeStartupTrace(missing,identity,true), new RegExp(`Missing worker mark ${phase}`));
  }
  for (const phase of spans) {
    const wrongKind = structuredClone(attempt);
    wrongKind.worker_trace.events.find(event => event.phase === phase).kind = 'mark';
    assert.throws(() => analyzeStartupTrace(wrongKind,identity,true), new RegExp(`Missing worker span ${phase}`));
  }
  const failed = structuredClone(attempt);
  failed.worker_trace.events.find(event => event.phase === 'canonical_import').status = 'failed';
  assert.throws(() => analyzeStartupTrace(failed,identity,true), /Incomplete worker span canonical_import/);
});
