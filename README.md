# 安心屋 HomeSafe AI

面向成年照护者的三维居家空间改造演练：观察儿童与老人的空间需求，调整家具、解释冲突，并导出仍需现场核查的行动清单。

**当前分支交付 V6.1 实施方案文档，尚未导入参考实现或完成三维应用。** 活动架构为 Vue 3 / TypeScript / Three.js ＋ module Worker / Pyodide 中的单一 Python 规则内核。旧版服务端优先方案只供追溯。

## 阅读入口

从 [START_HERE](START_HERE.md) 了解开工顺序。

| 文档 | 内容 |
| --- | --- |
| [总体方案](docs/v6.1/00-overview.md) | 产品目标、范围、体验闭环、版本决策 |
| [架构与契约](docs/v6.1/01-architecture.md) | 运行拓扑、模块职责、Worker 协议、数据与版本 |
| [规则与交互](docs/v6.1/02-rules-and-interaction.md) | 八条规则、几何、未知、比较与挑战成功条件 |
| [Lux3D 资产工作流](docs/v6.1/03-assets.md) | 小样、校准、来源、发布与可选本地生成 |
| [部署与 V6.1 修订](docs/v6.1/04-deployment.md) | 同源运行时、加载恢复、修复验收与降级 |
| [实施计划](docs/v6.1/05-delivery-plan.md) | T00–T14、依赖、日期与完成标准 |
| [验收与提交](docs/v6.1/06-acceptance.md) | 测试矩阵、发布门禁、赛事材料与维护 |
| [来源与验证记录](docs/v6.1/07-sources.md) | 已读取材料、历史测试、本次检查与缺失项 |

## 当前边界

- 在线样例允许匿名观察、拖动、撤销和重算；无账号、照片上传、公开收费调用。
- 真实 Lux3D 核心家具是后续交付必需项；占位模型只能用于开发。
- 未触发只表示指定条件未触发；未知、已触发及未覆盖项必须保留。
- 参考包的历史测试通过不等于当前仓库可运行，也不证明现实家庭安全有效性。

本次从现有 main 历史创建 master，保留旧文档与原始摘要；后续开发以 docs/v6.1/ 为准。任务状态见 [task-status.json](evidence/task-status.json)，接手事项见 [HANDOFF](evidence/HANDOFF.md)。

