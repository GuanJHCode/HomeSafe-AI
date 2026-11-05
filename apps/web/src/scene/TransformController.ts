import type { PlacementIssue, TransformInput } from '../../../../contracts/frontend/domain';

export interface TransformSurface {
  canvas: HTMLCanvasElement;
  getPose(id: string): TransformInput | undefined;
  pickObject(clientX: number, clientY: number): string | null;
  groundPoint(clientX: number, clientY: number): { x: number; z: number } | null;
  previewTransform(id: string, transform: TransformInput): void;
  restorePose(id: string): void;
  showPlacementIssues(issues: readonly PlacementIssue[]): void;
}

interface TransformActions {
  canMove(id: string): boolean;
  select(id: string | null): void;
  commit(id: string, transform: TransformInput): Promise<readonly PlacementIssue[] | void>;
  onDraftChange?(active: boolean): void;
}

interface Drag {
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  startX: number;
  startZ: number;
  initial: TransformInput;
  preview?: TransformInput;
}

export class TransformController {
  private readonly surface: TransformSurface;
  private readonly actions: TransformActions;
  private drag: Drag | undefined;
  private pending = false;
  private disposed = false;
  private drafting = false;

  constructor(surface: TransformSurface, actions: TransformActions) {
    this.surface = surface;
    this.actions = actions;
    const { canvas } = surface;
    canvas.addEventListener('pointerdown', this.beginDrag);
    canvas.addEventListener('pointermove', this.previewTransform);
    canvas.addEventListener('pointerup', this.commitDrag);
    canvas.addEventListener('pointercancel', this.cancelPointer);
    canvas.addEventListener('lostpointercapture', this.cancelPointer);
  }

  beginDrag = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || this.drag || this.pending) return;
    const id = this.surface.pickObject(event.clientX, event.clientY);
    this.actions.select(id);
    if (!id || !this.actions.canMove(id)) return;
    const initial = this.surface.getPose(id);
    const ground = this.surface.groundPoint(event.clientX, event.clientY);
    if (!initial || !ground) return;

    this.surface.showPlacementIssues([]);
    this.surface.canvas.setPointerCapture(event.pointerId);
    this.surface.canvas.dataset.dragging = 'true';
    this.drag = {
      id, pointerId: event.pointerId, initial,
      clientX: event.clientX, clientY: event.clientY,
      startX: ground.x, startZ: ground.z,
    };
    this.setDrafting(true);
  };

  previewTransform = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.preview && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return;
    const ground = this.surface.groundPoint(event.clientX, event.clientY);
    if (!ground) return;
    const { position, yaw_rad } = drag.initial;
    drag.preview = {
      position: {
        x: position.x + Math.round((ground.x - drag.startX) * 100) / 100,
        y: position.y,
        z: position.z + Math.round((ground.z - drag.startZ) * 100) / 100,
      },
      yaw_rad,
    };
    this.surface.previewTransform(drag.id, drag.preview);
  };

  commitDrag = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    if (!this.surface.groundPoint(event.clientX, event.clientY)) {
      this.cancelDrag();
      return;
    }
    this.previewTransform(event);
    const drag = this.endDrag();
    if (drag?.preview) void this.commitTransform(drag.id, drag.preview);
    else this.setDrafting(false);
  };

  private cancelPointer = (event: PointerEvent): void => {
    if (this.drag?.pointerId === event.pointerId) this.cancelDrag();
  };

  cancelDrag(): void {
    const drag = this.endDrag();
    if (drag) this.surface.restorePose(drag.id);
    this.setDrafting(false);
  }

  private setDrafting(active: boolean): void {
    if (this.drafting === active) return;
    this.drafting = active;
    this.actions.onDraftChange?.(active);
  }

  private endDrag(): Drag | undefined {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    const { canvas } = this.surface;
    delete canvas.dataset.dragging;
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    return drag;
  }

  async rotate(id: string, deltaRadians: number): Promise<void> {
    const pose = this.surface.getPose(id);
    if (!pose || !Number.isFinite(deltaRadians)) return;
    const turn = 2 * Math.PI;
    const yaw_rad = ((pose.yaw_rad + deltaRadians + Math.PI) % turn + turn) % turn - Math.PI;
    await this.commitTransform(id, { ...pose, yaw_rad });
  }

  async commitTransform(id: string, transform: TransformInput): Promise<void> {
    if (this.disposed || this.drag || this.pending) return;
    const current = this.surface.getPose(id);
    if (!current) { this.setDrafting(false); return; }
    if (!this.actions.canMove(id) ||
        (current.position.x === transform.position.x && current.position.y === transform.position.y &&
          current.position.z === transform.position.z && current.yaw_rad === transform.yaw_rad)) {
      this.surface.restorePose(id);
      this.setDrafting(false);
      return;
    }
    this.pending = true;
    this.surface.showPlacementIssues([]);
    this.setDrafting(true);
    this.surface.previewTransform(id, transform);
    try {
      const issues = await this.actions.commit(id, transform);
      if (!this.disposed && issues?.length) {
        this.surface.restorePose(id);
        this.surface.showPlacementIssues(issues);
      }
    } catch {
      if (!this.disposed) this.surface.restorePose(id);
    } finally {
      this.pending = false;
      this.setDrafting(false);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelDrag();
    this.setDrafting(false);
    const { canvas } = this.surface;
    canvas.removeEventListener('pointerdown', this.beginDrag);
    canvas.removeEventListener('pointermove', this.previewTransform);
    canvas.removeEventListener('pointerup', this.commitDrag);
    canvas.removeEventListener('pointercancel', this.cancelPointer);
    canvas.removeEventListener('lostpointercapture', this.cancelPointer);
  }
}
