import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { applicationBaseUrl, candidateCalibration } from './private-asset-calibration.ts';
import { AssetLoader } from '../src/scene/AssetLoader.ts';

test('private probe resolves GLBs at the application root, not its /tests/ document directory', () => {
  const page = 'http://127.0.0.1:43123/tests/private-assets.html';
  const render = 'assets/public/private-test-chair.glb';
  assert.equal(new URL(render, applicationBaseUrl(page)).pathname, '/assets/public/private-test-chair.glb');
});

test('calibration candidate uses raw model bounds and keeps its pending-review scope explicit', () => {
  const source = new Mesh(new BoxGeometry(0.5, 0.8, 0.4));
  const c = candidateCalibration(source, '-Z');
  assert.equal(c.pivot_offset_after_rotation.x, 0);
  assert.ok(Math.abs(c.pivot_offset_after_rotation.y + 0.4) < 1e-6);
  assert.match(c.notes!, /not publication approval/);
});

test('a declared +Z source front faces the scene -Z after calibration without changing the source', () => {
  const source = new Group();
  const body = new Mesh(new BoxGeometry(2, 3, 1));
  body.position.set(1.5, 1, 0.5);
  const front = new Group(); front.name = 'source-front'; front.position.set(2, 1, 0.9);
  source.add(body, front);
  const before = new Box3().setFromObject(source, true).clone();

  const calibration = candidateCalibration(source, '+Z');
  const template = AssetLoader.normalize(source.clone(true), calibration);
  const marker = template.model.getObjectByName('source-front')!;
  const markerPosition = marker.getWorldPosition(new Vector3());
  const normalized = new Box3().setFromObject(template.model, true);

  assert.ok(Math.abs(calibration.orientation.y - 1) < 1e-9);
  assert.ok(Math.abs(calibration.orientation.w) < 1e-9);
  assert.ok(markerPosition.z < normalized.getCenter(new Vector3()).z);
  assert.deepEqual(new Box3().setFromObject(source, true), before);
  assert.equal(source.parent, null);
});

test('each declared horizontal source front maps to -Z, while unknown directions are rejected', () => {
  const source = new Mesh(new BoxGeometry(1, 2, 3));
  const fronts = {
    '+Z': new Vector3(0, 0, 1), '-Z': new Vector3(0, 0, -1),
    '+X': new Vector3(1, 0, 0), '-X': new Vector3(-1, 0, 0),
  } as const;
  for (const [front, direction] of Object.entries(fronts)) {
    const c = candidateCalibration(source, front as keyof typeof fronts);
    const normalized = AssetLoader.normalize(source.clone(true), c);
    const actual = direction.clone().applyQuaternion(normalized.model.children[0].quaternion);
    assert.ok(actual.distanceTo(new Vector3(0, 0, -1)) < 1e-9, front);
  }
  assert.throws(() => candidateCalibration(source, 'unknown' as '+Z'), /must be declared/);
  assert.throws(() => candidateCalibration(source, 'toString' as '+Z'), /must be declared/);
});
