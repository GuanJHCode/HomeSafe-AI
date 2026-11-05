# T07 CI 下载等待修复（2026-11-05 UTC）

任务：`T07-ci-download-completion`。实现由 `sol_download_fix`（gpt-6-sol / max）承担；独立审查由另一个 `sol_independent_review`（gpt-6-sol / max）承担。astra max 的定位已经通过父线程交接；本轮只修验收脚本的下载协议，不修改业务撤销、序列化、规则或性能预算。

## 基线与原 CI

隔离检出基线 `394eb04e9bbaf7555a507cbc4c1fe28caa62a6a9`，本地分支 `codex/download-completion-20261105`。核实远端功能分支仍是该基线，master 为 `2f562a3d0c6cae7aedbe2ea13a469a98a24ee57f`。原 `/workspace/HomeSafe-AI` 文档工作树 `3ed4e48` 无未提交改动，完整保留。

通过 GitHub 连接器重新读取 [CI 41948477248](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41948477248) / job `126986451585` 的步骤与原始日志。原生、应用、JS、构建等步骤通过；浏览器功能检查在 `check_web_observations.mjs:140` 解析下载文件时失败，调用行为撤销后的第 4 次报告下载（行 70）。错误为 `Unexpected end of JSON input`；严格性能步骤随之 **NOT_RUN / skipped**。结构化记录见 [original-ci.json](ci-download-fix/original-ci.json)。

旧脚本发现 `.json` 文件名即读取。确定性时序反例让空最终文件先出现、完成字节后到，旧逻辑稳定发生同类异常。astra 交接另记真实 Chromium 100 次中 3 次出现空最终文件，原完整脚本 3 轮、带诊断脚本 8 轮未自然复现；这些数字是诊断交接证据，不冒充本实现会话的新测量。**原 CI 失败文件未保留，因此原来那一次的原因仍为高置信推断，不能称绝对证明。**

上一版候选提交 `2ffb193` 的 Library 包及 astra 附件使用官方技能 helper 下载失败，未取得字节，未绕过访问限制；本轮依照诊断独立实现，不声称已比较或复用了该候选。

## 修复范围

- 共享 `scripts/web_download.mjs` 使用 `Browser.downloadWillBegin` / `Browser.downloadProgress`，点击前订阅，核对当前页面 frame 和预期报告/快照文件名，按 GUID 关联开始与完成。
- `allowAndName` 将实际文件绑定 GUID，完成后读取与解析；同名连续导出不会拾取旧文件。取消、开始/完成/点击超时、损坏或空 JSON 明确失败；不把解析失败当成尚未下载完重试。
- 同一页面不安全的并发 capture 明确拒绝，匹配到多个下载明确失败；同一浏览器只允许一个 harness，第二个 factory 在 CDP 设置前被拒绝，setup 失败回滚、close 幂等释放。不完整触发失败后要求新页面/CDP 重试，防止迟到同名事件误配；已完成且只有内容错误时可以继续。
- observations、preview、experience 保留原有 hash、资料三态、撤销、重复文件名及 Python 快照重算断言。
- 错误时在关闭浏览器前复制原始下载，并保留事件 trace。无输出目录的本地失败也复制到独立临时目录；成功后清理临时下载。
- 新增独立小型真实浏览器检查 `scripts/check_web_download_browser.mjs`，接入 CI 原有功能检查步骤。严格性能步骤及 3000/12000/150 ms 门槛保持原样。

独立审查还真实复现了留证顺序反例：未完成 HTTP attachment 关闭前存在 `GUID.crdownload`，内容为 `{"partial":`；`browser.close()` 后文件消失。已先保存红灯，再修复为关闭前快照复制。部分文件是失败当时的快照，不是完整 JSON 或最终下载成功证明。

## 本地验证与边界

环境 Linux x86_64、Python 3.13.5、Node 24.19.0、Chromium 154.0.8037.57、puppeteer-core 24.15.0、固定官方 Pyodide 314.0.6。原 CI 是 Chrome 156.0.8078.47 / Node 24.22.1；不能将本地结果当成该 CI、其他浏览器或公网验收。

Python **334**、应用 **36**、最终全部 JS **48** 项通过，其中下载专项 Node **18** 项。契约生成及严格类型、前端类型/构建、真实 Pyodide、同源资源传输和真实浏览器探针通过。最终冻结版 observations、preview、experience 均通过，observations 连续 **3 轮**通过；新增真实下载协议检查也通过。恢复、启动 trace 与同源/跨源受控 iframe 检查通过。产品与规则源码自基线测试后未变；详细结果见 [验证回执](ci-download-fix/validation-summary.json)。

严格性能在其他 agent 停止浏览器和批量测试后单独执行 `check_web_performance.mjs ... enforce required`，退出 **1**。5 组冷/热重载、30 次热评估，nearest-rank p95：首次可编辑 **4812.2 ms**（p50 3864.0），冷规则 **4812.1 ms**，热评估 **16.0 ms**。3 秒门槛仍 **OPEN_NOT_MET**；12 秒冷规则与 150 ms 热评估通过。业务与分发文件未修改，不与不同环境的历史数值相减归因，也不把下载修复称为启动优化。

原始本地日志位于 `ci-evidence/download-fix/`，经核对的 JSON/文本回执已归档到 `evidence/ci-download-fix/`。截图和打印文件只用于本地应用回归，不随源码或 Library 恢复包交付。

## 审查与交付状态

**PASS_INDEPENDENT**：独立审查及最终冻结版回归通过，允许关闭本次下载协议修复子任务；见 [独立审查](REVIEW_CI_DOWNLOAD_FIX_20261105.md)。源码导出/校验与恢复包核验由最终交付回执记录。审查还以故意失败的 Python 快照重算验证了语义失败后原件和 trace 留存。受控双页反例证明浏览器全局路径覆盖；未控制后台页的早期 start timeout 不用于证明事件改投其他 session。T07 整体仍 IN_PROGRESS，真实 Lux3D、公开模型权利、正式托管、Edge/Safari/其他网络和原 3 秒目标不在本次关闭范围。

本轮无推送、无强推、无 master 合并、无部署、无真实模型公开分发或收费调用。修复后的远端 CI **NOT_RUN_NO_PUSH**；推送另待授权。本地提交与可恢复包由最终交付回执给出。
