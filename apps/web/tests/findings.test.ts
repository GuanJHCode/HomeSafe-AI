import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assessment, Comparison, Scene } from '../../../contracts/frontend/domain.ts'
import conflictScene from '../../../browser-spike/examples/scene-conflict.json' with { type: 'json' }
import beforeAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' }
import conflictAssessment from '../../../browser-spike/examples/assessment-conflict.json' with { type: 'json' }
import comparison from '../../../examples/comparison.json' with { type: 'json' }
import { FindingsPresenter } from '../src/domain/FindingsPresenter.ts'

// Canonical JSON fixtures are validated by the Python contract check; JSON imports
// infer absent evidence keys as optional undefined, unlike the wire dictionary.
const assessment = conflictAssessment as unknown as Assessment
const scene = conflictScene as Scene

test('role switching filters findings and coverage using configured profile roles', () => {
  const presenter = new FindingsPresenter(scene, assessment)
  const child = presenter.forRole('child')
  const elder = presenter.forRole('elder')
  assert.ok(child.findings.length > 0 && elder.findings.length > 0)
  assert.ok(child.findings.every(finding => finding.profile_id === 'child'))
  assert.ok(elder.findings.every(finding => finding.profile_id === 'elder'))
  assert.ok(elder.coverage.every(coverage => coverage.profile_id === 'elder'))
  assert.ok(elder.unsupportedDomains.length > 0)
  const chairRoute = elder.findings.find(finding => finding.rule_id === 'R005' && finding.object_ids.includes('chair'))
  assert.equal(chairRoute?.status, 'triggered')
  assert.equal(chairRoute?.routeId, 'elder-route')
  assert.ok(presenter.groupByObject('elder').get('chair')?.includes(chairRoute!))
  const protection = child.findings.find(finding => finding.rule_id === 'R002')
  assert.equal(protection?.evidence.protection_reported, null)
  assert.ok(protection?.evidenceRows.some(row => row.value === '未知'))
})

test('comparison highlights a child–elder tradeoff and rejects unrelated hashes', () => {
  const presenter = new FindingsPresenter(scene, assessment)
  const delta = presenter.comparison(beforeAssessment as unknown as Assessment, comparison as Comparison)
  assert.equal(delta?.conflict, true)
  assert.deepEqual(delta?.newTriggered.map(finding => finding.role), ['elder'])
  assert.deepEqual(delta?.noLongerTriggered.map(finding => finding.role), ['child'])
  assert.equal(presenter.comparison(assessment, comparison as Comparison), null)
})

test('observation-only comparisons cannot be described as layout conflicts', () => {
  const presenter = new FindingsPresenter(scene, assessment)
  const delta = presenter.comparison(beforeAssessment as unknown as Assessment, {
    ...comparison as Comparison,
    change_kinds: ['observation'],
    resolved_unknown: [assessment.findings.find(finding => finding.rule_id === 'R002')!.key],
  })
  assert.equal(delta?.conflict, false)
  assert.equal(delta?.resolvedUnknown[0]?.rule_id, 'R002')
})

test('not-triggered copy does not claim an observed change was a layout adjustment', () => {
  const observed = structuredClone(assessment)
  const cabinet = observed.findings.find(finding => finding.rule_id === 'R003' && finding.object_ids.includes('cabinet'))!
  cabinet.status = 'not_triggered' // Canonical observation edit: anchored=true has this status.
  const presented = new FindingsPresenter(scene, observed).showFinding(cabinet.key)
  assert.equal(presented?.action, '当前输入条件未触发；仍需现场复核。')
})

test('both role summaries remain available without changing the assessment or profile capabilities', () => {
  const before = JSON.stringify({ scene, assessment })
  const presenter = new FindingsPresenter(scene, assessment)
  for (const summary of presenter.roleSummaries()) {
    const findings = presenter.forRole(summary.role).findings
    assert.equal(summary.triggered, findings.filter(finding => finding.status === 'triggered').length)
    assert.equal(summary.needsReview, findings.filter(finding => finding.status === 'needs_review').length)
    assert.equal(summary.notTriggered, findings.filter(finding => finding.status === 'not_triggered').length)
  }
  assert.deepEqual(presenter.roleSummaries().map(summary => summary.role), ['child', 'elder'])
  assert.equal(JSON.stringify({ scene, assessment }), before)
})
