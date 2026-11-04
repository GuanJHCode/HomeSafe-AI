# 接手记录

日期：2026-11-04。活动方案仍为 V6.1 浏览器优先。远端 master 为 `2f562a3d0c6cae7aedbe2ea13a469a98a24ee57f`；开发在 `codex/v6.1-browser-3d`，未合并或改写 master。

最近通过完整 CI 的代码提交为 `4bb18cda5274267d4a9912e417e29f89287d12e6`，对应本地源码提交 `f858d0a`，Git 文件树相同。由于本机终端不能解析 GitHub/npm，使用获准的 GitHub 连接器上传；本地快照用隔离 Git 元数据保留提交，并提供 Git bundle。详细失败、修复与验收链见 [CI 接续记录](CI_CONTINUATION_20261104.md)。

| 任务 | 实际完成范围 | 待办 |
| --- | --- | --- |
| T01 | 官方 Pyodide 314.0.6 保持原样；真实 Linux Chrome 下同源初始化、三样例、挑战、撤销重置、剩余事项、Worker 重建和 MIME/子路径检查通过 | 目标公网托管上的匿名 HTTPS、iframe、刷新与性能复验 |
| T02 | DONE：占位开发预览的第一条真实 3D 交互闭环通过；严格类型检查、完整构建、19 项应用测试、真实鼠标拖动/回弹、双角色、冲突、历史、挑战、JSON、打印 PDF、刷新及恢复通过 | 接入真实模型后做 T03 验收；上线后做 T04 复验 |
| T03 | 审核清单、对象绑定、GLB 校验与替换代码已完成；合成 GLB 回归通过 | BLOCKED：真实 Lux3D 椅子和柜体均未提供；不能将测试夹具计为真实资产 |
| T04 | 已生成可部署的完整开发预览构建目录、分发清单和校验文件 | BLOCKED：没有获准的目标托管入口；未公开上线 |

验证：[成功 CI 41769312093](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41769312093)。Python 209 项、探针 JS 15 项、应用 19 项通过；Vue/TypeScript 严格检查、Vite 构建与 22 个分发文件校验通过。真实 Chrome 156.0.8078.47 中应用冷启动 3216 ms、热刷新 2655 ms。数值只代表该 Linux CI localhost 环境；无公网性能承诺。用户 Mac 的 Chrome 未启动、未控制。

构建包：[development-preview-4bb18cd](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41769312093/artifacts/13294017524)。ZIP SHA-256：`77584d781bf3f2339e5b206a9b82df8dd7d14b8d305cf6d3f171fbc91079852c`。该 artifact 保留到 2026-11-18；下载后保留本地副本。包内 `apps/web/dist/` 为静态预览，`ci-evidence/` 包含实测 JSON、截图和打印 PDF。它不是公网网站。下载与文件清单元数据见 [artifact 记录](ci-artifact-4bb18cd.json)。

源码启动见 [START_HERE](../START_HERE.md)，使用已提交的真实 npm lock 执行 `npm ci`。手动导入模型见[资产目录](../assets/README.md)。官方 Lux3D 网页生成并下载 GLB 是主路径，当前不需要官方收费 API/SDK；没有发生生成、扣费或真实家庭素材上传。

下一步：取得真实椅子和柜体 GLB、生成及来源记录、公开分发权利、原件/优化件摘要、人工校准记录，接入现有 manifest 后验证场景操作。另在明确的静态托管入口发布经校验的开发预览，验证匿名 HTTPS 与实际交互。发布前补齐运行时及依赖的许可证通知审核。提交门禁仍为 BLOCKED/退出码 2，不伪造正式材料或赛事回执。

原有 ZIP、SHA 文件和 `claude-verification-20261103/` 未覆盖、未清理、未纳入源码发布。历史验证记录保留；当前机器状态见 [task-status.json](task-status.json)，部署状态见[部署检查表](deployment-checklist.json)。

本轮新增 T04 匿名资源核验工具，独立 agent 审查及两项 URL 反例修复已通过；CI 完成前该子任务不关闭。详情见 [核验工具记录](DEPLOYMENT_PROBE_20261104.md)，使用方式见 START_HERE。后续功能同样必须独立审查后才关闭。
