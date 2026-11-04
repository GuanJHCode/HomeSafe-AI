# 性能与 iframe 工具独立审查

日期：2026-11-04 UTC。实现/执行：主 agent；独立审查：`/root/review_ux`。审查对象为 `scripts/check_web_performance.mjs`、`scripts/check_web_embedding.mjs` 及其实际运行回执；基础提交为 `57faf384d64e9770407b28086fdfeb5b193a6d6f`。

结论：PASS，仅关闭本轮本地测量/受控 iframe 探针子项，不关闭公网部署、真实模型性能或跨设备验收。此复审独立读取代码和原始记录，重算统计结果；没有把主 agent 运行冒充审查者重复浏览器实测。

## 性能

[实际回执](browser-performance-20261104.json)于 `2026-11-04T07:01:06.302Z` 产生；主 agent 记录该轮没有并行浏览器负载。Linux x64 / AMD EPYC 9V74 / 分配 5 逻辑 CPU / Chromium 154.0.8037.57，localhost、不限速。SwiftShader 是启动请求，字段已改为 `requested_renderer`，未伪称观测到 GPU 身份。

独立检查了 5 组新 context 冷加载及其缓存重载、3 次预热后 30 次真实 Worker 评估，逐一验证样本有限且非负、输入 hash 一致，并从原始样本重算 min/max/p50/p95 与所有目标布尔值：PASS。使用 nearest-rank；5 个样本时 p95 即最大值，不能据此推断用户设备总体分布。

| 度量 | 样本数 | p95 |
| --- | --- | --- |
| 场景与相机控件可观察 | 5 | 507.3 ms |
| 冷加载至当前规则结果可用 | 5 | 3725.3 ms |
| 同 context 缓存重载至规则结果可用 | 5 | 3675.6 ms |
| 热评估内核 | 30 | 10.3 ms |
| 热评估含 Worker 往返 | 30 | 11.1 ms |

首项是可观察界面/相机控件，不是家具编辑已经就绪；规则可用另测。真实模型加载/渲染/释放、匿名 HTTPS、另一网络、Edge/Safari 均为 NOT_RUN。只重复固定合成场景的热评估，不代表所有输入规模。首版测量脚本误拒绝 warm reload 的合法 HTTP 304，修正为仅暖重载允许 304；冷导航仍要求成功响应。

## iframe

[实际回执](embedding-20261104.json)于 `2026-11-04T07:00:12.272Z` 产生；主 agent 确认这是修正后重新运行的记录。两次均通过：同源父页 `http://127.0.0.1:4174`；跨源父页 `http://127.0.0.1:4173`；子页均为 `http://127.0.0.1:4174/preview/`。实际检查了 iframe 加载、真实 Worker/WASM 返回评估、按钮移动后新报告出现。

独立发现并要求修复一项验收假阳性：原判定把可选 `.report .hash` 的文本直接与旧 hash 比较。当评估失败、报告删除且 `aria-busy=false` 时，`undefined !== oldHash` 为 true，会错误通过。审查保留的 JavaScript 反例结果为旧判定 true、修正判定 false。修正后必须同时存在非空新 hash、其与旧 hash 不同、面板不忙且没有错误提示；另增加 iframe context 存在断言。修正代码和重跑回执均已检查。

测试临时替换父页 DOM，iframe 未加 sandbox。它不代表魔搭或其他正式平台的 CSP、X-Frame-Options、sandbox、HTTPS 或访问策略通过。

## 回执完整性

- `browser-performance-20261104.json` SHA-256：`c0f2454dded1a7c8503e7b680394f8a43925719bc02c50f3ea17980da222f859`
- `embedding-20261104.json` SHA-256：`c4bb511f4594e705c302861d8dfe5db8a79a317e90afe72250d7ef2ac74b0b37`

后续性能优化或部署不得直接沿用本轮通过状态；目标入口变化须在该入口重新运行并保留设备、网络和代码版本。
