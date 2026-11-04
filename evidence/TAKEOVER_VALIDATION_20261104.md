# 接续验证与资产接入

日期：2026-11-04。接手已有功能提交 `69df60fdb04742ad369a6f4a54f6c1d2c35eb126`，分支 `codex/v6.1-browser-3d`。本轮开始和提交前通过 GitHub 的 master ref API 核对，远端仍是 `2f562a3d0c6cae7aedbe2ea13a469a98a24ee57f`，没有新增量需要合入。未推送、未改写 master。

## 本轮完成的子项

- T02：应用启动读取经审核的资产描述与绑定场景，交给现有 AssetLoader；SceneRuntime 按实际异步加载结果回报加载、成功、失败和占位状态。对象 ID、变换、规则输入和原有交互职责保留。Vue/Three 代码仍须完整类型检查与真实浏览器验证。
- T03：增加 canonical `PublicAssetCatalog` / `PublishedAsset`，生成三份契约。`prepare_public_assets` 核对公开分发声明、来源记录摘要、模型摘要、校准复核、自包含 GLB 和对象绑定。只输出渲染 DTO 与模型字节，来源记录不进入公开构建。真实模型数量仍为 0。
- T04：暂存前验证所有资源；禁止悄悄带入旧模型和未审核文件。发布校验从当前 Python 源码重新生成 bundle，并对照官方 vendor 清单和审核模型字节，修复“public 和 dist 同时损坏仍通过”及“源码更新后旧 bundle 仍通过”的缺陷。

Python 的八条规则没有在 TypeScript 重写。本轮没有添加账号、上传、后台服务或收费调用。资产权利和来源字段须由真实审核填写；程序校验与哈希不能证明来源真实性。

## 回归过程与实测

先新增反例：资产模块尚不存在时收集失败；5 项暂存/发布测试在旧实现上全部失败。实现后新增的 19 项 Python 回归全部通过。GLB 是测试生成的三角形，暂存测试使用明确标注的合成运行时与合成构建目录；它们只证明校验逻辑，不代表真实模型加载、Vite 构建或浏览器验收。

完整命令、标准输出与退出码见 [实测日志](logs/takeover-20261104.txt)。环境为 macOS、Node 24.13.0、TypeScript 5.8.3；使用仓库外既有 Python 虚拟环境执行，未修改系统 Python。

| 检查 | 本轮实际结果 |
| --- | --- |
| `python -m pytest reference/tests -q` | 206 项通过，Pydantic 2.13.5 与 2.12.5 分别执行 |
| `generate_contracts.py --check` | 三份契约匹配 |
| `validate_package.py` | 8 项通过；过程中曾因新增文档尚未写入报告断链，文档写入后复跑通过 |
| `node --test browser-spike/*.test.mjs` | 15 项通过 |
| 应用领域与变换测试 | 16 项通过 |
| 生成契约、领域与变换 TypeScript 严格检查 | 通过；不包含 Vue 与 Three.js 场景代码 |
| 同源资源暂存 | 通过，10 个 Python 模块、0 条真实资产记录 |
| `node scripts/check_web_core.mjs` | 官方 Pyodide 314.0.6 / Pydantic 2.12.5，控制器集成通过；达标后实际保留 2 项已触发、4 项待核查、5 类未覆盖 |
| npm 依赖安装 | BLOCKED，`registry.npmjs.org` 解析返回 ENOTFOUND；离线缓存缺所需依赖 |
| 应用完整 `typecheck` | BLOCKED，`vue-tsc` 缺失，退出 127 |
| Three.js 合成 GLB 加载器回归 | BLOCKED，`three` 缺失，测试文件未能加载；不计为通过 |
| `npm --prefix apps/web run build` | BLOCKED，资源暂存成功，严格检查因 `vue-tsc` 缺失退出 127；无应用 dist |
| `stage_web_preview.py --verify-dist` | 真实 dist 缺失时正确拒绝，退出 1；合成目录回归通过不等于正式构建 |
| `check_submission.py` | BLOCKED，预期退出 2；真实资产、公开体验及最终材料仍缺 |

本轮没有启动或控制 Chrome。用户已提醒浏览器频繁崩溃，浏览器操作继续暂停；没有诊断崩溃成因，也没有声称代码引起或修复崩溃。T01 的真实同源 Worker、冷/热启动、评估计时和失败恢复为 NOT_RUN。T02 的真实指针交互、视觉模型替换、导出和刷新为 NOT_RUN。

## 交付与接续

启动方式见 [START_HERE](../START_HERE.md)，模型填报步骤见[资产目录](../assets/README.md)。下一步首先在可安装依赖的环境执行应用完整类型检查、所有应用测试和构建；随后安排稳定的真实浏览器完成 T01/T02。模型材料可独立准备，不等待后台平台。

T03 仍需一把真实 Lux3D 椅子和一个柜体的自包含 GLB，以及来源、公开分发权利、摘要和校准证据。收到后填现有 `assets/asset-manifest.json`，人工复核并验证实际场景操作。T04 无目标托管入口，匿名 HTTPS、子路径、刷新、Worker、WASM、MIME 均未验收；部署步骤沿用[实施记录](WEB_PREVIEW_20261104.md#t04-目标托管复验)。没有发布成功声明。

工作区是源码快照，未含可写 `.git`。本地提交使用隔离 Git 元数据，继续原功能分支；原始未跟踪 ZIP 和审查目录不进入提交、不清理。`dist/HomeSafe-AI-v6.1-browser-3d.bundle` 是完整 Git 历史交接包，**不是网页构建目录**；旁有 SHA-256 文件。可将 bundle 克隆到一个新的空路径，查看 `git log -2` 和继续开发，不能覆盖当前工作区。根目录 `package-manifest.json` / `CHECKSUMS.sha256` 只覆盖审核后的源码与记录，不包含 vendor、构建产物或未核准材料。
