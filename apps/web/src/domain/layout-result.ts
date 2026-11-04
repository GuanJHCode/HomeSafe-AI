import type { Assessment, Scene } from '../../../../contracts/frontend/domain.ts'

export function assessmentMatchesScene(scene: Scene, assessment: Assessment | null | undefined): assessment is Assessment {
  return assessment?.scene_id === scene.scene_id && assessment.scene_revision === scene.revision &&
    /^[a-f0-9]{64}$/.test(assessment.input_hash)
}
