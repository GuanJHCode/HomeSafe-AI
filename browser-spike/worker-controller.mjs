// Independently testable lifecycle; the real Worker supplies the Pyodide initializer.
// A failed attempt is never retained as a permanently rejected readiness promise.
export function createWorkerController(initialize, send, clock = () => performance.now()) {
  let loading = null;
  let session = null;
  let sequence = Promise.resolve();

  async function ensureReady(config, base) {
    if (session) return session;
    if (!loading) loading = Promise.resolve().then(() => initialize(config, base));
    try {
      session = await loading;
      return session;
    } catch (error) {
      loading = null;
      session = null;
      throw error;
    }
  }

  async function handle(message) {
    const id = message?.id;
    const clientRevision = message?.clientRevision;
    try {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new Error("Invalid Worker message");
      }
      const {op, payload} = message;
      if (op === "init") {
        const ready = await ensureReady(payload?.config, payload?.base);
        send({id, clientRevision, ok:true, result:ready.metadata});
        return;
      }
      if (!session) throw new Error("Worker not initialized; retry initialization");
      const raw = JSON.stringify({op, payload});
      if (new TextEncoder().encode(raw).byteLength > 512000) throw new Error("Request too large");
      const started = clock();
      const result = JSON.parse(session.dispatch(raw));
      send({id, clientRevision, ...result, evaluation_ms:clock()-started});
    } catch (error) {
      send({id, clientRevision, ok:false,
        error:{code:"WORKER_ERROR", message:String(error?.message || error), issues:[]}});
    }
  }

  return {
    enqueue(message) {
      // Serialize stateful challenge commands; a previous failure cannot poison the queue.
      const task = sequence.then(() => handle(message));
      sequence = task.catch(() => {});
      return task;
    }
  };
}
