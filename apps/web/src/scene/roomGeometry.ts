import {
  BoxGeometry, BufferGeometry, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshStandardMaterial, Vector3,
} from 'three';
import type { Scene, SceneObject } from '../../../../contracts/frontend/domain';

function box(group: Group, material: MeshStandardMaterial, width: number, height: number, depth: number,
  x: number, y: number, z: number): Mesh<BoxGeometry, MeshStandardMaterial> {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function material(color: number, transparent = false, opacity = 1): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.8, transparent, opacity });
}

export function createRoom(scene: Scene) {
  const { width, depth, height } = scene.room;
  const group = new Group();
  box(group, material(0xd9c0a3), width, 0.08, depth, width / 2, -0.04, depth / 2);
  const wall = material(0xe7e3d6);
  const wallHeight = Math.min(height, 2.35);
  box(group, wall, width + 0.1, wallHeight, 0.08, width / 2, wallHeight / 2, depth + 0.04);
  box(group, wall, 0.08, wallHeight, depth, width + 0.04, wallHeight / 2, depth / 2);
  const skirting = material(0xb0977c);
  box(group, skirting, width, 0.08, 0.04, width / 2, 0.04, depth - 0.02);
  box(group, skirting, 0.04, 0.08, depth, width - 0.02, 0.04, depth / 2);

  const grid: Vector3[] = [];
  for (let x = 0.5; x < width; x += 0.5) {
    grid.push(new Vector3(x, 0.001, 0), new Vector3(x, 0.001, depth));
  }
  for (let z = 0.5; z < depth; z += 0.5) {
    grid.push(new Vector3(0, 0.001, z), new Vector3(width, 0.001, z));
  }
  group.add(new LineSegments(new BufferGeometry().setFromPoints(grid),
    new LineBasicMaterial({ color: 0xc3a98e })));

  const boundaryPoints = [
    new Vector3(0, 0.009, 0), new Vector3(width, 0.009, 0),
    new Vector3(width, 0.009, depth), new Vector3(0, 0.009, depth),
  ];
  const boundary = new LineSegments(new BufferGeometry().setFromPoints(
    boundaryPoints.flatMap((point, i) => [point, boundaryPoints[(i + 1) % boundaryPoints.length]]),
  ), new LineBasicMaterial({ color: 0x985c39 }));
  group.add(boundary);

  const routes = new Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>();
  for (const { id, rect, confirmed } of scene.routes) {
    const route = material(0x4eaa9a, true, confirmed ? 0.38 : 0.17);
    route.depthWrite = false;
    routes.set(id, box(group, route, rect.width, 0.004, rect.depth, rect.x, 0.003, rect.z));
  }
  return { group, boundary, routes };
}

export function createPlaceholder(object: SceneObject): Group {
  const { width: w, height: h, depth: d } = object.dimensions_m;
  const group = new Group();
  group.userData.visualSource = 'procedural_placeholder';
  switch (object.category) {
    case 'support': {
      const wood = material(0x91503e);
      const fabric = material(0xd58761);
      for (const x of [-0.4 * w, 0.4 * w]) {
        for (const z of [-0.4 * d, 0.4 * d]) {
          box(group, wood, 0.15 * w, 0.5 * h, 0.15 * d, x, 0.25 * h, z);
        }
      }
      box(group, fabric, w, 0.13 * h, d, 0, 0.51 * h, 0);
      box(group, wood, w, 0.46 * h, 0.17 * d, 0, 0.77 * h, 0.415 * d);
      break;
    }
    case 'cabinet':
    case 'hazardous_storage': {
      const storage = object.category === 'hazardous_storage';
      const shell = material(storage ? 0x8f6b8a : 0x777b61);
      const doors = material(storage ? 0xa98ba3 : 0x969f80);
      const handle = material(0x493e34);
      box(group, shell, w, h, d * 0.91, 0, h / 2, 0.045 * d);
      for (const x of [-w / 4, w / 4]) {
        box(group, doors, w * 0.46, h * 0.9, d * 0.07, x, h / 2, -d * 0.455);
        box(group, handle, w * 0.035, h * 0.09, d * 0.02, x * 0.35, h / 2, -d * 0.49);
      }
      break;
    }
    case 'window': {
      const frame = material(0x526b66);
      const pane = material(0x8ed2d7, true, 0.78);
      box(group, pane, w * 0.45, h, d, 0, h / 2, 0);
      for (const z of [-0.46 * d, 0, 0.46 * d]) {
        box(group, frame, w, h, 0.08 * d, 0, h / 2, z);
      }
      for (const y of [0.04 * h, 0.96 * h]) {
        box(group, frame, w, 0.08 * h, d, 0, y, 0);
      }
      break;
    }
    case 'child_gate': {
      const gate = material(0xa38652);
      for (const z of [-0.44 * d, -0.22 * d, 0, 0.22 * d, 0.44 * d]) {
        box(group, gate, w * 0.45, h, 0.12 * d, 0, h / 2, z);
      }
      for (const y of [0.055 * h, 0.945 * h]) {
        box(group, gate, w, 0.11 * h, d, 0, y, 0);
      }
      break;
    }
    default: {
      const color = object.category === 'rug' ? 0x617c92 : 0x59535a;
      box(group, material(color), w, h, d, 0, h / 2, 0);
    }
  }
  group.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = object.category !== 'window';
  });
  return group;
}
