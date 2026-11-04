import { formatChallengeSummary } from '../../../../browser-spike/challenge-summary.mjs';
import type { ChallengeGoal, ChallengeResult, Scene, TransformInput } from '../../../../contracts/frontend/domain.ts';
import { assertAssessmentFor, assertComparisonFor, type EvaluationController } from './EvaluationController.ts';

type Command = 'challenge_start' | 'challenge_move' | 'challenge_undo' | 'challenge_reset' | 'challenge_state';

export class ChallengeController {
  #evaluation: EvaluationController;
  #current: ChallengeResult | null = null;
  #initialHash: string | null = null;
  #pending = false;

  constructor(evaluation: EvaluationController) {
    this.#evaluation = evaluation;
  }

  start(scene: Scene, movableIds: string[], goals: ChallengeGoal[], revision: number): Promise<ChallengeResult | null> {
    return this.#submit('challenge_start', { scene, movable_ids: movableIds, goals }, revision, scene);
  }

  applyMove(objectId: string, transform: TransformInput, revision: number): Promise<ChallengeResult | null> {
    const { position: { x, y, z }, yaw_rad } = transform;
    return this.#submit('challenge_move', { object_id: objectId, transform: { position: { x, y, z }, yaw_rad } }, revision);
  }

  undo(revision: number): Promise<ChallengeResult | null> {
    return this.#submit('challenge_undo', {}, revision);
  }

  reset(revision: number): Promise<ChallengeResult | null> {
    return this.#submit('challenge_reset', {}, revision);
  }

  state(revision: number): Promise<ChallengeResult | null> {
    return this.#submit('challenge_state', {}, revision);
  }

  renderProgress(result: ChallengeResult | null): { summary: string; uncovered: number | null } {
    return {
      summary: formatChallengeSummary(result?.challenge),
      uncovered: result?.assessment?.unsupported_domains?.length ?? null,
    };
  }

  async #submit(op: Command, payload: object, revision: number, initial?: Scene): Promise<ChallengeResult | null> {
    if (this.#pending) throw new Error('挑战操作处理中，请等待结果。');
    const scene = initial ?? this.#current?.scene;
    if (!scene) throw new Error('请先开始挑战。');
    const previousHash = this.#current?.assessment.input_hash;
    this.#pending = true;
    try {
      const result = await this.#evaluation.runCurrent(revision, async request => {
        const response = await request(op, payload) as ChallengeResult | null;
        if (response === null) return null;
        if (response.scene.scene_id !== scene.scene_id || !response.challenge) {
          throw new Error('挑战返回的场景或进度不完整。');
        }
        assertAssessmentFor(initial ?? response.scene, response.assessment);
        if (response.comparison && previousHash && !initial) {
          assertComparisonFor(response.comparison, previousHash, response.assessment.input_hash);
        } else if (!initial) {
          const expectedHash = op === 'challenge_reset' ? this.#initialHash : previousHash;
          if (response.assessment.input_hash !== expectedHash) {
            throw new Error('挑战返回的输入摘要与当前会话不匹配。');
          }
        }
        return response;
      });
      if (result) {
        this.#current = result;
        if (initial) this.#initialHash = result.assessment.input_hash;
      }
      return result;
    } finally {
      this.#pending = false;
    }
  }
}
