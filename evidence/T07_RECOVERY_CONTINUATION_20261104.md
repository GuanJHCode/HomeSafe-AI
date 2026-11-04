# T07：渲染失败恢复与终止 Worker 处理

日期：2026-11-04 UTC。基于 `f6245e1` 的独立续作工作树 `/workspace/HomeSafe-AI-continuation`，未修改原工作树。

## 先核对已有行为

原实现的自由布置 Worker 重试使用 `workspace.snapshot` 重新评估，保留接受的布局和历史；并非必然回到初始布局。挑战重试明确启动该关初始状态，界面也说明会重开。此次保留这两种语义，不重写已正确的逻辑，补实际浏览器回归。

## 实际缺口与修复

1. 渲染器只捕获初次构造错误；后续 WebGL context lost 没有产品错误提示或重建入口。现在监听实际 context lost，停止绘制和拖动，保留业务布局、检查结果及家具按钮操作。同步绘制异常也进入相同失败通道。用户点击“重试 3D 显示”重新创建渲染器并恢复当前场景、选择、观察视角和高亮；旧实例释放资源及事件监听，不重置规则或历史。
2. `BrowserRuleClient` 在空闲时收到 Worker error，只拒绝当时已有请求，之后还会向失败的 Worker 发送请求并等到 45 秒超时。现在保留终止错误，后续请求立即拒绝，不发送或重放操作；仍通过用户明确重试创建新 Worker。

上下文失效时，之前接受的同一布局评估仍可保留；新操作必须成功获得新评估才能被接受。渲染失败不改变规则、成员能力或模型校准。

## 保留的失败反例

- [旧 Worker 行为](logs/recovery-worker-counterexample-20261104.txt)：空闲 Worker error 后新请求得到 timeout，而不是立即失败。
- [旧构建真实浏览器反例](logs/recovery-context-counterexample-20261104.txt)：实际 WebGL2 context 经 `WEBGL_lose_context` 失效后，等待错误提示 3 秒超时；页面继续显示原检查而没有 3D 故障说明。

## 实际验证

- 定向 Worker 6 项 PASS，[日志](logs/recovery-worker-regression-20261104.txt)。该阶段全部 probe 16 项、应用 30 项及严格类型检查通过；其他功能并行增加测试时以最终回归总数为准。
- 开发服务及新构建子路径均运行 `scripts/check_web_recovery.mjs`。最终分发入口 `http://127.0.0.1:4175/preview/`，Chrome 154.0.8037.57、隔离 Linux，2026-11-04T08:49:21Z PASS，见[浏览器回执](recovery-continuation-20261104.json)。
- 实际覆盖：WebGL context lost 提示；按钮继续修改且获得新评估；重建画面保留 hash、选择、视角及撤销重做历史；空闲 Worker error 后新操作立即失败且不发送；失败提案不被接受或重放；自由布置重试保留合法布局/历史；挑战重试从初始布局及零计数开始。
- 另注入初始 `getContext` 返回 null，验证首次没有可用 3D 时仍可按钮操作；解除故障后显式重试创建可用渲染器，保持输入 hash。
- 旧体验回归 `check_web_experience.mjs` 在同一新构建 PASS（08:48:19Z）；包含父 agent 的初始化并行加载改动后，取消、迟到响应和重试仍通过。

Worker 故障通过真实 Worker terminate 加测试发出的终止 error 事件注入，不冒充自然发生的浏览器崩溃。WebGL 使用真实上下文的标准失效扩展；初始错误用测试替换 getContext 注入。注入仅存在于测试脚本，不加入产品代码。

## 范围限制

真实 Lux3D 资产、公开托管、其他网络、Edge/Safari 设备：NOT_RUN。此处是隔离 Chromium 的故障恢复证据，不是上述外部验收通过。

独立 agent `/root/review_ux` 已独立阅读实现、运行定向测试及实际浏览器脚本，结论 PASS；见[独立审查](REVIEW_RECOVERY_CONTINUATION_20261104.md)及其逐文件摘要和回执。本结论仅覆盖上述恢复子项，不关闭 T07 的真实资产、公网和跨设备验收。
