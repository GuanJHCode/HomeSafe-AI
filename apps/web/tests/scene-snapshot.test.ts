import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assessment, Scene } from '../../../contracts/frontend/domain.ts'
import fixtureScene from '../../../browser-spike/examples/scene-before.json' with { type: 'json' }
import fixtureAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' }
import { SceneSnapshotBuilder } from '../src/domain/SceneSnapshotBuilder.ts'

const scene = fixtureScene as Scene
const assessment = fixtureAssessment as unknown as Assessment

test('snapshot preserves complete canonical inputs and accepted identity without model bytes', () => {
  const snapshot = SceneSnapshotBuilder.build(scene, assessment)
  const saved = JSON.parse(SceneSnapshotBuilder.exportJson(snapshot))
  assert.deepEqual(saved.scene, scene)
  assert.deepEqual(saved.assessment, {
    scene_id: assessment.scene_id, scene_revision: assessment.scene_revision,
    input_hash: assessment.input_hash, ruleset_version: assessment.ruleset_version,
  })
  assert.equal(saved.source_kind, 'synthetic_demo')
  assert.equal(saved.includes_asset_bytes, false)
  assert.ok(saved.limitations.some((text: string) => text.includes('挑战进度')))
  assert.notEqual(snapshot.scene, scene)
  snapshot.scene.objects[0]!.position.x += 1
  assert.deepEqual(scene, fixtureScene)
  assert.equal(saved.scene.objects[0].position.x, fixtureScene.objects[0]!.position.x)
})

test('snapshot rejects a result for another scene or revision', () => {
  assert.throws(() => SceneSnapshotBuilder.build(scene, { ...assessment, scene_revision: scene.revision + 1 }), /版本/)
  assert.throws(() => SceneSnapshotBuilder.build(scene, { ...assessment, scene_id: 'other' }), /版本/)
})

test('snapshot keeps unknown and provenance observations and distinct filenames', () => {
  const snapshot = SceneSnapshotBuilder.build(scene, assessment)
  assert.deepEqual(snapshot.scene.objects.map(object => object.properties), scene.objects.map(object => object.properties))
  const first = SceneSnapshotBuilder.fileName(snapshot)
  assert.match(first, /^homesafe-scene-v\d+-[a-f0-9]{12}-[0-9TZ-]+-\d+\.json$/)
  assert.notEqual(first, SceneSnapshotBuilder.fileName(snapshot))
  assert.ok(first.includes(assessment.input_hash.slice(0, 12)))
})
