import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Assessment, Scene } from '../../../contracts/frontend/domain.ts';
import { EvaluationController } from '../src/domain/EvaluationController.ts';

const readFixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../../browser-spike/examples/${name}.json`, import.meta.url), 'utf8'));
const scene = readFixture<Scene>('scene-before');
const assessment = readFixture<Assessment>('assessment-before');
const metadata = { pyodide: '314.0.6', pydantic: '2.12.5', core_hash: 'core', startup_ms: 1, packages_ms: 2, total_ready_ms: 3 };
const config = { pyodideVersion: '314.0.6', pydanticVersion: '2.12.5', pyodideIndexURL: './vendor/pyodide/', coreBundle: 'python/homesafe_core.zip', coreManifest: 'python/manifest.json' };

class FakeClient {
  stopped = false;
  failure?: Error;
  sent: Array<{ op: string; revision: number; resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];

  initialize() {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve({ result: metadata });
  }

  request(op: string, _payload: object, revision: number) {
    return new Promise((resolve, reject) => this.sent.push({ op, revision, resolve, reject }));
  }

  respond(index: number, result: unknown, revision = this.sent[index].revision) {
    this.sent[index].resolve({ clientRevision: revision, result });
  }

  dispose() {
    this.stopped = true;
    this.sent.forEach(({ reject }) => reject(new Error('disposed')));
  }
}

const turn = () => new Promise<void>(resolve => setImmediate(resolve));

function controller(createClient: () => FakeClient) {
  return new EvaluationController({ config, base: 'https://example.test/subpath/', createClient });
}

test('a late result cannot replace the current revision', async () => {
  const client = new FakeClient();
  const evaluation = controller(() => client);
  await evaluation.ensureReady();
  const first = evaluation.evaluateDraft(scene, 10);
  await turn();
  const second = evaluation.evaluateDraft(scene, 11);
  await turn();
  client.respond(1, assessment);
  assert.deepEqual(await second, { assessment, comparison: null });
  client.respond(0, assessment);
  assert.equal(await first, null);
  evaluation.dispose();
});

test('mismatched response revision and comparison hashes cannot become current', async () => {
  const client = new FakeClient();
  const evaluation = controller(() => client);
  await evaluation.ensureReady();
  const response = evaluation.evaluateDraft(scene, 12);
  await turn();
  client.respond(0, assessment, 11);
  assert.equal(await response, null);
  const comparisonResponse = evaluation.evaluateDraft(scene, 13, { scene, assessment });
  await turn();
  client.respond(1, assessment);
  await turn();
  assert.equal(client.sent[2].op, 'compare');
  client.respond(2, { before_input_hash: 'wrong', after_input_hash: assessment.input_hash });
  await assert.rejects(comparisonResponse, /hash/i);
  evaluation.dispose();
});

test('a failed Worker is terminated and a fresh Worker can evaluate without replaying the failed request', async () => {
  const first = new FakeClient();
  first.failure = new Error('WASM unavailable');
  const second = new FakeClient();
  const clients = [first, second];
  const evaluation = controller(() => clients.shift()!);
  await assert.rejects(evaluation.ensureReady(), /WASM unavailable/);
  assert.equal(first.stopped, true);
  assert.deepEqual(await evaluation.restart(), metadata);
  assert.equal(second.sent.length, 0);
  const response = evaluation.evaluateDraft(scene, 1);
  await turn();
  second.respond(0, assessment);
  assert.equal((await response)?.assessment.input_hash, assessment.input_hash);
  evaluation.dispose();
});

test('structured placement issues survive a current request failure', async () => {
  const client = new FakeClient();
  const evaluation = controller(() => client);
  const response = evaluation.evaluateDraft(scene, 1);
  await turn();
  const details = { code: 'INVALID_PLACEMENT', issues: [{ object_id: 'chair', related_object_ids: ['cabinet'] }] };
  client.sent[0].reject(Object.assign(new Error('collision'), { details }));
  await assert.rejects(response, error => (error as { details?: unknown }).details === details);
  evaluation.dispose();
});

test('retry uses refreshed runtime configuration and never replays a failed operation', async () => {
  const received: string[] = [];
  let stopped = 0;
  let requests = 0;
  const evaluation = new EvaluationController({
    config: { ...config, pyodideIndexURL: './vendor/missing/' },
    base: 'https://example.test/subpath/',
    createClient: () => ({
      initialize: async current => {
        received.push(current.pyodideIndexURL);
        if (current.pyodideIndexURL.includes('missing')) throw new Error('runtime unavailable');
        return { result: metadata };
      },
      request: async () => { requests++; throw new Error('unexpected replay'); },
      dispose: () => { stopped++; },
    }),
  });
  await assert.rejects(evaluation.ensureReady(), /runtime unavailable/);
  assert.deepEqual(await evaluation.restart(config), metadata);
  assert.deepEqual(received, ['./vendor/missing/', config.pyodideIndexURL]);
  assert.equal(stopped, 1);
  assert.equal(requests, 0);
  evaluation.dispose();
});

test('optional trace observers cannot reject business results and wrong generations are ignored', async () => {
  const { createStartupTrace } = await import('../../../browser-spike/startup-trace.mjs');
  const windowTrace = createStartupTrace({ thread: 'window', generation: 4 });
  const wrong = createStartupTrace({ thread: 'worker', generation: 3 });
  const correct = createStartupTrace({ thread: 'worker', generation: 4 });
  let observed = 0;
  const evaluation = new EvaluationController({ config, base: 'https://example.test/', trace: windowTrace,
    onStartupTrace: () => { observed++; throw new Error('broken observer'); },
    createClient: () => ({
      initialize: async (_config, _base, context) => {
        assert.equal(context?.generation, 4);
        return { result: metadata, startup_trace: wrong.snapshot() };
      },
      request: async (_op, _payload, revision) => ({ clientRevision: revision, result: assessment, startup_trace: correct.snapshot() }),
      dispose: () => {},
    }),
  });
  assert.deepEqual(await evaluation.ensureReady(), metadata); assert.equal(observed, 0);
  assert.deepEqual((await evaluation.evaluateDraft(scene, 1))?.assessment, assessment);
  assert.equal(observed, 1); evaluation.dispose();
});

test('failed first evaluation retains same-generation diagnostics while preserving its real error', async () => {
  const { createStartupTrace } = await import('../../../browser-spike/startup-trace.mjs');
  const windowTrace = createStartupTrace({ thread: 'window', generation: 9 });
  const workerTrace = createStartupTrace({ thread: 'worker', generation: 9 });
  workerTrace.mark('first_evaluation');
  let observed = 0;
  const error = Object.assign(new Error('actual rule failure'), { startup_trace: workerTrace.snapshot() });
  const evaluation = new EvaluationController({ config, base: 'https://example.test/', trace: windowTrace,
    onStartupTrace: () => { observed++; },
    createClient: () => ({ initialize: async () => ({ result: metadata }), request: async () => { throw error; }, dispose: () => {} }),
  });
  await assert.rejects(evaluation.evaluateDraft(scene, 1), value => value === error);
  assert.equal(observed, 1); evaluation.dispose();
});
