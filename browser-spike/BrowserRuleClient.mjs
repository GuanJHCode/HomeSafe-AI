// Browser boundary. Use draft revision filtering even after an old request resolves.
export class BrowserRuleClient {
  constructor(worker = new Worker(new URL("./rule-worker.mjs", import.meta.url), {type:"module"})) {
    this.worker = worker;
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
    this.failure = null;
    this.onMessage = ({data}) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (data.ok) pending.resolve(data);
      else pending.reject(Object.assign(new Error(data.error?.message || "Evaluation failed"),
                                        {details:data.error,clientRevision:data.clientRevision,startup_trace:data.startup_trace}));
    };
    this.onError = () => {
      this.failure = new Error("Worker crashed; restart explicitly");
      this.failAll(this.failure);
    };
    worker.addEventListener("message",this.onMessage);
    worker.addEventListener("error",this.onError);
  }
  /** @param {{schema_version:number,generation:number}|undefined} trace */
  request(op,payload={},clientRevision=0,timeoutMs=45000,trace=undefined) {
    if (this.closed) return Promise.reject(new Error("Worker disposed"));
    if (this.failure) return Promise.reject(this.failure);
    const id=this.nextId++;
    return new Promise((resolve,reject) => {
      const timer=setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Worker timeout; result is not a safe/not-triggered conclusion"));
      },timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try {
        this.worker.postMessage({id,op,payload,clientRevision,...(trace ? {trace} : {})});
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  /** @param {{schema_version:number,generation:number}|undefined} trace */
  initialize(config,base,trace=undefined) { return this.request("init",{config,base},0,120000,trace); }
  evaluate(scene,revision) { return this.request("evaluate",{scene},revision); }
  isCurrent(response,currentRevision) { return response.clientRevision===currentRevision; }
  failAll(error) {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);item.reject(error);
    }
    this.pending.clear();
  }
  dispose() {
    if (this.closed) return;
    this.closed=true;
    this.failAll(new Error("Worker disposed"));
    this.worker.removeEventListener("message",this.onMessage);
    this.worker.removeEventListener("error",this.onError);
    this.worker.terminate();
  }
}
