// Independently testable lifecycle; the real Worker supplies the Pyodide initializer.
// A failed attempt is never retained as a permanently rejected readiness promise.
import {createStartupTrace} from './startup-trace.mjs';
export function createWorkerController(initialize, send, clock = () => performance.now()) {
  let loading = null;
  let session = null;
  let sequence = Promise.resolve();
  let generation = 0;
  const moduleEvaluatedAt = performance.now();

  async function ensureReady(config, base, trace) {
    if (session) return session;
    if (!loading) {
      trace.mark('worker_module_evaluated', moduleEvaluatedAt);
      loading = Promise.resolve().then(() => initialize(config, base, trace));
    }
    try {
      session = await loading;
      session.trace = trace;
      session.firstEvaluation = false;
      return session;
    } catch (error) {
      loading = null;
      session = null;
      throw error;
    }
  }

  async function handle(message, initTrace) {
    const id = message?.id;
    const clientRevision = message?.clientRevision;
    let operationTrace = null;
    try {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new Error("Invalid Worker message");
      }
      const {op, payload} = message;
      if (op === "init") {
        initTrace.mark('init_handler_started');
        const cached = session !== null;
        const ready = await ensureReady(payload?.config, payload?.base, initTrace);
        const replyTrace = cached ? initTrace : ready.trace;
        replyTrace.identify(ready.metadata);
        replyTrace.finish('ready');
        replyTrace.mark('init_reply_ready');
        const snapshot = replyTrace.snapshot();
        send({id, clientRevision, ok:true, result:ready.metadata,
          ...(snapshot ? {startup_trace:{...snapshot, cached_initialization:cached, runtime_generation:ready.trace.generation}} : {}),
          startup_resources:ready.resources ?? []});
        return;
      }
      if (!session) throw new Error("Worker not initialized; retry initialization");
      const raw = JSON.stringify({op, payload});
      if (new TextEncoder().encode(raw).byteLength > 512000) throw new Error("Request too large");
      const first = !session.firstEvaluation && ['evaluate', 'challenge_start'].includes(op);
      const finishEvaluation = first ? session.trace.start('first_evaluation') : null;
      if (first) operationTrace = session.trace;
      const started = clock();
      let result;
      try { result = JSON.parse(session.dispatch(raw)); }
      catch (error) { finishEvaluation?.('failed'); session.firstEvaluation = true; throw error; }
      const evaluation_ms = clock()-started;
      if (finishEvaluation) {
        finishEvaluation(result.ok ? 'ok' : 'failed');
        session.firstEvaluation = true;
        session.trace.identify(result.result?.assessment ?? result.result ?? {});
      }
      send({id, clientRevision, ...result, evaluation_ms,
        ...(first ? {startup_trace:session.trace.snapshot()} : {})});
    } catch (error) {
      if (initTrace) initTrace.finish('failed');
      send({id, clientRevision, ok:false,
        error:{code:"WORKER_ERROR", message:String(error?.message || error), issues:[]},
        ...((initTrace ?? operationTrace) ? {startup_trace:(initTrace ?? operationTrace).snapshot()} : {})});
    }
  }

  return {
    enqueue(message) {
      let trace = null;
      if (message?.op === 'init') {
        const supplied = message.trace;
        const id = supplied?.schema_version === 1 && Number.isSafeInteger(supplied.generation) && supplied.generation > 0
          ? supplied.generation : ++generation;
        trace = createStartupTrace({thread:'worker', generation:id});
        trace.mark('init_enqueued');
      }
      // Serialize stateful challenge commands; a previous failure cannot poison the queue.
      const task = sequence.then(() => handle(message, trace));
      sequence = task.catch(() => {});
      return task;
    }
  };
}
