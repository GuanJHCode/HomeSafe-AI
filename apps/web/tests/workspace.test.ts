import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assessment, Scene } from '../../../contracts/frontend/domain.ts'
import beforeScene from '../../../browser-spike/examples/scene-before.json' with { type: 'json' }
import beforeAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' }
import conflictAssessment from '../../../browser-spike/examples/assessment-conflict.json' with { type: 'json' }
import { WorkspaceController, placementFeedback } from '../src/domain/WorkspaceController.ts'

const scene = beforeScene as Scene
const assessment = beforeAssessment as Assessment
const chair = scene.objects.find(object => object.id === 'chair')!
const pose = { position: { x: 3, y: 0, z: 2 }, yaw_rad: 0 }

function atRevision(result: Assessment, candidate: Scene): Assessment {
  return { ...result, scene_revision: candidate.revision }
}

const chairPosition = (workspace: WorkspaceController) => workspace.snapshot.objects.find(object => object.id === 'chair')?.position

test('a drag changes layout and history only after accepted evaluation', () => {
  const workspace = new WorkspaceController(scene)
  assert.equal(workspace.setAssessment(assessment), true)
  const change = workspace.proposal('chair', pose)!
  assert.deepEqual(chairPosition(workspace), chair.position)
  assert.equal(workspace.canUndo, false)
  assert.equal(workspace.accept(change, assessment), false)
  assert.equal(workspace.accept(change, atRevision(conflictAssessment as Assessment, change.scene)), true)
  assert.deepEqual(chairPosition(workspace), pose.position)
  assert.equal(workspace.canUndo, true)
  assert.equal(workspace.accept(change, atRevision(conflictAssessment as Assessment, change.scene)), false)
  assert.equal(workspace.proposal('chair', pose), null)
})

test('undo, redo and reset keep the last legal layout until reevaluated', () => {
  const workspace = new WorkspaceController(scene)
  const change = workspace.proposal('chair', pose)!
  workspace.accept(change, atRevision(conflictAssessment as Assessment, change.scene))

  const undo = workspace.undo()!
  assert.equal(workspace.canRedo, false)
  assert.deepEqual(chairPosition(workspace), pose.position)
  assert.ok(workspace.accept(undo, atRevision(assessment, undo.scene)))
  assert.deepEqual(chairPosition(workspace), chair.position)
  assert.equal(workspace.canRedo, true)
  assert.equal(workspace.canUndo, false)

  const redo = workspace.redo()!
  assert.ok(workspace.accept(redo, atRevision(conflictAssessment as Assessment, redo.scene)))
  assert.deepEqual(chairPosition(workspace), pose.position)

  const reset = workspace.reset()!
  assert.ok(workspace.accept(reset, atRevision(assessment, reset.scene)))
  assert.deepEqual(chairPosition(workspace), chair.position)
  assert.equal(workspace.snapshot.revision, scene.revision + 4)
  assert.equal(workspace.canRedo, false)
  assert.equal(workspace.canUndo, false)
})

test('a newer proposal supersedes an older one at the same scene revision', () => {
  const workspace = new WorkspaceController(scene)
  const older = workspace.proposal('chair', pose)!
  const newer = workspace.proposal('chair', { ...pose, yaw_rad: 0.5 })!
  assert.equal(older.scene.revision, newer.scene.revision)
  assert.equal(workspace.accept(older, atRevision(assessment, older.scene)), false)
  assert.equal(workspace.canUndo, false)
})

test('invalid placement highlights both colliding objects and structured room boundaries', () => {
  const workspace = new WorkspaceController(scene)
  assert.ok(workspace.proposal('chair', pose))
  const feedback = placementFeedback([
    { object_id: 'cabinet', related_object_ids: ['chair'], field: 'position', code: 'SOLID_PENETRATION', message: 'no ids here' },
    { object_id: 'chair', field: 'position', code: 'FOOTPRINT_OUTSIDE_ROOM', message: 'no ids here either' },
  ])
  assert.deepEqual(feedback.objectIds, ['cabinet', 'chair'])
  assert.equal(feedback.boundary, true)
  assert.deepEqual(chairPosition(workspace), chair.position)
  assert.equal(workspace.canUndo, false)
})
