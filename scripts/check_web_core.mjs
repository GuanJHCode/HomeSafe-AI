// Compatibility check for real WASM and app controllers. No browser, Worker, or renderer.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const load = (path) => import(new URL(path, root).href);
const sample = async (name) => JSON.parse(await readFile(new URL(`examples/scene-${name}.json`, root), 'utf8'));
const [before, conflict, improved] = await Promise.all(['before', 'conflict', 'improved'].map(sample));
const { loadPyodide } = await load('browser-spike/vendor/pyodide/pyodide.mjs');
const py = await loadPyodide({ indexURL: fileURLToPath(new URL('browser-spike/vendor/pyodide/', root)) });
await py.loadPackage('pydantic');
py.FS.mkdirTree('/homesafe');
py.unpackArchive(new Uint8Array(await readFile(new URL('browser-spike/python/homesafe_core.zip', root))), 'zip', { extractDir: '/homesafe' });
py.runPython("import sys; sys.path.insert(0, '/homesafe')\nfrom homesafe_core.browser_bridge import dispatch_json");
const dispatch = py.globals.get('dispatch_json');
const { EvaluationController } = await load('apps/web/src/domain/EvaluationController.ts');
const { ChallengeController } = await load('apps/web/src/domain/ChallengeController.ts');
const { WorkspaceController } = await load('apps/web/src/domain/WorkspaceController.ts');
const { FindingsPresenter } = await load('apps/web/src/domain/FindingsPresenter.ts');
const { ReportBuilder } = await load('apps/web/src/domain/ReportBuilder.ts');

const e = new EvaluationController({
  config: {}, base: 'https://preview.invalid/',
  createClient: () => ({
    async initialize() { return { result: { pyodide: py.version } }; },
    async request(op, payload, clientRevision) {
      const response = JSON.parse(dispatch(JSON.stringify({ op, payload })));
      if (!response.ok) throw Object.assign(new Error(response.error.message), { details: response.error });
      return { ...response, clientRevision };
    },
    dispose() {},
  }),
});
const workspace = new WorkspaceController(before);
let revision = 1;
const initial = await e.evaluateDraft(before, revision);
assert.ok(workspace.setAssessment(initial.assessment));
const chairPose = scene => {
  const {position, yaw_rad} = scene.objects.find(({id}) => id === 'chair');
  return {position, yaw_rad};
};
async function apply(change) {
  const prior = workspace.assessment;
  const result = await e.evaluateDraft(change.scene, ++revision, { scene: workspace.snapshot, assessment: prior });
  assert.ok(workspace.accept(change, result.assessment));
  return new FindingsPresenter(workspace.snapshot, workspace.assessment).comparison(prior, result.comparison);
}
const delta = await apply(workspace.proposal('chair', chairPose(conflict)));
assert.equal(delta.conflict, true);
assert.ok(workspace.canUndo);
const invalid = workspace.proposal('chair', { position: { x: 0.5, y: 0, z: 3.3 }, yaw_rad: 0 });
await assert.rejects(e.evaluateDraft(invalid.scene, ++revision), error => error.details.code === 'INVALID_PLACEMENT');
assert.deepEqual(chairPose(workspace.snapshot), chairPose(conflict));
await apply(workspace.undo());
assert.deepEqual(chairPose(workspace.snapshot), chairPose(before));
await apply(workspace.redo());
assert.deepEqual(chairPose(workspace.snapshot), chairPose(conflict));
await apply(workspace.reset());
assert.deepEqual(chairPose(workspace.snapshot), chairPose(before));
const c = new ChallengeController(e);
await c.start(before, ['chair'], [
  { rule_id: 'R001', profile_id: 'child', object_id: 'chair' },
  { rule_id: 'R005', profile_id: 'elder', object_id: 'chair' },
], ++revision);
await c.applyMove('chair', chairPose(conflict), ++revision);
const result = await c.applyMove('chair', chairPose(improved), ++revision);
assert.equal(result.challenge.status, 'goal_met');
const report = JSON.parse(ReportBuilder.exportJson(ReportBuilder.buildViewModel(result.scene, result.assessment)));
assert.equal(report.input_hash, result.assessment.input_hash);
assert.equal(report.actions.onSite.length, result.challenge.remaining_triggered);
assert.equal(report.actions.information.length, result.challenge.remaining_needs_review);
assert.equal(report.unsupportedDomains.length, c.renderProgress(result).uncovered);
assert.deepEqual(chairPose((await c.undo(++revision)).scene), chairPose(conflict));
assert.deepEqual(chairPose((await c.reset(++revision)).scene), chairPose(before));
console.log(JSON.stringify({
  scope: 'NODE_WASM_CONTROLLER_INTEGRATION_NOT_BROWSER', result: 'PASS',
  pyodide: py.version, pydantic: py.runPython('import pydantic; pydantic.__version__'),
  conflict: delta.conflict, goal: result.challenge.status,
  remaining_triggered: report.actions.onSite.length, remaining_needs_review: report.actions.information.length,
  unsupported_domains: report.unsupportedDomains.length,
}, null, 2));
e.dispose();
dispatch.destroy();
