// Bounded diagnostic metadata only. No input scenes, URLs, errors or credentials.
export const STARTUP_TRACE_VERSION = 'startup-v1';
const phases = new Set([
  'attempt_started', 'worker_created', 'worker_module_evaluated', 'init_sent', 'init_enqueued',
  'init_handler_started', 'init_reply_ready', 'init_received', 'runtime_module', 'load_pyodide',
  'ensure_package', 'pydantic_import', 'core_fetch', 'core_hash', 'bundle_join_wait', 'unpack',
  'canonical_import', 'dispatcher_bind', 'first_evaluation', 'first_evaluation_sent',
  'first_evaluation_received', 'config_fetch', 'scene_fetch', 'renderer_create',
  'first_evaluation_accepted', 'edit_eligible', 'attempt_ready', 'attempt_failed', 'attempt_cancelled',
  'scene_reused', 'renderer_reused',
]);

/**
 * @typedef {{phase: string, kind: 'mark'|'span', start_ms:number, start_epoch_ms:number,
 * end_ms?:number, end_epoch_ms?:number, duration_ms?:number, status?:'ok'|'failed'}} TraceEvent
 * @typedef {{schema_version:1, trace_version:string, generation:number, thread:'window'|'worker',
 * time_origin_ms:number, status:string, identity:Record<string,string>, events:TraceEvent[], truncated:boolean,
 * cached_initialization?:boolean, runtime_generation?:number}} TraceSnapshot
 */
export class StartupTrace {
  /** @param {{thread:'window'|'worker',generation:number,now?:()=>number,timeOrigin?:number}} options */
  constructor({ thread, generation, now = () => performance.now(), timeOrigin = performance.timeOrigin }) {
    this.thread = thread;
    this.generation = generation;
    this.now = now;
    this.timeOrigin = timeOrigin;
    this.status = 'running';
    /** @type {TraceEvent[]} */ this.events = [];
    /** @type {Record<string,string>} */ this.identity = {};
    this.truncated = false;
  }
  context() { return { schema_version: 1, generation: this.generation }; }
  /** @param {Record<string,unknown>} identity */
  identify(identity) {
    if (this.status === 'failed' || this.status === 'cancelled') return;
    for (const key of ['core_hash', 'input_hash']) {
      if (typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key])) this.identity[key] = identity[key];
    }
    for (const key of ['pyodide', 'pydantic', 'ruleset_version']) {
      if (typeof identity[key] === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(identity[key])) this.identity[key] = identity[key];
    }
  }
  /** @param {string} phase @param {number} [at] */
  mark(phase, at = this.now()) { this.record({ phase, kind: 'mark', start_ms: at, start_epoch_ms: this.timeOrigin + at }); }
  /** @param {string} phase @param {number} start @param {number} end */
  interval(phase, start, end) {
    this.record({ phase, kind: 'span', start_ms: start, start_epoch_ms: this.timeOrigin + start,
      end_ms: end, end_epoch_ms: this.timeOrigin + end, duration_ms: end - start, status: 'ok' });
  }
  /** @param {string} phase */
  start(phase) {
    const start = this.now();
    let ended = false;
    /** @param {'ok'|'failed'} [status] */
    return (status = 'ok') => {
      if (ended) return;
      ended = true;
      const end = this.now();
      this.record({ phase, kind: 'span', start_ms: start, start_epoch_ms: this.timeOrigin + start,
        end_ms: end, end_epoch_ms: this.timeOrigin + end, duration_ms: end - start, status });
    };
  }
  /** @template T @param {string} phase @param {()=>Promise<T>} callable @returns {Promise<T>} */
  async measure(phase, callable) {
    const end = this.start(phase);
    try { const value = await callable(); end(); return value; }
    catch (error) { end('failed'); throw error; }
  }
  /** @template T @param {string} phase @param {()=>T} callable @returns {T} */
  measureSync(phase, callable) {
    const end = this.start(phase);
    try { const value = callable(); end(); return value; }
    catch (error) { end('failed'); throw error; }
  }
  /** @param {'ready'|'failed'|'cancelled'} status */
  finish(status) {
    if (this.status === 'failed' || this.status === 'cancelled') return;
    this.mark(`attempt_${status}`);
    this.status = status;
  }
  /** @param {TraceEvent} event */
  record(event) {
    if (this.status === 'failed' || this.status === 'cancelled' || !phases.has(event.phase)) return;
    if (!Number.isFinite(event.start_ms) || !Number.isFinite(event.start_epoch_ms) || event.start_ms < 0 ||
        (event.duration_ms !== undefined && (!Number.isFinite(event.duration_ms) || event.duration_ms < 0))) return;
    if (event.kind === 'span' && (!Number.isFinite(event.end_ms) || !Number.isFinite(event.end_epoch_ms) ||
        !['ok', 'failed'].includes(event.status))) return;
    if (this.events.length >= 96) { this.truncated = true; return; }
    this.events.push({ phase: event.phase, kind: event.kind, start_ms: event.start_ms, start_epoch_ms: event.start_epoch_ms,
      ...(event.kind === 'span' ? {end_ms:event.end_ms, end_epoch_ms:event.end_epoch_ms,
        duration_ms:event.duration_ms, status:event.status} : {}) });
  }
  /** @returns {TraceSnapshot} */
  snapshot() {
    return { schema_version: 1, trace_version: STARTUP_TRACE_VERSION, generation: this.generation,
      thread: this.thread, time_origin_ms: this.timeOrigin, status: this.status,
      identity: { ...this.identity }, events: this.events.map(event => ({ ...event })), truncated: this.truncated };
  }
}

// Also serialized into page.evaluate by the harness. Keep this function standalone.
// Exact owned runtime/engine paths and build JS/CSS only; model URLs are never included.
export function safeResourceTimings({ base, entries = performance.getEntriesByType('resource'), timeOrigin = performance.timeOrigin }) {
  if (!Number.isFinite(timeOrigin) || timeOrigin < 0) return [];
  const root = new URL('.', base);
  const fixed = {
    'engine/config.json': 'config', 'engine/scene-before.json': 'scene',
    'engine/scene-main-challenge.json': 'challenge_scene', 'engine/assets.json': 'asset_catalog',
    'engine/rule-worker.mjs': 'worker_module', 'engine/worker-controller.mjs': 'worker_controller',
    'engine/startup-trace.mjs': 'trace_module', 'engine/python/manifest.json': 'core_manifest',
    'engine/python/homesafe_core.zip': 'core_bundle',
    'vendor/pyodide/pyodide.mjs': 'runtime_module', 'vendor/pyodide/pyodide.asm.mjs': 'runtime_bootstrap',
    'vendor/pyodide/pyodide.asm.wasm': 'runtime_wasm', 'vendor/pyodide/python_stdlib.zip': 'python_stdlib',
    'vendor/pyodide/pyodide-lock.json': 'runtime_lock',
  };
  const output = [];
  for (const entry of entries) {
    if (!Number.isFinite(entry.startTime) || entry.startTime < 0 || !Number.isFinite(timeOrigin + entry.startTime)) continue;
    let path;
    try {
      const url = new URL(entry.name);
      if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) continue;
      path = url.pathname.slice(root.pathname.length);
    } catch { continue; }
    let label = fixed[path];
    if (!label && /^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(path)) label = path.endsWith('.js') ? 'app_js' : 'app_css';
    if (!label && /^vendor\/pyodide\/(pydantic_core|pydantic|typing_extensions|typing_inspection|annotated_types)-[A-Za-z0-9_.-]+\.whl$/.test(path))
      label = `wheel_${path.slice('vendor/pyodide/'.length).split('-')[0]}`;
    if (!label) continue;
    const row = { label, start_epoch_ms: timeOrigin + entry.startTime };
    for (const key of ['startTime', 'duration', 'fetchStart', 'domainLookupStart', 'domainLookupEnd',
      'connectStart', 'connectEnd', 'requestStart', 'responseStart', 'responseEnd', 'transferSize',
      'encodedBodySize', 'decodedBodySize']) {
      if (Number.isFinite(entry[key]) && entry[key] >= 0) row[key] = entry[key];
    }
    output.push(row);
    if (output.length >= 96) break;
  }
  return output;
}

/** @param {unknown} value @param {number} generation @param {'window'|'worker'} thread @returns {TraceSnapshot|null} */
export function sanitizeTraceSnapshot(value, generation, thread) {
  if (!value || typeof value !== 'object' || value.schema_version !== 1 || value.trace_version !== STARTUP_TRACE_VERSION ||
      value.generation !== generation || value.thread !== thread || !Number.isFinite(value.time_origin_ms) || value.time_origin_ms < 0 ||
      !['running', 'ready', 'failed', 'cancelled'].includes(value.status) || !Array.isArray(value.events)) return null;
  const copy = new StartupTrace({ thread, generation, timeOrigin: value.time_origin_ms, now: () => 0 });
  if (value.identity && typeof value.identity === 'object') copy.identify(value.identity);
  for (const event of value.events.slice(0, 96)) {
    if (!Number.isFinite(event?.start_ms) || event.start_ms < 0) continue;
    if (event?.kind === 'mark') copy.mark(event.phase, event.start_ms);
    else if (event?.kind === 'span' && Number.isFinite(event.end_ms) && event.end_ms >= event.start_ms &&
        ['ok', 'failed'].includes(event.status)) {
      copy.record({ phase: event.phase, kind: 'span', start_ms: event.start_ms,
        start_epoch_ms: value.time_origin_ms + event.start_ms, end_ms: event.end_ms,
        end_epoch_ms: value.time_origin_ms + event.end_ms, duration_ms: event.end_ms - event.start_ms, status: event.status });
    }
  }
  copy.status = value.status;
  copy.truncated = value.truncated === true || value.events.length > 96;
  const result = copy.snapshot();
  if (typeof value.cached_initialization === 'boolean') result.cached_initialization = value.cached_initialization;
  if (Number.isSafeInteger(value.runtime_generation) && value.runtime_generation > 0) result.runtime_generation = value.runtime_generation;
  return result;
}

// All observation boundaries are fallible. The facade shields business code even
// from a broken clock/observer or injected recorder method; callable errors survive.
/** @param {ConstructorParameters<typeof StartupTrace>[0]} options */
export function createStartupTrace(options) {
  const recorder = new StartupTrace(options);
  const handle = {
    generation: options.generation,
    thread: options.thread,
    get status() { return recorder.status; },
    context: () => ({ schema_version: 1, generation: options.generation }),
    /** @param {Record<string,unknown>} identity */
    identify(identity) { try { recorder.identify(identity); } catch {} },
    /** @param {string} phase @param {number} [at] */
    mark(phase, at) { try { recorder.mark(phase, at); } catch {} },
    /** @param {string} phase @param {number} start @param {number} end */
    interval(phase, start, end) { try { recorder.interval(phase, start, end); } catch {} },
    /** @param {'ready'|'failed'|'cancelled'} status */
    finish(status) { try { recorder.finish(status); } catch {} },
    /** @returns {TraceSnapshot|null} */
    snapshot() { try { return recorder.snapshot(); } catch { return null; } },
    /** @param {string} phase */
    start(phase) {
      /** @type {((status?:'ok'|'failed')=>void)|undefined} */ let end;
      try { end = recorder.start(phase); } catch {}
      /** @param {'ok'|'failed'} [status] */
      return (status = 'ok') => { try { end?.(status); } catch {} };
    },
    /** @template T @param {string} phase @param {()=>Promise<T>} callable @returns {Promise<T>} */
    async measure(phase, callable) {
      const end = handle.start(phase);
      try { const result = await callable(); end(); return result; }
      catch (error) { end('failed'); throw error; }
    },
    /** @template T @param {string} phase @param {()=>T} callable @returns {T} */
    measureSync(phase, callable) {
      const end = handle.start(phase);
      try { const result = callable(); end(); return result; }
      catch (error) { end('failed'); throw error; }
    },
  };
  return handle;
}
/** @typedef {ReturnType<typeof createStartupTrace>} StartupTraceHandle */
