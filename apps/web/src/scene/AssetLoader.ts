import {
  Box3, BufferGeometry, Group, LoadingManager, Material, Mesh,
  Object3D, SkinnedMesh, Texture, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { AssetCalibration, AssetRenderDTO, Dimensions } from '../../../../contracts/frontend/domain';
import { permitsReviewCandidate, type LocalReviewPolicy } from './LocalAssetReview.ts';

export interface AssetTemplate {
  model: Object3D;
  calibration: AssetCalibration;
}

const sizes = (dimensions: Dimensions) =>
  new Vector3(dimensions.width, dimensions.height, dimensions.depth);

function matchesBounds(actual: Vector3, expected: Vector3): boolean {
  return (['x', 'y', 'z'] as const).every((axis) =>
    Number.isFinite(actual[axis]) && Number.isFinite(expected[axis]) &&
    expected[axis] > 0 &&
    Math.abs(actual[axis] - expected[axis]) <= Math.max(0.002, expected[axis] * 0.01),
  );
}

export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<ImageBitmap>();
  root.traverse((node) => {
    if (node instanceof SkinnedMesh) node.skeleton.dispose();
    if ('geometry' in node && node.geometry instanceof BufferGeometry) geometries.add(node.geometry);
    if ('material' in node) {
      const values = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of values) {
        if (material instanceof Material) materials.add(material);
      }
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
    material.dispose();
  }
  for (const texture of textures) {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) {
      images.add(texture.image);
    }
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const geometry of geometries) geometry.dispose();
}

export class AssetLoader {
  private readonly descriptors: Map<string, AssetRenderDTO>;
  private readonly baseUrl: URL;
  private readonly templates = new Map<string, Promise<AssetTemplate>>();
  private readonly instances = new Set<Object3D>();
  private readonly abort = new AbortController();
  private readonly downloadTimeoutMs: number;
  private readonly localReview: LocalReviewPolicy | null;
  private readonly gltf = new GLTFLoader(new LoadingManager().setURLModifier((url) => {
    if (!url.startsWith('blob:')) throw new Error('GLB must embed all model resources');
    return url;
  }));

  constructor(assets: readonly AssetRenderDTO[], baseUrl: string = document.baseURI,
    downloadTimeoutMs = 45000, localReview: LocalReviewPolicy | null = null) {
    this.downloadTimeoutMs = downloadTimeoutMs;
    this.localReview = localReview;
    this.descriptors = new Map(assets.map((asset) => [asset.asset_id, asset]));
    this.baseUrl = new URL(baseUrl);
  }

  load(assetId: string): Promise<AssetTemplate> {
    const asset = this.descriptors.get(assetId);
    if (this.abort.signal.aborted || !asset || (!asset.calibration.reviewed &&
        !permitsReviewCandidate(asset, this.localReview, this.baseUrl.href)) ||
        asset.provenance_summary === 'unverified') {
      return Promise.reject(new Error('Asset has no reviewed calibration and provenance'));
    }
    const key = `${assetId}:${asset.content_hash}:${asset.calibration.revision}`;
    const cached = this.templates.get(key);
    if (cached) return cached;
    const pending = this.fetchTemplate(asset).catch((error: unknown) => {
      this.templates.delete(key);
      throw error;
    });
    this.templates.set(key, pending);
    return pending;
  }

  private async fetchTemplate(asset: AssetRenderDTO): Promise<AssetTemplate> {
    const url = new URL(asset.render_url, this.baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.origin !== this.baseUrl.origin) {
      throw new Error('Asset must be served from the application origin');
    }
    // Request with integrity so changed bytes cannot appear under a reviewed asset ID.
    const hashBytes = asset.content_hash.match(/^[a-f0-9]{64}$/)
      ? asset.content_hash.match(/../g)?.map((part) => Number.parseInt(part, 16))
      : undefined;
    if (!hashBytes) throw new Error('Asset hash is invalid');
    const deadline = new AbortController();
    const signal = AbortSignal.any([this.abort.signal, deadline.signal]);
    const timer = setTimeout(() => deadline.abort(new Error('模型下载超时，请重试。')), this.downloadTimeoutMs);
    let buffer: ArrayBuffer;
    try {
      const response = await fetch(url, {
        signal,
        mode: 'same-origin',
        redirect: 'error',
        integrity: `sha256-${btoa(String.fromCharCode(...hashBytes))}`,
      });
      if (!response.ok) throw new Error(`GLB load failed (${response.status})`);
      buffer = await response.arrayBuffer();
      signal.throwIfAborted();
    } finally {
      clearTimeout(timer);
    }
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) {
      throw new Error('Asset is not a GLB');
    }
    const { scene } = await this.gltf.parseAsync(buffer, '');
    try {
      if (this.abort.signal.aborted) throw new Error('Asset loader disposed');
      return AssetLoader.normalize(scene, asset.calibration);
    } catch (error) {
      disposeObject(scene);
      throw error;
    }
  }

  static normalize(source: Object3D, calibration: AssetCalibration): AssetTemplate {
    const model = new Group();
    const orientation = new Group();
    if (calibration.strategy === 'runtime_axis_fit') {
      const { x, y, z, w } = calibration.orientation;
      orientation.quaternion.set(x, y, z, w);
      const pivot = calibration.pivot_offset_after_rotation;
      model.position.set(-pivot.x, -pivot.y, -pivot.z);
    }
    orientation.add(source);
    model.add(orientation);
    const box = new Box3().setFromObject(model, true);
    const expected = sizes(calibration.normalized_bounds_m);
    const base = box.getCenter(new Vector3());
    base.y = box.min.y;
    if (!matchesBounds(box.getSize(new Vector3()), expected) ||
        (['x', 'y', 'z'] as const).some((axis) =>
          Math.abs(base[axis]) > Math.max(0.002, expected[axis] * 0.01),
        )) {
      throw new Error('GLB bounds or bottom-center origin do not match the reviewed calibration');
    }
    model.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return { model, calibration };
  }

  instantiate(template: AssetTemplate, dimensions: Dimensions): Object3D {
    const visual = new Group();
    const expected = sizes(template.calibration.normalized_bounds_m);
    const target = sizes(dimensions);
    if (template.calibration.strategy === 'runtime_axis_fit') {
      visual.scale.copy(target).divide(expected);
    } else if (!matchesBounds(target, expected)) {
      throw new Error('Baked GLB dimensions do not match the layout proxy');
    }
    visual.add(clone(template.model));
    this.instances.add(visual);
    return visual;
  }

  release(instance: Object3D): void {
    if (!this.instances.delete(instance)) return;
    instance.removeFromParent();
    // Meshes share template geometry and materials, but a cloned skeleton is instance-owned.
    instance.traverse((node) => {
      if (node instanceof SkinnedMesh) node.skeleton.dispose();
    });
  }

  dispose(): void {
    this.abort.abort();
    for (const instance of this.instances) this.release(instance);
    for (const pending of this.templates.values()) {
      void pending.then(({ model }) => disposeObject(model), () => {});
    }
    this.templates.clear();
  }
}
