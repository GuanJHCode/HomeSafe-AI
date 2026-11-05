import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { createStartupTrace, type StartupTraceHandle, type TraceSnapshot } from '../../../browser-spike/startup-trace.mjs';
import type {
  Assessment, AssetRenderDTO, ChallengeResult, Comparison, ObservationEdit, ObservationOption, PlacementIssue, Profile, Scene, TransformInput,
} from '../../../contracts/frontend/domain.ts';
import { ChallengeController } from './domain/ChallengeController.ts';
import { ObservationController } from './domain/ObservationController.ts';
import { EvaluationController, type WorkerConfig } from './domain/EvaluationController.ts';
import { FindingsPresenter, type ComparisonPresentation } from './domain/FindingsPresenter.ts';
import { ReportBuilder } from './domain/ReportBuilder.ts';
import { SceneSnapshotBuilder } from './domain/SceneSnapshotBuilder.ts';
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
  const drafting = ref(false);
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
  const observationOptions = shallowRef<ObservationOption[]>([]);
  const observationsOpen = ref(false);
  const observationNotice = ref('');

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
  let startupGeneration = 0;
  let startupTrace: StartupTraceHandle | null = null;

  function publishStartupTrace(trace: StartupTraceHandle, workerTrace?: TraceSnapshot) {
    try {
      window.dispatchEvent(new CustomEvent('homesafe-startup-trace', {
        detail: { window_trace: trace.snapshot(), ...(workerTrace ? { worker_trace: workerTrace } : {}) },
      }));
    } catch { /* Passive diagnostics never alter scene or Worker lifecycle. */ }
  }

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
    transforms?.cancelDrag();
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
    return run(async () => {
      observationsOpen.value = false;
      mode.value = next;
      if (next !== 'workspace') await startChallenge();
      else {
        const ended = await evaluation?.runCurrent(++revision, request => request('challenge_end', {}));
        if (!ended) throw new Error('未能结束挑战会话，请重试。');
        publishWorkspace();
      }
      select(null);
    });
  }

  async function openObservations() {
    if (busy.value || failure.value) return;
    transforms?.cancelDrag();
    if (mode.value !== 'workspace') await switchMode('workspace');
    if (failure.value || mode.value !== 'workspace') return;
    await run(async () => {
      if (!workspace || !evaluation) return;
      const options = await new ObservationController(evaluation).options(workspace.snapshot, ++revision);
      if (disposed) return;
      if (!options) throw new Error('未取得当前布局的可补充资料。');
      observationOptions.value = options;
      observationsOpen.value = true;
    });
  }

  async function applyObservation(edit: ObservationEdit) {
    if (mode.value !== 'workspace' || busy.value || failure.value) return;
    transforms?.cancelDrag();
    await run(async () => {
      if (!workspace?.assessment || !evaluation) return;
      const previous = workspace.assessment;
      const result = await new ObservationController(evaluation).apply(workspace.snapshot, previous, edit, ++revision);
      if (disposed) return;
      if (!result) throw new Error('未取得资料更新的评估结果。');
      if (result.scene.revision === workspace.snapshot.revision) return;
      const replacement = new WorkspaceController(result.scene);
      if (!replacement.setAssessment(result.assessment)) throw new Error('资料基线与评估版本不匹配。');
      workspace = replacement;
      workspaceComparison = presentDelta(result.scene, result.assessment, previous, result.comparison);
      observationNotice.value = '已建立新的资料基线，旧布局撤销/重做记录已清空。后续重置保留这些资料；本次不是空间整改，也不计挑战胜利。';
      publishWorkspace();
      observationOptions.value = observationOptions.value.map(option => ({ ...option,
        observation: result.scene.objects.find(object => object.id === option.object_id)!.properties[option.field]!,
      }));
    });
  }

  function mountRenderer() {
    if (disposed || !host.value) return;
    const endRender = startupTrace?.status === 'running' ? startupTrace.start('renderer_create') : null;
    let rendered = false;
    transforms?.dispose();
    transforms = null;
    runtime?.dispose();
    runtime = null;
    renderFailure.value = '';
    assetStates.value = {};
    try {
      const mounted = new SceneRuntime(host.value, renderAssets.value, (id, state) => {
        if (disposed) return;
        if (state === null) delete assetStates.value[id];
        else assetStates.value[id] = state;
      }, message => {
        if (disposed) return;
        renderFailure.value = message;
        transforms?.dispose();
        transforms = null;
      });
      runtime = mounted;
      transforms = new TransformController(mounted, { canMove, select, commit,
        onDraftChange: active => { drafting.value = active; } });
      if (layout.value) mounted.setSnapshot(layout.value);
      mounted.setRoleView(view.value);
      mounted.setSelected(selected.value);
      mounted.setFindings(checks.value?.findings.filter(finding => finding.status === 'triggered')
        .flatMap(finding => finding.object_ids) ?? []);
      mounted.showPlacementIssues(placement.value);
      rendered = true;
    } catch (error) {
      transforms?.dispose();
      transforms = null;
      runtime?.dispose();
      runtime = null;
      assetStates.value = {};
      renderFailure.value = error instanceof Error ? error.message : String(error);
    } finally {
      endRender?.(rendered ? 'ok' : 'failed');
    }
  }

  async function initialize(retry: boolean) {
    if (disposed) return;
    if (startupTrace?.status === 'running') {
      startupTrace.finish('cancelled');
      publishStartupTrace(startupTrace);
    }
    const trace = createStartupTrace({ thread: 'window', generation: ++startupGeneration });
    startupTrace = trace;
    trace.mark('attempt_started');
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
      stage.value = '正在加载场景和同源规则';
      // Observe both promises immediately: scene/network errors cannot leave an
      // unhandled rule startup, and cancellation prevents late controller creation.
      const loadRules = async () => {
        const config = await trace.measure('config_fetch', () => readJsonResource<WorkerConfig>(new URL('engine/config.json', base), { cache: 'no-store', signal: attempt.signal }));
        if (!active()) return null;
        if (!evaluation) {
          evaluation = new EvaluationController({ config, base, trace,
            onStartupTrace: snapshot => {
              if (startupTrace?.generation === snapshot.generation) publishStartupTrace(startupTrace, snapshot);
            },
          });
          challenge = new ChallengeController(evaluation);
        }
        return retry ? evaluation.restart(config, trace) : evaluation.ensureReady();
      };
      const loadScene = async () => {
        if (!template) {
          const [scene, assets, mainScene] = await trace.measure('scene_fetch', () => Promise.all([
            readJsonResource<Scene>(new URL('engine/scene-before.json', base), { signal: attempt.signal }),
            readJsonResource<AssetRenderDTO[]>(new URL('engine/assets.json', base), { signal: attempt.signal }),
            readJsonResource<Scene>(new URL('engine/scene-main-challenge.json', base), { signal: attempt.signal }),
          ]));
          if (!active()) return;
          template = scene;
          mainTemplate = mainScene;
          renderAssets.value = assets;
          workspace = new WorkspaceController(scene);
          publishWorkspace();
          mountRenderer();
        } else {
          trace.mark('scene_reused');
          if (runtime && !renderFailure.value) trace.mark('renderer_reused');
        }
      };
      const [metadata] = await Promise.all([loadRules(), loadScene()]);
      if (!active()) return;
      if (!metadata || !evaluation) throw new Error('规则 Worker 未就绪。');
      if (mode.value !== 'workspace') await startChallenge();
      else if (workspace) {
        const result = await evaluation.evaluateDraft(workspace.snapshot, ++revision);
        if (!active()) return;
        if (!result || !workspace.setAssessment(result.assessment)) throw new Error('未取得当前布局的评估结果。');
        publishWorkspace();
      }
      if (accepted.value) trace.identify({ input_hash: accepted.value.input_hash, ruleset_version: accepted.value.ruleset_version });
      trace.mark('first_evaluation_accepted');
      stage.value = '规则已就绪';
    } catch (error) {
      if (active()) {
        // A scene fetch can fail while parallel rule startup is still running.
        // Stop that worker too; explicit retry creates a fresh controller.
        evaluation?.dispose();
        evaluation = null;
        challenge = null;
        failure.value = error instanceof Error ? error.message : String(error);
        trace.finish('failed');
        publishStartupTrace(trace);
      }
    } finally {
      if (active()) {
        busy.value = false;
        initializing.value = false;
        startup = null;
        attempt.abort();
        if (!failure.value) {
          trace.finish('ready');
          publishStartupTrace(trace);
          // Diagnostic only: no extra await or change to edit enabling/acceptance.
          void nextTick(() => {
            if (disposed || startupTrace !== trace || busy.value || failure.value) return;
            if (runtime && !renderFailure.value && report.value && canMove('chair')) trace.mark('edit_eligible');
            publishStartupTrace(trace);
          });
        }
      }
    }
  }

  function cancelLoading() {
    if (!initializing.value) return;
    startupTrace?.finish('cancelled');
    if (startupTrace) publishStartupTrace(startupTrace);
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
    if (drafting.value || busy.value || failure.value) return;
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

  function exportSceneSnapshot() {
    // Use the same current-result gate as the action list; never export a draft
    // while evaluation or recovery is pending.
    if (drafting.value || busy.value || failure.value || !report.value || !layout.value || !accepted.value) return;
    const snapshot = SceneSnapshotBuilder.build(layout.value, accepted.value);
    const blob = new Blob([SceneSnapshotBuilder.exportJson(snapshot)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = SceneSnapshotBuilder.fileName(snapshot);
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
    if (startupTrace?.status === 'running') startupTrace.finish('cancelled');
    startup?.abort(new Error('页面已关闭'));
    transforms?.dispose();
    runtime?.dispose();
    evaluation?.dispose();
  });

  return {
    observationOptions, observationsOpen, observationNotice, openObservations, applyObservation,
    closeObservations: () => { observationsOpen.value = false; },
    host, mode, exercise, role, view, busy, drafting, failure, renderFailure, modelCounts, selectedModel, stage, selected, selectedObject,
    layout, checks, comparison, progress, feedback, report, canUndo, canRedo,
    objectName, movable, canMove, select, useView, moveBy, rotate, history, switchMode, focus,
    roleSummaries, initializing, cancelLoading,
    retryModels: () => {
      transforms?.cancelDrag();
      if (layout.value) runtime?.retryFailedAssets(layout.value);
    },
    retry: () => void initialize(true),
    retryRenderer: mountRenderer,
    exportReport, exportSceneSnapshot,
    printReport: () => { if (!drafting.value && !busy.value && !failure.value && report.value) ReportBuilder.print(); },
  };
}
