# HomeSafe AI V6.1 开工入口

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
npm --prefix apps/web install --no-audit --no-fund
apps/web/node_modules/.bin/tsc --strict --noEmit --target ES2022 contracts/frontend/domain.ts
npm --prefix apps/web run typecheck
npm --prefix apps/web test
```

## 准备同源运行时

准备官方 Pyodide 314.0.6 分发到仓库外。需要运行时文件及官方 lock 指定的 Pydantic 2.12.5 依赖闭包。保持官方 lock 原件，先检查复制计划，再写入空的默认目标目录。若已复制且校验通过，可直接运行暂存命令。

```bash
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution --copy
python scripts/stage_web_preview.py
node scripts/check_web_core.mjs
```

只运行诊断时，使用 `python -m http.server 8080 --bind 127.0.0.1 --directory browser-spike` 并打开 [同源探针](http://localhost:8080/?runtime=same-origin)。运行真实浏览器验收前先阅读[探针说明](browser-spike/README.md)。

## 启动开发预览与打包

```bash
npm --prefix apps/web run dev
```

打开 Vite 打印的本地地址。首次运行先等待规则就绪。自由布置允许拖动椅子和柜体。把窗边椅子拖到地面标注的老人通道，观察两类检查发生的变化。将椅子拖到房间边界外可以检查回弹。可通过按钮切换角色、撤销、重做、重置或开始只开放椅子的挑战。行动清单支持 JSON 和打印。

```bash
npm --prefix apps/web run build
(cd apps/web/dist && shasum -a 256 -c CHECKSUMS.sha256)
npm --prefix apps/web run preview
```

`build` 重新暂存同源资源，运行严格检查和 Vite 构建，并生成 `apps/web/dist/preview-manifest.json` 与 `CHECKSUMS.sha256`。只有上述命令成功才有可用构建目录。运行结果、正式托管步骤及限制见[本轮验证](evidence/WEB_PREVIEW_20261104.md)。
