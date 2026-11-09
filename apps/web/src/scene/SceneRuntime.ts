import {
  BoxGeometry, Color, DirectionalLight, EdgesGeometry, Group, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera,
  Plane, Raycaster, Scene as ThreeScene, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';
import type {
  AssetRenderDTO, PlacementIssue, Profile, Scene, SceneObject, TransformInput,
} from '../../../../contracts/frontend/domain';
import { AssetLoader, disposeObject } from './AssetLoader.ts';
import type { LocalReviewPolicy } from './LocalAssetReview.ts';
import { createPlaceholder, createRoom } from './roomGeometry.ts';

type View = Profile['role'] | 'overview';
export type AssetLoadState = 'placeholder' | 'loading' | 'loaded' | 'error';

interface ObjectView {
  root: Group;
  hitProxy: Mesh;
  outline: LineSegments<EdgesGeometry, LineBasicMaterial>;
  visual: Object3D;
  asset: boolean;
  key: string;
  failed: boolean;
}

export class SceneRuntime {
  readonly canvas: HTMLCanvasElement;
  private readonly world = new ThreeScene();
  private readonly camera = new PerspectiveCamera(48, 1, 0.03, 100);
  private readonly renderer: WebGLRenderer;
  private readonly host: HTMLElement;
  private readonly assets: AssetLoader;
  private readonly onAssetState: (id: string, state: AssetLoadState | null) => void;
  private readonly resizeObserver: ResizeObserver;
  private readonly raycaster = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly objects = new Map<string, ObjectView>();
  private readonly poses = new Map<string, TransformInput>();
  private room: ReturnType<typeof createRoom> | undefined;
  private roomKey = '';
  private width = 6;
  private depth = 4;
  private role: View = 'overview';
  private focused: readonly string[] = [];
  private selected: string | null = null;
  private findings = new Set<string>();
  private issues = new Set<string>();
  private boundaryIssue = false;
  private frame = 0;
  private disposed = false;
  private renderFailed = false;
  private readonly onRenderFailure: (message: string) => void;

  constructor(host: HTMLElement, assets: readonly AssetRenderDTO[] = [],
    onAssetState: (id: string, state: AssetLoadState | null) => void = () => {},
    onRenderFailure: (message: string) => void = () => {}, localReview: LocalReviewPolicy | null = null) {
    this.host = host;
    this.onAssetState = onAssetState;
    this.onRenderFailure = onRenderFailure;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.assets = new AssetLoader(assets, document.baseURI, 45000, localReview);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    this.canvas.setAttribute('aria-label', '样例客厅三维场景');
    this.canvas.setAttribute('role', 'img');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    this.host.append(this.canvas);

    this.world.background = new Color(0xe8eee7);
    this.world.add(new HemisphereLight(0xfff2de, 0xaebcc4, 2.25));
    const key = new DirectionalLight(0xffecd7, 2.0);
    key.position.set(-2, 9, -3);
    key.target.position.set(3, 0, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.normalBias = 0.03;
    this.world.add(key, key.target);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.placeCamera();
  }

  setSnapshot(snapshot: Scene): void {
    this.width = snapshot.room.width;
    this.depth = snapshot.room.depth;
    const roomKey = JSON.stringify([snapshot.room, snapshot.routes]);
    if (this.roomKey !== roomKey) {
      if (this.room) {
        this.room.group.removeFromParent();
        disposeObject(this.room.group);
      }
      this.room = createRoom(snapshot);
      this.world.add(this.room.group);
      this.roomKey = roomKey;
      this.placeCamera();
    }
    const nextIds = new Set(snapshot.objects.map(({ id }) => id));
    for (const id of this.objects.keys()) {
      if (!nextIds.has(id)) {
        this.removeObject(id);
        this.poses.delete(id);
      }
    }
    for (const object of snapshot.objects) {
      const { id, category, dimensions_m, asset_id, position, yaw_rad } = object;
      const key = JSON.stringify([category, dimensions_m, asset_id]);
      if (this.objects.get(id)?.key !== key) {
        this.removeObject(id);
        this.createObject(object, key);
      }
      const pose = { position: { ...position }, yaw_rad };
      this.poses.set(id, pose);
      this.previewTransform(id, pose);
    }
    this.refreshHighlights();
  }

  private createObject(object: SceneObject, key: string): void {
    const { id, dimensions_m, asset_id } = object;
    const { width, height, depth } = dimensions_m;
    const root = new Group();
    root.name = id;
    root.userData.objectId = id;
    const visual = createPlaceholder(object);
    const geometry = new BoxGeometry(width, height, depth);
    const hitProxy = new Mesh(geometry, new MeshBasicMaterial());
    hitProxy.position.y = height / 2;
    hitProxy.visible = false;
    hitProxy.userData.objectId = id;
    const outline = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({
      color: 0x146e67, depthTest: false,
    }));
    outline.position.y = height / 2;
    outline.scale.setScalar(1.035);
    outline.renderOrder = 10;
    outline.visible = false;
    root.add(visual, hitProxy, outline);
    const view: ObjectView = { root, hitProxy, outline, visual, asset: false, key, failed: false };
    this.objects.set(id, view);
    this.world.add(root);
    this.onAssetState(id, asset_id ? 'loading' : 'placeholder');

    if (asset_id) {
      void this.assets.load(asset_id).then((template) => {
        if (this.disposed || this.objects.get(id) !== view) return;
        const replacement = this.assets.instantiate(template, dimensions_m);
        replacement.userData.visualSource = 'reviewed_glb';
        visual.removeFromParent();
        disposeObject(visual);
        root.add(replacement);
        view.visual = replacement;
        view.asset = true;
        this.onAssetState(id, 'loaded');
        this.requestRender();
      }).catch(() => {
        if (!this.disposed && this.objects.get(id) === view) {
          view.failed = true;
          this.onAssetState(id, 'error');
        }
      });
    }
  }

  retryFailedAssets(snapshot: Scene): void {
    if (this.disposed) return;
    for (const [id, view] of this.objects) {
      if (view.failed) this.removeObject(id);
    }
    this.setSnapshot(snapshot);
  }

  private removeObject(id: string): void {
    const object = this.objects.get(id);
    if (!object) return;
    if (object.asset) this.assets.release(object.visual);
    object.root.removeFromParent();
    disposeObject(object.root);
    this.objects.delete(id);
    this.onAssetState(id, null);
  }

  setRoleView(role: View): void {
    this.role = role;
    this.canvas.dataset.role = role;
    this.focused = [];
    this.placeCamera();
    this.refreshHighlights();
  }

  focusObjects(ids: readonly string[]): void {
    this.focused = ids;
    this.placeCamera();
    this.refreshHighlights();
  }

  private placeCamera(): void {
    const span = Math.max(this.width, this.depth);
    const target = new Vector3(this.width / 2, 0.45, this.depth * 0.56);
    if (this.role === 'overview') {
      this.camera.position.set(this.width * -0.46, span * 0.86, this.depth * -0.98);
    } else {
      // These are presentation-only eye levels, independent of reach observations.
      const y = this.role === 'child' ? 0.98 : 1.55;
      this.camera.position.set(this.width * 0.44, y, -span * 0.82);
    }
    const focus = new Vector3();
    let count = 0;
    for (const id of this.focused) {
      const view = this.objects.get(id);
      const route = this.room?.routes.get(id);
      if (view) {
        focus.add(view.root.position);
        focus.y += view.hitProxy.position.y;
      } else if (route) {
        focus.add(route.position);
      } else {
        continue;
      }
      count++;
    }
    if (count) target.lerp(focus.divideScalar(count), 0.56);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }

  setSelected(id: string | null): void {
    this.selected = id;
    this.canvas.dataset.selected = id ?? '';
    this.refreshHighlights();
  }

  setFindings(ids: readonly string[]): void {
    this.findings = new Set(ids);
    this.refreshHighlights();
  }

  showPlacementIssues(issues: readonly PlacementIssue[]): void {
    this.issues = new Set(issues.flatMap((issue) =>
      [issue.object_id, ...(issue.related_object_ids ?? [])].filter((id): id is string => !!id),
    ));
    this.boundaryIssue = issues.some((issue) => issue.code === 'FOOTPRINT_OUTSIDE_ROOM');
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    for (const [id, { outline }] of this.objects) {
      const color = this.issues.has(id) ? 0xbc3331
        : this.selected === id || this.focused.includes(id) ? 0x087970
          : this.findings.has(id) ? 0xc76c22 : undefined;
      outline.visible = color !== undefined;
      if (color !== undefined) outline.material.color.setHex(color);
    }
    if (this.room) {
      this.room.boundary.material.color.setHex(this.boundaryIssue ? 0xbc3331 : 0x985c39);
      for (const [id, route] of this.room.routes) {
        route.material.color.setHex(this.focused.includes(id) ? 0x087970
          : this.findings.has(id) ? 0xdba350 : 0x4eaa9a);
      }
    }
    this.requestRender();
  }

  getPose(id: string): TransformInput | undefined {
    return this.poses.get(id);
  }

  previewTransform(id: string, { position, yaw_rad }: TransformInput): void {
    const object = this.objects.get(id);
    if (!object) return;
    object.root.position.set(position.x, position.y, position.z);
    object.root.rotation.y = yaw_rad;
    this.requestRender();
  }

  restorePose(id: string): void {
    const pose = this.getPose(id);
    if (pose) this.previewTransform(id, pose);
  }

  private pointRay(x: number, y: number): boolean {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return false;
    this.raycaster.setFromCamera(new Vector2(
      2 * (x - bounds.left) / bounds.width - 1,
      1 - 2 * (y - bounds.top) / bounds.height,
    ), this.camera);
    return true;
  }

  pickObject(x: number, y: number): string | null {
    if (!this.pointRay(x, y)) return null;
    this.world.updateMatrixWorld(true);
    const proxies = [...this.objects.values()].map((object) => object.hitProxy);
    const first = this.raycaster.intersectObjects(proxies, false)[0];
    return first?.object.userData.objectId ?? null;
  }

  groundPoint(x: number, y: number): { x: number; z: number } | null {
    if (!this.pointRay(x, y)) return null;
    return this.raycaster.ray.intersectPlane(this.ground, new Vector3());
  }

  resize(): void {
    if (this.disposed) return;
    const { clientWidth, clientHeight } = this.host;
    if (!clientWidth || !clientHeight) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.requestRender();
  }

  private requestRender(): void {
    if (!this.frame && !this.disposed && !this.renderFailed) this.frame = requestAnimationFrame(this.renderFrame);
  }

  private contextLost = (event: Event): void => {
    event.preventDefault();
    this.failRender('三维绘图上下文已丢失。布局和检查结果仍保留，可继续用家具按钮操作。');
  };

  private failRender(message: string): void {
    if (this.disposed || this.renderFailed) return;
    this.renderFailed = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.onRenderFailure(message);
  }

  private renderFrame = (): void => {
    this.frame = 0;
    if (this.disposed || this.renderFailed) return;
    try {
      this.renderer.render(this.world, this.camera);
    } catch (error) {
      this.failRender(`三维绘制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const id of this.objects.keys()) this.removeObject(id);
    this.poses.clear();
    this.assets.dispose();
    disposeObject(this.world);
    this.world.traverse((object) => {
      if (object instanceof DirectionalLight) object.shadow.dispose();
    });
    this.world.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
