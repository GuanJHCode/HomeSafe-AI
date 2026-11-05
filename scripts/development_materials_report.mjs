// Printable, source-bound development report. All dynamic text is escaped.
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const short = value => html(String(value ?? '').slice(0, 16));
const row = (label, value) => `<tr><th>${html(label)}</th><td>${html(value)}</td></tr>`;

export function renderDevelopmentReport({ source, capture, exports, video, checks }) {
  const state = exports.report;
  const counts = Object.fromEntries(['triggered', 'needs_review', 'not_triggered']
    .map(status => [status, state.findings.filter(item => item.status === status).length]));
  const score = `${counts.triggered} 项已触发 · ${counts.needs_review} 项待核查 · `
    + `${counts.not_triggered} 项当前条件未触发 · ${state.unsupportedDomains.length} 类未覆盖`;
  const sourceRows = Object.entries(source.key_files).map(([path, digest]) =>
    row(path, digest)).join('');
  const historical = checks.historical_baseline;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>安心屋 · 本地开发报告工作稿</title>
<style>
@page { size: A4; margin: 15mm 15mm 17mm; }
* { box-sizing: border-box; }
html { font-family: "Noto Sans CJK SC", "Noto Sans CJK", sans-serif; color: #173c39; }
body { margin: 0; font-size: 10.5pt; line-height: 1.64; }
h1,h2,h3,p { margin-top: 0; }
h1 { font-size: 28pt; line-height: 1.24; margin-bottom: 8mm; }
h2 { font-size: 16pt; border-bottom: 2px solid #d1e4dd; padding-bottom: 3mm; margin: 0 0 6mm; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; }
p { margin-bottom: 3mm; }
.page { min-height: 258mm; break-after: page; position: relative; }
.page:last-child { break-after: auto; }
.eyebrow { color: #17796d; letter-spacing: .12em; font-size: 9pt; font-weight: 700; }
.status { background: #fcebdc; border-left: 5px solid #b75b22; padding: 4mm 5mm; color: #6f381d; font-weight: 700; }
.hero { background: #eaf3ee; padding: 8mm; border-radius: 5mm; margin: 8mm 0; }
.hero strong { display:block; font-size: 15pt; margin-bottom: 2mm; }
.muted { color: #536d68; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.card { background: #f1f6f3; border: 1px solid #dceae2; padding: 4mm; border-radius: 3mm; }
.card strong { display:block; }
table { width:100%; border-collapse:collapse; margin: 4mm 0; font-size: 9.2pt; }
th,td { border-bottom: 1px solid #d5e3dd; text-align:left; padding: 2.5mm 1.5mm; vertical-align:top; overflow-wrap:anywhere; }
th { width: 32%; color:#3b6259; font-weight: 600; }
.hash { font-family: ui-monospace, monospace; font-size: 8pt; overflow-wrap:anywhere; }
.callout { border-left: 4px solid #d3a238; background: #fff8e7; padding: 3mm 4mm; }
ul { padding-left: 5mm; margin: 2mm 0 4mm; }
li { margin-bottom: 2mm; }
.footer { position:absolute; bottom:0; left:0; right:0; border-top:1px solid #d1e4dd; padding-top:2mm; font-size:8pt; color:#607a72; }
</style></head><body>
<section class="page"><p class="eyebrow">HOMESAFE AI / 安心屋 / T10 开发材料</p>
<h1>在合成客厅里，<br>看见两种照护需求的取舍</h1>
<p class="status">DRAFT_NOT_SUBMITTABLE · ${capture.mode === 'trial' ? 'TRIAL_ONLY_NOT_DELIVERABLE' : 'LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING'}</p>
<div class="hero"><strong>给成年照护者的空间演练</strong>
<p>移动家具后，儿童窗边支点条件可能不再触发，同时老人指定通道条件可能新增触发。页面把每次合法布局的两类检查、资料缺口和行动清单放在一起，帮助练习核查依据。</p></div>
<div class="grid"><div class="card"><strong>本稿展示</strong>隔离 Chromium 中真实操作的本地开发预览、程序占位家具、同一 Python 规则内核以及一次挑战结果。</div>
<div class="card"><strong>不作出的承诺</strong>没有安全认证、现实事故预测、家庭照片识别、用户试玩结果或正式公网可用性声明。</div></div>
<h3>本次材料身份</h3><table>
${row('源码提交锚点', source.head)}
${row('工作区状态', source.project_dirty ? `有未提交改动；App/Core 对当前 HEAD ${source.app_matches_head ? '一致' : '有差异'}` : '无未提交改动')}
${row('App/Core 内容摘要', source.app_source_sha256)}
${row('本地预览', capture.url)}
${row('实际浏览器', capture.browser)}
${row('演示输入摘要', state.input_hash)}
</table>
<p class="footer">工作稿 · 来源：本地程序占位场景 · 生成时间 ${html(capture.created_at)} · 1 / 4</p></section>

<section class="page"><h2>玩法、实现与素材来源</h2>
<h3>一条完整演练</h3>
<p>切换儿童和老人观察视角，点开检查卡定位对象；拖动椅子生成双角色取舍；撤销后在窗边挑战重新摆放；达标后仍查看已触发、待核查和未覆盖项。导出的 JSON、场景快照及打印样式 PDF 都来自同一接受的布局。</p>
<p>相机高度只影响观察，不代表触及能力。模型尺寸是合成教学场景中的目标尺寸，并非现实测量。未知保持未知；资料补充不算空间整改。</p>
<h3>单一规则内核</h3>
<p>Vue 3、TypeScript 与 Three.js 负责界面和三维呈现；同源 module Worker 载入 Pyodide 与 Python 参考内核。布局校验、规则结果、比较、挑战计数和胜负以 Python 为准，前端不另写权威规则。</p>
<h3>真实 Lux3D 原件的边界</h3>
<p>历史接收记录包含两件 Lux3D 网页图生 3D 原始 GLB：chair 任务 30471、cabinet 任务 30475；参考图为 AI 生成家具图。原件 SHA 分别为 <span class="hash">e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a</span> 与 <span class="hash">a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b</span>。</p>
<p class="callout">本次录屏只加载程序占位家具；当前环境未取得这两件原件字节（${html(checks.model_materialization)}）。真实纹理、方向、场景交互和公开再分发权利仍待核验。历史 Node 几何检查不能代替真实模型浏览器验收。</p>
<h3>本地预览资源</h3><table>
${row('分发清单摘要', source.dist_manifest_sha256)}
${row('本地 HTTP 字节核对', checks.local_transport)}
${row('源文件摘要样本', `${Object.keys(source.key_files).length} 个关键文件，完整值见第 4 页`)}
</table><p class="footer">开发预览 · 模型授权与正式托管仍待确认 · 2 / 4</p></section>

<section class="page"><h2>本次真实浏览器演示</h2>
<p>录屏为真实 Chromium 页面连续捕获，无音频解说。画面上的“录屏注释”只标明阶段和局限，不是产品功能；没有用生成帧替代软件操作。</p>
<table>
${row('浏览器与画面', `${capture.browser} · ${capture.viewport.width}×${capture.viewport.height}`)}
${row('视频时长 / SHA-256', `${video.duration_seconds.toFixed(2)} 秒 / ${video.sha256}`)}
${row('场景版本 / 规则集', `v${state.scene_revision} / ${state.ruleset_version}`)}
${row('输入摘要', state.input_hash)}
${row('导出一致性', exports.binding_result)}
${row('挑战界面原文', capture.challenge_summary)}
${row('当前检查概况', score)}
</table>
<p class="callout">“当前条件未触发”不表示现实安全。挑战达标只针对本关目标；剩余问题和未覆盖范围仍显示在当前清单中。</p>
<h3>可复核的同版输出</h3><ul>
<li>行动清单 JSON：接受的 scene_revision、input_hash 与 ruleset_version 和页面一致，来源为 synthetic_demo。</li>
<li>场景快照 JSON：保留当前输入与资料来源，不含模型文件或挑战进度；同一 Python 内核独立复算结果为 ${html(exports.snapshot_verification)}。</li>
<li>打印样式 PDF：从当前页面实际 print CSS 生成。录屏展示点击“打印清单”，不宣称镜头呈现系统原生打印预览。</li>
</ul>
<h3>测试结论的范围</h3><p>${html(historical)}。本次材料脚本另验证本地 HTTP 资源字节、浏览器操作、导出字段、快照复算、中文 PDF 可解析及视频帧；这些不能证明公网或真实 GLB。</p>
<p class="footer">${capture.mode === 'trial' ? 'TRIAL_ONLY_NOT_DELIVERABLE' : 'LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING'} · ${html(capture.url)} · 3 / 4</p></section>

<section class="page"><h2>版本追溯、开放问题与下一步</h2>
<p>首个可操作界面 ≤3 秒是项目工程目标，仍为 OPEN。此前本地严格测试 p95=4812.2 ms，属于较早版本与环境的历史结果；本次制作材料没有重测性能，也没有降低 CI 门槛。该目标不能称为已核实的赛事官方要求。</p>
<div class="grid"><div class="card"><strong>仍需实际证据</strong>两件真实 GLB 的浏览器视觉/交互与分发权利、获准托管的匿名 HTTPS 和另一网络、同版跨设备/性能、当前账户表单与赛事规则、最终可提交材料。</div>
<div class="card"><strong>后续维护</strong>正式入口和责任人尚未确认。只有 G0–G4 门禁、权利与实际表单均满足后，才制作并提交正式参赛版本；本稿不填写作品编号或回执。</div></div>
<h3>关键文件内容摘要（SHA-256）</h3><table>${sourceRows}</table>
<h3>本稿的使用方式</h3><p>供团队核对叙事、中文排版和操作顺序。公开传播、参赛提交或真实模型展示需另按实际权利与最终版本重做。当前文件和录屏均为私下开发材料。</p>
<p class="footer">DRAFT_NOT_SUBMITTABLE · 无公网、无实际 Lux3D 浏览器验收、无用户试玩 · 4 / 4</p></section>
</body></html>`;
}
