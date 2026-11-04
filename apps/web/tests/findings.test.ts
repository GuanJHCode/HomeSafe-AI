import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assessment, Comparison, Scene } from '../../../contracts/frontend/domain.ts'
import conflictScene from '../../../browser-spike/examples/scene-conflict.json' with { type: 'json' }
import beforeAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' }
import conflictAssessment from '../../../browser-spike/examples/assessment-conflict.json' with { type: 'json' }
import comparison from '../../../examples/comparison.json' with { type: 'json' }
import { FindingsPresenter } from '../src/domain/FindingsPresenter.ts'

const assessment = conflictAssessment as Assessment
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
  const delta = presenter.comparison(beforeAssessment as Assessment, comparison as Comparison)
  assert.equal(delta?.conflict, true)
  assert.deepEqual(delta?.newTriggered.map(finding => finding.role), ['elder'])
  assert.deepEqual(delta?.noLongerTriggered.map(finding => finding.role), ['child'])
  assert.equal(presenter.comparison(assessment, comparison as Comparison), null)
})

test('observation-only comparisons cannot be described as layout conflicts', () => {
  const presenter = new FindingsPresenter(scene, assessment)
  const delta = presenter.comparison(beforeAssessment as Assessment, {
    ...comparison as Comparison,
    change_kinds: ['observation'],
    resolved_unknown: [assessment.findings.find(finding => finding.rule_id === 'R002')!.key],
  })
  assert.equal(delta?.conflict, false)
  assert.equal(delta?.resolvedUnknown[0]?.rule_id, 'R002')
})
