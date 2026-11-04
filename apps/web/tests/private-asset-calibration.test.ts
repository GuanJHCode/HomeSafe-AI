import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BoxGeometry, Mesh } from 'three';
import { applicationBaseUrl, candidateCalibration } from './private-asset-calibration.ts';

test('private probe resolves GLBs at the application root, not its /tests/ document directory', () => {
  const page = 'http://127.0.0.1:43123/tests/private-assets.html';
  const render = 'assets/public/private-test-chair.glb';
  assert.equal(new URL(render, applicationBaseUrl(page)).pathname, '/assets/public/private-test-chair.glb');
});

test('calibration candidate uses raw model bounds and keeps its pending-review scope explicit', () => {
  const source = new Mesh(new BoxGeometry(0.5, 0.8, 0.4));
  const c = candidateCalibration(source);
  assert.equal(c.pivot_offset_after_rotation.x, 0);
  assert.ok(Math.abs(c.pivot_offset_after_rotation.y + 0.4) < 1e-6);
  assert.match(c.notes!, /not publication approval/);
});
