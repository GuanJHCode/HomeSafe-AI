// Reproducible, private localhost development report and genuine browser recording.
// The full 3–4 minute mode is for a frozen app source; trial mode proves the workflow.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createJsonDownloadHarness, REPORT_FILENAME, SNAPSHOT_FILENAME } from './web_download.mjs';
import { privateOutputPath } from './private_asset_inputs.mjs';
import { renderDevelopmentReport } from './development_materials_report.mjs';
import { loadPrivateMaterialInputs, attachPrivateMaterialInputs } from './private_materials_inputs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: Object.fromEntries(
  ['url', 'chrome', 'driver', 'python', 'output', 'expected-head', 'mode', 'private-models', 'source-bundle'].map(name => [name, { type: 'string' }])) });
for (const name of ['url', 'chrome', 'driver', 'python', 'output', 'expected-head', 'mode']) {
  if (!values[name]) throw new Error(`Required: --${name}`);
}
assert.ok(['trial', 'full'].includes(values.mode), '--mode must be trial or full');
const url = new URL(values.url);
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
  && url.pathname.endsWith('/preview/'), 'Development materials require the local /preview/ app');
const output = await privateOutputPath(root, values.output);
assert.ok(output.split('/').at(-1).startsWith('development-materials-'),
  'Output directory must be named development-materials-*');
const sourceBefore = await sourceIdentity();
assert.equal(sourceBefore.head, values['expected-head'], 'Source HEAD changed before capture');
assert.equal(sourceBefore.app_matches_head, true, 'Capture requires unchanged App/Core');
const privateInputs = values['private-models'] ? await loadPrivateMaterialInputs(values['private-models']) : null;
if (privateInputs) assert.equal(sourceBefore.app_matches_authorized_source, true, 'Private capture must match the explicitly selected --expected-head App/Core');
const distCatalog = JSON.parse(await readFile(resolve(root, 'apps/web/dist/engine/assets.json'), 'utf8'));
assert.deepEqual(distCatalog, [], 'This recording must use the public placeholder-only preview');
const publicCatalog = JSON.parse(await readFile(resolve(root, 'assets/asset-manifest.json'), 'utf8'));
assert.deepEqual(publicCatalog.assets, [], 'Public asset manifest must remain empty');
const previewManifest = JSON.parse(await readFile(resolve(root, 'apps/web/dist/preview-manifest.json'), 'utf8'));
assert.equal(previewManifest.reviewed_assets, 0);
assert.equal(previewManifest.lux3d_assets_declared, 0);
await mkdir(output, { recursive: true });
if (privateInputs) {
  assert.ok(values['source-bundle'], 'Private materials require --source-bundle for reference/task/original evidence');
  const receiptPath = resolve(output, 'source-bundle-receipt.json');
  execFileSync(values.python, [resolve(root, 'scripts/check_lux3d_source_bundle.py'),
    '--source', resolve(values['source-bundle']), '--output', receiptPath], { cwd: root, encoding: 'utf8' });
  const bytes = await readFile(receiptPath), receipt = JSON.parse(bytes);
  for (const model of privateInputs.evidence.models) assert.equal(receipt.models.find(m => m.object_id === model.id)?.original_model.sha256,
    model.original_sha256, 'Source bundle must match actual runtime original');
  privateInputs.evidence.source_bundle_receipt = { checked_delivery_files: receipt.checked_delivery_files,
    sha256: createHash('sha256').update(bytes).digest('hex'), models: receipt.models,
    platform_attestation_verified: false, public_redistribution_approved: false };
}

// Verify that the exact local HTTP resources served to Chromium match the
// reviewed local dist bytes. This is transport evidence, not public deployment.
const transportPath = resolve(output, 'loopback-transport.json');
const transportRun = spawnSync(values.python, [resolve(root, 'scripts/check_deployment.py'),
  '--url', url.href, '--dist', resolve(root, 'apps/web/dist'),
  '--output', transportPath, '--allow-local-http'], { cwd: root, encoding: 'utf8' });
if (transportRun.status !== 0) throw new Error(`Loopback transport failed: ${transportRun.stderr}`);
const transport = JSON.parse(await readFile(transportPath, 'utf8'));
assert.equal(transport.scope, 'LOCAL_HTTP_TRANSPORT_ONLY');
assert.equal(transport.result, 'PASS');

const puppeteer = await import(pathToFileURL(resolve(values.driver)).href);
const browser = await puppeteer.default.launch({ executablePath: resolve(values.chrome), headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ...(process.env.CI ? ['--no-sandbox'] : [])] });
let page, cdp, downloads, recording, privateBinding;
let complete = false;
const scene = { chairBefore: { x: 5.3, z: 3.3 }, conflict: { x: 3, z: 2 },
  improved: { x: 3, z: 0.6 } };
const phases = [];
const seconds = values.mode === 'full'
  ? privateInputs ? [12, 12, 12, 12, 8, 16, 10, 10, 11, 14, 10, 10, 10, 10, 11, 11]
    : [15, 13, 14, 13, 9, 18, 12, 11, 13, 18, 12, 12, 12, 13]
  : [1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1];
// Each reading segment visits several genuine app regions. The video has no
// repeated synthetic stills; the browser scroll and pointer remain visible.
const attention = [
  ['.intro', '.notice', '.scene-panel'],
  ['.views', '.viewport', '.role-summaries'],
  ['.finding-list article:first-child', '.finding-list article:nth-child(2)', '.scope'],
  ['.role-summaries', '.finding-list article:first-child', '.scope'],
  ['.viewport', '.toolbar', '.scene-panel'],
  ['[data-testid="layout-comparison"]', '.role-summaries', '.finding-list'],
  ['.role-summaries', '.finding-list article:first-child', '.scope'],
  ['.role-summaries', '.finding-list article:nth-child(2)', '.scope'],
  ['.challenge', '.viewport', '.finding-list'],
  ['.challenge', '[data-testid="challenge-counts"]', '.scope', '.report'],
  ['.report .hash', '.action-grid', '.report-coverage'],
  ['.report .hash', '.scope', '.report'],
  ['.report-buttons', '.action-grid', '.limits'],
  ['.report', '.notice', '.intro'],
  ['.challenge', '.viewport', '.toolbar'],
  ['.viewport', '.challenge', '.scope'],
];
const recordedAt = new Date().toISOString();
const viewport = { width: 1280, height: 900, deviceScaleFactor: 1 };
let browserVersion;
try {
  page = await browser.newPage();
  if (privateInputs) privateBinding = await attachPrivateMaterialInputs(page, url.href, privateInputs);
  browserVersion = await browser.version();
  await page.setViewport(viewport);
  page.setDefaultTimeout(60_000);
  cdp = await page.createCDPSession();
  downloads = await createJsonDownloadHarness({ browser, cdp, downloadPath: output });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Puppeteer's image2pipe input defaults to 25 fps. Match its duplicated
  // screencast frame rate so the video duration follows elapsed browser time.
  if (!privateInputs) recording = await page.screencast({ path: resolve(output, 'browser-original.webm'), fps: 25 });
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'Local app did not respond');
  await ready();
  await page.waitForSelector('canvas[aria-label="样例客厅三维场景"]', { visible: true });
  await assertModels();
  if (privateInputs) {
    await page.screenshot({ path: resolve(output, 'real-models-before.png'), fullPage: true });
    await writeFile(resolve(output, 'private-model-inputs.json'), JSON.stringify(privateInputs.evidence, null, 2) + '\n');
    recording = await page.screencast({ path: resolve(output, 'browser-original.webm'), fps: 25,
      ffmpegPath: resolve(root, 'scripts/capture_ffmpeg_fast.py') });
  }
  await installAnnotation();
  await phase(0, privateInputs ? '录屏注释｜两件真实 Lux3D 法线修复派生件；私下教学拟合，非公开授权（非产品控件）'
    : '录屏注释｜本地开发预览：仅程序占位；本片未使用真实 Lux3D（非产品控件）', '.intro');

  await page.click('[data-testid="start-risk-case"]'); await ready();

  await click('儿童视角');
  await phase(1, '录屏注释｜儿童观察视角；相机高度仅用于示意', '.views');
  await page.click('.finding-list article:first-child .finding-title');
  await page.click('.finding-list article:first-child summary');
  await phase(2, '录屏注释｜点击检查卡，查看对象与依据', '.finding-list');

  await click('老人视角');
  await phase(3, '录屏注释｜老人观察视角；两类检查使用同一布局', '.role-summaries');
  await click('俯看客厅');
  await phase(4, '录屏注释｜准备移动椅子；当前为合成场景', '.viewport');
  await dragChair(scene.chairBefore, scene.conflict);
  await ready();
  assert.match(await text('[data-testid="layout-comparison"]'), /双角色取舍/);
  const conflictHash = await currentHash();
  await phase(5, '录屏注释｜一次合法移动带来儿童与老人条件取舍', '[data-testid="layout-comparison"]');

  await page.click('.role-summaries button:first-child');
  await phase(6, '录屏注释｜切换检查焦点，核对儿童结果', '.role-summaries');
  await page.click('.role-summaries button:nth-child(2)');
  await phase(7, '录屏注释｜同一布局中的老人结果仍保留', '.finding-list');
  await click('撤销');
  await ready();
  assert.notEqual(await currentHash(), conflictHash);
  await click('窗边挑战');
  await ready();
  await phase(8, '录屏注释｜撤销后重新摆位，进入窗边挑战', '.challenge');
  await dragChair(scene.chairBefore, scene.improved);
  await ready();
  let challengeSummary = await text('[data-testid="challenge-summary"]');
  assert.match(challengeSummary, /本关布局目标已完成/);
  await phase(9, '录屏注释｜本关达标；仍须看已触发、待核查与未覆盖项', '.challenge');

  if (privateInputs) {
    await click('柜体主挑战'); await ready(); await assertModels();
    await page.select('.toolbar select', 'cabinet');
    await phase(14, '录屏注释｜柜体主挑战：真实柜体、椅子锁定；规则仍由 Python 计算', '.challenge');
    await dragObject({ x: 5.3, z: 3.3 }, { x: 4.5, z: 3.2 }, 0.8); await ready();
    await click('旋转 45°'); await ready();
    const accepted = await currentHash();
    await dragObject({ x: 4.5, z: 3.2 }, { x: -1, z: 3.2 }, 0.8); await ready();
    assert.equal(await currentHash(), accepted);
    assert.match(await text('[data-testid="placement-rejected"]'), /已恢复最后合法位置/);
    challengeSummary = await text('[data-testid="challenge-summary"]');
    assert.match(challengeSummary, /本关布局目标已完成/);
    await phase(15, '录屏注释｜合法摆位与旋转；越界回弹保留布局，达标后仍有未知', '.viewport');
    await assertModels();
    await page.screenshot({ path: resolve(output, 'real-models-main-challenge.png'), fullPage: true });
  }

  const exportedReport = await downloads.capture({
    click: () => click('导出 JSON'), filenamePattern: REPORT_FILENAME,
  });
  await copyFile(exportedReport.path, resolve(output, 'action-list.json'));
  const report = exportedReport.json;
  assert.equal(report.source_kind, 'synthetic_demo');
  assert.equal(report.input_hash, await currentHash());
  assert.ok(report.findings.some(item => item.status === 'needs_review')
    || report.unsupportedDomains.length, 'Challenge must retain unresolved scope');
  await phase(10, '录屏注释｜实际导出当前行动清单 JSON', '.report');

  const exportedSnapshot = await downloads.capture({
    click: () => click('导出场景快照'), filenamePattern: SNAPSHOT_FILENAME,
  });
  await copyFile(exportedSnapshot.path, resolve(output, 'scene-snapshot.json'));
  const snapshot = exportedSnapshot.json;
  assert.equal(snapshot.source_kind, 'synthetic_demo');
  assert.equal(snapshot.includes_asset_bytes, false);
  assert.equal(snapshot.assessment.scene_revision, report.scene_revision);
  assert.equal(snapshot.assessment.input_hash, report.input_hash);
  assert.equal(snapshot.assessment.ruleset_version, report.ruleset_version);
  assert.equal(snapshot.scene.revision, report.scene_revision);
  if (privateInputs) for (const m of privateInputs.evidence.models) {
    assert.equal(snapshot.scene.objects.find(o => o.id === m.id).asset_id, m.asset_id);
  }
  const verify = JSON.parse(execFileSync(values.python,
    [resolve(root, 'scripts/check_scene_snapshot.py'), resolve(output, 'scene-snapshot.json')],
    { cwd: root, encoding: 'utf8' }));
  assert.equal(verify.result, 'MATCHES_CURRENT_CORE');
  await phase(11, '录屏注释｜实际导出同版场景快照；已独立复算', '.report .hash');

  await click('打印清单');
  await phase(12, '录屏注释｜已点击打印；镜头未显示系统打印预览', '.report-buttons');
  await page.emulateMediaType('print');
  const printable = await page.pdf({ format: 'A4', printBackground: true });
  const printablePath = resolve(output, 'printable-action-list.pdf');
  await writeFile(printablePath, printable);
  const printableText = execFileSync('pdftotext', [printablePath, '-'], { encoding: 'utf8' });
  assert.ok(printableText.includes(report.input_hash), 'Print PDF must bind the current input');
  assert.ok(!printableText.includes('录屏注释'), 'Recording annotation leaked into printed checklist');
  await page.emulateMediaType('screen');
  assert.equal(await currentHash(), report.input_hash);
  await phase(13, privateInputs ? '录屏注释｜两件真实派生模型私下操作；无公网、无公开许可、无音频，非正式提交'
    : '录屏注释｜无公网、无真实模型验收、无音频；本片为开发工作稿', '.report');
  assert.deepEqual(errors, [], 'Browser page errors');

  await recording.stop(); recording = undefined;
  await convertVideo(resolve(output, 'browser-original.webm'), resolve(output, 'development-recording.mp4'));
  const video = await probeVideo(resolve(output, 'development-recording.mp4'));
  if (values.mode === 'full') assert.ok(video.duration_seconds >= 180 && video.duration_seconds <= 240,
    `Full recording must be 180–240 seconds, got ${video.duration_seconds}`);
  else assert.ok(video.duration_seconds > 10 && video.duration_seconds < 90);
  const sourceAfter = await sourceIdentity();
  assert.equal(sourceAfter.app_source_sha256, sourceBefore.app_source_sha256,
    'App/Core source changed during recording');
  assert.equal(sourceAfter.dist_manifest_sha256, sourceBefore.dist_manifest_sha256,
    'Served dist changed during recording');
  assert.equal(sourceAfter.head, sourceBefore.head, 'HEAD changed during recording');
  assert.deepEqual(sourceAfter.capture_tool_sha256, sourceBefore.capture_tool_sha256, 'Capture tools changed');
  if (privateInputs) {
    await privateInputs.verifyUnchanged();
    assert.deepEqual(privateBinding.errors, []);
    assert.deepEqual(privateBinding.blockedExternal, []);
    assert.deepEqual(privateBinding.externalRequests, []);
    assert.deepEqual([...new Set(privateBinding.requests.map(r => r.id))].sort(), ['cabinet', 'chair']);
    assert.equal(new Set(privateBinding.overlays.map(r => r.path)).size, 5, 'All five private overrides must be observed');
    await writeFile(resolve(output, 'private-binding.json'), JSON.stringify(privateBinding, null, 2) + '\n');
  }

  const capture = { created_at: recordedAt, finished_at: new Date().toISOString(),
    mode: values.mode, url: url.href, browser: browserVersion,
    viewport, challenge_summary: challengeSummary, phases,
    recording_started_after_models_ready: Boolean(privateInputs) };
  const checks = { local_transport: 'PASS（本地 HTTP 字节核对；非公网验收）',
    historical_baseline: '继承的 ba21f54 基线记录：Python 334、应用 39、JS 48 项通过；本材料流程未重跑全套测试',
    model_bytes_in_environment: 'NOT_ASSESSED_BY_PLACEHOLDER_CAPTURE',
    model_materialization: '本次占位录屏不执行模型物化；原件可用性与私下验收应查独立记录',
    real_lux3d_browser: 'NOT_RUN_BY_THIS_CAPTURE', rights: 'NOT_ASSESSED_BY_THIS_CAPTURE', public_https: 'NOT_RUN_BY_THIS_CAPTURE',
    performance_3s_goal: 'NOT_RUN_THIS_CAPTURE；本材料流程未重测性能，不从其他版本推定当前达标或未达标' };
  if (privateInputs) Object.assign(checks, {
    historical_baseline: '历史基线6dc418d / CI42323926769：Python343、应用39、JS59及Chrome156通过，首次可编辑p95=2349.8ms，原3秒门槛通过；本次未重跑CI或性能，不推定当前版本结果',
    model_bytes_in_environment: 'TWO_PRIVATE_DERIVATIVES_LOADED_HASH_MATCH',
    model_materialization: '原件与派生件链已核对；本次仅浏览器内存拦截绑定，不写公开目录',
    real_lux3d_browser: 'PASS_CURRENT_PRIVATE_CAPTURE_INTERACTIONS', rights: 'PENDING_NO_PUBLIC_DISTRIBUTION',
    performance_3s_goal: 'NOT_RUN_THIS_CAPTURE；本材料流程未重测性能，已存在的 CI 结果只对其对应提交有效，严格阈值保持',
  });
  const exportEvidence = { report, snapshot,
    report_filename: exportedReport.filename, snapshot_filename: exportedSnapshot.filename,
    snapshot_verification: verify.result, binding_result: 'PASS：版本、输入摘要、规则集与当前页面一致' };
  video.sha256 = await fileHash(resolve(output, 'development-recording.mp4'));
  video.raw_sha256 = await fileHash(resolve(output, 'browser-original.webm'));
  video.raw_last_packet_pts_seconds = lastPacketPts(resolve(output, 'browser-original.webm'));
  const reportHtml = renderDevelopmentReport({ source: sourceBefore, capture,
    exports: exportEvidence, video, checks, privateCapture: privateInputs?.evidence });
  await writeFile(resolve(output, 'development-report.html'), reportHtml);
  const pdfPage = await browser.newPage();
  try {
    await pdfPage.setContent(reportHtml, { waitUntil: 'load' });
    await pdfPage.evaluate(() => document.fonts.ready);
    await pdfPage.pdf({ path: resolve(output, 'development-report.pdf'),
      format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await pdfPage.close(); }
  const extracted = execFileSync('pdftotext', [resolve(output, 'development-report.pdf'), '-'],
    { encoding: 'utf8' });
  for (const phrase of ['安心屋', 'DRAFT_NOT_SUBMITTABLE', '程序占位', report.input_hash,
    '真实 Lux3D', '工程目标']) assert.ok(extracted.includes(phrase), `PDF missing ${phrase}`);
  const pdfInfo = execFileSync('pdfinfo', [resolve(output, 'development-report.pdf')],
    { encoding: 'utf8' });
  const pages = Number(pdfInfo.match(/^Pages:\s+(\d+)/m)?.[1]);
  assert.ok(pages >= 4 && pages <= 6, `Unexpected report pagination: ${pages}`);
  const files = ['browser-original.webm', 'development-recording.mp4',
    'development-report.pdf', 'development-report.html',
    'action-list.json', 'scene-snapshot.json', 'printable-action-list.pdf'];
  if (privateInputs) files.push('private-model-inputs.json', 'private-binding.json',
    'real-models-before.png', 'real-models-main-challenge.png');
  const fileHashes = Object.fromEntries(await Promise.all(files.map(async file => [file,
    await fileHash(resolve(output, file))])));
  const manifest = {
    status: values.mode === 'full' ? privateInputs ? 'PRIVATE_REAL_MODEL_DEVELOPMENT_RECORDING' : 'LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING'
      : 'TRIAL_ONLY_NOT_DELIVERABLE',
    report_status: 'DRAFT_NOT_SUBMITTABLE', source: sourceBefore,
    project_dirty_after: sourceAfter.project_dirty,
    project_status_after: sourceAfter.project_status,
    capture, video, report_pdf_pages: pages,
    exports: { report_filename: exportedReport.filename, snapshot_filename: exportedSnapshot.filename,
      scene_revision: report.scene_revision, input_hash: report.input_hash,
      ruleset_version: report.ruleset_version, source_kind: report.source_kind,
      snapshot_verification: verify.result, binding_result: exportEvidence.binding_result },
    checks, file_sha256: fileHashes,
    public_deployment: 'NOT_VERIFIED', real_lux3d: privateInputs ? 'TWO_PRIVATE_NORMAL_REPAIR_DERIVATIVES_USED' : 'NOT_USED_IN_THIS_CAPTURE',
    private_models: privateInputs?.evidence,
    audio: 'NONE', native_print_preview_visible_in_recording: false,
  };
  await writeFile(resolve(output, 'materials-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const publicSummary = { status: manifest.status, report_status: manifest.report_status,
    source_head: sourceBefore.head, app_source_sha256: sourceBefore.app_source_sha256,
    app_matches_head: sourceBefore.app_matches_head, project_dirty: sourceBefore.project_dirty,
    url: url.href, browser: browserVersion, duration_seconds: video.duration_seconds,
    scene_revision: report.scene_revision, input_hash: report.input_hash,
    ruleset_version: report.ruleset_version, file_sha256: fileHashes,
    model_materialization: checks.model_materialization,
    real_lux3d: manifest.real_lux3d, public_deployment: 'NOT_VERIFIED' };
  await mkdir(resolve(root, 'ci-evidence/network-materials/materials'), { recursive: true });
  await writeFile(resolve(root, 'ci-evidence/network-materials/materials',
    `${values.mode}-summary.json`), JSON.stringify(publicSummary, null, 2) + '\n');
  complete = true;
  console.log(JSON.stringify({ result: 'PASS', mode: values.mode, output,
    report_pages: pages, video_seconds: video.duration_seconds,
    input_hash: report.input_hash, real_lux3d: manifest.real_lux3d }));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ status: 'FAIL',
    error: String(error), source_head: sourceBefore.head, mode: values.mode,
    privateBinding, phases, page_text: await page?.$eval('body', n => n.textContent).catch(() => null),
  }, null, 2) + '\n');
  throw error;
} finally {
  if (recording) await recording.stop().catch(() => {});
  downloads?.close();
  await privateBinding?.close().catch(() => {});
  await cdp?.detach().catch(() => {});
  await browser.close();
  if (!complete) console.error(`Partial development materials kept at ${output}`);
}

async function sourceIdentity() {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const head = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  const projectStatus = git(['status', '--porcelain=v1', '--untracked-files=all']).split('\n').filter(Boolean);
  const roots = ['apps/web/src', 'apps/web/index.html', 'apps/web/package.json',
    'apps/web/package-lock.json', 'reference/homesafe_core', 'contracts/frontend'];
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...roots], { cwd: root })
    .toString('utf8').split('\0').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', ...roots],
    { cwd: root }).toString('utf8').split('\0').filter(Boolean);
  const paths = [...new Set([...tracked, ...untracked])].sort();
  const digest = createHash('sha256');
  for (const path of paths) digest.update(path).update('\0').update(await fileHash(resolve(root, path))).update('\n');
  const appStatus = git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...roots])
    .split('\n').filter(Boolean);
  const anchorDiff = execFileSync('git', ['diff', '--name-only', 'ba21f54', '--', ...roots],
    { cwd: root, encoding: 'utf8' }).trim();
  const keyPaths = ['apps/web/src/App.vue', 'apps/web/src/useLivingRoom.ts',
    'apps/web/src/scene/SceneRuntime.ts', 'reference/homesafe_core/challenge.py',
    'apps/web/dist/engine/scene-before.json', 'apps/web/dist/engine/scene-main-challenge.json'];
  const keyFiles = Object.fromEntries(await Promise.all(keyPaths.map(async path => [path,
    await fileHash(resolve(root, path))])));
  const toolPaths = ['scripts/create_development_materials.mjs', 'scripts/development_materials_report.mjs',
    'scripts/private_materials_inputs.mjs', 'scripts/web_download.mjs', 'scripts/private_asset_inputs.mjs',
    'scripts/capture_ffmpeg_fast.py'];
  const toolHashes = Object.fromEntries(await Promise.all(toolPaths.map(async path => [path,
    await fileHash(resolve(root, path))])));
  const currentAppDiff = git(['diff', '--name-only', values['expected-head'], '--', ...roots]);
  return { head, branch, initial_anchor: 'ba21f54ace3218cfa2d695092b735165c923b1b9',
    project_dirty: projectStatus.length > 0, project_status: projectStatus,
    app_matches_head: appStatus.length === 0, app_anchor_match: !anchorDiff && untracked.length === 0,
    app_status: appStatus, app_source_sha256: digest.digest('hex'),
    dist_manifest_sha256: await fileHash(resolve(root, 'apps/web/dist/preview-manifest.json')),
    dist_checksums_sha256: await fileHash(resolve(root, 'apps/web/dist/CHECKSUMS.sha256')),
    key_files: keyFiles, capture_tool_sha256: toolHashes,
    authorized_app_reference_commit: values['expected-head'],
    app_matches_authorized_source: !currentAppDiff && untracked.length === 0 };
}

async function assertModels() {
  if (!privateInputs) { assert.match(await text('.scene-panel'), /0 件模型 · \d+ 件程序占位模型/); return; }
  await page.waitForFunction(() => /已加载 2 件模型/.test(document.querySelector('.scene-panel')?.textContent)
    && !/件加载中|件加载失败/.test(document.querySelector('.scene-panel')?.textContent));
}

async function fileHash(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function ready() {
  await page.waitForFunction(() => {
    const panel = document.querySelector('[aria-label="检查结果"]');
    return panel?.getAttribute('aria-busy') === 'false' && document.querySelector('.report .hash');
  });
  assert.equal(await page.$eval('[aria-label="检查结果"]',
    node => node.querySelector('[role="alert"]')?.textContent ?? null), null);
}

async function text(selector) {
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, node => node.textContent.trim().replace(/\s+/g, ' '));
}

async function click(label) {
  const handle = await page.waitForFunction(value => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === value && !button.disabled), {}, label);
  await handle.asElement().click();
  await handle.dispose();
}

async function currentHash() { return (await text('.report .hash')).split(' ').at(-1); }

async function installAnnotation() {
  await page.evaluate(() => {
    const printRule = document.createElement('style');
    printRule.textContent = '@media print { #homesafe-recording-annotation { display: none !important; } }';
    document.head.append(printRule);
    const annotation = document.createElement('aside');
    annotation.id = 'homesafe-recording-annotation';
    annotation.setAttribute('aria-label', '录屏注释，非产品界面');
    annotation.style.cssText = 'position:fixed;top:8px;right:8px;max-width:550px;z-index:9999;'
      + 'padding:7px 11px;border-radius:8px;background:#163c36;color:white;'
      + 'font:600 15px "Noto Sans CJK SC",sans-serif;pointer-events:none;'
      + 'box-shadow:0 2px 8px #0005;';
    document.body.append(annotation);
  });
}

async function phase(index, note, selector) {
  await page.evaluate(({ note, selector }) => {
    document.querySelector('#homesafe-recording-annotation').textContent = note;
    document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, { note, selector });
  phases.push({ index: phases.length, script_segment: index, note, planned_seconds: seconds[index], started_at: new Date().toISOString() });
  const targets = attention[index];
  for (const target of targets) {
    const point = await page.evaluate(selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const rect = node.getBoundingClientRect();
      return { x: Math.max(10, Math.min(innerWidth - 10, rect.left + Math.min(rect.width / 2, 300))),
        y: Math.max(10, Math.min(innerHeight - 10, rect.top + Math.min(rect.height / 2, 120))) };
    }, target);
    if (point) await page.mouse.move(point.x, point.y, { steps: 8 });
    await new Promise(resolve => setTimeout(resolve, seconds[index] * 1000 / targets.length));
  }
}

async function dragChair(from, to) {
  return dragObject(from, to, 0.4);
}

async function dragObject(from, to, height) {
  const bounds = await page.$eval('canvas[aria-label="样例客厅三维场景"]', node => {
    node.scrollIntoView({ block: 'center' });
    const { left, top, width, height } = node.getBoundingClientRect();
    return { left, top, width, height };
  });
  const eye = [-2.76, 5.16, -3.92];
  const project = point => {
    const forward = unit(diff([3, 0.45, 2.24], eye));
    const right = unit(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const offset = diff(point, eye);
    const scale = bounds.height / (2 * Math.tan(24 * Math.PI / 180) * dot(offset, forward));
    return { x: bounds.left + bounds.width / 2 + scale * dot(offset, right),
      y: bounds.top + bounds.height / 2 - scale * dot(offset, up) };
  };
  const start = project([from.x, height, from.z]);
  const groundFactor = eye[1] / (eye[1] - height);
  const groundX = eye[0] + (from.x - eye[0]) * groundFactor;
  const groundZ = eye[2] + (from.z - eye[2]) * groundFactor;
  const end = project([groundX + to.x - from.x, 0, groundZ + to.z - from.z]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  assert.equal(await page.$eval('canvas', node => node.dataset.dragging), 'true');
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
}

function diff(a, b) { return a.map((value, i) => value - b[i]); }
function dot(a, b) { return a.reduce((sum, value, i) => sum + value * b[i], 0); }
function unit(a) { return a.map(value => value / Math.hypot(...a)); }
function cross([x, y, z], [a, b, c]) { return [y * c - z * b, z * a - x * c, x * b - y * a]; }

async function convertVideo(input, output) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', output], { encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) throw new Error(`Video conversion failed: ${result.stderr}`);
}

async function probeVideo(path) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,size:stream=codec_name,width,height,nb_frames', '-of', 'json', path],
    { encoding: 'utf8' }));
  const stream = probe.streams.find(item => item.codec_name === 'h264');
  assert.ok(stream && stream.width === 1280 && stream.height === 900, 'Unexpected video format');
  return { duration_seconds: Number(probe.format.duration), bytes: Number(probe.format.size),
    codec: stream.codec_name, width: stream.width, height: stream.height,
    frames: Number(stream.nb_frames) };
}

function lastPacketPts(path) {
  const output = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'packet=pts_time',
    '-of', 'default=noprint_wrappers=1:nokey=1', path], { encoding: 'utf8' }).trim();
  const pts = Number(output.split('\n').at(-1));
  assert.ok(Number.isFinite(pts) && pts > 0, 'Raw screencast has no valid final PTS');
  return pts;
}
