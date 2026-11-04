import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Assessment, ChallengeGoal, ChallengeResult, Scene } from '../../../contracts/frontend/domain.ts';
import { ChallengeController } from '../src/domain/ChallengeController.ts';
import { EvaluationController } from '../src/domain/EvaluationController.ts';

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../../browser-spike/examples/${name}.json`, import.meta.url), 'utf8'));
const scene = fixture<Scene>('scene-before');
const assessment = fixture<Assessment>('assessment-before');
const movedScene = fixture<Scene>('scene-improved');
const movedAssessment = fixture<Assessment>('assessment-improved');
const goals: ChallengeGoal[] = [{ rule_id: 'R001', profile_id: 'child', object_id: 'chair' }];
const result: ChallengeResult = {
  scene, assessment, comparison: null,
  challenge: {
    status: 'in_progress', goal_results: [false], steps: 0, conflict_events: 0, invalid_attempts: 0,
    remaining_triggered: 3, remaining_needs_review: 7, setup_objects: 2, label: '教学样例',
  },
};
const config = { pyodideVersion: '314.0.6', pydanticVersion: '2.12.5', pyodideIndexURL: './vendor/pyodide/', coreBundle: 'python/homesafe_core.zip', coreManifest: 'python/manifest.json' };

function setup(responses: ChallengeResult[]) {
  const sent: Array<{ op: string; payload: object; revision: number }> = [];
  const evaluation = new EvaluationController({ config, base: 'https://example.test/', createClient: () => ({
    initialize: async () => ({ result: {} }),
    request: async (op, payload, revision) => {
      sent.push({ op, payload, revision });
      return { clientRevision: revision, result: responses.shift() };
    },
    dispose() {},
  }) });
  return { sent, evaluation, challenge: new ChallengeController(evaluation) };
}

test('sends only the canonical transform and renders remaining issues after Python confirms the goal', async () => {
  const moved: ChallengeResult = {
    ...result, scene: movedScene, assessment: movedAssessment,
    comparison: {
      before_input_hash: assessment.input_hash, after_input_hash: movedAssessment.input_hash,
      new_triggered: [], no_longer_triggered: [], still_triggered: [], became_unknown: [],
      needs_review: [], removed_from_scope: [], added_to_scope: [],
    },
    challenge: { ...result.challenge, status: 'goal_met', goal_results: [true], remaining_triggered: 8, remaining_needs_review: 13 },
  };
  const { sent, evaluation, challenge } = setup([result, moved, result]);
  assert.equal(await challenge.start(scene, ['chair'], goals, 1), result);
  const chair = movedScene.objects.find(object => object.id === 'chair')!;
  const pose = { position: chair.position, yaw_rad: chair.yaw_rad };
  const applied = await challenge.applyMove('chair', { ...pose, size: 99, trait: false } as typeof pose, 2);
  assert.equal(applied, moved);
  assert.deepEqual(sent[1], { op: 'challenge_move', payload: { object_id: 'chair', transform: pose }, revision: 2 });
  const rendered = challenge.renderProgress(moved);
  assert.match(rendered.summary, /本关布局目标已完成.*8项已触发、13项待核查/);
  assert.equal(rendered.uncovered, movedAssessment.unsupported_domains.length);
  assert.equal(await challenge.reset(3), result);
  assert.equal(sent[2].op, 'challenge_reset');
  evaluation.dispose();
});

test('rejects a changed challenge state if its comparison does not bind both input hashes', async () => {
  const wrongHash: ChallengeResult = { ...result, scene: movedScene, assessment: movedAssessment };
  const { evaluation, challenge } = setup([result, wrongHash]);
  await challenge.start(scene, ['chair'], goals, 1);
  await assert.rejects(challenge.state(2), /摘要/);
  evaluation.dispose();
});
