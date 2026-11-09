import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export async function checkLocalReviewTransport(baseURL) {
  const base = new URL(baseURL);
  assert.ok(base.protocol === 'http:' && base.hostname === '127.0.0.1' && base.pathname === '/preview/');
  const json = async path => {
    const response = await fetch(new URL(path, base), { redirect: 'error' });
    assert.equal(response.status, 200, path); return response.json();
  };
  const manifest = await json('review-manifest.json');
  assert.equal(manifest.kind, 'LOCAL_ASSET_REVIEW');
  assert.equal(manifest.license_status, 'NOT_VERIFIED');
  assert.equal(manifest.publication_approved, false);
  assert.equal(manifest.formal_catalog_changed, false);
  assert.equal(manifest.models.length, 2);
  const files = [];
  for (const file of manifest.files) {
    assert.ok(typeof file.path === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(file.path)
      && file.path.split('/').every(part => part && part !== '.' && part !== '..'), 'Review file must be a canonical relative path');
    const target = new URL(file.path, base);
    assert.ok(target.origin === base.origin && target.pathname.startsWith(base.pathname)
      && !target.username && !target.password, 'Review file must remain in the application origin and /preview/');
    const response = await fetch(target, { redirect: 'error' });
    assert.equal(response.status, 200, file.path);
    const raw = Buffer.from(await response.arrayBuffer());
    assert.equal(raw.length, file.bytes, file.path);
    assert.equal(createHash('sha256').update(raw).digest('hex'), file.sha256, file.path);
    files.push({ path: file.path, bytes: raw.length, sha256: file.sha256 });
  }
  const assets = await json('engine/assets.json');
  const scene = await json('engine/scene-before.json');
  for (const model of manifest.models) {
    const asset = assets.find(a => a.content_hash === model.derived_sha256);
    assert.ok(asset); assert.equal(asset.calibration.reviewed, false);
    assert.equal(scene.objects.find(o => o.id === model.object_id).asset_id, asset.asset_id);
    assert.deepEqual(asset.calibration, model.calibration);
    assert.deepEqual(scene.objects.find(o => o.id === model.object_id).dimensions_m, model.target_dimensions_m);
  }
  return { result: 'PASS', scope: 'LOCAL_REVIEW_HTTP_BYTES_ONLY', files, manifest,
    public_deployment: 'NOT_VERIFIED', browser_interaction: 'NOT_RUN' };
}
