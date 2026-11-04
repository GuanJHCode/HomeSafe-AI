import assert from 'node:assert/strict';
import test from 'node:test';
import type { Assessment, ObservationEdit, ObservationResult, Scene } from '../../../contracts/frontend/domain.ts';
import beforeScene from '../../../browser-spike/examples/scene-before.json' with { type: 'json' };
import beforeAssessment from '../../../browser-spike/examples/assessment-before.json' with { type: 'json' };
import { ObservationController } from '../src/domain/ObservationController.ts';
import { EvaluationController } from '../src/domain/EvaluationController.ts';
import { FindingsPresenter } from '../src/domain/FindingsPresenter.ts';
import { ReportBuilder } from '../src/domain/ReportBuilder.ts';

const scene = beforeScene as Scene;
const assessment = beforeAssessment as unknown as Assessment;
const edit: ObservationEdit = { object_id: 'cabinet', field: 'anchored', value: true };
const config = { pyodideVersion: '314.0.6', pydanticVersion: '2.12.5', pyodideIndexURL: './vendor/pyodide/', coreBundle: 'python/homesafe_core.zip', coreManifest: 'python/manifest.json' };

function updated(): ObservationResult {
  const after = structuredClone(scene);
  after.revision++;
  after.objects.find(object => object.id === 'cabinet')!.properties.anchored = {
    value: true, source_kind: 'simulated', verification_state: 'provided', observed_at: '2026-11-04T08:00:00+00:00',
  };
  const result = structuredClone(assessment);
  result.scene_revision = after.revision;
  result.input_hash = 'd'.repeat(64);
  const target = result.findings.find(finding => finding.rule_id === 'R003' && finding.object_ids.includes('cabinet'))!;
  target.status = 'not_triggered';
  target.evidence.anchored_reported = true;
  target.evidence.source = 'simulated';
  return { scene: after, assessment: result, comparison: {
    before_input_hash: assessment.input_hash, after_input_hash: result.input_hash, change_kinds: ['observation'],
    new_triggered: [], no_longer_triggered: [], still_triggered: [], became_unknown: [], needs_review: [],
    removed_from_scope: [], added_to_scope: [], resolved_unknown: [target.key],
  } };
}

function setup(response: ObservationResult) {
  const sent: Array<{ op: string; payload: object }> = [];
  const evaluation = new EvaluationController({ config, base: 'https://example.test/', createClient: () => ({
    initialize: async () => ({ result: {} }),
    request: async (op, payload, revision) => { sent.push({ op, payload }); return { clientRevision: revision, result: response }; },
    dispose() {},
  }) });
  return { controller: new ObservationController(evaluation), evaluation, sent };
}

test('only sends allowlisted edit fields, binds response to hashes and shows information separately', async () => {
  const result = updated();
  const { controller, evaluation, sent } = setup(result);
  const received = await controller.apply(scene, assessment, { ...edit, traits: {}, source_kind: 'measurement' } as ObservationEdit, 2);
  assert.equal(received, result);
  assert.deepEqual(sent[0], { op: 'observation_edit', payload: { scene, edit } });
  const comparison = new FindingsPresenter(result.scene, result.assessment).comparison(assessment, result.comparison);
  const report = ReportBuilder.buildViewModel(result.scene, result.assessment, comparison);
  assert.equal(report.actions.layout.length, 0);
  assert.equal(report.actions.observations.length, 1);
  assert.equal(report.comparison?.conflict, false);
  assert.equal(report.simulatedObservations.length, 1);
  assert.equal(report.simulatedObservations[0].observation?.source_kind, 'simulated');
  assert.match(JSON.stringify(report.property_observations), /simulated/);
  evaluation.dispose();
});

test('does not accept edited dimensions, stale hashes, wrong value, or unrelated layout changes as observations', async () => {
  for (const mutate of [
    (result: ObservationResult) => { result.scene.objects[0].dimensions_m.height = 99; },
    (result: ObservationResult) => { result.comparison.before_input_hash = 'a'.repeat(64); },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.value = false; },
    (result: ObservationResult) => { result.comparison.change_kinds = ['layout']; },
    (result: ObservationResult) => { result.scene.revision += 1; result.assessment.scene_revision += 1; },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.source_kind = 'measurement'; },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.verification_state = 'owner_checked'; },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.evidence_ref = 'fake-evidence'; },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.observed_at = 'invalid'; },
    (result: ObservationResult) => { result.comparison.change_kinds = []; },
  ]) {
    const result = updated(); mutate(result);
    const { controller, evaluation } = setup(result);
    await assert.rejects(controller.apply(scene, assessment, edit, 2));
    evaluation.dispose();
  }
});

test('unchanged input cannot rewrite provenance or claim an observation change', async () => {
  const known = updated();
  const noop: ObservationResult = { ...structuredClone(known), comparison: { ...known.comparison,
    before_input_hash: known.assessment.input_hash, after_input_hash: known.assessment.input_hash,
    change_kinds: [], resolved_unknown: [],
  } };
  const valid = setup(noop);
  assert.equal(await valid.controller.apply(known.scene, known.assessment, edit, 3), noop);
  valid.evaluation.dispose();
  for (const mutate of [
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.source_kind = 'measurement'; },
    (result: ObservationResult) => { result.comparison.change_kinds = ['observation']; },
  ]) {
    const result = structuredClone(noop); mutate(result);
    const { controller, evaluation } = setup(result);
    await assert.rejects(controller.apply(known.scene, known.assessment, edit, 3));
    evaluation.dispose();
  }
});

test('restoring unknown cannot retain simulated or verified provenance', async () => {
  const known = updated();
  const unknown: ObservationResult = structuredClone(known);
  unknown.scene.revision++;
  unknown.assessment.scene_revision++;
  unknown.assessment.input_hash = 'e'.repeat(64);
  unknown.comparison.before_input_hash = known.assessment.input_hash;
  unknown.comparison.after_input_hash = unknown.assessment.input_hash;
  unknown.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored = {
    value: null, source_kind: 'unknown', verification_state: 'unknown', observed_at: null, evidence_ref: null,
  };
  const valid = setup(unknown);
  assert.equal(await valid.controller.apply(known.scene, known.assessment, { ...edit, value: null }, 3), unknown);
  valid.evaluation.dispose();
  for (const mutate of [
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.source_kind = 'simulated'; },
    (result: ObservationResult) => { result.scene.objects.find(object => object.id === 'cabinet')!.properties.anchored!.observed_at = '2026-11-04T08:00:00Z'; },
  ]) {
    const result = structuredClone(unknown); mutate(result);
    const { controller, evaluation } = setup(result);
    await assert.rejects(controller.apply(known.scene, known.assessment, { ...edit, value: null }, 3));
    evaluation.dispose();
  }
});
