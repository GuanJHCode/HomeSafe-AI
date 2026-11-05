// Numeric inspection of original GLB geometry in Node. Textures are deliberately
// not decoded: this cannot substitute for browser, material, or visual acceptance.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Box3, Group, Texture, Vector3 } from '../apps/web/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../apps/web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from '../apps/web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { AssetLoader, disposeObject } from '../apps/web/src/scene/AssetLoader.ts';
import { candidateCalibration } from '../apps/web/tests/private-asset-calibration.ts';
import type { SourceFront } from '../apps/web/tests/private-asset-calibration.ts';
import { inspectGlb, privateOutputPath } from './private_asset_inputs.mjs';

const { values } = parseArgs({ options: { chair: { type: 'string' }, cabinet: { type: 'string' },
  'chair-front': { type: 'string' }, 'cabinet-front': { type: 'string' }, output: { type: 'string' } } });
if (!values.chair || !values.cabinet || !values.output || !values['chair-front'] || !values['cabinet-front']) {
  throw new Error('Pass --chair, --cabinet, --chair-front, --cabinet-front and --output');
}
const validFronts = new Set<SourceFront>(['+Z', '-Z', '+X', '-X']);
for (const id of ['chair', 'cabinet'] as const) {
  if (!validFronts.has(values[`${id}-front`] as SourceFront)) throw new Error(`Invalid --${id}-front`);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = await privateOutputPath(root, values.output);
const scene = JSON.parse(await readFile(resolve(root, 'examples/scene-before.json'), 'utf8'));
const checks = [];
for (const id of ['chair', 'cabinet'] as const) {
  const raw = await readFile(resolve(values[id]!)); const envelope = inspectGlb(raw);
  const parser = new GLTFLoader();
  parser.register(() => ({ name: 'NODE_GEOMETRY_ONLY_NO_TEXTURE_DECODE',
    loadTexture: async () => new Texture() }));
  const source = (await parser.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene;
  const sourceParent = source.parent;
  const sourceJson = JSON.stringify(source.toJSON());
  const sourceBounds = new Box3().setFromObject(source, true).clone();
  const sourceFront = values[`${id}-front`] as SourceFront;
  const calibration = candidateCalibration(source, sourceFront);
  const template = AssetLoader.normalize(clone(source), calibration);
  const loader = new AssetLoader([], 'http://127.0.0.1/');
  const object = scene.objects.find((item: { id: string }) => item.id === id);
  const before = JSON.stringify(object);
  const dimensions = object.dimensions_m;
  const visual = loader.instantiate(template, dimensions);
  const second = loader.instantiate(template, dimensions);
  const group = new Group(); group.userData.objectId = id; group.add(visual);
  const near = (a: number, b: number) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-5, `${a} != ${b}`);
  for (const yaw of [0, Math.PI / 2, Math.PI, 0]) {
    group.rotation.y = yaw; group.position.set(2, 0, 1);
    const box = new Box3().setFromObject(group, true), extent = box.getSize(new Vector3());
    const rotated = yaw === Math.PI / 2;
    near(extent.x, rotated ? dimensions.depth : dimensions.width);
    near(extent.z, rotated ? dimensions.width : dimensions.depth);
    near(extent.y, dimensions.height); near(box.min.y, 0);
    near(box.getCenter(new Vector3()).x, 2); near(box.getCenter(new Vector3()).z, 1);
  }
  loader.release(visual);
  near(new Box3().setFromObject(second, true).getSize(new Vector3()).y, dimensions.height);
  assert.equal(group.userData.objectId, id); assert.equal(JSON.stringify(object), before);
  assert.equal(source.parent, sourceParent);
  assert.equal(JSON.stringify(source.toJSON()), sourceJson);
  assert.deepEqual(new Box3().setFromObject(source, true), sourceBounds);
  assert.deepEqual(await readFile(resolve(values[id]!)), raw);
  checks.push({ object_id: id, ...envelope, source_front_candidate: sourceFront,
    calibration_candidate: { ...calibration, reviewed: false },
    target_dimensions: dimensions, numerical_fit: 'PASS', bottom_center: 'PASS',
    rotations_and_translation: 'PASS', multiple_instances: 'PASS', source_object_unchanged: true,
    raw_bytes_unchanged: true, textures: 'NOT_DECODED', browser: 'NOT_RUN' });
  loader.release(second); loader.dispose(); disposeObject(template.model);
}
const report = { scope: 'NODE_GEOMETRY_ONLY', result: 'PASS',
  publication_approved: false, physical_measurement: false, visual_review: 'PENDING', checks };
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'geometry.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
