# HomeSafe AI 实施约束 · V5

## 状态与权威来源

本包为设计与参考实现。应用HTTP接口、数据库和浏览器仍待实现。先读 START_HERE.md。
权威顺序：用户新指令 → 本文件 → docs → canonical models.py → 生成契约；发现不一致停止相关变更并修正契约/文档，不能无声采用旧版本。
`history/` 是历史证据；旧代码不在活动目录。不要从历史归档恢复V1规则。

## 产品边界

一客厅、成年照护者、学步儿童与老人。Lux3D实质生成关键交互家具，不伪造来源。不存在“必须实时API”“至少六个模型”的官方硬门槛。
三态结果、覆盖状态、模拟与现实自报分别建模。未知不当作否；未执行不当作未触发；删除对象不当作现实已整改。
首版为属性核查、临近关系和指定通道占用，不是儿童行为预测、医疗评估、全屋安全认证。

## 工程

- Python后端；Vue/TypeScript/Three.js前端。模块化单体。P0不启动worker，不需要AHOLO_API_KEY。
- 不引入Rust第二后端、LLM、World、LuxReal、Redis、Kubernetes，除非需求变化与实测证明必要并写ADR。
- API→应用服务→领域；存储/SDK经ports注入；领域不做网络/DB I/O。
- `reference/homesafe_core/models.py` 为当前契约源；迁入正式应用后只保留一份源，并更新生成器导入路径，禁止两份模型分叉。
- `python scripts/generate_contracts.py` 生成契约，`--check` 用于CI；不要手改生成JSON/TS。
- 先复用参考规则，再扩展；浏览器不另写权威规则。放置/高度验证在正式计算之前。
- ObjectPatch仅允许位置/yaw；尺寸、traits、层级和观察值走单独受控编辑，改变比较基础要明确重新建基线。
- 每次拖动结束一次提交，CAS revision单调递增；迟到结果不得覆盖新场景。
- 真实资产GLB校准持久化，加载和计算实例使用同一已确认尺寸，禁止重复缩放。
- SDK仅P1按明确批准调用；传输超时视为unknown，禁止自动再次创建收费任务。
- 公开导出只采用审核过的精确路径和哈希。新证据默认不公开；密钥不入前端、不入日志和Git。
- Git一次一任务、新分支、小提交；不force、不reset他人改动、不自动merge主分支。

## 执行与协作

先验基线→T00–T02第一条功能流程→真实GLB→存储/解释/报告→发布验收。不要为再次总结计划拖延开发。
多agent分别用branch/worktree；一个任务同时只有一个owner；契约文件由单一owner修改并先合并，其他任务随后rebase。
完成更新 evidence/task-status.json，输出修改文件/方法、实测命令和pass/fail、commit、剩余阻断。
测试没跑写NOT_RUN；API没调用写NOT_RUN；不以“应当通过”替代证据。
