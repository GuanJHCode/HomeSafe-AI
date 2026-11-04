import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonResource } from '../src/domain/resource-loading.ts';

const url = new URL('https://example.test/engine/scene-before.json');

test('a stalled response body times out and can be loaded by an explicit retry', async (context) => {
  let signal: AbortSignal | null | undefined;
  context.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  await assert.rejects(readJsonResource(url, { timeoutMs: 10 }), /加载超时/);
  assert.equal(signal?.aborted, true);
  context.mock.restoreAll();
  context.mock.method(globalThis, 'fetch', async () => new Response('{"ready":true}'));
  assert.deepEqual(await readJsonResource(url), { ready: true });
});

test('cancelled startup rejects even if a transport ignores abort and responds late', async (context) => {
  const controller = new AbortController();
  let resolve!: (response: Response) => void;
  context.mock.method(globalThis, 'fetch', () => new Promise<Response>(done => { resolve = done; }));
  const pending = readJsonResource(url, { signal: controller.signal });
  controller.abort(new Error('已取消加载'));
  await assert.rejects(pending, /已取消加载/);
  resolve(new Response('{"late":true}'));
});

test('already cancelled startup does not start a fetch', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  await assert.rejects(readJsonResource(url, { signal: AbortSignal.abort(new Error('cancelled')) }), /cancelled/);
  assert.equal(fetchMock.mock.callCount(), 0);
});
