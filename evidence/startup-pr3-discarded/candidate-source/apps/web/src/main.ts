import { prepareStartup } from './domain/PreparedStartup.ts';
import { listenForPageExit, startEntry } from './domain/entry-lifecycle.ts';
import "./style.css";

const base = new URL(import.meta.env.BASE_URL, window.location.href).href;
const host = document.querySelector<HTMLElement>('#app')!;
const loading = document.createElement('div');
loading.className = 'shell';
loading.setAttribute('role', 'status');
const status = document.createElement('p');
const cancel = document.createElement('button');
cancel.textContent = '取消加载';
const retry = document.createElement('button');
retry.textContent = '重试加载';
loading.append(status,cancel,retry);
host.append(loading);
let stopWatchingExit = () => {};
let entryState: 'loading' | 'cancelled' | 'failed' | 'mounted' = 'loading';
const entry = startEntry({
  prepare: generation => prepareStartup({base,generation,publish(trace,snapshot) {
    try { window.dispatchEvent(new CustomEvent('homesafe-startup-trace', {
      detail:{window_trace:trace.snapshot(),...(snapshot ? {worker_trace:snapshot} : {})},
    })); } catch {}
  }}),
  loadUi: () => import('./mountApp.ts'),
  mount: (ui,startup) => ui.mountApp(startup),
  state(value) {
    entryState = value;
    if (value !== 'mounted' && !loading.isConnected) host.replaceChildren(loading);
    status.textContent = value === 'loading' ? '正在加载客厅和同源规则'
      : value === 'cancelled' ? '已取消加载。可重试。' : '界面加载失败，请重新加载页面重试。';
    retry.textContent = value === 'failed' ? '重新加载页面' : '重试加载';
    cancel.hidden = value !== 'loading';
    retry.hidden = value === 'loading';
    if (value === 'mounted') {
      cancel.onclick = retry.onclick = null;
      stopWatchingExit();
    }
  },
});
cancel.onclick = () => entry.cancel();
// Browsers may cache a failed module import for this document. A user-requested
// fresh document retries that failure; there is no accepted UI layout yet.
retry.onclick = () => { if (entryState === 'failed') window.location.reload(); else entry.retry(); };
// Keep the cancelled loader retryable when a persisted page is shown again.
stopWatchingExit = listenForPageExit(window,() => entry.cancel());
