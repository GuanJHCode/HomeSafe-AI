import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRegistration, decide, stats, invalidateForCleanup } from './paired-startup.mjs';
const hash = 'a'.repeat(64);
function registration() {
  const treatment = { url: 'http://127.0.0.1:4200/baseline/', trace_mode: 'optional', source_revision: 'test-only',
    source_fingerprint_sha256: hash, lock_sha256: hash, dist_manifest_sha256: hash, core_hash: hash };
  return { schema_version: 1, experiment_id: 'SYNTHETIC_VALIDATION_ONLY', purpose: 'instrumentation_overhead',
    pair_order: [['A','B'],['B','A'],['A','B'],['B','A'],['A','B']], baseline_definition: 'fixture', single_change: 'fixture', trace_comparability_note: 'fixture',
    treatments: { A: treatment, B: { ...treatment, trace_mode: 'required' } },
    expected_runtime: { pyodide: '314.0.6', pydantic: '2.12.5' },
    chrome: { executable: '/fixture', expected_version: 'fixture' }, driver: { path: '/fixture', sha256: hash },
    harness_sha256: hash, measurement_fingerprints_sha256: hash };
}
test('validation is pure and accepts identical cores for instrumentation-only comparison', () => {
  assert.equal(validateRegistration(registration()).purpose, 'instrumentation_overhead');
});
test('fixed order, required candidate trace and exact fingerprints cannot be weakened', () => {
  for (const mutate of [r => r.pair_order[1]=['A','B'], r => r.treatments.B.trace_mode='optional', r => r.treatments.A.core_hash='missing']) {
    const r = registration();
    mutate(r);
    assert.throws(() => validateRegistration(r));
  }
});
test('remote/credential/query URLs excluded from loopback-only experiment', () => {
  for (const url of ['https://example.com/', 'http://user@127.0.0.1/', 'http://127.0.0.1/?token=x']) {
    const r = registration(); r.treatments.A.url=url;
    assert.throws(() => validateRegistration(r));
  }
});
const samples = Array.from({ length: 10 }, () => ({ status: 'PASS' }));
const pairs = savings => savings.map(saving_ms => ({ status: 'PASS', saving_ms }));
test('optimization requires both four improving pairs and100ms pairedmedian', () => {
  assert.equal(decide('optimization',samples,pairs([200,200,200,200,-100])).optimization_gate,'PASS');
  assert.equal(decide('optimization',samples,pairs([90,90,90,90,90])).optimization_gate,'FAIL');
  assert.equal(decide('optimization',samples,pairs([200,200,200,-1,-1])).optimization_gate,'FAIL');
});
test('instrumentation overhead never becomes optimization approval', () => {
  const result = decide('instrumentation_overhead',samples,pairs([200,200,200,200,200]));
  assert.equal(result.optimization_gate,'NOT_APPLICABLE');
  assert.equal(result.paired_B_minus_A_overhead_ms.p50,-200);
  assert.equal(result.recommendation,'OVERHEAD_REPORTED_ONLY');
});
test('failed attempt or pair hash invalidation prevents eligibility; no replacement', () => {
  assert.equal(decide('optimization',[...samples.slice(0,9),{status:'FAIL'}],pairs([200,200,200,200,200])).valid_complete_comparison,false);
  const invalid = pairs([200,200,200,200,200]); invalid[0].status='FAIL';
  assert.equal(decide('optimization',samples,invalid).valid_complete_comparison,false);
  assert.equal(decide('optimization',samples.slice(1),pairs([200,200,200,200,200])).valid_complete_comparison,false);
});
test('nearest-rank remains maximum for five samples including negative savings', () => {
  assert.equal(stats([3386,3068.9,3004.1,3034.3,2936.2]).p95,3386);
  assert.equal(stats([-10,-20,-30,2,5]).p50,-10);
});
test('injected editable predicate and real-edit validation exactly match frozen current probe', () => {
  const source=readFileSync(new URL('./measurement/scripts/check_web_performance.mjs',import.meta.url),'utf8');
  const harness=readFileSync(new URL('./paired-startup.mjs',import.meta.url),'utf8');
  const callback=source.slice(source.indexOf('      await page.evaluateOnNewDocument(() => {'),source.indexOf("      for (const cache of ['cold', 'warm'])")).trimEnd();
  const validation=source.slice(source.indexOf('        await page.waitForFunction(() => window.__measurement.first_editable_ms !== null);'),source.indexOf('        const resources = await page.evaluate(safeResourceTimings, { base: url });')).trimEnd();
  assert.ok(harness.includes(callback)); assert.ok(harness.includes(validation));
});

test('browser cleanup failure invalidates an otherwise eligible result', () => {
  const result = { status: 'COMPLETED', decision: decide('optimization', samples, pairs([200,200,200,200,200])) };
  assert.equal(result.decision.eligible_for_adoption_review, true);
  invalidateForCleanup(result, new Error('fixture cleanup failed'));
  assert.equal(result.status, 'FAILED_BROWSER_CLEANUP');
  assert.equal(result.decision.eligible_for_adoption_review, false);
  assert.equal(result.decision.optimization_gate, 'NOT_EVALUABLE');
});
