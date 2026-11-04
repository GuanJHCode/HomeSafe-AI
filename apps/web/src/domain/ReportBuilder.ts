import type { Assessment, Scene } from '../../../../contracts/frontend/domain.ts'
import { FindingsPresenter, type ComparisonPresentation } from './FindingsPresenter.ts'
import { assessmentMatchesScene } from './layout-result.ts'

const siteActions: Record<string, string> = {
  R001: '现场核查窗边家具位置和实际可接近条件。',
  R005: '现场核查指定通道内的家具位置和实际通行需要。',
}

export class ReportBuilder {
  static buildViewModel(scene: Scene, assessment: Assessment, comparison?: ComparisonPresentation | null) {
    if (!assessmentMatchesScene(scene, assessment) || (comparison && comparison.afterInputHash !== assessment.input_hash)) {
      throw new Error('布局与检查结果版本不一致，请重新计算后导出。')
    }

    const presenter = new FindingsPresenter(scene, assessment)
    const findings = presenter.findings
    const layoutOnly = comparison?.changeKinds.length === 1 && comparison.changeKinds[0] === 'layout'
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
        information: findings.filter(finding => finding.status === 'needs_review'),
        onSite: findings.filter(finding => finding.status === 'triggered').map(finding => ({
          ...finding,
          action: siteActions[finding.rule_id] ?? finding.action,
        })),
      },
      findings,
      coverage: assessment.coverage,
      setupItems: presenter.showSetupItems(),
      unsupportedDomains: assessment.unsupported_domains,
      comparison: comparison ?? null,
      limitations: [
        scene.is_demo ? '本清单使用合成客厅和模拟布局。' : '本清单使用所提供的输入资料。',
        '请在现场核实真实尺寸、实际通行路径及安装状态。',
        '相机高度仅用于观察示意，真实触及能力需独立确认。',
        '本清单仅覆盖列出的检查条件。未触发和关卡达标均不代表现实家庭安全。',
      ],
    }
  }

  static exportJson(report: ReportViewModel): string {
    return `${JSON.stringify(report, null, 2)}\n`
  }

  static print(): void {
    window.print()
  }
}

export type ReportViewModel = ReturnType<typeof ReportBuilder.buildViewModel>
