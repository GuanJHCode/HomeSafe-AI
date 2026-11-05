import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { loadPrivateMaterialInputs, attachPrivateMaterialInputs } from './private_materials_inputs.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');
function fixtureGlb(generator) {
  const data = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator } }));
  const json = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, json]);
}
async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), 'homesafe-material-contract-'));
  const config = { provenance: 'lux3d_web', models: [], calibration_file: join(dir, 'calibration.json') };
  const calibration = { status: 'PASS', assets: [], checks: [] };
  const save = async (path, value) => writeFile(path, JSON.stringify(value));
  try {
    for (const id of ['chair', 'cabinet']) {
      const source = fixtureGlb('SYNTHETIC_TEST_ORIGINAL'), derived = fixtureGlb('SYNTHETIC_TEST_DERIVED');
      const item = { id, path: join(dir, id + '.glb'), original_path: join(dir, id + '-original.glb'),
        sha256: sha(derived), original_sha256: sha(source), repair_record: join(dir, id + '-repair.json') };
      await writeFile(item.path, derived); await writeFile(item.original_path, source);
      await save(item.repair_record, { scope: 'PRIVATE_ZERO_NORMAL_DERIVATIVE', source_sha256: item.original_sha256,
        derived_sha256: item.sha256, protected_binary_bytes_unchanged: true, original_bytes_unchanged: true,
        publication_approved: false, rights_status: 'PENDING' });
      config.models.push(item);
      calibration.assets.push({ asset_id: `private-lux3d_web-${id}`, content_hash: item.sha256,
        render_url: `assets/public/private-test-${id}.glb`, provenance_summary: 'lux3d_web', calibration: {
          reviewed: false, revision: 1, strategy: 'runtime_axis_fit', orientation: { x: 0, y: 1, z: 0, w: 0 },
          pivot_offset_after_rotation: { x: 0, y: -0.5, z: 0 }, normalized_bounds_m: { width: 1, height: 1, depth: 1 } } });
      calibration.checks.push({ object_id: id, sha256: item.sha256, source_front_candidate: '+Z',
        textures_decoded: 2, source_bounds: [1, 1, 1], target_dimensions: { width: 1, height: 1, depth: 1 },
        fit: 'PASS', bottom_center: 'PASS', orientation_mapping: 'PASS' });
    }
    const path = join(dir, 'config.json');
    const persist = async () => { await save(path, config); await save(config.calibration_file, calibration); };
    await persist(); await run({ config, calibration, path, persist, save });
  } finally { await rm(dir, { recursive: true, force: true }); }
}
test('private capture preserves pending candidates and checks byte identities after loading', () => fixture(async f => {
  const input = await loadPrivateMaterialInputs(f.path);
  assert.ok(input.runtimeAssets.every(a => a.calibration.reviewed === true));
  assert.ok(input.evidence.persisted_candidates.every(a => a.calibration.reviewed === false));
  assert.ok(JSON.parse(await readFile(f.config.calibration_file)).assets.every(a => a.calibration.reviewed === false));
  await input.verifyUnchanged();
  await writeFile(f.config.models[0].path, fixtureGlb('SYNTHETIC_TAMPER'));
  await assert.rejects(input.verifyUnchanged(), /changed during capture/);
}));
test('a model with an unrelated content hash cannot be labelled as the supplied derivative', () => fixture(async f => {
  f.config.models[0].sha256 = '0'.repeat(64); await f.persist();
  await assert.rejects(loadPrivateMaterialInputs(f.path), /capture hash mismatch/);
}));
test('repair provenance must match the exact original and derived bytes', () => fixture(async f => {
  await f.save(f.config.models[0].repair_record, { scope: 'PRIVATE_ZERO_NORMAL_DERIVATIVE', source_sha256: '0'.repeat(64) });
  await assert.rejects(loadPrivateMaterialInputs(f.path));
}));
test('approved candidate cannot silently stand in for the private test-only gate', () => fixture(async f => {
  f.calibration.assets[0].calibration.reviewed = true; await f.persist();
  await assert.rejects(loadPrivateMaterialInputs(f.path), /Persisted candidate must remain unapproved/);
}));
test('private overlay rejects non-loopback destinations before touching a browser', async () => {
  const page = { setRequestInterception() { throw new Error('Must not reach browser'); } };
  await assert.rejects(attachPrivateMaterialInputs(page, 'https://example.org/preview/', {}));
});

test('copied PASS receipt cannot approve an identity quaternion that displays the model back', () => fixture(async f => {
  f.calibration.assets[0].calibration.orientation = { x: 0, y: 0, z: 0, w: 1 }; await f.persist();
  await assert.rejects(loadPrivateMaterialInputs(f.path), /source front/);
}));

test('actual Node HTTP200 scene response is consumed and privately bound, without aborting', async () => {
  const dims = { width: 1, height: 1, depth: 1 };
  const scene = { objects: ['chair', 'cabinet'].map(id => ({ id, dimensions_m: dims })) };
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(scene)); });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    let handler, response, aborted = false, enabledPatterns;
    const cdp = { on(event, callback) { handler = callback; }, async send(method, value) {
      if (method === 'Fetch.enable') enabledPatterns = value.patterns;
      if (method === 'Fetch.fulfillRequest') response = { status: value.responseCode, body: Buffer.from(value.body, 'base64').toString() };
      if (method === 'Fetch.failRequest') aborted = true;
    } };
    const page = { async createCDPSession() { return cdp; }, on() {} };
    const base = `http://127.0.0.1:${server.address().port}/preview/`;
    const input = { runtimeAssets: [], evidence: { models: ['chair', 'cabinet'].map(id => ({ id,
      asset_id: `private-lux3d_web-${id}`, synthetic_target_dimensions: dims })) } };
    const result = await attachPrivateMaterialInputs(page, base, input);
    assert.equal(enabledPatterns.length, 5);
    assert.ok(enabledPatterns.every(p => !p.urlPattern.includes('*')));
    await handler({ requestId: 'synthetic-request-id', request: { url: base + 'engine/scene-before.json' } });
    assert.deepEqual(result.errors, []);
    assert.equal(aborted, false);
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body).objects.map(o => o.asset_id),
      ['private-lux3d_web-chair', 'private-lux3d_web-cabinet']);
    assert.equal(result.overlays.length, 1);
  } finally { await new Promise(done => server.close(done)); }
});
