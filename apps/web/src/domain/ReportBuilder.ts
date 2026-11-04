import type { Assessment, Scene } from '../../../../contracts/frontend/domain.ts'
import { FindingsPresenter, type ComparisonPresentation } from './FindingsPresenter.ts'
import { assessmentMatchesScene } from './layout-result.ts'

const siteActions: Record<string, string> = {
  R001: '现场核查窗边家具位置和实际可接近条件。',
  R005: '现场核查指定通道内的家具位置和实际通行需要。',
}
const propertyLabels: Record<string, string> = {
  anchored: '柜体已固定', protection_reported: '窗户防护已提供', locked: '收纳已上锁',
  accessible: '线缆可被接触', secured: '已固定', raised_threshold_present: '门栏有凸起门槛', storage_height: '收纳高度',
}

export class ReportBuilder {
  private static exportSequence = 0
  static buildViewModel(scene: Scene, assessment: Assessment, comparison?: ComparisonPresentation | null) {
    if (!assessmentMatchesScene(scene, assessment) || (comparison && comparison.afterInputHash !== assessment.input_hash)) {
      throw new Error('布局与检查结果版本不一致，请重新计算后导出。')
    }

    const presenter = new FindingsPresenter(scene, assessment)
    const findings = presenter.findings
    const layoutOnly = comparison?.changeKinds.length === 1 && comparison.changeKinds[0] === 'layout'
    const observationOnly = comparison?.changeKinds.length === 1 && comparison.changeKinds[0] === 'observation'
    const observationChanges = observationOnly ? [...new Map([
      ...comparison.newTriggered, ...comparison.noLongerTriggered, ...comparison.resolvedUnknown, ...comparison.becameUnknown,
    ].map(finding => [finding.key, finding])).values()] : []
    return {
      schema_version: '1.0',
      title: '客厅检查行动清单',
      source_kind: scene.is_demo ? 'synthetic_demo' : 'user_provided',
      scene_id: scene.scene_id,
      scene_revision: scene.revision,
      input_hash: assessment.input_hash,
      ruleset_version: assessment.ruleset_version,
      actions: {
        layout: layoutOnly ? [...comparison.newTriggered, ...comparison.noLongerTriggered] : [],
        observations: observationChanges,
        information: findings.filter(finding => finding.status === 'needs_review'),
        onSite: findings.filter(finding => finding.status === 'triggered').map(finding => ({
          ...finding,
          action: siteActions[finding.rule_id] ?? finding.action,
        })),
      },
      findings,
      property_observations: scene.objects.map(object => ({ object_id: object.id, properties: structuredClone(object.properties) })),
      simulatedObservations: scene.objects.flatMap(object => Object.entries(object.properties)
        .filter(([, observation]) => observation?.source_kind === 'simulated')
        .map(([field, observation]) => ({ object_id: object.id, field, label: propertyLabels[field] ?? field, observation }))),
      coverage: assessment.coverage,
      setupItems: presenter.showSetupItems(),
      unsupportedDomains: assessment.unsupported_domains,
      comparison: comparison ?? null,
      limitations: [
        scene.is_demo ? '本清单使用合成客厅和模拟布局。' : '本清单使用所提供的输入资料。',
        '资料补充中的simulated表示演练假设，不是现场确认；资料变化不计为空间整改。',
        '请在现场核实真实尺寸、实际通行路径及安装状态。',
        '相机高度仅用于观察示意，真实触及能力需独立确认。',
        '本清单仅覆盖列出的检查条件。未触发和关卡达标均不代表现实家庭安全。',
      ],
    }
  }

  static exportJson(report: ReportViewModel): string {
    return `${JSON.stringify(report, null, 2)}\n`
  }

  static fileName(report: ReportViewModel): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `homesafe-action-list-v${report.scene_revision}-${report.input_hash.slice(0, 12)}-${stamp}-${++this.exportSequence}.json`
  }

  static print(): void {
    window.print()
  }
}

export type ReportViewModel = ReturnType<typeof ReportBuilder.buildViewModel>
