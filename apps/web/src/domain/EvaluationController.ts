import { BrowserRuleClient } from '../../../../browser-spike/BrowserRuleClient.mjs';
import type { Assessment, Comparison, Scene } from '../../../../contracts/frontend/domain.ts';
import { assessmentMatchesScene } from './layout-result.ts';

export type WorkerConfig = {
  pyodideVersion: string;
  pydanticVersion: string;
  pyodideIndexURL: string;
  coreBundle: string;
  coreManifest: string;
};

export type WorkerMetadata = {
  pyodide: string;
  pydantic: string;
  core_hash: string;
  startup_ms: number;
  packages_ms: number;
  total_ready_ms: number;
};

type RuleClient = {
  initialize(config: WorkerConfig, base: string): Promise<unknown>;
  request(op: string, payload: object, revision: number): Promise<unknown>;
  dispose(): void;
};

type Options = { config: WorkerConfig; base: string; createClient?: () => RuleClient };
type AcceptedScene = { scene: Scene; assessment: Assessment };
export type EvaluationResult = { assessment: Assessment; comparison: Comparison | null };
type Request = (operation: string, payload: object) => Promise<unknown>;

export function assertAssessmentFor(scene: Scene, assessment: Assessment): void {
  if (!assessmentMatchesScene(scene, assessment)) {
    throw new Error('评估结果与布局版本或输入摘要不匹配。');
  }
}

export function assertComparisonFor(comparison: Comparison, beforeHash: string, afterHash: string): void {
  if (comparison?.before_input_hash !== beforeHash || comparison.after_input_hash !== afterHash) {
    throw new Error('评估比较的输入摘要不匹配 (input hash mismatch)。');
  }
}

export class EvaluationController {
  #options: Options;
  #client: RuleClient | null = null;
  #ready: Promise<WorkerMetadata | null> | null = null;
  #revision = -1;
  #ticket = 0;
  #disposed = false;

  constructor(options: Options) {
    this.#options = options;
  }

  ensureReady(): Promise<WorkerMetadata | null> {
    if (this.#disposed) return Promise.resolve(null);
    if (this.#ready) return this.#ready;

    const { config, base, createClient } = this.#options;
    try {
      const client = createClient?.() ?? new BrowserRuleClient(
        new Worker(new URL('engine/rule-worker.mjs', base), { type: 'module' }),
      );
      this.#client = client;
      this.#ready = client.initialize(config, base).then(response => {
        if (client !== this.#client) return null;
        return (response as { result: WorkerMetadata }).result;
      }).catch((error: unknown) => {
        if (client !== this.#client) return null;
        this.#closeClient();
        throw error;
      });
      return this.#ready;
    } catch (error) {
      this.#closeClient();
      return Promise.reject(error);
    }
  }

  restart(): Promise<WorkerMetadata | null> {
    this.#ticket++;
    this.#closeClient();
    return this.ensureReady();
  }

  invalidate(revision: number): void {
    if (revision < this.#revision) return;
    this.#revision = revision;
    this.#ticket++;
  }

  async evaluateDraft(scene: Scene, revision: number, previous?: AcceptedScene): Promise<EvaluationResult | null> {
    return this.runCurrent(revision, async request => {
      const assessment = await request('evaluate', { scene }) as Assessment | null;
      if (assessment === null) return null;
      assertAssessmentFor(scene, assessment);
      if (!previous) return { assessment, comparison: null };

      assertAssessmentFor(previous.scene, previous.assessment);
      const comparison = await request('compare', { before: previous.scene, after: scene }) as Comparison | null;
      if (comparison === null) return null;
      assertComparisonFor(comparison, previous.assessment.input_hash, assessment.input_hash);
      return { assessment, comparison };
    });
  }

  async runCurrent<T>(revision: number, operation: (request: Request) => Promise<T | null>): Promise<T | null> {
    if (this.#disposed || revision < this.#revision) return null;
    this.#revision = revision;
    const ticket = ++this.#ticket;
    const current = () => ticket === this.#ticket && revision === this.#revision;

    try {
      const metadata = await this.ensureReady();
      const client = this.#client;
      if (!metadata || !client || !current()) return null;

      const result = await operation(async (op, payload) => {
        if (!current()) return null;
        const response = await client.request(op, payload, revision) as { clientRevision: number; result: unknown };
        return current() && response.clientRevision === revision ? response.result : null;
      });
      return current() ? result : null;
    } catch (error) {
      if (!current()) return null;
      throw error;
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#ticket++;
    this.#closeClient();
  }

  #closeClient(): void {
    const client = this.#client;
    this.#client = null;
    this.#ready = null;
    client?.dispose();
  }
}
