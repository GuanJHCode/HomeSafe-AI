# 开工入口：V6.1 参考源码已导入

日期：2026-11-03，Asia/Shanghai。当前提供方案、Python 参考内核、契约、测试、浏览器诊断和本地部署工具；不是完整三维应用。

先读[总体方案](docs/v6.1/00-overview.md)、[AGENTS.md](AGENTS.md)、[源码补齐说明](docs/V6_1_SOURCE_IMPORT.md)和[本次验证](evidence/IMPORT_VALIDATION_20261103.md)。

## 运行原生检查

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

最后一项当前预期 BLOCKED、退出码 2，原因是应用、真实资产、正式入口和提交材料未完成，不是源码导入失败。契约类型检查需要 TypeScript 5.8.3：`tsc --strict --noEmit --target ES2022 contracts/frontend/domain.ts`。

## 下一步：真实同源浏览器探针

从固定官方分发准备运行时到仓库外，不给 lock 人工添加 info.version：

```bash
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution --copy
python -m http.server 8080 --bind 127.0.0.1 --directory browser-spike
```

访问 `http://localhost:8080/?runtime=same-origin`，验证初始化、三样例、挑战与失败后重建 Worker。官方运行时二进制不在仓库；本次原生/JS 测试不代替这项验收。

探针通过后继续 T02：创建 apps/web，完成拖动→合法布局→双角色重算→撤销→清单；T03 制作两件真实 Lux3D 小样。完整计划见[任务表](docs/v6.1/05-delivery-plan.md)。

## 文档与版本

docs/v6.1/ 为概要导航；恢复的 docs/00-scope-and-rules.md 等原包明细与 reference/ 为当前实现基线。原仓库六份早期文档继续保留历史标记，不要误将全部 docs 根目录文件都视为旧方案。

五份冲突原文与原包清单保存在 history/v6.1-original-source/；其中相对路径和历史测试按原包上下文理解。提交格式 `<type>: <desc>`，任务 ID 写正文。只更新实际完成部分；SUBMITTED 仍需真实回执。
