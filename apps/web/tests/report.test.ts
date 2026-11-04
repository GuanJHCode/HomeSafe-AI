import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assessment, Comparison, Scene } from '../../../contracts/frontend/domain.ts'
import conflictScene from '../../../browser-spike/examples/scene-conflict.json' with { type: 'json' }
import beforeScene from '../../../browser-spike/examples/scene-before.json' with { type: 'json' }
import beforeAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' }
import conflictAssessment from '../../../browser-spike/examples/assessment-conflict.json' with { type: 'json' }
import comparison from '../../../examples/comparison.json' with { type: 'json' }
import { FindingsPresenter } from '../src/domain/FindingsPresenter.ts'
import { ReportBuilder } from '../src/domain/ReportBuilder.ts'

const scene = conflictScene as Scene
// Canonical JSON fixtures are validated by the Python contract check; JSON imports
// infer absent evidence keys as optional undefined, unlike the wire dictionary.
const assessment = conflictAssessment as unknown as Assessment
const delta = new FindingsPresenter(scene, assessment).comparison(beforeAssessment as unknown as Assessment, comparison as Comparison)

test('JSON and print view model use the same accepted version and actual assessment', () => {
  const report = ReportBuilder.buildViewModel(scene, assessment, delta)
  const exported = JSON.parse(ReportBuilder.exportJson(report))
  assert.deepEqual(exported, report)
  assert.equal(report.input_hash, assessment.input_hash)
  assert.equal(report.scene_revision, scene.revision)
  assert.equal(report.source_kind, 'synthetic_demo')
  assert.deepEqual(report.coverage, assessment.coverage)
  assert.deepEqual(report.unsupportedDomains, assessment.unsupported_domains)
  assert.deepEqual(report.actions.onSite.map(finding => finding.key), assessment.findings.filter(finding => finding.status === 'triggered').map(finding => finding.key))
  assert.deepEqual(report.actions.information.map(finding => finding.key), assessment.findings.filter(finding => finding.status === 'needs_review').map(finding => finding.key))
  assert.ok(report.actions.layout.some(finding => finding.role === 'elder'))
  assert.match(report.actions.onSite.find(finding => finding.rule_id === 'R005')!.action, /^现场核查/)
  assert.ok(report.actions.information.some(finding => finding.evidence.protection_reported === null))
})

test('stale assessment and mixed-version comparison cannot be exported', () => {
  assert.throws(() => ReportBuilder.buildViewModel(scene, beforeAssessment as unknown as Assessment), /版本/)
  assert.throws(() => ReportBuilder.buildViewModel(scene, assessment, { ...delta!, afterInputHash: 'other' }), /版本/)
})

test('different evaluated layouts at the same revision have traceable export filenames', () => {
  const before = ReportBuilder.buildViewModel(beforeScene as Scene,
    beforeAssessment as unknown as Assessment)
  const after = ReportBuilder.buildViewModel(scene, assessment, delta)
  const name = ReportBuilder.fileName(after)
  assert.match(name, /^homesafe-action-list-v\d+-[a-f0-9]{12}\.json$/)
  assert.ok(name.includes(after.input_hash.slice(0, 12)))
  assert.notEqual(name, ReportBuilder.fileName({ ...before, scene_revision: after.scene_revision }))
})
