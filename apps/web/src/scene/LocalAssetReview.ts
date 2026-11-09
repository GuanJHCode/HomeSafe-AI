import type { AssetRenderDTO } from '../../../../contracts/frontend/domain';

export type LocalReviewPolicy = {
  mode: 'local_asset_review'; publication_approved: false; license_status: 'NOT_VERIFIED';
  candidates: { asset_id: string; content_hash: string }[];
};
const loopback = (href: string) => {
  const url = new URL(href);
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
};

// Separate, explicit inspection permission. Never rewrite calibration.reviewed,
// provenance, the publication catalog, or a consent/license field to exercise it.
export function localReviewPolicy(value: unknown, href: string): LocalReviewPolicy | null {
  if (value === undefined) return null;
  if (!loopback(href)) throw new Error('Asset review is limited to HTTP loopback');
  const v = value as Partial<LocalReviewPolicy> | null;
  if (!v || v.mode !== 'local_asset_review' || v.publication_approved !== false || v.license_status !== 'NOT_VERIFIED') {
    throw new Error('Invalid local review license boundary');
  }
  if (!Array.isArray(v.candidates) || v.candidates.length !== 2 || v.candidates.some(c =>
    !c || typeof c.asset_id !== 'string' || !/^[a-f0-9]{64}$/.test(c.content_hash)) ||
    new Set(v.candidates.map(c => c.asset_id)).size !== 2) throw new Error('Invalid review candidates');
  return structuredClone(v) as LocalReviewPolicy;
}

export function permitsReviewCandidate(asset: AssetRenderDTO, policy: LocalReviewPolicy | null, href: string): boolean {
  return Boolean(policy && loopback(href) && policy.mode === 'local_asset_review' &&
    policy.publication_approved === false && policy.license_status === 'NOT_VERIFIED' &&
    policy.candidates.some(c => c.asset_id === asset.asset_id && c.content_hash === asset.content_hash));
}
