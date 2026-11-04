# 启动剖析与优化阶段记录

日期：2026-11-04。**最终保留范围：PR-1 剖析、PR-2 模型拆分及 CI 改进；PR-3 实验已否决并独立核验撤回。还原后的唯一最终 enforce 仍失败，T07 保持 OPEN_NOT_MET。** 工作树 `/workspace/HomeSafe-AI-startup`，本地分支 `codex/startup-profile-20261104`，基线 `64e166540495126f618dd65aa8dc88760ed70604`。本地提交见交付回执；本轮无远端写入、合并或部署，新代码远端 CI 为 NOT_RUN。原始与 continuation 工作树保留。

## 当前结论与版本范围

| 验证对象 | 功能 / 正确性 | 首次可编辑结果 | 结论 |
| --- | --- | --- | --- |
| 固定远端 `64e1665`，CI 41807603537，Chrome 156 | PASS_CI_LOCALHOST | p95 3386 ms，FAIL >3000 | 既有远端结果，不能替本轮改动背书 |
| 本地 PR-1 traced baseline，Chrome 154 | 独立 PASS | 原完整 profile p95 4128.5 ms，FAIL | 剖析与开销披露完成，不是提速承诺 |
| 本地 PR-2 模型拆分，Chrome 154 | 独立 ADOPT_PR2_SCOPED_OPTIMIZATION | 配对候选 p95 3877.9 ms；随后完整 enforce p95 3858.5 ms，均 FAIL | 保留有收益的拆分；T07 仍 OPEN_NOT_MET |
| PR-3 轻入口候选 | 候选功能与独立生命周期检查通过 | 3/5 改善，中位 43.9 ms；A/B p95 3946.1/4311.6 ms | DISCARD；精确撤回通过，候选功能不算最终能力 |
| 最终还原 PR-2 分发，Chrome 154 | 28 文件逐字节还原独立 PASS | 唯一最终 enforce p95 **4086.1 ms**，hot p95 **12.6 ms** | 冷首次可编辑 FAIL；冷规则/热评估 PASS |
| 本阶段新远端 CI / 预先建议的三次稳定性 CI | NOT_RUN | NOT_RUN | 尚无本轮推送授权，不以旧 CI 或本地结果代替 |

不同浏览器版本和机器上的绝对时间不能相减作为代码收益。原门槛保持冷首次可编辑 p95 <=3000 ms、冷规则 <=12000 ms、热评估 p95 <=150 ms；可编辑仍要求实际接受的报告、空闲状态、有效画布和可用移动按钮，每样本真实移动并验证接受的 input_hash 改变。没有使用画布先显示、提前启用按钮、放宽预算或挑选重跑结果替代验收。

## 已完成且独立审查通过的范围

**PR-0 状态与证据同步**：HANDOFF 顶部与机器状态明确区分远端固定源码和本地阶段；历史“未推送”记录原样保留。完整 CI 性能 JSON 从原始 job log 提取并保持字节，旧整体失败没有改成通过。[CI 记录](CI_PUSH_64e1665_20261104.md)、[独立审查](REVIEW_STARTUP_PR0_20261104.md)。

**PR-1 启动剖析**：在 Window/Worker 同代 trace 中记录时间原点与相对时间、初始化排队/处理/回复、运行时/依赖、bundle 下载/摘要/等待/解包、canonical import、首评及 UI 阶段。资源与长任务只保留受限诊断数据。跨线程以 timeOrigin+now 对齐，重叠阶段按区间并集处理，未测残差不归因为编译。失败、取消、重试与缓存初始化经过反例修复，诊断故障不改变业务回复；required 模式拒绝缺少生命周期或阶段证据的 trace。[实现](STARTUP_PR1_IMPLEMENTATION_20261104.md)、[独立最终审查](REVIEW_STARTUP_PR1_20261104.md)。

独立审查的固定 overhead 实验使用裸 `64e1665` 对比相同 canonical 内核的 PR-1 trace 版本，AB/BA/AB/BA/AB，十次实际编辑全部通过。观测 B−A 中位数 −278.9 ms，范围 −850.9 至 +217.5 ms；这是小样本开销披露，**不能推断 tracing 提速、真实开销为零或未来开销上界**。该模式不应用优化采纳门槛。[原始与独立实验审计](REVIEW_STARTUP_BENCHMARK_20261104.md)。

**PR-2 canonical 模型拆分**：原 46 类按运行时、资产、API 和契约聚合职责拆分；浏览器仅初始化 26 个运行时类。保留同一 Python 权威定义、strict/extra forbid、来源/布局/未知语义，未采用 defer_build、惰性兼容聚合或 TS 规则副本。三份契约字节不变；源码 bundle 摘要真实变为 `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8`。独立原生/契约检查与实际新 Pyodide 的 11 模块 ZIP 闭包验证通过，全部 10 个 RPC、业务反例和模块排除检查通过。阶段完整检查为 native 334、app 36、JS 30、类型/构建/package 通过；这些是 PR-2 阶段记录，不冒称后续 PR-3 的最终全量结果。[实现](STARTUP_PR2_IMPLEMENTATION_20261104.md)、[独立采纳审查](REVIEW_STARTUP_PR2_20261104.md)。

PR-2 固定配对的 A 是 **64e1665 + PR-1 trace**，不是裸 64e1665；B 仅改变 canonical 拆分，其他 24 个分发文件逐字节一致。五对全部改善，节省分别 503.2、458.3、334.4、267.0、261.8 ms，中位数 334.4 ms，通过预先固定的至少 4/5 且中位数 >=100 ms 工程采用信号。所有十次实际移动和对内初始/编辑后哈希一致。不能把全部节省归因于 schema，或将其解释为总体统计显著性。

随后完整 `enforce required` 真实退出 1：冷样本 3671.4、3858.5、3522.9、3543.6、3838.5 ms，p95 3858.5 ms；冷规则通过 12000 ms，热评估 30 样本 p95 12.5 ms 通过 150 ms。保留全部样本和失败，[完整原始回执](startup-pr2-enforce-performance-20261104.json)。采纳改动不等于完成 3 秒目标。

**PR-4 工作流步骤拆分**：同一构建与服务先跑功能、再跑严格性能；功能失败后性能 NOT_RUN；准备失败及后续失败均清理服务；始终生成分范围 summary 和归档。八项实际 Bash 合成回归及独立审查通过。后续 PR-1 增加 trace 功能命令和 `enforce required` 已纳入 PR-1 最终审查。这里只关闭步骤拆分子项，**完整稳定性回归、三次新远端 CI、性能余量与冻结仍未完成**。[实现与范围](CI_SCOPES_STARTUP_20261104.md)、[独立步骤拆分审查](REVIEW_STARTUP_PR4_20261104.md)。

## PR-3 实验完成并否决；还原与最终复核

[只读设计](STARTUP_PR3_READONLY_DESIGN_20261104.md)之后，候选通过独立预审才进入活动树作验证。独立 pagehide 接管缺口、实际 init failure 的 busy 清理缺陷、失败 App chunk 的同页重试缺陷均保留反例并修复。作者 experience9/recovery9/trace3/bootstrap3 和独立 bootstrap3/trace3/native BFCache 检查通过。这些仅证明 **DISCARDED 候选** 的功能，不是最终保留代码的新能力。

固定五对实际节省为 −381.9、125.3、−70.5、43.9、279.8 ms，仅 3/5 改善，中位数 43.9 ms，未达至少 4/5 且中位数 >=100 ms 的预注册标准；A/B p95 为 3946.1/4311.6 ms。十次移动与对内初始/编辑后哈希均通过。按规则 DISCARD，不能仅因为 Worker 更早创建而保留。候选完整 hot/enforce 为 NOT_RUN，不借用 PR-2 热值。原始注册、所有样本、最终补丁与功能/反例证据由相应作者及独立审查归档。[实验审计](REVIEW_STARTUP_BENCHMARK_20261104.md)、[候选实现历史](STARTUP_PR3_IMPLEMENTATION_20261104.md)。

作者已精确恢复冻结 PR-2，独立复核确认最终 28 个分发文件逐字节一致；候选七文件源码/补丁、功能测试和真实 BFCache 结果完整保存于 [DISCARDED 历史归档](startup-pr3-discarded/README.md)，未遗留为最终产品入口。还原后的 app36、类型/构建、CI scope8 通过，原始 [作者核验](startup-pr3-rollback-verification-20261104.json) 与 [独立撤回核验](review-startup-pr3-rollback-20261104.json) 分开保留。

还原后的最终非浏览器复跑也已完成：native **334**（内含 CI 工作流 **8** 项，不重复累计）、app **36**、JS **30**、三份契约检查与包检查 **8** 项均 PASS；命令、退出码和 stdout/stderr 摘要见 [最终检查汇总](startup-final-checks/summary.json)。本次复跑没有启动浏览器、重建或运行性能，类型/构建与分发同一性沿用上述还原回执。

父任务预先声明且仅运行一次最终 `enforce required`，完成于 `2026-11-04T11:05:54.485Z`，退出 **1**。五个冷样本 **3913.5、4086.1、3784.6、3843.3、4049.8 ms**；p50 **3913.5 ms**、p95 **4086.1 ms**，仍 FAIL >3000。冷规则 p95 **4086.1 ms** 通过 12000，30 次热评估（另有三次预热）p95 **12.6 ms** 通过 150，十次冷/缓存实际编辑通过。[预注册](startup-benchmark/final-retained-enforce-registration.json)、[完整原始结果](startup-benchmark/final-retained-enforce-performance.json)与[独立离线审计](startup-benchmark/independent-final-retained-enforce-review.json)均已归档；独立审计 PASS、性能预算 FAIL，两者不混淆。最终数字不替换或删除先前 PR-2 的 3858.5/12.5 阶段回执，也不与该回执相减推导新收益；PR-2 的采纳收益仍只来自固定五对中位 **334.4 ms**。整体决策与同样本诊断见 [ADR-0003](../docs/ADR-0003-startup-profiling-and-bounded-optimization.md)：保留 PR-1/PR-2/CI 改进，不追加未授权的运行时/后台/阈值变更。

## 输入材料、产物归档与外部阻断

四份用户附件经 Library 全文读取，全部 has_more=false；UTF-8 正文恢复一个末尾 LF 后与提供的三个 SHA-256 和字节数完全一致，父任务和独立 agent 均核验通过。materialize 首次和一次有界重试均为 generic `download failed`；未报告 HTTP 状态。这不妨碍已验证文本方案的实施，也不能写成附件未收到。[附件回执](startup-adjustment-attachment-receipt-20261104.json)。

固定 CI artifact `13310537586` 上传元数据已确认；官方 connector 返回可复用文件 ID 后，本地 materialize 失败，ZIP 字节 NOT_OBTAINED、摘要及内容验读 NOT_RUN。没有记录 signed URL 或绕过下载。性能 JSON 已从授权原日志提取保存，不冒充完整 artifact 的本地归档。artifact 到期日仍为 2026-11-18。[证据范围](CI_PUSH_64e1665_20261104.md)。

两件真实 Lux3D 原件已交付，历史摘要与 Node 数值检查通过；本执行环境仍缺合法可读字节，原 GLB 下载代理 403 与本次文本/artifact 的 generic 失败是不同记录。真实模型浏览器、主挑战绑定、资源释放及负载性能仍 BLOCKED/NOT_RUN；公开再分发权利未确认，公开资产清单保持空。未发生新收费生成。

没有获准的正式托管入口/责任人；匿名 HTTPS、目标子路径/刷新/MIME/实际 iframe、另一网络、Edge/Safari 及用户设备验收仍独立未完成。本轮隔离 Chrome 和程序夹具不能关闭 T03/T04/T09，也不能成为正式参赛视频或提交回执。报告/视频工作稿不变，未公开发布、正式提交或创建未来自动任务。
