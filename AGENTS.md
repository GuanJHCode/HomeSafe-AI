# HomeSafe-AI 项目约束

先读 START_HERE.md、docs/v6.1/00-overview.md、docs/v6.1/05-delivery-plan.md。

- 当前活动方案为 V6.1 浏览器优先；旧 docs 根目录文档仅作历史。
- 先完成真实浏览器探针、3D 互动与真实 Lux3D 核心家具；不先建账号、SQLite、持久化 CAS、后台生成队列或多 Agent 调度系统。
- Python 内核是规则唯一来源；类型与契约从 canonical 模型生成，不在 TypeScript 重写权威规则。
- 未知不转 false，资料补充不冒充空间整改；相机高度不等于触及高度，预测尺寸不等于实测。
- 不伪造运行结果、资产来源、收费调用、试玩、上线或赛事回执；没运行就明确记录 NOT_RUN。
- 缺陷保留反例，先失败回归再最小修复；验证范围与改动匹配。
- 提交前检查工作区与远端；不覆盖无关改动，不 force push。用户已授权本轮将方案提交到 master。
- 提交格式 `<type>: <desc>`，任务 ID 写正文；更新 evidence/task-status.json 与 evidence/HANDOFF.md。
- 不提交密钥、私人照片、原始账户截图或未核准资产；新增收费调用须得到明确授权并核对预算。
- 原始参考包尚未导入，不能把本仓库描述为可运行应用。
