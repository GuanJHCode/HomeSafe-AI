// Pure Pyodide core-closure test, with no project source mounted into its FS.
// node scripts/check_runtime_bundle.mjs RUNTIME_DIR BUNDLE_ZIP MANIFEST_JSON runtime-only|baseline OUTPUT_JSON
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [runtime, bundle, manifestFile, mode, output] = process.argv.slice(2);
if (!runtime || !bundle || !manifestFile || !['runtime-only', 'baseline'].includes(mode) || !output) {
  throw new Error('Pass RUNTIME_DIR BUNDLE_ZIP MANIFEST_JSON runtime-only|baseline OUTPUT_JSON');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = new Uint8Array(await readFile(resolve(bundle)));
const manifest = JSON.parse(await readFile(resolve(manifestFile), 'utf8'));
const evidence = JSON.parse(await readFile(resolve(root, 'evidence/model-split-baseline-64e1665.json'), 'utf8'));
const source = await readFile(resolve(root, 'scripts/runtime_bundle_commands.py'), 'utf8');
assert.equal(sha(bytes), manifest.bundle_sha256, 'Exact input ZIP hash must match its manifest');
const expectedFiles = ['__init__.py', 'models.py', 'geometry.py', 'validation.py', 'rule_support.py',
  'policy.py', 'rules.py', 'engine.py', 'challenge.py', 'observations.py', 'browser_bridge.py'].sort();
assert.deepEqual(manifest.files.map(item => item.path).sort(), expectedFiles);
const load = performance.now();
const { loadPyodide } = await import(pathToFileURL(resolve(runtime, 'pyodide.mjs')).href);
const py = await loadPyodide({ indexURL: `${resolve(runtime)}/`, packages: ['pydantic'] });
assert.equal(py.version, '314.0.6');
await py.loadPackage('pydantic');
assert.equal(py.runPython('import pydantic; pydantic.__version__'), '2.12.5');
const readyMs = performance.now() - load;
const importRoot = '/homesafe_bundle_probe';
assert.equal(py.FS.analyzePath(importRoot).exists, false, 'Fresh FS extraction directory required');
py.FS.mkdirTree(importRoot);
py.unpackArchive(bytes, 'zip', { extractDir: importRoot });
const moduleRoot = `${importRoot}/homesafe_core`;
assert.deepEqual(py.FS.readdir(importRoot).filter(name => name !== '.' && name !== '..'), ['homesafe_core']);
assert.deepEqual(py.FS.readdir(moduleRoot).filter(name => name !== '.' && name !== '..').sort(), expectedFiles);
for (const entry of manifest.files) {
  assert.equal(sha(py.FS.readFile(`${moduleRoot}/${entry.path}`)), entry.sha256, `Unpacked source bytes: ${entry.path}`);
}
const samples = {}, expected = {};
for (const name of ['before', 'conflict', 'improved']) {
  samples[name] = JSON.parse(await readFile(resolve(root, `examples/scene-${name}.json`), 'utf8'));
  expected[name] = JSON.parse(await readFile(resolve(root, `examples/assessment-${name}.json`), 'utf8'));
}
py.globals.set('__homesafe_probe_input', JSON.stringify({ import_root: importRoot, samples, expected,
  expected_classes: mode === 'runtime-only' ? evidence.partition['models.py'] : Object.keys(evidence.class_ast_sha256) }));
let result;
try {
  result = JSON.parse(py.runPython(`${source}\nimport json\njson.dumps(verify_runtime_bundle(json.loads(__homesafe_probe_input)))`));
} finally {
  py.globals.delete('__homesafe_probe_input');
}
const report = {
  scope: 'REAL_PYODIDE_ZIP_ONLY_CLOSURE_NOT_BROWSER_OR_PERFORMANCE_ADOPTION', mode,
  bundle_sha256: sha(bytes), manifest_sha256: sha(await readFile(resolve(manifestFile))),
  harness_sha256: sha(Buffer.from(source)), pyodide: py.version, pydantic: '2.12.5',
  runtime_ready_ms: readyMs, ...result,
};
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
