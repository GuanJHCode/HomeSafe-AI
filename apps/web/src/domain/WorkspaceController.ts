import type { Assessment, PlacementIssue, Scene, TransformInput } from '../../../../contracts/frontend/domain.ts'
import { assessmentMatchesScene } from './layout-result.ts'

export interface LayoutChange {
  readonly scene: Scene
}

interface Snapshot {
  scene: Scene
  assessment: Assessment | null
}

type Operation = 'move' | 'undo' | 'redo' | 'reset'

export class WorkspaceController {
  readonly #initial: Snapshot
  #current: Snapshot
  #past: Snapshot[] = []
  #future: Snapshot[] = []
  #pending: { change: LayoutChange; operation: Operation; target: Snapshot } | null = null

  constructor(scene: Scene) {
    this.#initial = { scene: structuredClone(scene), assessment: null }
    this.#current = this.#initial
  }

  get snapshot(): Scene {
    return structuredClone(this.#current.scene)
  }

  get assessment(): Assessment | null {
    return structuredClone(this.#current.assessment)
  }

  get canUndo(): boolean {
    return this.#past.length > 0
  }

  get canRedo(): boolean {
    return this.#future.length > 0
  }

  setAssessment(assessment: Assessment): boolean {
    if (!this.#matches(this.#current, assessment)) return false
    this.#current.assessment = structuredClone(assessment)
    return true
  }

  proposal(objectId: string, transform: TransformInput): LayoutChange | null {
    const scene = this.snapshot
    const object = scene.objects.find(item => item.id === objectId)
    if (!object) return null
    const { x, y, z } = transform.position
    if (x === object.position.x && y === object.position.y && z === object.position.z &&
        transform.yaw_rad === object.yaw_rad) return null

    object.position = { x, y, z }
    object.yaw_rad = transform.yaw_rad
    return this.#plan('move', { scene, assessment: null })
  }

  undo(): LayoutChange | null {
    const previous = this.#past.at(-1)
    return previous ? this.#plan('undo', previous) : null
  }

  redo(): LayoutChange | null {
    const next = this.#future.at(-1)
    return next ? this.#plan('redo', next) : null
  }

  reset(): LayoutChange | null {
    return this.canUndo || this.canRedo ? this.#plan('reset', this.#initial) : null
  }

  accept(change: LayoutChange, assessment: Assessment): boolean {
    const pending = this.#pending
    if (!pending || pending.change !== change || !this.#matches(pending.target, assessment)) return false

    switch (pending.operation) {
      case 'move':
        this.#past.push(this.#current)
        this.#future.length = 0
        break
      case 'undo':
        this.#past.pop()
        this.#future.push(this.#current)
        break
      case 'redo':
        this.#future.pop()
        this.#past.push(this.#current)
        break
      case 'reset':
        this.#past.length = 0
        this.#future.length = 0
        break
    }
    this.#current = { scene: pending.target.scene, assessment: structuredClone(assessment) }
    this.#pending = null
    return true
  }

  #matches(target: Snapshot, assessment: Assessment): boolean {
    return assessmentMatchesScene(target.scene, assessment) &&
      (!target.assessment || target.assessment.input_hash === assessment.input_hash)
  }

  #plan(operation: Operation, layout: Snapshot): LayoutChange {
    const scene = { ...layout.scene, revision: this.#current.scene.revision + 1 }
    const change: LayoutChange = { get scene() { return structuredClone(scene) } }
    this.#pending = { change, operation, target: { scene, assessment: layout.assessment } }
    return change
  }
}

const placementLabels: Record<string, string> = {
  SOLID_PENETRATION: '家具实体重叠',
  FOOTPRINT_OUTSIDE_ROOM: '家具占地超出房间边界',
  HEIGHT_OUTSIDE_ROOM: '家具高度超出房间边界',
  HEIGHT_OUTSIDE_CONTAINER: '收纳高度超出所属容器',
  FLOOR_OBJECT_FLOATING: '落地家具必须贴地',
  SUPPORT_HEIGHT_MISMATCH: '物品没有放在支撑面高度',
  SUPPORT_OVERHANG: '物品超出支撑面范围',
}

export function placementFeedback(issues: readonly PlacementIssue[]) {
  const objectIds = new Set<string>()
  for (const issue of issues) {
    if (issue.object_id) objectIds.add(issue.object_id)
    for (const related of issue.related_object_ids ?? []) objectIds.add(related)
  }
  return {
    objectIds: [...objectIds],
    boundary: issues.some(issue => ['FOOTPRINT_OUTSIDE_ROOM', 'HEIGHT_OUTSIDE_ROOM'].includes(issue.code)),
    issues: issues.map(issue => ({ ...issue, label: placementLabels[issue.code] ?? issue.message })),
  }
}
