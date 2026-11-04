import type { Assessment, Comparison, Finding, Profile, Scene, SetupItem } from '../../../../contracts/frontend/domain.ts'

export type Role = Profile['role']

export interface PresentedFinding extends Finding {
  title: string
  statusLabel: string
  role: Role | null
  routeId: string | null
  objectLabels: string[]
  reason: string
  action: string
  evidenceRows: { label: string; value: string }[]
}

export interface PresentedSetupItem extends SetupItem {
  objectLabel: string
  unknownLabels: string[]
  suggestedLabels: string[]
}

export interface ComparisonPresentation {
  beforeInputHash: string
  afterInputHash: string
  conflict: boolean
  newTriggered: PresentedFinding[]
  noLongerTriggered: PresentedFinding[]
  resolvedUnknown: PresentedFinding[]
  becameUnknown: PresentedFinding[]
  removedFromScope: PresentedFinding[]
  changeKinds: NonNullable<Comparison['change_kinds']>
  interpretation: string | null
}

const ruleCopy: Record<string, { title: string; triggered: string; needs_review: string }> = {
  R001: { title: '窗边支点', triggered: '在样例中把支点移离窗边，再复核指定通道。', needs_review: '核查支点、窗口位置及相关能力资料。' },
  R002: { title: '窗口防护', triggered: '现场核查窗口防护并记录现状。', needs_review: '核查并补充窗口防护资料。' },
  R003: { title: '柜体固定', triggered: '现场核查柜体固定方式。', needs_review: '补充柜体固定方式和检查记录。' },
  R004: { title: '危险品收纳', triggered: '现场核查危险品的收纳位置与锁闭状态。', needs_review: '补充收纳高度、锁闭状态及触及能力资料。' },
  R005: { title: '指定通道占用', triggered: '在样例中移开占用通道的家具，再复核儿童条件。', needs_review: '核查指定通道和家具位置资料。' },
  R006: { title: '通道地毯', triggered: '现场核查通道内地毯的位置和固定状态。', needs_review: '核查并记录地毯固定状态。' },
  R007: { title: '可接触线缆', triggered: '现场检查线缆的可接触位置及收纳状态。', needs_review: '补充线缆的可接触和收纳资料。' },
  R008: { title: '通道门栏底框', triggered: '现场核查门栏底框和实际通行需求。', needs_review: '补充门栏底框及通道位置资料。' },
}

const statusLabels: Record<Finding['status'], string> = {
  triggered: '已触发', needs_review: '待核查', not_triggered: '当前条件未触发',
}

const evidenceLabels: Record<string, string> = {
  distance_m: '对象间距（米）',
  attention_band_m: '教学关注距离（米）',
  parameter_source: '参数来源',
  approach_route_verified: '接近路径已验证',
  can_climb_source: '攀爬资料来源',
  protection_reported: '窗口防护记录',
  anchored_reported: '柜体固定记录',
  storage_world_height_m: '距地收纳高度（米）',
  configured_reach_height_m: '配置的触及高度（米）',
  locked_reported: '锁闭记录',
  height_source: '高度来源',
  lock_source: '锁闭资料来源',
  not_total_access_proof: '不能据此判断所有可接触情况',
  accessible_reported: '可接触记录',
  secured_reported: '已收纳记录',
  source: '资料来源',
  overlaps_designated_route: '与指定通道重叠',
  route_confirmed: '通道资料已确认',
  alternative_routes_evaluated: '替代通道已评估',
}

const sourceLabels: Record<string, string> = {
  unknown: '未知',
  demo: '合成样例',
  demo_heuristic: '教学参数',
  owner_defined: '使用者设置',
  user_reported: '现场自报',
  measurement: '实测记录',
  simulated: '模拟结果',
}

const traitLabels: Record<string, string> = {
  possible_climb_support: '可能成为攀爬支点',
  requires_anchor_check: '需要核查固定',
  contains_hazardous_items: '存放危险物品',
  blocks_floor_route: '可能占用通道',
  window_opening: '窗口开口',
  loose_cord: '散置线缆',
  rug: '地毯',
  child_gate: '儿童门栏',
}

const demoLabels: Record<string, string> = {
  chair: '椅子', window: '窗户', cabinet: '柜体', storage: '收纳柜', rug: '地毯', cord: '线缆', gate: '门栏',
}

function evidenceText(value: Finding['evidence'][string]): string {
  if (value === null) return '未知'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return String(Number(value.toFixed(3)))
  return sourceLabels[value] ?? value
}

export class FindingsPresenter {
  private readonly profileRoles: Map<string, Role>
  private readonly objectLabels: Map<string, string>
  private readonly routeIds: Set<string>
  private readonly presented: Map<string, PresentedFinding>
  private readonly assessment: Assessment

  constructor(scene: Scene, assessment: Assessment) {
    this.assessment = assessment
    this.profileRoles = new Map(scene.profiles.map(profile => [profile.id, profile.role]))
    this.objectLabels = new Map(scene.objects.map(object => [object.id,
      object.label && object.label !== object.id ? object.label :
        (scene.is_demo ? demoLabels[object.id] : undefined) ?? object.id]))
    this.routeIds = new Set(scene.routes.map(route => route.id))
    this.presented = new Map(assessment.findings.map(finding => [finding.key, this.present(finding)]))
  }

  get findings(): PresentedFinding[] {
    return [...this.presented.values()]
  }

  showFinding(key: string): PresentedFinding | undefined {
    return this.presented.get(key)
  }

  showSetupItems(): PresentedSetupItem[] {
    return (this.assessment.setup_items ?? []).map(item => ({
      ...item,
      objectLabel: this.objectLabels.get(item.object_id) ?? item.object_id,
      unknownLabels: item.unknown_traits.map(trait => traitLabels[trait] ?? trait),
      suggestedLabels: item.suggested_true_traits.map(trait => traitLabels[trait] ?? trait),
    }))
  }

  forRole(role: Role) {
    return {
      findings: this.findings.filter(finding => finding.role === role),
      coverage: this.assessment.coverage.filter(entry => entry.profile_id === null
        ? !entry.rule_id.startsWith('ROLE:') || entry.rule_id === `ROLE:${role}`
        : this.profileRoles.get(entry.profile_id) === role),
      setupItems: this.showSetupItems(),
      unsupportedDomains: this.assessment.unsupported_domains,
    }
  }

  groupByObject(role: Role): Map<string, PresentedFinding[]> {
    const groups = new Map<string, PresentedFinding[]>()
    for (const finding of this.forRole(role).findings) {
      for (const id of finding.object_ids) {
        const group = groups.get(id) ?? []
        group.push(finding)
        groups.set(id, group)
      }
    }
    return groups
  }

  comparison(previous: Assessment, comparison: Comparison): ComparisonPresentation | null {
    if (previous.input_hash !== comparison.before_input_hash ||
        this.assessment.input_hash !== comparison.after_input_hash) return null

    const previousFindings = new Map(previous.findings.map(finding => [finding.key, this.present(finding)]))
    const select = (keys: string[], findings: Map<string, PresentedFinding> = this.presented) =>
      keys.flatMap(key => {
        const finding = findings.get(key)
        return finding ? [finding] : []
      })
    const newTriggered = select(comparison.new_triggered)
    const noLongerTriggered = select(comparison.no_longer_triggered)
    const changeKinds = comparison.change_kinds ?? []
    const conflict = changeKinds.length === 1 && changeKinds.includes('layout') &&
      noLongerTriggered.some(before => before.role !== null &&
        newTriggered.some(after => after.role !== null && after.role !== before.role))
    return {
      beforeInputHash: comparison.before_input_hash,
      afterInputHash: comparison.after_input_hash,
      conflict,
      newTriggered,
      noLongerTriggered,
      resolvedUnknown: select(comparison.resolved_unknown ?? []),
      becameUnknown: select(comparison.became_unknown),
      removedFromScope: select(comparison.removed_from_scope, previousFindings),
      changeKinds,
      interpretation: comparison.change_interpretation ?? null,
    }
  }

  private present(finding: Finding): PresentedFinding {
    const copy = ruleCopy[finding.rule_id]
    const evidenceRows = Object.entries(finding.evidence).map(([key, value]) => ({
      label: evidenceLabels[key] ?? key,
      value: evidenceText(value),
    }))
    return {
      ...finding,
      title: copy?.title ?? finding.rule_id,
      statusLabel: statusLabels[finding.status],
      role: this.profileRoles.get(finding.profile_id) ?? null,
      routeId: this.routeIds.has(finding.scope_id) ? finding.scope_id : null,
      objectLabels: finding.object_ids.map(id => this.objectLabels.get(id) ?? id),
      reason: evidenceRows.map(({ label, value }) => `${label}：${value}`).join('，'),
      action: finding.status === 'not_triggered' ? '布局调整后重新核查。' :
        copy?.[finding.status] ?? '查看当前依据并核查。',
      evidenceRows,
    }
  }
}
