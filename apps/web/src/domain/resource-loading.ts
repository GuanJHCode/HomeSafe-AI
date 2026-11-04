// Initial scene/catalog/config fetches must finish or fail visibly before the
// Worker exists. Bound the body read as well as the response headers.
export async function readJsonResource<T>(url: URL, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 20000, signal, ...requestOptions } = options;
  signal?.throwIfAborted();
  const controller = new AbortController();
  let rejectAbort!: (reason: unknown) => void;
  const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = (reason: unknown) => {
    controller.abort(reason);
    rejectAbort(reason);
  };
  const onAbort = () => abort(signal?.reason ?? new Error('已取消加载'));
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => abort(new Error(`资源加载超时：${url.pathname}。请重试。`)), timeoutMs);
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...requestOptions, signal: controller.signal });
        if (!response.ok) throw new Error(`资源加载失败：${url.pathname}（${response.status}）`);
        return response.json() as Promise<T>;
      })(),
      cancelled,
    ]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
