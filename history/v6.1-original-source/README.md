# 安心屋 HomeSafe AI · V6.1
**浏览器优先的3D居家空间改造演练。** 面向成年照护者，关注学步儿童和老人空间需求差异。
此版完整替代V6：修官方Pyodide lock兼容、Worker初始化恢复、JSON深度错误、挑战剩余条件、规则来源记录与提交字段策略。

从 [START_HERE.md](START_HERE.md) 开始；[修订说明](REVIEW_V6_1.md)；[执行约束](AGENTS.md)；[架构](docs/ADR-0002-browser-first-competition.md)。
完整包含参考代码、契约、诊断源码、实施计划、Lux3D制作流程和提交模板。
**不包含完整Three.js应用、真实家具GLB、Pyodide运行时二进制、字体或已上线网站。**

## 主交付
优先在线可交互Demo。项目同时制作真实运行视频，但官方Demo主字段可能二选一；视频放报告/社媒/允许的补充位置。
Lux3D制作核心家具，同一Python内核运行在Module Worker的Pyodide中，不做生产后台。
挑战达标只意味着本关布局目标完成，必须保留剩余已触发、待核查和未覆盖信息。

## 验证与证据
[本轮验证](evidence/BUILD_VALIDATION.md) 与 [用户V6本地验证](evidence/external-verification-20261103.json)分开记录。
官方条款已按用户本地JS复核纳入执行，并注明核验者与原件是否在包内；不将未重抓的内容冒称本轮亲验。
新版本重新生成浏览器核心ZIP、契约检查与逐文件CHECKSUMS.sha256。整个ZIP的校验文件在下载页面单独提供。

历史资料只用于追溯，不覆盖当前任务和提交策略。本包未触碰远仓或收费接口。
