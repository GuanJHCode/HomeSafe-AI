# T07 CI 下载完成协议独立审查（2026-11-05 UTC）

**结论：PASS_INDEPENDENT，限本次下载等待与失败留证修复。** 审查者 `sol_independent_review` 独立检查了共享 helper、Node/真实 Chromium 反例、observations/preview/experience 三脚本接入和 CI 新检查。未改实现、未提交或推送。基线为 `394eb04e9bbaf7555a507cbc4c1fe28caa62a6a9`，分支为 `codex/download-completion-20261105`。本结论不表示完整产品或 3 秒性能目标通过。

## 独立发现与修复复审

1. 原脚本只见到 `.json` 文件名就解析；[原 CI 记录](ci-download-fix/original-ci.json)显示第 4 次报告下载发生 `Unexpected end of JSON input`，原失败字节没有保留。因此“临时空文件竞态”是高置信定位，不是该次失败的绝对证明。修复在点击前订阅下载事件，核对主 frame 与精确建议文件名，依 GUID 等到 `completed` 后读取 GUID 文件。连续同名、旧空建议文件、取消、开始/完成/点击超时、空或损坏 JSON、重复终态、并发捕获和迟到事件均有明确处理。已完成但内容错误的下载可继续捕获；未完成失败要求新页面/CDP。
2. 独立的慢速 HTTP attachment 反例发现失败留证顺序缺陷：[红灯](ci-download-fix/red-partial-close.log)中，关闭 Chromium 前 `GUID.crdownload` 含 `{"partial":`，关闭后目录为空。修复在关闭/分离浏览器前将原始文件与 `download-events.jsonl` 复制到独立目录。最终[真实浏览器小回归](ci-download-fix/download-protocol-final.json)验证部分字节在关闭后存活。
3. 第二页面的 `Browser.setDownloadBehavior` 会覆盖同一浏览器的下载目录。[受控前台反例](ci-download-fix/red-browser-global-controlled.log)显示：第一页 CDP 收到 `begin/completed`，但 GUID 文件只落在第二目录。反例依次在两个页面 CDP 上设置 `allowAndName` 到不同目录，调用 `page1.bringToFront()`，再点击第一页的 Blob JSON 导出；独立临时脚本命令为 `node /tmp/homesafe-review-browser-global.mjs`。初次[双页记录](ci-download-fix/red-two-pages.log)没有控制前后台页，`start timed out` 受后台下载行为混杂，**不用于证明事件改投第二 session**。最终 helper 以显式 `browser` 身份和 WeakMap 在 CDP 设置前拒绝第二 harness；setup 失败回滚、`close()` 幂等释放。独立[修后双页复测](ci-download-fix/green-two-pages-independent.log)确认第二 harness 在任何 CDP send 前被拒，前台第一页仍按 GUID 成功下载（临时脚本命令 `node /tmp/homesafe-review-two-pages-fixed.mjs`）。
4. 独立故意令 Python 快照重算失败：`CI=1 HOMESAFE_PYTHON=/bin/false HOMESAFE_EVIDENCE_DIR=/tmp/homesafe-semantic-review-4x2ariys node scripts/check_web_preview.mjs http://127.0.0.1:4173/preview/ /usr/bin/chromium /workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js` 按预期退出 1。浏览器关闭后仍保留 1 个 GUID 原始场景快照，**29,870 字节**，SHA-256 `cebbff62943322eabcda3eb1053f957260fd1e3a5a070a05428576509e157fed`；事件记录含 `completed_and_parsed`。[原件、事件及错误日志](ci-download-fix/semantic-failure-review/summary.json)已持久归档在 `evidence/ci-download-fix`。这验证了内容语义检查失败也留住已下载原件。

## 最终冻结版核验

- 独立执行 `node --test scripts/web_download.test.mjs`：**18/18 PASS**；`git diff --check` 与五个改动脚本的 `node --check` 通过。主会话同一冻结代码运行全 JS **48/48 PASS**、契约/类型检查通过，见 [final-js.log](ci-download-fix/final-js.log)。小型浏览器复测命令：`CI=1 node scripts/check_web_download_browser.mjs /usr/bin/chromium /workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js ci-evidence/download-fix/download-protocol-final`。
- 最终 Chromium 154 本地回执：`observations-final`、`web-preview-final`、`experience-final` 均 PASS；observations 最终版连续 **3 轮 PASS**，见 [最终观察](ci-download-fix/observations-final.json)、[第 2 轮](ci-download-fix/observations-repeat-2.json)、[第 3 轮](ci-download-fix/observations-repeat-3.json)、[预览](ci-download-fix/web-preview-final.json)、[体验](ci-download-fix/experience-final.json)。根会话也完成构建、真实 Pyodide、恢复、启动 trace、iframe 等回归；产品 `apps/`、`browser-spike/`、`reference/`、`contracts/`、`examples/`、`assets/` 相对基线无代码差异。
- CI 增加一次真实 Chromium 下载协议检查，仍顺序执行原浏览器功能与严格性能步骤。报告 hash、资料三态、撤销、场景快照 Python 原生重算断言仍在三个脚本中。远端修复版 CI **NOT_RUN_NO_PUSH**。

冻结源文件 SHA-256（已与 [冻结清单](ci-download-fix/frozen-source-hashes.json)逐一重算匹配）：

| 文件 | SHA-256 |
| --- | --- |
| `scripts/web_download.mjs` | `9834d5ceb09baef46ac04c7dacbc4f203ef18f5c024cda787226e0a3308de179` |
| `scripts/web_download.test.mjs` | `b590907626334a07471f3b1dccdbd09b879d06d7d1cd4eadaa3d88075b480f8e` |
| `scripts/check_web_download_browser.mjs` | `d76e20ffde764e5d06067372622e66b112649cae6711ce71eb4989c18e277c72` |
| `scripts/check_web_observations.mjs` | `3dd01f4bbce8b73332518329d26b903a093d77d4c7f910fe5692dbead648429d` |
| `scripts/check_web_preview.mjs` | `5620116f157723ddc5355c51bb1c7d5dcf719fb96c0e60072bd42e6431443580` |
| `scripts/check_web_experience.mjs` | `38a32a5be758ea1a9026e88bbfdc76a67bba0a9ad5eb3563c5b29a1fdb7d8c37` |
| `.github/workflows/reference-checks.yml` | `3ddeb7b4244b3d9e0f22760d7736995bd532eeb5724b575c292e09cc50f4367b` |

## 边界与未完成项

本地严格性能 `enforce required` 仍退出 **1**：[5 组冷样本、30 次热评估](ci-download-fix/performance.json)的首次可编辑 p95 为 **4812.2 ms**，超过 3000 ms；冷规则 p95 **4812.1 ms** 与热评估 p95 **16.0 ms** 分别符合 12000/150 ms 门槛。下载修复没有修改预算或业务分发文件，不能把不同环境的旧值与本次值直接相减归因。远端 Chrome 156 CI、正式 HTTPS、公网/其他网络、Edge/Safari 和真实 Lux3D 资产验收均未在本次独立审查中运行；这些限制不影响本次下载协议的 scoped PASS。
