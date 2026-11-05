import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { PlacementIssue, TransformInput } from '../../../contracts/frontend/domain';
import { TransformController } from '../src/scene/TransformController.ts';
import type { TransformSurface } from '../src/scene/TransformController.ts';

class PointerCanvas extends EventTarget {
  dataset: Record<string, string> = {};
  pointerId: number | null = null;
  hasPointerCapture(id: number): boolean { return this.pointerId === id; }
  setPointerCapture(id: number): void { this.pointerId = id; }
  releasePointerCapture(): void { this.pointerId = null; }
  pointer(type: string, x: number, y: number): void {
    this.dispatchEvent(Object.assign(new Event(type), {
      isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: y,
    }));
  }
}

test('drag previews until release, sends one proposal, and restores the last legal pose on rejection', async () => {
  const canvas = new PointerCanvas();
  const initial = { position: { x: 5.3, y: 0, z: 3.3 }, yaw_rad: 0 };
  let committed = initial;
  let visible = committed;
  let selected: string | null = null;
  let issues: readonly PlacementIssue[] = [];
  const draftStates: boolean[] = [];
  const rejectIssue: PlacementIssue = {
    object_id: 'chair', related_object_ids: ['cabinet'], field: 'position',
    code: 'SOLID_PENETRATION', message: 'Objects overlap',
  };
  const proposals: TransformInput[] = [];
  let respond!: (value: readonly PlacementIssue[] | void) => void;
  const surface: TransformSurface = {
    canvas: canvas as unknown as HTMLCanvasElement,
    getPose: () => committed,
    pickObject: () => 'chair',
    groundPoint: (x, z) => ({ x: x / 100, z: z / 100 }),
    previewTransform: (_id, transform) => { visible = transform; },
    restorePose: () => { visible = committed; },
    showPlacementIssues: (value) => { issues = value; },
  };
  const controller = new TransformController(surface, {
    canMove: (id) => id === 'chair',
    select: (id) => { selected = id; },
    commit: (_id, pose) => {
      proposals.push(pose);
      return new Promise((resolve) => { respond = resolve; });
    },
    onDraftChange: active => { draftStates.push(active); },
  });

  canvas.pointer('pointerdown', 30, 50);
  assert.equal(selected, 'chair');
  assert.equal(draftStates.at(-1), true, 'Pointer hold blocks report output before a visible move');
  canvas.pointer('pointermove', 50, 80);
  canvas.pointer('pointermove', 70, 80);
  assert.equal(proposals.length, 0);
  assert.equal(visible.position.x, 5.7);
  canvas.pointer('pointerup', 80, 80);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].position.x, 5.8);
  assert.equal(canvas.pointerId, null);
  assert.equal(draftStates.at(-1), true, 'Draft gate stays active until evaluation settles');

  // A rejected edit must restore the pose from the current snapshot, even if it changed.
  committed = { position: { x: 3, y: 0, z: 3.3 }, yaw_rad: 0 };
  respond([rejectIssue]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(visible, committed);
  assert.deepEqual(issues, [rejectIssue]);
  assert.equal(draftStates.at(-1), false, 'Rejected proposal restores accepted report access');

  canvas.pointer('pointerdown', 30, 50);
  canvas.pointer('pointermove', 80, 80);
  canvas.pointer('pointercancel', 80, 80);
  assert.deepEqual(visible, committed);
  assert.equal(proposals.length, 1);
  assert.equal(draftStates.at(-1), false, 'Canceled pointer restores report access');

  canvas.pointer('pointerdown', 30, 50);
  assert.equal(draftStates.at(-1), true);
  canvas.pointer('lostpointercapture', 30, 50);
  assert.equal(draftStates.at(-1), false, 'Lost capture restores report access');

  canvas.pointer('pointerdown', 30, 50);
  canvas.pointer('pointerup', 31, 51);
  assert.equal(proposals.length, 1);
  assert.equal(draftStates.at(-1), false, 'A hold without a submitted change restores report access');
  const rotation = controller.rotate('chair', Math.PI / 2);
  assert.equal(proposals.length, 2);
  assert.equal(draftStates.at(-1), true, 'Button transform also blocks output until accepted');
  assert.equal(proposals[1].yaw_rad, Math.PI / 2);
  assert.deepEqual(proposals[1].position, committed.position);
  respond();
  await rotation;
  assert.equal(draftStates.at(-1), false);
  canvas.pointer('pointerdown', 30, 50);
  assert.equal(draftStates.at(-1), true);
  controller.dispose();
  assert.equal(draftStates.at(-1), false, 'Unmounting clears draft state');
  canvas.pointer('pointerdown', 30, 50);
  assert.equal(canvas.pointerId, null);
});
