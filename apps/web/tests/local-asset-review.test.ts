import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localReviewPolicy, permitsReviewCandidate } from '../src/scene/LocalAssetReview.ts';
import type { AssetRenderDTO } from '../../../contracts/frontend/domain';

const hash = 'a'.repeat(64);
const config = { mode: 'local_asset_review', publication_approved: false,
  license_status: 'NOT_VERIFIED', candidates: [{ asset_id: 'review-chair', content_hash: hash },
    { asset_id: 'review-cabinet', content_hash: 'c'.repeat(64) }] };
const asset = { asset_id: 'review-chair', content_hash: hash,
  calibration: { reviewed: false }, provenance_summary: 'lux3d_web' } as AssetRenderDTO;

test('explicit loopback review permits only the named hash without changing review or license state', () => {
  const before = JSON.stringify(asset);
  const policy = localReviewPolicy(config, 'http://127.0.0.1:4174/preview/');
  assert.ok(permitsReviewCandidate(asset, policy, 'http://127.0.0.1:4174/preview/'));
  assert.equal(JSON.stringify(asset), before);
  assert.equal(asset.calibration.reviewed, false);
  assert.equal(permitsReviewCandidate({ ...asset, content_hash: 'b'.repeat(64) }, policy, 'http://127.0.0.1/'), false);
  assert.equal(permitsReviewCandidate({ ...asset, asset_id: 'other' }, policy, 'http://127.0.0.1/'), false);
  assert.equal(permitsReviewCandidate(asset, policy, 'https://public.example/'), false);
});

test('ordinary/public builds cannot enable pending candidates, nor can a license=true toggle', () => {
  assert.equal(localReviewPolicy(undefined, 'http://127.0.0.1/'), null);
  assert.throws(() => localReviewPolicy(config, 'https://example.test/preview/'), /loopback/);
  assert.throws(() => localReviewPolicy({ ...config, publication_approved: true }, 'http://127.0.0.1/'), /license/);
  assert.throws(() => localReviewPolicy({ ...config, candidates: [] }, 'http://127.0.0.1/'), /candidates/);
});
