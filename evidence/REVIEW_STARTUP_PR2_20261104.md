# PR2 canonical 模型拆分独立审查

日期：2026-11-04。审查者 `/root/review_challenge`；实现者 `/root/challenge`。结论：**ADOPT_PR2_SCOPED_OPTIMIZATION**。代码正确性和预先固定的工程采用标准通过，允许关闭 PR2 模型拆分子项；**冷首次可编辑 3000 ms 门槛仍失败，T07 性能总任务保持 OPEN_NOT_MET**。此结论不授权推送、合并或发布。

精确源码指纹、独立复算和证据摘要见 [审查回执](review-startup-pr2-20261104.json)。配对实验另由 `/root/review_delivery` [独立审计](REVIEW_STARTUP_BENCHMARK_20261104.md)。

## 正确性及准备缺陷

以实际 git 对象 `64e166540495126f618dd65aa8dc88760ed70604` 为原始定义，独立比较全部 46 个类 AST、辅助函数和类型别名，语义均未改变，没有重复类或简化副本。运行时 26 类，资产 6 类，API/契约专用 13 类，聚合 1 类；`TransformInput` 留在运行时，`ChallengeGoal` 仅供契约聚合使用。原有 strict、extra forbid、来源校验、字段默认和顺序随 AST 保留。运行时与离线模块共用相同 Model 和嵌套类，未引入 eager/lazy 兼容聚合入口或 defer_build。三份契约与原始 git 字节逐字节相同。

初审发现准备脚本重跑会遗漏后来手工加入的测试文件。作者先增加模板复制和缺失模板拒绝，再将其纳入 patch 和迁移清单。审查者从原 git 对象独立恢复输入并重跑生成器，全部 11 个路径和候选逐字节相同，含测试文件与 patch 条目。活动实现也与已审候选逐字节相同。对已拆分活动源误用准备脚本时，源摘要守卫实际拒绝执行。此缺陷已修复，无遗留代码阻断。

审查者独立执行 `python -m pytest reference/tests/test_browser_model_split.py -q`，5 项通过；独立执行契约生成检查，3 份一致。完整 native 334、app 36、JS 30、类型/构建/package 通过属于实现者执行的结果，详见[实现记录](STARTUP_PR2_IMPLEMENTATION_20261104.md)，不冒称由本审查者重复执行。

## 实际 Pyodide 与浏览器

审查者分别运行 `scripts/check_runtime_bundle.mjs` 的 baseline/runtime-only 两种模式。每次为新的 Pyodide 314.0.6 解释器、Pydantic 2.12.5，仅在新 FS 路径安装经过逐文件 SHA 校验的 11 模块 ZIP。模块路径均来自该目录；可选资产/API/聚合模块在全部命令前后均未加载。A 的 46 类与 B 的 26 类在首个 RPC 前及全部 RPC 后均 eagerly complete。

全部 10 个现有 RPC、三样例完整 assessment、比较、教程和主挑战、移动/撤销/重置/结束/状态、资料三态、挑战隔离、非法摆放、深 JSON、伪造来源和未知命令均通过。独立回执：[A ZIP 闭包](review-startup-pr2-baseline-closure-20261104.json)、[B ZIP 闭包](review-startup-pr2-candidate-closure-20261104.json)。实际 bundle 摘要从 `ee006f87a81fff99e3447ed7e1aa8438d125332beed617d2694a5f711dfcaa2d` 变为 `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8`。

已审实现者实际隔离 Chromium 154 localhost 的 probe、preview、资料确认、体验、Worker/渲染恢复、trace、iframe 和 transport 结果，功能通过；本轮浏览器由实现者运行，审查者独立执行的是上述真实 Pyodide 闭包。浏览器数据为合成占位场景；专门 private procedural 全套工具本轮 NOT_RUN，experience 内的程序生成模型失败/重试结果独立记录，不能替代真实 Lux3D。

首用测量明确保留 prior_calls：初评之后第一次 challenge_start/move，显式 challenge_end 后第一次 observation_options/edit。独立单对诊断中，A/B challenge_start 为 23.18/32.77 ms，observation_edit 为 18.44/17.99 ms。它验证操作实际执行且未把 schema 构建延期到首用；**单对 Python dispatch+JSON 时间不是多次浏览器首用延迟测试，也不能据此宣称首次操作全面加速或无统计波动**。未发现故意延期加载或首用失败。

## 固定配对与原门禁

A 为原始 64e1665 加已冻结 PR1 观测代码，B 在相同观测代码上仅拆分模型；A 不是未加观测的原始提交。独立配对审查确认浏览器分发唯一业务差异为 ZIP 内 models.py，其余变化为对应派生摘要。固定 AB/BA/AB/BA/AB，共十个完整新 context，实际 core/hash/版本与预注册相符，所有样本真实编辑成功；各对初始和编辑后摘要一致。

| 对 | A 首次可编辑 ms | B 首次可编辑 ms | 节省 ms |
|---|---:|---:|---:|
| 1 | 4163.5 | 3660.3 | 503.2 |
| 2 | 4125.8 | 3667.5 | 458.3 |
| 3 | 3983.9 | 3649.5 | 334.4 |
| 4 | 4144.9 | 3877.9 | 267.0 |
| 5 | 3952.4 | 3690.6 | 261.8 |

审查者从[原始配对结果](startup-pr2-paired-comparison-20261104.json)独立复算：5/5 改善，配对节省中位数 334.4 ms，通过至少 4/5 改善且中位数 >=100 ms 的工程采用标准。A/B p95 为 4163.5/3877.9 ms。不能把全部 334.4 ms 归因于 schema：同批 trace 的 canonical_import 配对节省中位数约 102.2 ms，load_pyodide 也存在约 191.6 ms 的配对差异；这些阶段值不相加构造虚假总收益。小样本工程采用不代表总体统计显著性。

随后原 `enforce`、`trace required` 完整测量真实退出码为 **1**，[原始门禁记录](startup-pr2-enforce-performance-20261104.json)已原样归档。冷样本为 **3671.4、3858.5、3522.9、3543.6、3838.5 ms**，p95 **3858.5 ms**，未达到 3000 ms；冷规则 p95 满足 12000 ms；30 次热评估 p95 **12.5 ms**，满足 150 ms。审查者重算 nearest-rank p95 并核对十次冷/暖样本真实编辑后的摘要变化，门槛未放宽，失败未隐藏。

## 保留边界

允许保留此低风险、正确性通过且实测达到预定采用信号的拆分。3 秒目标仍未完成，不能把 PR2 采用写成 T07 完成。真实模型、公网、其他网络、Edge/Safari/手机和真人试玩均不由本审查证明。没有重跑挑选更快结果，没有改写实现、推送或发布。
