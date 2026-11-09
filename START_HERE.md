# HomeSafe AI V6.1 开工入口

2026-11-09 当前续作：本地工作分支为 `codex/contest-content-20261109`；现已授权将已审查源码、脱敏证据与可公开草稿正常快进到既有 `codex/v6.1-browser-3d`。不改master，不授权网站部署或受权利阻断的模型/画面公开分发。内容补强与复验见[执行单](docs/CONTEST_CONTENT_20261109.md)：完整可重置风险案例、Lux3D保留来源与真实运行证据层级、合成场景和规则能力边界。来源目录写入及打印入口反例已修复，冻结5826的来源链、完整风险案例与独立真实浏览器重跑通过。新制88.92秒V3与四页纯文字私下报告已逐段/逐页独立通过，私有附件保存待确认，原V2保留；详见[补强记录](evidence/CONTEST_CONTENT_20261109.md)。

本源码记录创建时已核实的远端基线为6dc418d；新推送与CI按对应SHA另行核对。[CI42323926769](evidence/current-ci/6dc418d-ci-summary.json) 37项步骤全部成功，0失败/跳过；首次可编辑p95=2349.8ms、冷规则2349.7ms、热评估6.5ms，通过原3000/12000/150ms门槛。该测量仅对应6dc和隔离占位场景，本轮没有性能新测，门槛保持。原500的4324ms失败属于下面的历史。真实模型画面与原/派生件仍私下，公开清单为空，分发权限待确认。

## 历史2026-11-07源码同步

本轮用户已授权将全部可公开的待推送源码与交接记录同步到现有开发分支，范围见[源码同步清单](evidence/CODE_SYNC_20261107.md)。C1/54两提交均保留；54之后没有未提交产品代码。后续90.68秒字幕演示候选及仅本人Space交付已经独立审查通过；旧221.72秒片保留作技术验收记录。模型、媒体、私有附件引用和一次性私下录制/审查材料继续保密，公开许可与正式提交门禁不变。新CI按本次最终推送SHA核对，下面500的CI属于历史。

## 历史54阶段私下材料与500推送记录

真实模型私下材料现已完成：[4页报告、221.72秒完整实录及准备包](evidence/PRIVATE_REAL_MATERIALS_20261105.md)，均已独立实际审查。工具冻结C1、产品App/Core对500一致；新工具/证据仅本地，不推送。原/派生模型、PDF/视频和截图均私下不入恢复包；正式权利/托管/本人声明/外部设备门禁仍保留。

当前已按用户明确授权将 `5001222413937586604e8d944ba83787c7cb06fa` 正常快进推送到 `codex/v6.1-browser-3d`，master未改。[CI41993004005](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41993004005) 已终态：Python343、应用39、JS51及Chrome156功能全部通过；唯一失败为内部首次可编辑p95=4324ms >3000ms，冷规则4323.9ms<12000ms、热评估p95=14.8ms<150ms通过。用户暂不以3秒目标阻塞其他开发，严格预算未降低。两个setup后置步骤skipped，详见[当前CI回执](evidence/current-ci/5001222-ci-summary.json)。真实Lux3D原件和私下派生件已独立通过浏览器验收，公开分发权仍未确认；无网站发布。本轮独立本地分支已补齐真实模型私下报告与完整视频，见上方完成记录；不推送新提交。

历史5001222推送前集成记录：

当前本地集成以已只读确认到达远端的 `a192d51` 为首父基线，合入独立 `9a0818f` 的真实模型私下工作，见[集成记录](evidence/INTEGRATION_20261105.md)。两边代码/审查/历史证据均保留；a192不再是缺失输入。本地集成不推送、不发布；真实模型/媒体仍私下，公开权利、目标托管、真机和最终材料门禁保持独立。

历史9a阶段[本地可执行事项复核](evidence/LOCAL_READINESS_20261105.md)补齐真实模型逐件下载/摘要失败重试、375px操作、WebGL恢复和拖动导出保护，独立审查通过；并取得当前公开规则与PC协议文本，列出仅需本人/外部环境完成的具体条件。`a192d51`仍未取得或合并；下方4203阶段的测试计数和未重测范围按其阶段保留。

历史4203阶段真实原件进展见[私下模型验收](evidence/REAL_LUX3D_PRIVATE_20261105.md)：当前实例公网配置已生效，两件匹配 SHA 的原件从 Library 取得并通过真实浏览器交互和独立方向/代理审查。原件有20/24个零法线格式错误，独立私下派生件修复；原件保持不变，公开权利和部署门禁仍保留。实际派生复测及最终范围以该记录和独立审查为准。

历史a192阶段记录（写于推送前）见[网络恢复与开发材料续作](evidence/NETWORK_MATERIALS_20261105.md)，基线ba21f54。受控网络恢复与开发材料两个限定子项分别独立通过：4页中文工作稿、198.52秒真实占位操作视频及同版导出，T07/T10整体仍未完成。模型包本环境有界重试仍失败；用户已批准仅增加准确下载主机，但当前工具无环境配置写接口，尚未生效或再下载。未推送。

上一交付见 [be32202 后续开发](evidence/CONTINUATION_NEXT_20261105.md)：拖动输出保护、中性检查说明、显式方向校准工具均独立审查通过。用户暂不以3秒工程目标阻塞其他事项；现有CI预算和失败判断不变。本地be32202未推送，远端394eb04/CI41948477248下载功能失败、性能跳过；下文启动与下载历史按各自版本理解。

2026-11-05 上一交付为 [CI 下载等待修复](evidence/CI_DOWNLOAD_FIX_20261105.md)：原 394eb04 的 CI 因下载解析失败、性能步骤跳过；本地下载协议修复已通过独立审查与最终浏览器回归，尚未推送。本轮本地 strict enforce 首次可编辑 p95=4812.2 ms，3 秒仍未达标。下面启动调整记录按其阶段保留，最新交付状态以 HANDOFF / task-status 为准。

小杂接手续作：先读[全部后续任务执行提示词](docs/NEXT_AGENT_PROMPT_20261104.md)。它覆盖剩余功能、真实模型、部署、材料与逐项独立审查；实际状态仍以最新证据为准。

历史本地启动调整（2026-11-04）见[阶段记录](evidence/STARTUP_ADJUSTMENTS_20261104.md)：PR-1 已独立通过、PR-2 模型拆分已采纳；PR-3 固定实验未达采纳标准，已决定舍弃并还原 PR-2。已独立核验还原，最终 enforce 首次可编辑 p95=4086.1 ms 仍失败、热评估 p95=12.6 ms 通过；当时新远端 CI 未运行，其后394eb04/CI41948477248已运行，下载功能失败并跳过性能。

当前工作是合成客厅的三维开发预览。界面使用程序占位家具，同源 module Worker 加载同一份 Python 参考内核。当前验证和交付阻断见[接手记录](evidence/HANDOFF.md)和[任务状态](evidence/task-status.json)。

先读 [AGENTS.md](AGENTS.md)、[总体方案](docs/v6.1/00-overview.md)和[实施计划](docs/v6.1/05-delivery-plan.md)。恢复的 docs 根目录设计明细与 reference/ 为现行参考。历史导入结果见[源码导入验证](evidence/IMPORT_VALIDATION_20261103.md)。

## 本地检查

需要 Python 3.13 或 3.14、Node.js 24 和 npm。以下命令在仓库根目录运行。

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-validation.txt
python -m pytest reference/tests -q
python scripts/generate_contracts.py --check
python scripts/validate_package.py
node --test browser-spike/*.test.mjs
python scripts/stage_browser_core.py
python scripts/check_submission.py
```

当前提交预检预期为 BLOCKED、退出码 2。契约严格检查使用 TypeScript 5.8.3。

```bash
npm --prefix apps/web ci --no-audit --no-fund
apps/web/node_modules/.bin/tsc --strict --noEmit --target ES2022 contracts/frontend/domain.ts
npm --prefix apps/web run typecheck
npm --prefix apps/web test
```

## 准备同源运行时

准备官方 Pyodide 314.0.6 分发到仓库外。需要运行时文件及官方 lock 指定的 Pydantic 2.12.5 依赖闭包。保持官方 lock 原件，先检查复制计划，再写入空的默认目标目录。若已复制且校验通过，可直接运行暂存命令。

在可以访问官方 CDN 的环境，可先执行下面的固定摘要下载命令。目标目录必须尚不存在；已下载的分发可以复用。下载后仍执行后面的预览与复制，不手工修改 lock。

```bash
python scripts/download_pyodide.py --dest /tmp/homesafe-official-314.0.6
```

```bash
python scripts/vendor_pyodide_from_dir.py --source /tmp/homesafe-official-314.0.6
python scripts/vendor_pyodide_from_dir.py --source /tmp/homesafe-official-314.0.6 --copy
python scripts/stage_web_preview.py
node scripts/check_web_core.mjs
```

只运行诊断时，使用 `python -m http.server 8080 --bind 127.0.0.1 --directory browser-spike` 并打开 [同源探针](http://localhost:8080/?runtime=same-origin)。运行真实浏览器验收前先阅读[探针说明](browser-spike/README.md)。

## 启动开发预览与打包

保持上述 Python 虚拟环境已激活：打包暂存脚本会调用同一份 canonical 模型校验资源清单。真实模型的手动接入步骤见[资产目录](assets/README.md)；空清单使用明确标注的占位对象。

```bash
npm --prefix apps/web run dev
```

打开 Vite 打印的本地地址。首次运行先等待规则就绪。自由布置允许拖动椅子和柜体。把窗边椅子拖到地面标注的老人通道，观察两类检查发生的变化。将椅子拖到房间边界外可以检查回弹。可通过按钮切换角色、撤销、重做、重置或开始只开放椅子的挑战。行动清单支持 JSON 和打印。另可点击“导出场景快照”，保存当前已评估的完整输入、未知资料及来源，并附 revision/input_hash/ruleset。快照不含模型文件、撤销历史或挑战进度；页面当前不支持导入恢复。

下载场景快照后，在相同代码版本及 Python 环境中可独立重算复核：

```bash
python scripts/check_scene_snapshot.py /path/to/homesafe-scene-snapshot.json
```

仅当 canonical 输入和版本信息与当前 Python 内核一致时返回 `MATCHES_CURRENT_CORE`。这不是现实安全或挑战获胜证明。

续作提供窗边挑战、柜体主挑战和自由布置三个入口。主挑战只允许柜体移动/旋转，至少有三种不同合法解；Python 决定目标、步数、非法次数和取舍事件。两角色摘要持续显示，点击摘要只切换检查焦点。加载时可取消，失败后点击“重建 Worker 并重试”；失败模型可单独重试。重复 JSON 导出使用不同文件名，内容仍绑定同一布局版本与摘要。真实 Lux3D 和公网验收仍独立保留，见[续作验收](evidence/CONTINUATION_20261104.md)。

在隔离 Chromium 中验证时，显式传入浏览器和已安装的 puppeteer-core 入口，不使用个人浏览器目录：

```bash
node scripts/check_web_preview.mjs http://127.0.0.1:4173/ /path/to/chromium /path/to/puppeteer-core.js
node scripts/check_web_experience.mjs http://127.0.0.1:4173/ /path/to/chromium /path/to/puppeteer-core.js /tmp/homesafe-experience
node scripts/check_web_performance.mjs http://127.0.0.1:4173/ /path/to/chromium /path/to/puppeteer-core.js enforce
```

受控网络恢复验收使用已构建的 `/preview/` 本地入口。它对页面和实际 Worker 发禁缓存断网探针，再验证已加载会话的编辑/撤销/导出与显式恢复；范围及独立结果见[网络审查](evidence/REVIEW_NETWORK_RECOVERY_20261105.md)。

```bash
CI=1 HOMESAFE_PYTHON=/path/to/venv/bin/python node scripts/check_web_network_recovery.mjs \
  http://127.0.0.1:4173/preview/ /path/to/chromium /path/to/puppeteer-core.js \
  ci-evidence/network-recovery
```

本地开发材料工具需要 Chromium、puppeteer-core、FFmpeg/ffprobe、Poppler 与 Noto CJK 字体。它核对实际 HTTP 分发字节，录制真实占位场景并导出中文报告与同版行动清单；输出须使用新的 `evidence/private/development-materials-*` 目录。生成期间保持 HEAD、App/Core 和所服务分发不变。可先用 `--mode trial` 验证流程，再以新的输出目录运行 `--mode full`；完整视频时长须为180–240秒。原始失败材料保留，源码包只纳入审查过的文本证据。

```bash
CI=1 node scripts/create_development_materials.mjs \
  --url http://127.0.0.1:4173/preview/ --chrome /path/to/chromium \
  --driver /path/to/puppeteer-core.js --python /path/to/venv/bin/python \
  --output evidence/private/development-materials-local-new \
  --expected-head "$(git rev-parse HEAD)" --mode full
```

生成报告与录屏均标为开发工作稿；T10正式材料仍须绑定验收冻结后的真实模型和获准托管版本。

性能脚本采集五组全新浏览器上下文/缓存重载及三次预热后的三十次热评估，输出原始样本和 nearest-rank p95。当前门槛使用已接受报告、空闲评估及启用移动按钮的首次可编辑时间，并在每个样本实际移动、核验接受的输入哈希改变。首个观察界面只作诊断；结果仅适用于实际测试环境。传入末尾参数 `enforce` 将 3000/12000/150 ms 三项预算作为失败门禁；省略时仅报告。固定源码 `64e1665` 的 [CI 41807603537](evidence/CI_PUSH_64e1665_20261104.md) 功能通过、首次可编辑 p95=3386 ms 导致整体失败；最终保留 PR-1/PR-2、撤回 PR-3 后唯一完整 enforce p95=4086.1 ms 仍失败（此前 PR-2 阶段 3858.5 ms 另作历史保留）；该环境与旧 CI 不同，不能直接相减归因。上述启动阶段记录写于推送前；其后已随394eb04远端运行，CI41948477248因下载解析失败而跳过性能。阶段细节见[阶段记录](evidence/STARTUP_ADJUSTMENTS_20261104.md)。可选 `HOMESAFE_VIDEO_PATH=/tmp/development-regression.webm` 记录浏览器实帧（需 ffmpeg），这是开发回归原片，不自动成为最终参赛视频。容器测试沿用 CI 的隔离启动配置 `CI=1`。

```bash
npm --prefix apps/web run build
(cd apps/web/dist && shasum -a 256 -c CHECKSUMS.sha256)
npm --prefix apps/web run preview
```

`build` 重新暂存同源资源和经审核的模型，运行严格检查和 Vite 构建，并生成 `apps/web/dist/preview-manifest.json` 与 `CHECKSUMS.sha256`。发布校验会对照当前源码重新生成的 Python bundle、官方 vendor 清单和审核资产字节，拒绝过期或被改写的资源。只有上述命令成功才有可用构建目录。历史 CI 构建 artifact 见[CI 接续验证](evidence/CI_CONTINUATION_20261104.md)；该旧包不包含本轮主挑战，当前源码的本地构建与实测见[续作验收](evidence/CONTINUATION_20261104.md)，托管步骤见[实施记录](evidence/WEB_PREVIEW_20261104.md)。

CI 在临时 Linux 环境运行真实 Chrome 和完整构建，不会启动用户电脑上的浏览器。artifact 中的 `apps/web/dist/` 才是静态页面目录；`ci-evidence/` 是验收输出、截图与打印 PDF，不能作为公网部署成功的证明。下载后先进入 dist 运行 SHA-256 校验，只将该目录提交给已核准的静态托管入口。

## 目标托管资源核验

取得已核准的静态托管地址后，保留与上传内容相同的 `apps/web/dist/`（或下载 artifact 中的 dist），执行：

```bash
python scripts/check_deployment.py --url https://YOUR-APPROVED-HOST/preview/ --dist apps/web/dist --output deployment-transport.json
```

此命令先核验本地分发清单、摘要和未列出文件，再匿名请求目标首页、清单与全部资源；检查精确字节、Worker/WASM MIME 和子路径尾斜杠跳转。无登录、Cookie 或 API Key。资源重定向、登录页和 SPA 回退不能通过。输出必须放在 dist 外。

HTTP 检查通过仍不是浏览器或公开部署验收：回执固定保留 `browser_interaction: NOT_RUN`、`public_deployment: NOT_VERIFIED`。随后按浏览器验收脚本在同一目标完成真实交互、刷新、恢复与性能检查，再人工更新部署证据。`--allow-local-http` 仅供显式 loopback 测试，回执不会声称匿名 HTTPS 通过。CI 在真实 HTTP 子路径运行该命令；目前没有公开托管地址。

## 未核准公开分发的模型

已收到原件但权利待确认时，先按[私下接收流程](docs/v6.1/08-private-asset-intake.md)做几何检查与隔离浏览器验证。原件不进入公开目录，Node检查不替代真实浏览器。
