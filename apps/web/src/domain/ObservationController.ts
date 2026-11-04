import type { Assessment, ObservationEdit, ObservationOption, ObservationResult, Scene } from '../../../../contracts/frontend/domain.ts';
import { assertAssessmentFor, assertComparisonFor, type EvaluationController } from './EvaluationController.ts';

export class ObservationController {
  #evaluation: EvaluationController;
  constructor(evaluation: EvaluationController) { this.#evaluation = evaluation; }

  options(scene: Scene, revision: number): Promise<ObservationOption[] | null> {
    return this.#evaluation.runCurrent(revision, async request =>
      await request('observation_options', { scene }) as ObservationOption[] | null);
  }

  apply(scene: Scene, assessment: Assessment, edit: ObservationEdit, revision: number): Promise<ObservationResult | null> {
    assertAssessmentFor(scene, assessment);
    const { object_id, field, value } = edit;
    return this.#evaluation.runCurrent(revision, async request => {
      const result = await request('observation_edit', { scene, edit: { object_id, field, value } }) as ObservationResult | null;
      if (!result) return null;
      assertAssessmentFor(result.scene, result.assessment);
      assertComparisonFor(result.comparison, assessment.input_hash, result.assessment.input_hash);
      if (result.scene.scene_id !== scene.scene_id ||
          result.comparison.change_kinds?.some(kind => kind !== 'observation')) {
        throw new Error('资料更新意外改变了布局或检查范围。');
      }
      // The Python operation may change only the selected observation and revision.
      const original = scene.objects.find(object => object.id === object_id);
      const candidate = structuredClone(result.scene);
      const changed = candidate.objects.find(object => object.id === object_id);
      if (!original || !changed || changed.properties[field]?.value !== value) {
        throw new Error('资料更新与所选字段不匹配。');
      }
      const valueChanged = original.properties[field]?.value !== value;
      const observation = changed.properties[field]!;
      const kinds = result.comparison.change_kinds;
      if (!kinds || (valueChanged ? kinds.length !== 1 || kinds[0] !== 'observation' : kinds.length !== 0)) {
        throw new Error('资料更新缺少准确的变化分类。');
      }
      if (!valueChanged) {
        if (JSON.stringify(observation) !== JSON.stringify(original.properties[field])) {
          throw new Error('未变化的资料不能改写其来源。');
        }
      } else if (value === null) {
        if (observation.source_kind !== 'unknown' || observation.verification_state !== 'unknown' ||
            observation.observed_at != null || observation.evidence_ref != null) {
          throw new Error('未知资料必须保留未知来源和状态。');
        }
      } else if (observation.source_kind !== 'simulated' || observation.verification_state !== 'provided' ||
          typeof observation.observed_at !== 'string' || !Number.isFinite(Date.parse(observation.observed_at)) ||
          !/(?:Z|[+-]\d{2}:\d{2})$/.test(observation.observed_at) || observation.evidence_ref != null) {
        throw new Error('演练资料必须标明模拟来源，不能冒充现场确认。');
      }
      const expectedRevision = scene.revision + (valueChanged ? 1 : 0);
      if (candidate.revision !== expectedRevision) throw new Error('资料更新版本不匹配。');
      candidate.revision = scene.revision;
      candidate.objects[candidate.objects.indexOf(changed)] = {
        ...changed, properties: { ...changed.properties, [field]: original.properties[field] },
      };
      if (JSON.stringify(candidate) !== JSON.stringify(scene)) throw new Error('资料更新改变了其他场景输入。');
      return result;
    });
  }
}
