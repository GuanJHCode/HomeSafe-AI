import { Box3, Group, Object3D, Quaternion, Vector3 } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { AssetCalibration } from '../../../contracts/frontend/domain';

// The inspection page lives under /tests/, while the app and intake routes are
// at /. Resolve explicitly instead of inheriting the inspection document base.
export const applicationBaseUrl = (pageHref: string): string => new URL('/', pageHref).href;

export type SourceFront = '+Z' | '-Z' | '+X' | '-X';

const sourceFrontYaw: Record<SourceFront, number> = {
  '+Z': Math.PI, '-Z': 0, '+X': Math.PI / 2, '-X': -Math.PI / 2,
};

export function candidateCalibration(source: Object3D, sourceFront: SourceFront): AssetCalibration {
  if (!Object.hasOwn(sourceFrontYaw, sourceFront)) throw new Error('Source front must be declared');
  const quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sourceFrontYaw[sourceFront]);
  // The offset and bounds are measured after rotation. Cloning leaves the GLB
  // source and its parent untouched while the private candidate is inspected.
  const oriented = new Group();
  oriented.quaternion.copy(quaternion);
  oriented.add(clone(source));
  const box = new Box3().setFromObject(oriented, true);
  const size = box.getSize(new Vector3()), pivot = box.getCenter(new Vector3());
  pivot.y = box.min.y;
  if (size.toArray().some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Degenerate model bounds');
  return {
    revision: 1, strategy: 'runtime_axis_fit', reviewed: true,
    orientation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
    pivot_offset_after_rotation: { x: pivot.x, y: pivot.y, z: pivot.z },
    normalized_bounds_m: { width: size.x, height: size.y, depth: size.z },
    notes: `Private test-only calibration: the runtime descriptor is temporarily marked reviewed solely to exercise its gate; the persisted candidate remains reviewed=false and is not publication approval. Declared Y-up/${sourceFront} source front maps to scene -Z; visual confirmation remains pending. Original coordinate bounds are not physical measurements. Rights and visual review remain separate.`,
  };
}
