import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type {
  Assessment, AssetRenderDTO, ChallengeResult, Comparison, PlacementIssue, Profile, Scene, TransformInput,
} from '../../../contracts/frontend/domain.ts';
import { ChallengeController } from './domain/ChallengeController.ts';
import { EvaluationController, type WorkerConfig } from './domain/EvaluationController.ts';
import { FindingsPresenter, type ComparisonPresentation } from './domain/FindingsPresenter.ts';
import { ReportBuilder } from './domain/ReportBuilder.ts';
import { placementFeedback, WorkspaceController, type LayoutChange } from './domain/WorkspaceController.ts';
import { SceneRuntime, type AssetLoadState } from './scene/SceneRuntime.ts';
import { TransformController } from './scene/TransformController.ts';
import { readJsonResource } from './domain/resource-loading.ts';

const exercises = {
  challenge: {
    object: 'chair', title: '引导：给窗口和通道都留出空间',
    instruction: '本关只允许移动、旋转椅子。将椅子移离窗口，并避开老人指定通道。试着撤销一次，查看仍待核查的资料。',
  },
  'main-challenge': {
    object: 'cabinet', title: '主挑战：柜体放在哪里？',
    instruction: '本关只允许移动、旋转柜体。离开窗边后，也要给老人指定通道留出空间。可尝试沿墙或房间另一侧的不同合法摆位；柜体固定情况仍待现场核查。',
  },
} as const;
const workspaceObjects = ['chair', 'cabinet'];
const names: Record<string, string> = {
  chair: '椅子', cabinet: '柜体', window: '窗户', storage: '收纳柜',
  rug: '地毯', cord: '线缆', gate: '儿童门栏', 'elder-route': '老人指定通道',
};

function placementIssues(error: unknown): PlacementIssue[] {
  if (!(error instanceof Error) || !('details' in error)) return [];
  const details = error.details as { code?: string; issues?: PlacementIssue[] } | undefined;
  return details?.code === 'INVALID_PLACEMENT' && Array.isArray(details.issues) ? details.issues : [];
}

export function useLivingRoom() {
  const host = ref<HTMLElement | null>(null);
  const mode = ref<'workspace' | 'challenge' | 'main-challenge'>('workspace');
  const exercise = computed(() => mode.value === 'workspace' ? null : exercises[mode.value]);
  const role = ref<Profile['role']>('child');
  const view = ref<Profile['role'] | 'overview'>('overview');
  const busy = ref(true);
  const initializing = ref(false);
  const failure = ref('');
  const renderFailure = ref('');
  const assetStates = ref<Record<string, AssetLoadState>>({});
  const renderAssets = shallowRef<AssetRenderDTO[]>([]);
  const stage = ref('正在加载客厅');
  const selected = ref<string | null>(null);
  const placement = shallowRef<PlacementIssue[]>([]);
  const layout = shallowRef<Scene | null>(null);
  const accepted = shallowRef<Assessment | null>(null);
  const comparison = shallowRef<ComparisonPresentation | null>(null);
  const progress = shallowRef<ReturnType<ChallengeController['renderProgress']> | null>(null);
  const workspaceUndo = ref(false);
  const workspaceRedo = ref(false);
  const challengeUndo = ref(0);

  let template: Scene | null = null;
  let mainTemplate: Scene | null = null;
  let workspace: WorkspaceController | null = null;
  let evaluation: EvaluationController | null = null;
  let challenge: ChallengeController | null = null;
  let runtime: SceneRuntime | null = null;
  let transforms: TransformController | null = null;
  let workspaceComparison: ComparisonPresentation | null = null;
  let revision = 0;
  let disposed = false;
  let startup: AbortController | null = null;

  const base = new URL(import.meta.env.BASE_URL, window.location.href).href;
  const current = computed(() => !busy.value && !failure.value && layout.value && accepted.value
    ? new FindingsPresenter(layout.value, accepted.value) : null);
  const checks = computed(() => current.value?.forRole(role.value) ?? null);
  const roleSummaries = computed(() => current.value?.roleSummaries() ?? []);
  const report = computed(() => current.value && layout.value && accepted.value
    ? ReportBuilder.buildViewModel(layout.value, accepted.value, comparison.value ?? undefined) : null);
  const selectedObject = computed(() => layout.value?.objects.find(object => object.id === selected.value));
  const modelCounts = computed(() => {
    const states = Object.values(assetStates.value);
    return {
      loaded: states.filter(state => state === 'loaded').length,
      loading: states.filter(state => state === 'loading').length,
      failed: states.filter(state => state === 'error').length,
      placeholders: states.filter(state => state === 'placeholder' || state === 'error').length,
    };
  });
  const selectedModel = computed(() => {
    const object = selectedObject.value;
    if (!object) return '';
    const state = assetStates.value[object.id];
    if (state === 'loading') return '模型加载中，当前显示占位模型';
    if (state === 'error') return '模型加载失败，当前使用占位模型';
    if (state !== 'loaded') return '程序占位模型';
    const asset = renderAssets.value.find(item => item.asset_id === object.asset_id);
    const source = asset?.provenance_summary;
    return source === 'lux3d_web' || source === 'lux3d_api' ? 'Lux3D 模型已加载' : '程序生成模型已加载';
  });
  const feedback = computed(() => placementFeedback(placement.value));
  const canUndo = computed(() => !busy.value && !failure.value &&
    (mode.value !== 'workspace' ? challengeUndo.value > 0 : workspaceUndo.value));
  const canRedo = computed(() => !busy.value && !failure.value && mode.value === 'workspace' && workspaceRedo.value);
  const objectName = (id: string) => names[id] ?? id;
  const movable = (id: string) => exercise.value ? id === exercise.value.object : workspaceObjects.includes(id);
  const canMove = (id: string) => !busy.value && !failure.value && movable(id);

  function publish(scene: Scene, assessment: Assessment | null, delta: ComparisonPresentation | null) {
    if (disposed) return;
    layout.value = scene;
    accepted.value = assessment;
    comparison.value = delta;
    runtime?.setSnapshot(scene);
  }

  function presentDelta(scene: Scene, assessment: Assessment, previous: Assessment | null, delta: Comparison | null) {
    return previous && delta ? new FindingsPresenter(scene, assessment).comparison(previous, delta) : null;
  }

  function publishWorkspace() {
    if (!workspace) return;
    workspaceUndo.value = workspace.canUndo;
    workspaceRedo.value = workspace.canRedo;
    publish(workspace.snapshot, workspace.assessment, workspaceComparison);
  }

  function publishChallenge(result: ChallengeResult, previous: Assessment | null) {
    publish(result.scene, result.assessment, presentDelta(result.scene, result.assessment, previous, result.comparison));
    progress.value = challenge?.renderProgress(result) ?? null;
  }

  function select(id: string | null) {
    selected.value = id;
    runtime?.setSelected(id);
  }

  function useView(next: Profile['role'] | 'overview') {
    transforms?.cancelDrag();
    view.value = next;
    if (next !== 'overview') role.value = next;
    runtime?.setRoleView(next);
  }

  async function run(task: () => Promise<void>): Promise<PlacementIssue[]> {
    if (busy.value || disposed) return [];
    busy.value = true;
    stage.value = '正在校验布局并重算双角色检查';
    placement.value = [];
    runtime?.showPlacementIssues([]);
    try {
      await task();
      return [];
    } catch (error) {
      if (disposed) return [];
      const issues = placementIssues(error);
      placement.value = issues;
      if (issues.length) runtime?.showPlacementIssues(issues);
      else failure.value = error instanceof Error ? error.message : String(error);
      return issues;
    } finally {
      stage.value = '规则已就绪';
      busy.value = false;
    }
  }

  async function updateWorkspace(change: LayoutChange | null) {
    if (!change || !workspace || !evaluation) return;
    const assessment = workspace.assessment;
    const scene = change.scene;
    const previous = assessment ? { scene: workspace.snapshot, assessment } : undefined;
    const result = await evaluation.evaluateDraft(scene, ++revision, previous);
    if (disposed) return;
    if (!result || !workspace.accept(change, result.assessment)) throw new Error('未取得当前布局的评估结果。');
    workspaceComparison = presentDelta(scene, result.assessment, assessment, result.comparison);
    publishWorkspace();
  }

  async function startChallenge() {
    const scene = mode.value === 'main-challenge' ? mainTemplate : template;
    if (!scene || !challenge || !exercise.value) return;
    const object_id = exercise.value.object;
    const result = await challenge.start(scene, [object_id], [
      { rule_id: 'R001', profile_id: 'child', object_id },
      { rule_id: 'R005', profile_id: 'elder', object_id },
    ], ++revision);
    if (disposed) return;
    if (!result) throw new Error('未取得当前挑战状态。');
    challengeUndo.value = 0;
    publishChallenge(result, null);
  }

  async function commit(id: string, transform: TransformInput) {
    if (!canMove(id)) throw new Error('当前不能移动这件家具。');
    const issues = await run(async () => {
      if (mode.value === 'workspace') {
        await updateWorkspace(workspace?.proposal(id, transform) ?? null);
      } else if (challenge) {
        const previous = accepted.value;
        let result: ChallengeResult | null;
        try {
          result = await challenge.applyMove(id, transform, ++revision);
        } catch (error) {
          if (placementIssues(error).length) {
            // Python records the rejected attempt even though the layout stays put.
            // Fetch the authoritative count instead of deriving it in the UI.
            const state = await challenge.state(++revision);
            if (!state) throw new Error('未取得非法尝试后的挑战状态。');
            publishChallenge(state, previous);
          }
          throw error;
        }
        if (disposed) return;
        if (!result) throw new Error('未取得当前挑战移动结果。');
        if (result.scene.revision !== layout.value?.revision) challengeUndo.value++;
        publishChallenge(result, previous);
      }
    });
    // The transform controller restores the committed pose after any rejected evaluation.
    if (failure.value) throw new Error(failure.value);
    return issues;
  }

  function moveBy(x: number, z: number) {
    const object = selectedObject.value;
    if (!object || !canMove(object.id)) return;
    const position = { ...object.position, x: object.position.x + x, z: object.position.z + z };
    const transform = { position, yaw_rad: object.yaw_rad };
    if (transforms) void transforms.commitTransform(object.id, transform);
    else void commit(object.id, transform).catch(() => {});
  }

  function rotate() {
    const object = selectedObject.value;
    if (!object || !canMove(object.id)) return;
    if (transforms) void transforms.rotate(object.id, Math.PI / 4);
    else {
      const yaw_rad = (object.yaw_rad + Math.PI / 4 + Math.PI) % (2 * Math.PI) - Math.PI;
      void commit(object.id, { position: object.position, yaw_rad }).catch(() => {});
    }
  }

  function history(action: 'undo' | 'redo' | 'reset') {
    if (failure.value) return;
    transforms?.cancelDrag();
    void run(async () => {
      if (mode.value === 'workspace') {
        await updateWorkspace(workspace?.[action]() ?? null);
      } else if (challenge && action !== 'redo') {
        const previous = accepted.value;
        const result = await challenge[action](++revision);
        if (disposed) return;
        if (!result) throw new Error('未取得当前挑战历史结果。');
        challengeUndo.value = action === 'reset' ? 0 : Math.max(0, challengeUndo.value - 1);
        publishChallenge(result, action === 'reset' ? null : previous);
      }
    });
  }

  function switchMode(next: typeof mode.value) {
    if (busy.value || failure.value || next === mode.value) return;
    transforms?.cancelDrag();
    void run(async () => {
      mode.value = next;
      if (next !== 'workspace') await startChallenge();
      else publishWorkspace();
      select(null);
    });
  }

  async function initialize(retry: boolean) {
    if (disposed) return;
    startup?.abort(new Error('已取消旧加载'));
    const attempt = new AbortController();
    startup = attempt;
    const active = () => !disposed && startup === attempt && !attempt.signal.aborted;
    initializing.value = true;
    busy.value = true;
    failure.value = '';
    placement.value = [];
    runtime?.showPlacementIssues([]);
    try {
      if (!template) {
        const [scene, assets, mainScene] = await Promise.all([
          readJsonResource<Scene>(new URL('engine/scene-before.json', base), { signal: attempt.signal }),
          readJsonResource<AssetRenderDTO[]>(new URL('engine/assets.json', base), { signal: attempt.signal }),
          readJsonResource<Scene>(new URL('engine/scene-main-challenge.json', base), { signal: attempt.signal }),
        ]);
        if (!active()) return;
        template = scene;
        mainTemplate = mainScene;
        renderAssets.value = assets;
        workspace = new WorkspaceController(scene);
        if (host.value) {
          try {
            runtime = new SceneRuntime(host.value, assets, (id, state) => {
              if (disposed) return;
              if (state === null) delete assetStates.value[id];
              else assetStates.value[id] = state;
            });
            transforms = new TransformController(runtime, { canMove, select, commit });
          } catch (error) {
            renderFailure.value = error instanceof Error ? error.message : String(error);
          }
        }
        publishWorkspace();
        runtime?.setRoleView(view.value);
      }
      stage.value = '正在加载同源 Pyodide、依赖和规则';
      const config = await readJsonResource<WorkerConfig>(new URL('engine/config.json', base), { cache: 'no-store', signal: attempt.signal });
      if (!active()) return;
      if (!evaluation) {
        evaluation = new EvaluationController({ config, base });
        challenge = new ChallengeController(evaluation);
      }
      const metadata = await (retry ? evaluation.restart(config) : evaluation.ensureReady());
      if (!active()) return;
      if (!metadata) throw new Error('规则 Worker 未就绪。');
      if (mode.value !== 'workspace') await startChallenge();
      else if (workspace) {
        const result = await evaluation.evaluateDraft(workspace.snapshot, ++revision);
        if (!active()) return;
        if (!result || !workspace.setAssessment(result.assessment)) throw new Error('未取得当前布局的评估结果。');
        publishWorkspace();
      }
      stage.value = '规则已就绪';
    } catch (error) {
      if (active()) failure.value = error instanceof Error ? error.message : String(error);
    } finally {
      if (active()) {
        busy.value = false;
        initializing.value = false;
        startup = null;
        attempt.abort();
      }
    }
  }

  function cancelLoading() {
    if (!initializing.value) return;
    startup?.abort(new Error('已取消加载'));
    startup = null;
    evaluation?.dispose();
    evaluation = null;
    challenge = null;
    initializing.value = false;
    busy.value = false;
    failure.value = '已取消加载。重试将重新加载规则，不重放之前的操作。';
  }

  function focus(ids: readonly string[]) {
    transforms?.cancelDrag();
    runtime?.focusObjects(ids);
  }

  function exportReport() {
    const currentReport = report.value;
    if (!currentReport) return;
    const blob = new Blob([ReportBuilder.exportJson(currentReport)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ReportBuilder.fileName(currentReport);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  watch(checks, result => {
    runtime?.setFindings(result?.findings
      .filter(finding => finding.status === 'triggered')
      .flatMap(finding => finding.object_ids) ?? []);
  });
  onMounted(() => void initialize(false));
  onUnmounted(() => {
    disposed = true;
    startup?.abort(new Error('页面已关闭'));
    transforms?.dispose();
    runtime?.dispose();
    evaluation?.dispose();
  });

  return {
    host, mode, exercise, role, view, busy, failure, renderFailure, modelCounts, selectedModel, stage, selected, selectedObject,
    layout, checks, comparison, progress, feedback, report, canUndo, canRedo,
    objectName, movable, canMove, select, useView, moveBy, rotate, history, switchMode, focus,
    roleSummaries, initializing, cancelLoading,
    retryModels: () => {
      transforms?.cancelDrag();
      if (layout.value) runtime?.retryFailedAssets(layout.value);
    },
    retry: () => void initialize(true),
    exportReport,
    printReport: () => { if (report.value) ReportBuilder.print(); },
  };
}
