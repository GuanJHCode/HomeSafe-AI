// Diagnostics only. Never supplies an editing-readiness time or changes a budget.
import assert from 'node:assert/strict';
import { sanitizeTraceSnapshot } from '../browser-spike/startup-trace.mjs';
const workerPhases = ['runtime_module', 'load_pyodide', 'ensure_package', 'pydantic_import',
  'core_fetch', 'core_hash', 'bundle_join_wait', 'unpack', 'canonical_import', 'dispatcher_bind', 'first_evaluation'];

export function intervalUnionMs(intervals) {
  const sorted = intervals.map(([start, end]) => [start, end]).sort((a, b) => a[0] - b[0]);
  let covered = 0, left = null, right = null;
  for (const [start, end] of sorted) {
    assert.ok(Number.isFinite(start) && Number.isFinite(end) && end >= start);
    if (left === null) { left = start; right = end; }
    else if (start > right) { covered += right - left; left = start; right = end; }
    else right = Math.max(right, end);
  }
  return covered + (left === null ? 0 : right - left);
}

export function analyzeStartupTrace(attempt, metadata, requireTrace = false) {
  if (!attempt?.window_trace || !attempt?.worker_trace) {
    assert.ok(!requireTrace, 'Instrumented candidate must provide both Window and Worker startup traces');
    return { status: 'NOT_AVAILABLE', reason: 'Uninstrumented baseline or unavailable diagnostic collection' };
  }
  const generation = attempt.window_trace.generation;
  const windowTrace = sanitizeTraceSnapshot(attempt.window_trace, generation, 'window');
  const workerTrace = sanitizeTraceSnapshot(attempt.worker_trace, generation, 'worker');
  assert.ok(windowTrace && workerTrace, 'Trace schema/thread/generation must match');
  for (const raw of [attempt.window_trace, attempt.worker_trace]) {
    for (const event of raw.events) {
      assert.ok(Math.abs(raw.time_origin_ms + event.start_ms - event.start_epoch_ms) < .01, 'Thread epoch alignment must be explicit');
      if (event.kind === 'span') assert.ok(Math.abs(raw.time_origin_ms + event.end_ms - event.end_epoch_ms) < .01);
    }
  }
  const mark = (trace, phase) => trace.events.find(event => event.phase === phase);
  if (requireTrace) {
    assert.equal(windowTrace.status, 'ready'); assert.equal(workerTrace.status, 'ready');
    const requireEvent = (trace, phase, kind) => {
      const event = mark(trace, phase);
      assert.ok(event && event.kind === kind, `Missing ${trace.thread} ${kind} ${phase}`);
      if (kind === 'span') assert.ok(event.status === 'ok' && Number.isFinite(event.duration_ms) &&
        Number.isFinite(event.end_epoch_ms), `Incomplete ${trace.thread} span ${phase}`);
    };
    for (const phase of workerPhases) requireEvent(workerTrace, phase, 'span');
    for (const phase of ['worker_module_evaluated', 'init_enqueued', 'init_handler_started', 'init_reply_ready'])
      requireEvent(workerTrace, phase, 'mark');
    for (const phase of ['attempt_started', 'worker_created', 'init_sent', 'init_received',
      'first_evaluation_accepted', 'edit_eligible']) requireEvent(windowTrace, phase, 'mark');
    requireEvent(windowTrace, 'config_fetch', 'span');
    if (mark(windowTrace, 'scene_reused')) requireEvent(windowTrace, 'scene_reused', 'mark');
    else requireEvent(windowTrace, 'scene_fetch', 'span');
    if (mark(windowTrace, 'renderer_reused')) requireEvent(windowTrace, 'renderer_reused', 'mark');
    else requireEvent(windowTrace, 'renderer_create', 'span');
    assert.equal(workerTrace.identity.core_hash, metadata.core_hash);
    assert.equal(windowTrace.identity.core_hash, metadata.core_hash);
    assert.equal(workerTrace.identity.pyodide, metadata.pyodide);
    assert.equal(workerTrace.identity.pydantic, metadata.pydantic);
    assert.match(windowTrace.identity.input_hash ?? '', /^[a-f0-9]{64}$/);
    assert.equal(workerTrace.identity.input_hash, windowTrace.identity.input_hash);
  }
  const stages = workerTrace.events.filter(event => event.kind === 'span');
  const start = mark(workerTrace, 'init_handler_started')?.start_epoch_ms;
  const end = mark(workerTrace, 'dispatcher_bind')?.end_epoch_ms;
  const intervals = stages.filter(event => event.phase !== 'first_evaluation' &&
    Number.isFinite(start) && Number.isFinite(end)).map(event =>
    [Math.max(start, event.start_epoch_ms), Math.min(end, event.end_epoch_ms)]).filter(([a, b]) => b >= a);
  const covered = intervalUnionMs(intervals);
  const gap = (a, b) => a && b ? a.start_epoch_ms - b.start_epoch_ms : null;
  return { status: 'AVAILABLE', generation, trace_version: windowTrace.trace_version,
    window_trace: windowTrace, worker_trace: workerTrace,
    stage_durations_ms: Object.fromEntries(stages.map(event => [event.phase, event.duration_ms])),
    alignment: { worker_minus_window_time_origin_ms: workerTrace.time_origin_ms - windowTrace.time_origin_ms,
      init_send_to_enqueue_ms: gap(mark(workerTrace, 'init_enqueued'), mark(windowTrace, 'init_sent')),
      init_queue_wait_ms: gap(mark(workerTrace, 'init_handler_started'), mark(workerTrace, 'init_enqueued')),
      reply_ready_to_received_ms: gap(mark(windowTrace, 'init_received'), mark(workerTrace, 'init_reply_ready')) },
    initialization_wall_ms: Number.isFinite(start) && Number.isFinite(end) ? end - start : null,
    measured_span_union_ms: covered,
    unattributed_initialization_wall_ms: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start - covered) : null,
    note: 'Epochs equal timeOrigin+now. Parallel spans use interval union, never summed; residuals are not assigned to compilation/import/network. Edit-eligible is diagnostic, not the enforced actual DOM editable metric.' };
}
