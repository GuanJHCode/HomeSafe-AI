# HomeSafe AI V6.1 开工入口

最新续作见 [be32202 后续开发](evidence/CONTINUATION_NEXT_20261105.md)：拖动输出保护、中性检查说明、显式方向校准工具均独立审查通过。用户暂不以3秒工程目标阻塞其他事项；现有CI预算和失败判断不变。本地be32202未推送，远端394eb04/CI41948477248下载功能失败、性能跳过；下文启动与下载历史按各自版本理解。

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
