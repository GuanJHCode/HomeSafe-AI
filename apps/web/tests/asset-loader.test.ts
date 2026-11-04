import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Box3, Group, Vector3 } from 'three';
import type { AssetRenderDTO } from '../../../contracts/frontend/domain';
import { AssetLoader } from '../src/scene/AssetLoader.ts';

// A test-only triangle spanning all three axes. It does not represent a Lux3D asset.
function syntheticGlb(): Buffer<ArrayBuffer> {
  const positions = new Float32Array([0, 0, 0, 1, 2, 0, 0, 0, 3]);
  const document = {
    asset: { version: '2.0' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{
      bufferView: 0, componentType: 5126, count: 3, type: 'VEC3',
      min: [0, 0, 0], max: [1, 2, 3],
    }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    buffers: [{ byteLength: positions.byteLength }],
  };
  const json = JSON.stringify(document);
  const padded = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const glb = Buffer.alloc(28 + padded.length + positions.byteLength);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  glb.set(padded, 20);
  glb.writeUInt32LE(positions.byteLength, 20 + padded.length);
  glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  glb.set(new Uint8Array(positions.buffer), 28 + padded.length);
  return glb;
}

test('same-origin GLB replacement applies orientation, bottom pivot, and instance dimensions', async (context) => {
  const fixture = syntheticGlb();
  const hash = createHash('sha256').update(fixture);
  const digest = hash.copy().digest('hex');
  const integrity = `sha256-${hash.digest('base64')}`;
  const fetchMock = context.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.href, 'https://example.test/preview/assets/public/test.glb');
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.integrity, integrity);
    return new Response(fixture);
  });
  const asset: AssetRenderDTO = {
    asset_id: 'fixture-triangle', content_hash: digest,
    render_url: 'assets/public/test.glb', provenance_summary: 'procedural',
    calibration: {
      reviewed: true, revision: 1, strategy: 'runtime_axis_fit',
      orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      pivot_offset_after_rotation: { x: 1.5, y: 0, z: -0.5 },
      normalized_bounds_m: { width: 3, height: 2, depth: 1 },
    },
  };
  const loader = new AssetLoader([asset, {
    ...asset, asset_id: 'unreviewed', calibration: { ...asset.calibration, reviewed: false },
  }, {
    ...asset, asset_id: 'external', render_url: 'https://external.test/test.glb',
  }], 'https://example.test/preview/');
  context.after(() => loader.dispose());
  await assert.rejects(loader.load('unreviewed'), /reviewed/);
  await assert.rejects(loader.load('external'), /application origin/);
  const template = await loader.load(asset.asset_id);
  assert.equal(await loader.load(asset.asset_id), template);
  assert.equal(fetchMock.mock.callCount(), 1);

  const object = new Group();
  object.userData.objectId = 'chair';
  object.position.set(5, 0, 3);
  object.rotation.y = Math.PI / 2;
  const placeholder = new Group();
  object.add(placeholder);
  const visual = loader.instantiate(template, { width: 0.6, height: 0.8, depth: 0.4 });
  const second = loader.instantiate(template, { width: 0.3, height: 0.5, depth: 0.5 });
  object.remove(placeholder);
  object.add(visual);
  const bbox = new Box3().setFromObject(object, true);
  const expected = [0.4, 0.8, 0.6];
  bbox.getSize(new Vector3()).toArray().forEach((size, i) => assert.ok(Math.abs(size - expected[i]) < 1e-6));
  assert.equal(bbox.min.y, 0);
  assert.equal(object.userData.objectId, 'chair');
  assert.equal(object.rotation.y, Math.PI / 2);
  loader.release(visual);
  assert.equal(object.children.length, 0);
  assert.equal(new Box3().setFromObject(second, true).getSize(new Vector3()).y, 0.5);
});
