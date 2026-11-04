// A loopback-only test entry. Not imported by the product or included by vite build.
import {
  Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, PerspectiveCamera,
  Scene, Texture, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetLoader, disposeObject } from '../src/scene/AssetLoader.ts';
import { applicationBaseUrl, candidateCalibration } from './private-asset-calibration.ts';
import type { AssetRenderDTO, Dimensions } from '../../../contracts/frontend/domain';

type Intake = { id: string; asset_id: string; sha256: string; bytes: number; dimensions: Dimensions; provenance: 'lux3d_web' | 'procedural' };
const result: { status: string; assets: AssetRenderDTO[]; checks: unknown[]; error?: string } = {
  status: 'RUNNING', assets: [], checks: [],
};
Object.assign(window, { privateAssetResult: result });
const close = (actual: number, expected: number) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-5) {
    throw new Error(`Bounds mismatch: ${actual} versus ${expected}`);
  }
};

try {
  if (location.hostname !== '127.0.0.1') throw new Error('Private probe requires loopback');
  const input: Intake[] = await (await fetch('/__intake/info.json')).json();
  const scene = new Scene(); scene.background = new Color(0xe8eee7);
  scene.add(new HemisphereLight(0xffffff, 0x919788, 2.5));
  const light = new DirectionalLight(0xffffff, 3); light.position.set(2, 5, 4); scene.add(light);
  const camera = new PerspectiveCamera(40, 1100 / 800, 0.01, 50);
  camera.position.set(2.3, 2, 3.6); camera.lookAt(0, 0.8, 0);
  const renderer = new WebGLRenderer({ antialias: true }); renderer.setSize(1100, 800);
  document.querySelector('#preview')!.append(renderer.domElement);

  for (const item of input) {
    const url = `/__intake/${item.id}.glb`;
    const bytes = await (await fetch(url)).arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    if (hash !== item.sha256 || bytes.byteLength !== item.bytes) throw new Error('Source bytes changed');
    const original = (await new GLTFLoader().parseAsync(bytes, '')).scene;
    const bbox = new Box3().setFromObject(original, true);
    const size = bbox.getSize(new Vector3()), pivot = bbox.getCenter(new Vector3()); pivot.y = bbox.min.y;
    if (size.toArray().some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Degenerate model bounds');
    const asset: AssetRenderDTO = {
      asset_id: item.asset_id, content_hash: hash,
      // Served only by the private harness; never written into public/ or the catalog.
      render_url: `assets/public/private-test-${item.id}.glb`, provenance_summary: item.provenance,
      calibration: candidateCalibration(original),
    };
    disposeObject(original);
    const loader = new AssetLoader([asset], applicationBaseUrl(location.href));
    const template = await loader.load(asset.asset_id);
    if (await loader.load(asset.asset_id) !== template) throw new Error('Template cache failed');
    let triangles = 0; const textures = new Set<Texture>();
    template.model.traverse(node => {
      if (!(node instanceof Mesh)) return;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      }
    });
    if (textures.size < 2 || [...textures].some(t => !t.image?.width || !t.image?.height)) {
      throw new Error('Expected decoded base-color and metal/roughness textures');
    }
    const visual = loader.instantiate(template, item.dimensions);
    const second = loader.instantiate(template, item.dimensions);
    const object = new Group(); object.userData.objectId = item.id; object.add(visual);
    const assertBounds = (rotated: boolean) => {
      const box = new Box3().setFromObject(object, true), extent = box.getSize(new Vector3());
      close(extent.x, rotated ? item.dimensions.depth : item.dimensions.width);
      close(extent.y, item.dimensions.height);
      close(extent.z, rotated ? item.dimensions.width : item.dimensions.depth);
      close(box.min.y, 0);
      close(box.getCenter(new Vector3()).x, object.position.x);
      close(box.getCenter(new Vector3()).z, object.position.z);
    };
    assertBounds(false);
    object.position.set(3, 0, 2); object.rotation.y = Math.PI / 2; assertBounds(true);
    object.position.set(0, 0, 0); object.rotation.y = 0; assertBounds(false);
    if (object.userData.objectId !== item.id) throw new Error('Stable object binding changed');
    loader.release(visual);
    close(new Box3().setFromObject(second, true).getSize(new Vector3()).y, item.dimensions.height);
    second.position.x = item.id === 'chair' ? -0.65 : 0.65; scene.add(second);
    result.assets.push(asset);
    result.checks.push({ object_id: item.id, sha256: hash, bytes: bytes.byteLength, triangles,
      textures_decoded: textures.size, source_bounds: size.toArray(), target_dimensions: item.dimensions,
      fit: 'PASS', bottom_center: 'PASS', rotation_90: 'PASS', multiple_instances: 'PASS',
      release_preserves_other_instance: 'PASS' });
    window.addEventListener('pagehide', () => loader.dispose(), { once: true });
  }
  renderer.render(scene, camera);
  result.status = 'PASS';
  document.querySelector('#status')!.textContent = '实际 GLB 加载与数值校准通过；本页不代表公开授权或 T03 整体验收。';
} catch (error) {
  result.status = 'FAIL'; result.error = String(error);
  document.querySelector('#status')!.textContent = result.error;
}
