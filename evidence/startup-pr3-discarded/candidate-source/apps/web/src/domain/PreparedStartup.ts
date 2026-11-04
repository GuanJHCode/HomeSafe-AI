import { EvaluationController, type WorkerConfig, type WorkerMetadata } from './EvaluationController.ts';
import { readJsonResource } from './resource-loading.ts';
import { createStartupTrace, type StartupTraceHandle, type TraceSnapshot } from '../../../../browser-spike/startup-trace.mjs';

export type StartupOutcome = { ok: true; evaluation: EvaluationController; metadata: WorkerMetadata }
  | { ok: false; error: unknown };
type Owner = 'bootstrap' | 'ui' | 'disposed';
type Observer = (snapshot: TraceSnapshot) => void;
export type PreparedStartup = {
  readonly trace: StartupTraceHandle;
  readonly abort: AbortController;
  readonly ready: Promise<StartupOutcome>;
  readonly owner: Owner;
  claim(): void;
  observe(observer: Observer): void;
  dispose(reason?: Error): void;
};

/** Starts synchronously; readiness always has a rejection observer before returning. */
export function prepareStartup(options: {
  base: string;
  generation: number;
  publish?: (trace: StartupTraceHandle, snapshot?: TraceSnapshot) => void;
  readConfig?: (signal: AbortSignal) => Promise<WorkerConfig>;
  createEvaluation?: (options: ConstructorParameters<typeof EvaluationController>[0]) => EvaluationController;
}): PreparedStartup {
  const trace = createStartupTrace({thread:'window',generation:options.generation});
  const abort = new AbortController();
  let owner: Owner = 'bootstrap';
  let evaluation: EvaluationController | null = null;
  let observer: Observer | null = null;
  let latest: TraceSnapshot | null = null;
  const publish = (snapshot?: TraceSnapshot) => { try { options.publish?.(trace, snapshot); } catch {} };
  const observe = (snapshot: TraceSnapshot) => {
    if (owner === 'disposed') return;
    latest = snapshot;
    if (observer) { try { observer(snapshot); } catch {} }
    else publish(snapshot);
  };
  const active = () => owner !== 'disposed' && !abort.signal.aborted;
  trace.mark('attempt_started');
  publish();
  const ready: Promise<StartupOutcome> = (async () => {
    try {
      const config = await trace.measure('config_fetch', () => options.readConfig
        ? options.readConfig(abort.signal)
        : readJsonResource<WorkerConfig>(new URL('engine/config.json', options.base), {cache:'no-store',signal:abort.signal}));
      if (!active()) return {ok:false,error:abort.signal.reason ?? new Error('已取消加载')};
      evaluation = options.createEvaluation
        ? options.createEvaluation({config,base:options.base,trace,onStartupTrace:observe})
        : new EvaluationController({config,base:options.base,trace,onStartupTrace:observe});
      const metadata = await evaluation.ensureReady();
      if (!active()) return {ok:false,error:abort.signal.reason ?? new Error('已取消加载')};
      if (!metadata) throw new Error('规则 Worker 未就绪。');
      return {ok:true,evaluation,metadata};
    } catch (error) {
      // Failure before UI import must never become an unhandled rejection or leak a Worker.
      evaluation?.dispose();
      evaluation = null;
      if (active()) { trace.finish('failed'); publish(latest ?? undefined); }
      return {ok:false,error};
    }
  })();
  return {
    trace, abort, ready,
    get owner() { return owner; },
    claim() {
      if (owner !== 'bootstrap') throw new Error('启动会话不能重复接管。');
      owner = 'ui';
    },
    observe(next) {
      if (owner !== 'ui') throw new Error('启动会话尚未由界面接管。');
      observer = next;
      if (latest) { try { next(latest); } catch {} }
    },
    dispose(reason = new Error('已取消加载')) {
      if (owner === 'disposed') return;
      owner = 'disposed';
      abort.abort(reason);
      evaluation?.dispose();
      evaluation = null;
      observer = null;
      if (trace.status === 'running') { trace.finish('cancelled'); publish(latest ?? undefined); }
    },
  };
}
