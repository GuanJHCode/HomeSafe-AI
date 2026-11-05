// Private capture overlay. No model is written to dist, public/, Git or a server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectGlb } from './private_asset_inputs.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadPrivateMaterialInputs(configPath) {
  const config = JSON.parse(await readFile(resolve(configPath), 'utf8'));
  assert.equal(config.provenance, 'lux3d_web', 'Explicit private Lux3D provenance required');
  assert.deepEqual(config.models.map(item => item.id).sort(), ['cabinet', 'chair']);
  const calibrationBytes = await readFile(resolve(config.calibration_file));
  const calibration = JSON.parse(calibrationBytes);
  assert.equal(calibration.status, 'PASS');
  assert.equal(calibration.assets.length, 2);
  const buffers = new Map(), evidence = [], fileHashes = new Map();
  fileHashes.set(resolve(config.calibration_file), hash(calibrationBytes));
  for (const item of config.models) {
    const raw = await readFile(resolve(item.path));
    const original = await readFile(resolve(item.original_path));
    const repairBytes = await readFile(resolve(item.repair_record));
    const repair = JSON.parse(repairBytes);
    const inspected = inspectGlb(raw);
    assert.equal(inspected.sha256, item.sha256, `${item.id} capture hash mismatch`);
    assert.equal(inspectGlb(original).sha256, item.original_sha256, `${item.id} original hash mismatch`);
    assert.equal(repair.scope, 'PRIVATE_ZERO_NORMAL_DERIVATIVE');
    assert.equal(repair.source_sha256, item.original_sha256);
    assert.equal(repair.derived_sha256, item.sha256);
    for (const field of ['protected_binary_bytes_unchanged', 'original_bytes_unchanged']) assert.equal(repair[field], true);
    assert.equal(repair.publication_approved, false);
    assert.equal(repair.rights_status, 'PENDING');
    const asset = calibration.assets.find(a => a.asset_id === `private-lux3d_web-${item.id}`);
    assert.ok(asset, `${item.id} calibration descriptor missing`);
    assert.equal(asset.content_hash, item.sha256);
    assert.equal(asset.render_url, `assets/public/private-test-${item.id}.glb`);
    assert.equal(asset.provenance_summary, 'lux3d_web');
    assert.equal(asset.calibration.reviewed, false, 'Persisted candidate must remain unapproved');
    const check = calibration.checks.find(c => c.object_id === item.id);
    assert.equal(check?.sha256, item.sha256);
    assert.equal(check.source_front_candidate, '+Z');
    assert.equal(asset.calibration.revision, 1);
    assert.equal(asset.calibration.strategy, 'runtime_axis_fit');
    const q = asset.calibration.orientation;
    assert.ok(q && ['x', 'y', 'z', 'w'].every(k => Number.isFinite(q[k])), 'Finite orientation required');
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-6, 'Unit orientation required');
    assert.ok(Math.abs(q.x) < 1e-6 && Math.abs(q.z) < 1e-6
      && Math.abs(Math.abs(q.y) - 1) < 1e-6 && Math.abs(q.w) < 1e-6,
    'Y-up +Z source front must actually map to scene -Z');
    const dims = asset.calibration.normalized_bounds_m;
    assert.ok(['width', 'height', 'depth'].every((k, i) => Number.isFinite(dims?.[k]) && dims[k] > 0
      && Math.abs(dims[k] - check.source_bounds?.[i]) < 1e-6
      && Number.isFinite(check.target_dimensions?.[k]) && check.target_dimensions[k] > 0), 'Valid bounds and target dimensions required');
    const pivot = asset.calibration.pivot_offset_after_rotation;
    assert.ok(pivot && ['x', 'y', 'z'].every(k => Number.isFinite(pivot[k]))
      && Math.abs(pivot.x) < 1e-6 && Math.abs(pivot.z) < 1e-6
      && Math.abs(pivot.y + dims.height / 2) < 1e-6, 'Centered bottom pivot required');
    assert.ok(check.textures_decoded > 0);
    for (const name of ['fit', 'bottom_center', 'orientation_mapping']) assert.equal(check[name], 'PASS');
    buffers.set(item.id, raw);
    for (const [path, bytes] of [[item.path, raw], [item.original_path, original], [item.repair_record, repairBytes]]) {
      fileHashes.set(resolve(path), hash(bytes));
    }
    evidence.push({ id: item.id, asset_id: asset.asset_id, ...inspected,
      original_sha256: item.original_sha256, repair_record_sha256: hash(repairBytes),
      source_front: '+Z', scene_front: '-Z', candidate_reviewed: false,
      synthetic_target_dimensions: check.target_dimensions,
      source_bounds: check.source_bounds, textures_decoded: check.textures_decoded });
  }
  const runtimeAssets = structuredClone(calibration.assets);
  // Same private test-only gate as the already reviewed intake harness.
  // Persisted candidates and publication catalogs are never changed.
  for (const a of runtimeAssets) a.calibration.reviewed = true;
  return { buffers, runtimeAssets, calibration, evidence: {
    kind: 'PRIVATE_LUX3D_NORMAL_REPAIR_DERIVATIVES', provenance: 'lux3d_web',
    delivery_status: 'PRIVATE_DRAFT_NOT_SUBMITTABLE', publication_approved: false,
    rights_status: 'PENDING', models: evidence, calibration_sha256: hash(calibrationBytes),
    binding: 'Browser request interception only; unchanged placeholder static distribution',
    dimensions: 'Nonuniform fit to synthetic scene; not measured furniture or scale fidelity',
    runtime_reviewed_flag: 'TEMPORARY_PRIVATE_TEST_GATE_ONLY',
    persisted_candidates: structuredClone(calibration.assets),
  }, async verifyUnchanged() {
    for (const [path, digest] of fileHashes) assert.equal(hash(await readFile(path)), digest, 'Private input changed during capture');
  } };
}

export async function attachPrivateMaterialInputs(page, baseURL, input) {
  const base = new URL(baseURL);
  assert.ok(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname));
  assert.ok(base.pathname.endsWith('/preview/'));
  const requests = [], overlays = [], errors = [], blockedExternal = [], externalRequests = [];
  const cdp = await page.createCDPSession();
  // Global Puppeteer interception can stall requests inside dedicated Workers.
  // Pause only these five private responses on the main-page CDP target.
  const paths = ['engine/assets.json', 'engine/scene-before.json', 'engine/scene-main-challenge.json',
    ...input.evidence.models.map(m => `assets/public/private-test-${m.id}.glb`)];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base.origin) externalRequests.push(url.origin);
  });
  cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const url = new URL(request.url);
      if (url.origin !== base.origin) {
        blockedExternal.push(url.origin);
        await cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); return;
      }
      let body, contentType = 'application/json', model;
      if (url.href === new URL('engine/assets.json', base).href) body = JSON.stringify(input.runtimeAssets);
      for (const name of ['scene-before', 'scene-main-challenge']) {
        if (url.href === new URL(`engine/${name}.json`, base).href) {
          const response = await fetch(url, { redirect: 'error' });
          assert.ok(response.ok); const scene = await response.json();
          for (const item of input.evidence.models) {
            const object = scene.objects.find(o => o.id === item.id);
            assert.deepEqual(object.dimensions_m, item.synthetic_target_dimensions);
            object.asset_id = item.asset_id;
          }
          body = JSON.stringify(scene);
        }
      }
      for (const item of input.evidence.models) {
        if (url.href === new URL(`assets/public/private-test-${item.id}.glb`, base).href) {
          body = input.buffers.get(item.id); contentType = 'model/gltf-binary'; model = item;
        }
      }
      if (body === undefined) await cdp.send('Fetch.continueRequest', { requestId });
      else {
        const bytes = typeof body === 'string' ? Buffer.from(body) : body;
        await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: contentType }, { name: 'Cache-Control', value: 'no-store' }],
          body: bytes.toString('base64') });
        overlays.push({ path: url.pathname, content_type: contentType, sha256: hash(bytes), bytes: bytes.length });
        if (model) requests.push({ id: model.id, sha256: hash(bytes), bytes: bytes.length });
      }
    } catch (error) {
      errors.push(String(error));
      await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
    }
  });
  await cdp.send('Fetch.enable', { patterns: paths.map(path => ({ urlPattern: new URL(path, base).href, requestStage: 'Request' })) });
  return { requests, overlays, errors, blockedExternal, externalRequests,
    async close() { await cdp.detach(); } };
}
