import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDevelopmentReport } from './development_materials_report.mjs';

// Synthetic render data: this regression needs no private models or browser.
for (const availability of ['AVAILABLE', 'UNAVAILABLE', 'NOT_ASSESSED']) {
  test(`placeholder report keeps independent environment availability separate: ${availability}`, () => {
    const rendered = renderDevelopmentReport({
      source: { head: 'a'.repeat(40), project_dirty: false, app_matches_head: true,
        app_source_sha256: 'b'.repeat(64), dist_manifest_sha256: 'c'.repeat(64), key_files: {} },
      capture: { mode: 'trial', url: 'http://127.0.0.1:1234/preview/', browser: 'Synthetic test',
        created_at: '2026-11-05T00:00:00Z', viewport: { width: 1280, height: 900 },
        challenge_summary: '本关布局目标已完成；仍有待核查' },
      exports: { report: { findings: [{ status: 'needs_review' }], unsupportedDomains: ['未覆盖'],
        input_hash: 'd'.repeat(64), scene_revision: 2, ruleset_version: 'demo-rules-3.0' },
        binding_result: 'PASS', snapshot_verification: 'MATCHES_CURRENT_CORE' },
      video: { duration_seconds: 20, sha256: 'e'.repeat(64) },
      checks: { historical_baseline: '历史测试，非本次重跑', local_transport: 'PASS_LOCAL_ONLY',
        model_bytes_in_environment: availability,
        model_materialization: availability === 'AVAILABLE' ? '独立私下流程已取得字节' : '录屏工具未判断',
        real_lux3d_browser: availability === 'AVAILABLE' ? 'PASS_PRIVATE_SEPARATE_EVIDENCE' : 'NOT_ASSESSED' },
    });
    assert.doesNotMatch(rendered, /当前环境未取得这两件原件字节/);
    assert.doesNotMatch(rendered, /真实纹理、方向、场景交互和公开再分发权利仍待核验/);
    assert.doesNotMatch(rendered, /无实际 Lux3D 浏览器验收/);
    assert.match(rendered, /本次录屏未使用或评估真实 Lux3D 原件/);
    assert.match(rendered, /本次材料未覆盖/);
    assert.match(rendered, /DRAFT_NOT_SUBMITTABLE/);
  });
}

test('private real-model report distinguishes repaired GLBs from originals and placeholder capture', () => {
  const rendered = renderDevelopmentReport({
    source: { head: 'a'.repeat(40), project_dirty: false, app_matches_head: true,
      app_source_sha256: 'b'.repeat(64), dist_manifest_sha256: 'c'.repeat(64), key_files: {} },
    capture: { mode: 'full', url: 'http://127.0.0.1:1234/preview/', browser: 'Synthetic test',
      created_at: '2026-11-05T00:00:00Z', viewport: { width: 1280, height: 900 },
      challenge_summary: '本关布局目标已完成；仍有待核查' },
    exports: { report: { findings: [{ status: 'needs_review' }], unsupportedDomains: ['未覆盖'],
      input_hash: 'd'.repeat(64), scene_revision: 2, ruleset_version: 'demo-rules-3.0' },
      binding_result: 'PASS', snapshot_verification: 'MATCHES_CURRENT_CORE' },
    video: { duration_seconds: 200, sha256: 'e'.repeat(64) },
    checks: { historical_baseline: 'CI5001222功能通过，首次可编辑4324ms，非本次性能重测', local_transport: 'PASS_LOCAL_ONLY' },
    privateCapture: { kind: 'PRIVATE_LUX3D_NORMAL_REPAIR_DERIVATIVES', rights_status: 'PENDING',
      models: [{ id: 'chair', sha256: '1'.repeat(64), original_sha256: '2'.repeat(64) },
        { id: 'cabinet', sha256: '3'.repeat(64), original_sha256: '4'.repeat(64) }] },
  });
  assert.match(rendered, /PRIVATE_REAL_MODEL_DEVELOPMENT_RECORDING/);
  assert.match(rendered, /法线修复派生件/);
  assert.match(rendered, /浏览器请求拦截/);
  assert.match(rendered, /公开分发许可仍未确认/);
  assert.match(rendered, /1{64}/);
  assert.doesNotMatch(rendered, /本片未使用真实|本次录屏未使用或评估真实|仅加载程序占位家具/);
});
