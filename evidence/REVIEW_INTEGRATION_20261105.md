# a192 与真实模型分支本地集成独立审查（2026-11-05 UTC）

**结论：PASS_INDEPENDENT_SCOPED_AFTER_MATERIAL_FACT_CACHE_AND_BOOTSTRAP_BODY_FIXES。** 审查工作区为 `codex/integrate-private-models-20261105`。本次实际浏览器与材料核验时，HEAD 是 `a192d51184393187a9e1d98e9c92cd2da06b1dd7`，未提交合并的 MERGE_HEAD 是 `9a0818f7c769e084bdaea0f723cb4266a0ab1224`，共同基线为 `ba21f54ace3218cfa2d695092b735165c923b1b9`。这是当前集成工作树的真实结果，不把测试锚点写成尚未产生的合并提交。最终提交及源码恢复包另由交付记录给出。

## 三方差异、任务与历史保留

独立读取两父与共同基线的 Git 对象并比较当前字节。两边共同修改仅有 `START_HERE.md`、`evidence/HANDOFF.md`、`evidence/task-status.json`、`package-manifest.json`、`CHECKSUMS.sha256` 五项；当前无冲突标记或未合并索引项。两父 Git 路径并集 913 项均存在，除明确的合并元数据、三份阶段文档的当前集成提示及下述材料事实/缓存修复外，均保留应有父方字节。`history/` 下 35 项逐字节不变。

a192 的网络脚本、CI 和两个材料工具先精确保留，随后分别因下述缓存时序与材料事实缺陷作限定修复，不能再称这四项逐字节不变；9a 的四个脚本及九项法线回归文件与该父提交完全相同。[来源保留回执](integration/source-preservation.json)区分继承字节与限定变更。新增 `development_materials_report.test.mjs` 和 `check_network_cache_browser.mjs` 分别针对实际材料事实与缓存反例。App、包锁/构建配置、Python 内核、canonical 契约及性能脚本所涉 44 个受保护源文件与共同基线及两父全部相同。

两父原有 15 个主任务、25 个唯一子任务均保留；按两父逐项核对的 45 条子任务记录精确保留，任务 evidence 数组无父方遗漏。受控网络、开发材料、真实模型、法线派生及真实模型恢复子项同时存在，新增缓存修复有独立当前证据，T03/T04/T07/T09/T10/T11 等整体门禁没有因合并一并关闭。性能目标仍 OPEN_NOT_MET，CI 预算及严格失败传播不变。

当前入口与 integration 状态明确 a192 已取得并合入工作树，旧“转移可读 a192 源码包”动作已解除；历史 a192/4203/9a 文档与状态带阶段标识，保留当时无法下载、未推送或 a192 不可读的事实。当前外部条件只保留实际许可/源码权利选择、获准托管及维护/发布授权、本人登录表单声明、实际设备/另一网络。a192 的原 198.52 秒视频与 PDF 私下二进制不在其 Git 树，本次没有恢复或冒称持有这些旧媒体。

初始显式源码 allowlist 精确包含两父的 911 项并集。检查未发现原/派生 GLB、截图、PDF、视频、私下输出或原始条款全文进入源码清单；既有 `browser-spike/python/homesafe_core.zip` 是 canonical 运行时包。公开 asset manifest 的 assets 与 feature map 的 mappings 均为空，构建的 28 个文件无 GLB 或私下媒体。新增集成证据及最终摘要重算由交付打包流程负责，不将初始待重算摘要当最终校验结果。

独立原始核对保留于忽略目录 `evidence/private/reviewer-integration-20261105/{source-audit,union-audit,visual-review}.json`。路径枚举使用 Git NUL 分隔，避免中文路径被默认引号转义造成伪缺失；初次探针的该问题已注明，实际无文件丢失。

## 实际集成浏览器检查

以下命令均由本审查独立执行，使用隔离 Chromium 154、既有官方运行时及当前集成树。公开构建服务只提供占位 dist；真实模型 harness 自建 loopback 内存绑定，不修改公共目录。

```bash
CI=1 HOMESAFE_PYTHON=/workspace/homesafe-private/app/.venv/bin/python \
  node scripts/check_web_network_recovery.mjs \
  http://127.0.0.1:42591/preview/ /usr/bin/chromium \
  /workspace/homesafe-private/browser-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  evidence/private/reviewer-integration-20261105/network

PATH=/workspace/homesafe-private/app/.venv/bin:$PATH CI=1 \
  HOMESAFE_PYTHON=/workspace/homesafe-private/app/.venv/bin/python \
  node scripts/check_private_assets.mjs \
  --chair /workspace/homesafe-private/app/evidence/private/lux3d-derived-chair-20261105/model.glb \
  --cabinet /workspace/homesafe-private/app/evidence/private/lux3d-derived-cabinet-20261105/model.glb \
  --chair-front +Z --cabinet-front +Z --provenance lux3d_web \
  --chrome /usr/bin/chromium \
  --driver /workspace/homesafe-private/browser-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  --resilience --output evidence/private/reviewer-integration-20261105/real-resilience

/workspace/homesafe-private/app/.venv/bin/python scripts/check_deployment.py \
  --url http://127.0.0.1:42591/preview/ --dist apps/web/dist --allow-local-http \
  --output evidence/private/reviewer-integration-20261105/loopback-transport.json
```

| 实际检查 | 结果与证据范围 |
| --- | --- |
| a192 受控断网与恢复 | PASS，06:47:46Z。页面和实际 module Worker 的禁缓存请求各记录 ERR_INTERNET_DISCONNECTED，八阶段完成；离线编辑/撤销/重做/导出、失败/取消、显式新 Worker 恢复保持接受布局。原生快照重算 MATCHES_CURRENT_CORE。 |
| 三态资料 | PASS。独立逐对象深比行动清单与快照的七组 properties/来源元数据完全相等：true 2、false 1、unknown/null 45、数值 0.5 一项，未知未转 false。 |
| 两件真实派生件完整交互 | PASS。输入摘要分别为 `296935f947dabf72026764d71d1df9f85d353d2062c7745b187ad21b417a07fc`、`92944741a7e9f2491f9220c9dff3f95d66190db80a2488a5d029fbe1b3de3350`；完整拖动/旋转/回弹/挑战/恢复/导出与三种快照复算通过。 |
| 真实模型四故障 | PASS，06:50:50Z。chair/cabinet 各 HTTP503 与 SRI 摘要不符：失败件请求 1→2，成功件保持 1；失败占位可见，显式重试保持已接受 hash/pose。 |
| 窄屏与 WebGL | PASS。375×812 视口两件按钮操作且无水平溢出；实际 WEBGL_lose_context 丢失后显式新 canvas 加载两件、保留接受 hash。 |
| 真实绑定拖动导出保护 | PASS。两件 loaded 门禁实际满足；hold/preview 阻止输出，pointercancel/视角变化恢复，合法 release 的 JSON/快照/打印调用绑定当前接受结果。 |
| 同源构建传输 | PASS_LOCAL_HTTP_TRANSPORT_ONLY。当前实际服务字节与本地清单匹配，anonymous HTTPS / public deployment 仍未验证。 |

我实际用 view_image 查看本次独立输出的 real-models、两件失败占位、375px 和 renderer-recovered 五张截图。两件木纹/柜门把手可见，失败对象有明确占位与重试提示，重建后两件恢复；不只采信脚本 PASS。原件 +Z/-Z 正反面对照、零法线缺陷/派生字节保护等既有审查按其原阶段保留，本轮没有重跑或伪称重做这些未变检查。样例仍是非均匀合成尺寸拟合，不能称实测或等比例保真。

## 实际材料反例、修复及短试复审

发现并报告的真实集成缺陷是旧生成器把“本环境原件 UNAVAILABLE / 真实浏览器 BLOCKED”写死。当前环境实际可读取两件匹配 SHA 原件且独立真实浏览器通过；首轮新 trial 的实际 PDF 却包含“当前环境未取得这两件原件字节”。我独立读取原件校验 SHA、执行模板反例得到退出 1，并从该实际 PDF 提取确认错误短句；旧 PDF SHA 为 `fc379da9a99080310ad5bbc53cbc2fb88f8ff7ba83cdd9964fbbcd451b2190d6`。旧红日志、错误 HTML/PDF 及首轮 trial 保留，未覆盖。

实施侧仅修两个材料工具的声明/元数据范围：本片仅用程序占位，不物化/使用/评估真实模型；原件可用性、私下验收、分发许可查独立证据。独立复审窄 diff 没有发现产品或权限变化。我的同一实际 SHA 反例由退出 1 变为 0；另独立运行 `node --test scripts/development_materials_report.test.mjs`，AVAILABLE / UNAVAILABLE / NOT_ASSESSED 三项均通过。原始反例和绿灯分别在私下目录的 materials-state-red.log、materials-state-green.log、materials-render-tests.log；可导出的事实摘要见[反例记录](integration/material-facts-counterexample.json)。

实施侧在当前环境重新生成 `evidence/private/development-materials-integration-fixed-20261105/`。我对实际产物独立复核，而非声称自己重新录制：

- 全部七件产物 SHA 与 manifest 相符；39 个 App/Core 源文件聚合 SHA 独立重算为 `7ec6dee5de77002c726a3c517602e96be17905f815bb873552bf625acb68cbb8`，六个关键文件、dist 清单摘要也相符。HEAD=a192，project_dirty=true、app_matches_head/anchor_match=true 与实际未提交合并一致。
- 四页 PDF 逐页渲染并用 view_image 目视：中文、摘要、页脚可读，无明显裁切/注释污染；错误原件缺失句消失，模型章节与页脚均限定本次 capture。状态为 DRAFT_NOT_SUBMITTABLE / TRIAL_ONLY_NOT_DELIVERABLE。
- ffprobe 独立计数原 WebM 与 MP4 均 652 帧，1280×900、25fps；MP4 为 26.08 秒。实际抽取并查看 0.8、4.6、8.5、17.5、24.5 秒实帧，4.6 秒清晰显示“本片未使用真实 Lux3D”，其他采样包含观察视角、窗边挑战和未覆盖项。未把抽样写成逐帧完整审片，也未把短试当新的 3–4 分钟正式片。
- 我再次原生执行 `scripts/check_scene_snapshot.py` 核对新场景快照，结果 MATCHES_CURRENT_CORE，布局 v2、规则 demo-rules-3.0、输入 `c8c61e185bd547373f4a10979f6e0d4310b325058950c3b20fc58ecffad86ebc`，与新行动清单和 manifest 一致。

## CI 第二页缓存时序修复独立复审

实际读取收到的 `HomeSafe-AI-CI-41980778267-diagnosis.txt`，包括其保留的失败日志片段、Chrome154/156 控制矩阵、普通/extra 响应与 DOM 证据。报告直接支持原 CI 停在 firstResponse.ok()、后续 startup trace/embedding 未执行、性能 skipped；但原 artifact 的 HTTP 日志和 failure.json 未取得，**原次 HTTP304 仍为高置信推断**。我没有重新下载原 CI artifact 或在当前环境重跑 Chrome156，也不把诊断环境的完整控制矩阵冒称本机运行。

独立审读冻结补丁，Network.setCacheDisabled 从第二页 goto 之后移到 firstCdp 的 Network.enable 之后、Fetch.enable/goto 之前。两处导航成功断言及所有离线/失败/取消/重试断言保留。新增诊断只选择缓存相关 header，记录 Puppeteer 状态、URL、fromCache/fromServiceWorker 和 CDP 普通/extra 状态；成功/失败 JSON 均有诊断，失败 stderr 另打印 NETWORK_NAVIGATION_DIAGNOSTICS。CI 仅追加合成缓存回归命令，原 network 命令和严格性能块未放宽。

我先在当前普通 dist 服务做有界观察：Chrome154 旧顺序返回200/fromCache=true，提前禁缓存返回200/fromCache=false，没有在该默认缓存新鲜度下复现304。随后另建标准 ETag/no-cache 的独立 loopback 服务器，只服务当前占位 dist：

```bash
node evidence/private/reviewer-integration-20261105/network-cache-full.mjs legacy
node evidence/private/reviewer-integration-20261105/network-cache-full.mjs fixed

CI=1 HOMESAFE_PYTHON=/workspace/homesafe-private/app/.venv/bin/python \
  node scripts/check_network_cache_browser.mjs /usr/bin/chromium \
  /workspace/homesafe-private/browser-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  evidence/private/reviewer-integration-20261105/cache-regression
```

第一条使用从 Git 对象取得的精确 a192 脚本，SHA `cd6a9326bfcfc3a2b986fbb82bdb9e1643836f2065aa0e042b171ed857a7e08b`，仅在私下目录链接原 helper、脚本字节未改。服务器实际记录200→带 If-None-Match 的304，旧脚本退出1、完成前六阶段，确切失败为 assert.ok(firstResponse?.ok())；错误 JSON/截图/下载均保留。我实际 view_image 检查 failure-initial.png，缓存页面 DOM 已显示，配置处于预期的待加载状态。另一个最小标准 HTTP 夹具也观察到缓存正文正常显示而 Puppeteer ok=false，未伪造响应对象或替换 ok()。

缓存时序单独修复阶段的脚本 SHA 为 `c6fdef96e17e2a7ec6ddc8d4a919f5926dc1de2e3d1e066b14dfea189075a4b8`。同类完整夹具实际200→无条件200，退出0、八阶段全部完成、原生快照 MATCHES_CURRENT_CORE；源文件运行前后摘要相同。页面、实际 Worker 及 initial-page 的真实断网失败事件均保留，未跳过尾部首次配置离线失败和显式在线恢复。该阶段结果保留，不替代下述最终正文屏障版本。

新增正式缓存回归脚本也由我独立实际运行，07:17:46Z 输出 PASS：旧顺序 replay 304/退出1/六阶段，提前禁缓存200/退出0/八阶段；404、500 均保持退出1/ok=false，且 stderr 含导航诊断。旧顺序的普通 CDP 状态为200、extra状态304、Puppeteer状态304，解释了 fromCache=false 仍可发生重验证；服务器条件请求日志提供独立协议证据。源码审查确认 replay 只退回原缓存调用位置并定位 helper，无 Git 历史读取依赖，适合浅克隆 CI。原始独立结果在私下 cache-full-{legacy,fixed}/experiment.json、cache-regression/result.json，原红灯未覆盖。

该修复的本地独立复审通过；本地成功不表示原 CI 原始304已实证或修复后远端 CI 已运行。当前最终移动调用的补丁只在 Chromium154 实际复测，Chrome156 的先前诊断对照与此分开记录。

## 并行 bootstrap 反例与完整正文屏障

随后实施侧将缓存夹具与 startup trace 并行运行，确实出现新的失败。我实际读取 `evidence/private/integration-cache-final-20261105/pre-navigation-disabled/failure.json`：第二页导航200/ok=true且没有条件缓存 header，但 assets.json 和 scene-main-challenge.json 先记录 ERR_INTERNET_DISCONNECTED，应用共享 AbortController 清理后，预期被测 config.json 变为 ERR_ABORTED，因此原来的配置断流断言正确失败。前六阶段仍完成；不能因此前多个绿灯而丢弃这份真实反例。

独立检查 App 的两个并行启动分支及当前 Puppeteer 实现后，确认只用 waitForNetworkIdle 并不严格证明正文完整：该版本 inflight 计数会在 response 事件就递减。我的私下 idle-only 提案/慢正文探针在该次实际仍通过八阶段，未另复现错误；外层探针错误假设必有 failure.json 导致 ENOENT，已记为探针假设错误，不能算产品红灯。我此前建议的 response.finished() 也不是当前 Puppeteer 公共 API；最终采用其实际支持的 json()/content() 正文完成链。

最终冻结脚本 SHA 为 `d6f0d9d3ff82aec18620bccea5d1366f0fe66a8db3b957f82b1f86e9a0c96b74`。它在 goto 前注册三份精确启动 URL 的 waitForResponse，确认 config 已被 hold 后，等待每份成功响应的 resource.json() 完整读取/解析，三项 body_complete 必须全为 true 才切断网络。每个等待任务内部捕获失败并返回显式 false，成功/失败回执和 stderr 都保留 initialBootstrap；原八阶段及 config 的断流断言保持。当前 Puppeteer 源码的 json→text→content 确实等待 bodyLoadedDeferred，并非只等 HTTP 头。

我独立运行 `node evidence/private/reviewer-integration-20261105/network-bootstrap-body-full.mjs fixed`，用正常 ETag/no-cache 服务器提供完整占位 App，三份 JSON 都先发响应头和第一个字节、其余正文延迟两秒。实际六次正文传输耗时2000–2003ms、均完整结束且无提前关闭；第二页三项 initialBootstrap 为200/body_complete=true，唯一 initial-page 断流为 config.json 的 ERR_INTERNET_DISCONNECTED。完整八阶段和 MATCHES_CURRENT_CORE 通过，源文件前后 SHA 不变，证据在 `evidence/private/reviewer-integration-20261105/bootstrap-body-fixed/experiment.json`。

最终五项缓存/正文/HTTP错误回归也由我独立实际运行，07:31:36Z 为 PASS。旧序304/退出1/六阶段；提前禁缓存和 slow-bootstrap-body 分别200/退出0/八阶段，并各自 MATCHES_CURRENT_CORE；404/500继续退出1。慢 assets 正文实测1001ms并完整结束，三项 initialBootstrap 均完成。network 脚本 d6f0d9d、缓存回归脚本 `88c22c70e9f7cf20406911b367bf12c49f28a81981634837c7794570b59acdb1`、CI 配置 `3635940bd16959c7653c3791fe9eb7b2e856b98e7c5eaabf3d0d265d69c33e7c` 三文件前后 SHA 相同。完整回执在私下 `cache-regression-final/result.json`；此前四项绿灯与实际并行红灯均保留，未挑选替换。

## 保留边界

本审查没有未解决的具体本地集成阻断；材料事实、导航缓存、并行 bootstrap 准备三类实际缺口均保留反例并完成相应修复复审。独立浏览器均为 Linux Chromium / loopback；断网是有真实失败事件支持的 CDP 模拟，Worker 终端故障/请求暂停是测试注入，打印保护只验证调用计数。375px 不是物理手机，受控断网不是另一实际网络或离线冷启动。材料是当前环境的新占位短试，旧环境媒体未恢复，最终冻结版真实素材报告/完整视频仍待对应门禁。

没有新的正式性能 p95、Edge/Safari、真机、公开 HTTPS、账户表单、接受条款、公开模型分发许可或正式提交验收。原/派生模型和全部私下图片/PDF/视频保留忽略目录，未推送、发布或上传。修复及本地集成的限定 PASS 不关闭 T00–T14 或 G0–G4 的其余外部条件。
