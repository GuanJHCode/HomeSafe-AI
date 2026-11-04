# HomeSafe AI V6.1 开工入口

小杂接手续作：先读[全部后续任务执行提示词](docs/NEXT_AGENT_PROMPT_20261104.md)。它覆盖剩余功能、真实模型、部署、材料与逐项独立审查；实际状态仍以最新证据为准。

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

打开 Vite 打印的本地地址。首次运行先等待规则就绪。自由布置允许拖动椅子和柜体。把窗边椅子拖到地面标注的老人通道，观察两类检查发生的变化。将椅子拖到房间边界外可以检查回弹。可通过按钮切换角色、撤销、重做、重置或开始只开放椅子的挑战。行动清单支持 JSON 和打印。

```bash
npm --prefix apps/web run build
(cd apps/web/dist && shasum -a 256 -c CHECKSUMS.sha256)
npm --prefix apps/web run preview
```

`build` 重新暂存同源资源和经审核的模型，运行严格检查和 Vite 构建，并生成 `apps/web/dist/preview-manifest.json` 与 `CHECKSUMS.sha256`。发布校验会对照当前源码重新生成的 Python bundle、官方 vendor 清单和审核资产字节，拒绝过期或被改写的资源。只有上述命令成功才有可用构建目录。最新实测与构建 artifact 见[CI 接续验证](evidence/CI_CONTINUATION_20261104.md)，托管步骤见[实施记录](evidence/WEB_PREVIEW_20261104.md)。

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
