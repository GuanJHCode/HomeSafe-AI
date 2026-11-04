import type { Assessment, Scene } from '../../../../contracts/frontend/domain.ts'
import { assessmentMatchesScene } from './layout-result.ts'

/** Portable input record, not a saved challenge session or an asset archive. */
export class SceneSnapshotBuilder {
  private static exportSequence = 0

  static build(scene: Scene, assessment: Assessment) {
    if (!assessmentMatchesScene(scene, assessment)) {
      throw new Error('布局与检查结果版本不一致，请重新计算后导出场景。')
    }
    return {
      format: 'homesafe_scene_snapshot',
      snapshot_version: '1.0',
      source_kind: scene.is_demo ? 'synthetic_demo' : 'user_provided',
      exported_at: new Date().toISOString(),
      scene: structuredClone(scene),
      assessment: {
        scene_id: assessment.scene_id,
        scene_revision: assessment.scene_revision,
        input_hash: assessment.input_hash,
        ruleset_version: assessment.ruleset_version,
      },
      includes_asset_bytes: false,
      limitations: [
        '这是当前已评估的输入场景，不包含模型文件、撤销历史或挑战进度。',
        '保留未知及资料来源；示例尺寸不是现场测量，模拟补充资料不是现场核查。',
        '当前页面刷新会重置；此文件用于本地记录与复核，页面尚不支持导入恢复。',
        '需用相同版本的 Python 内核重算；快照与摘要不证明现实安全或挑战胜利。',
      ],
    }
  }

  static exportJson(snapshot: SceneSnapshot): string {
    return `${JSON.stringify(snapshot, null, 2)}\n`
  }

  static fileName(snapshot: SceneSnapshot): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `homesafe-scene-v${snapshot.scene.revision}-${snapshot.assessment.input_hash.slice(0, 12)}-${stamp}-${++this.exportSequence}.json`
  }
}

export type SceneSnapshot = ReturnType<typeof SceneSnapshotBuilder.build>
