import type { PreparedStartup } from './PreparedStartup.ts';

export function listenForPageExit(target: EventTarget, suspend: () => void) {
  target.addEventListener('pagehide',suspend);
  return () => target.removeEventListener('pagehide',suspend);
}

/** Frameworks can report a mount error without throwing from mount(). */
export function mountOwnedUi(startup: PreparedStartup, ui: {
  config: {errorHandler?: (error: unknown, ...rest: any[]) => void};
  mount: () => unknown;
  unmount: () => unknown;
}) {
  const previous = ui.config.errorHandler;
  let reported = false;
  let reportedError: unknown;
  ui.config.errorHandler = error => { if (!reported) { reported=true; reportedError=error; } };
  try {
    ui.mount();
    if (reported) throw reportedError;
  } catch (error) {
    startup.trace.finish('failed');
    startup.dispose(new Error('界面加载失败'));
    try { ui.unmount(); } finally { throw error; }
  } finally { ui.config.errorHandler=previous; }
}

/** Only owns pre-mount startup; the mounted UI claims and cleans up the same handle. */
export function startEntry<T>(options: {
  prepare: (generation: number) => PreparedStartup;
  loadUi: () => Promise<T>;
  mount: (ui: T, startup: PreparedStartup) => void;
  state: (state: 'loading' | 'cancelled' | 'failed' | 'mounted') => void;
}) {
  let generation = 0;
  let current: PreparedStartup | null = null;
  let disposed = false;
  let mounted = false;
  const notify = (state: Parameters<typeof options.state>[0]) => options.state(state);
  const cancel = () => {
    if (disposed || mounted) return;
    generation++;
    current?.dispose();
    current = null;
    notify('cancelled');
  };
  const retry = () => {
    if (disposed || mounted) return;
    current?.dispose();
    const attempt = ++generation;
    const startup = options.prepare(attempt);
    current = startup;
    notify('loading');
    // Config/Worker startup has begun, but is deliberately not awaited here.
    void Promise.resolve().then(options.loadUi).then(ui => {
      if (disposed || attempt !== generation || current !== startup || startup.owner === 'disposed') return;
      try {
        options.mount(ui, startup);
        if (startup.owner !== 'ui') throw new Error('界面未接管启动会话。');
        mounted = true;
        current = null;
        notify('mounted');
      } catch {
        startup.trace.finish('failed');
        startup.dispose(new Error('界面加载失败'));
        current = null;
        notify('failed');
      }
    }, () => {
      if (disposed || attempt !== generation || current !== startup) return;
      startup.trace.finish('failed');
      startup.dispose(new Error('界面加载失败'));
      current = null;
      notify('failed');
    });
  };
  retry();
  return {cancel,retry,dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    current?.dispose(new Error('页面已关闭'));
    current = null;
  }};
}
