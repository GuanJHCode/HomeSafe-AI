import { Box3, Object3D, Vector3 } from 'three';
import type { AssetCalibration } from '../../../contracts/frontend/domain';

// The inspection page lives under /tests/, while the app and intake routes are
// at /. Resolve explicitly instead of inheriting the inspection document base.
export const applicationBaseUrl = (pageHref: string): string => new URL('/', pageHref).href;

export function candidateCalibration(source: Object3D): AssetCalibration {
  const box = new Box3().setFromObject(source, true);
  const size = box.getSize(new Vector3()), pivot = box.getCenter(new Vector3());
  pivot.y = box.min.y;
  if (size.toArray().some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Degenerate model bounds');
  return {
    revision: 1, strategy: 'runtime_axis_fit', reviewed: true,
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    pivot_offset_after_rotation: { x: pivot.x, y: pivot.y, z: pivot.z },
    normalized_bounds_m: { width: size.x, height: size.y, depth: size.z },
    notes: 'Private test-only candidate: reviewed=true exercises the runtime gate, not publication approval. Y-up/+Z front assumption. Original coordinate bounds are not physical measurements. Rights and visual review remain separate.',
  };
}
