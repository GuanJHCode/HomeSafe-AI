# 开工入口

基线：V6.1 浏览器优先方案；日期：2026-11-03，Asia/Shanghai。

## 先读与先做

1. 阅读[总体方案](docs/v6.1/00-overview.md)、[架构](docs/v6.1/01-architecture.md)和 [AGENTS.md](AGENTS.md)。
2. 恢复 V6.1 参考包：先校验 ZIP 及包内逐文件摘要，在临时目录审查后导入，保留本仓库方案与历史。当前仓库没有该包的源码。
3. 按参考包自己的 START_HERE.md 与 evidence/BUILD_VALIDATION.md 复跑原生测试、契约、JS 与包检查；本仓库此刻不能执行这些命令。
4. 用未手工添加 info.version 的真实 Pyodide 分发验证同源打包；在真实浏览器测试三样例、挑战及初始化失败后重建 Worker。
5. 创建 apps/web，完成拖动→合法布局→双角色重算→撤销→清单；同时准备两件真实 Lux3D 小样。
6. 尽早完成正式托管探针，再扩展场景、美术与挑战；任务和日期见[实施计划](docs/v6.1/05-delivery-plan.md)。

## 当前能做什么

这里可审阅方案和安排任务；没有 reference/、browser-spike/、apps/web/ 或运行时二进制。文档中的这些路径表示参考包结构或待建目录，不是已经存在的仓库入口。

历史文档 docs/01-*.md 至 docs/06-*.md 已标记为历史。不要按旧任务编号、持久化后端或在线生成队列先行开发。

提交格式为 `<type>: <desc>`；任务 ID 写入正文。完成任务后更新状态、证据、实际命令及限制。只有正式提交回执存在时才能标记 SUBMITTED。
