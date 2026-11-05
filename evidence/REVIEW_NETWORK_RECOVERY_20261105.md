# T07 网络中断恢复独立审查（2026-11-05 UTC）

**结论：`T07-network-interruption-recovery` 的受控 localhost 验收脚本 PASS_INDEPENDENT_SCOPED。** 基线提交 `ba21f54ace3218cfa2d695092b735165c923b1b9`，分支 `codex/network-materials-20261105`。本子项未改产品 App、Python 规则、Worker 实现或性能脚本；审查范围为新增的 `scripts/check_web_network_recovery.mjs`、独立 Chromium 154 运行与原始 JSON/快照。脚本 SHA-256 为 `cd6a9326bfcfc3a2b986fbb82bdb9e1643836f2065aa0e042b171ed857a7e08b`。审查时未提交、推送或部署。

## 独立复测与证据

我用隔离 Chromium profile 运行：

```bash
CI=1 HOMESAFE_PYTHON=/workspace/homesafe-test-venv313/bin/python \
  node scripts/check_web_network_recovery.mjs \
  http://127.0.0.1:4173/preview/ /usr/bin/chromium \
  /workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  ci-evidence/network-materials/network-review
```

退出码 0；[独立运行回执](network-materials/network-review/network-recovery.json)与[标准输出](network-materials/network-review-stdout.log)记录八个阶段。测试先在线接受一次编辑，再对页面 CDP session 施加离线条件、关闭缓存，并对精确的 `engine/config.json?network-probe=offline` 发 `cache: 'no-store'` 请求；随后在**实际运行的 module Worker CDP target** 中发同样请求。两个 target 各自记录 `Network.loadingFailed: net::ERR_INTERNET_DISCONNECTED`。这一步发生在 `Fetch.enable` 暂停请求之前，因此不是仅看 `navigator.onLine`，也不是用 HTTP 503/拦截伪装断网；唯一的 nonce URL 和禁缓存排除了该探针命中旧 HTTP 缓存。

已加载 Worker 在受控断网后仍完成本地 Python 编辑、撤销、重做，下载的[行动清单](network-materials/network-review/offline-report.json)和[场景快照](network-materials/network-review/offline-snapshot.json)同为接受摘要 `c3fd856859d086209d2da5ad0b774a54c38455832e31e70db4ea0ed2daa185e4`、布局 v5。脚本验证了离线打印按钮会调用 `window.print`，并以[原生 Python 重算](network-materials/network-review/network-recovery.json)得到 `MATCHES_CURRENT_CORE`。我另外逐对象深比原始报告与快照的 7 组 `property_observations`/scene properties，[独立断言 PASS](network-materials/network-review/independent-data-check.json)：true 2、false 1、unknown/null 45，未知来源未转成 false。

脚本为得到确定性终端错误，**测试注入**一次 Worker terminate/error；随后触发的家具提案没有发送到已死 Worker，结果区无旧报告，位置未接受。断网下点“重建 Worker 并重试”，实际失败在页面的 `config.json` 请求，CDP 记录断网错误、Worker 总数仍为 1；脚本没有把这一步说成已创建新 Worker 或完成其 WASM 下载。恢复联网后，另一次受控暂停配置请求验证取消不会发布报告；再次明确点重试才创建第 2 个 Worker。恢复后的摘要、布局版本、规则版本、finding 状态及全部三态属性/来源与断网前接受结果相同，失败提案未重放，撤销/重做历史继续可用。新文档首次加载场景只在 HTML 已在线载入后暂停配置请求再切断网络；页面明确失败且没有 Worker 或报告，联网后通过显式按钮恢复。

`node --check scripts/check_web_network_recovery.mjs` 与 `git diff --check` 均通过。失败路径在源码中先保存错误、阶段、网络事件和页面状态，并在浏览器关闭前复制下载证据；本次成功运行未人为触发该留证分支。没有发现需要产品修复的稳定缺陷，因此没有虚构“修复前红灯”。

## 适用范围

这是 Linux Chromium 154、固定 localhost 合成客厅的 CDP 网络模拟。它证明**已加载会话**中本地规则计算及显式恢复路径；不证明断网冷启动、PWA/service worker、真实公网另一网络、Edge/Safari 或真实 Lux3D 模型。Worker 错误、请求暂停和打印调用计数由测试注入；断网传输失败由 CDP 的实际页面与 Worker 请求事件支持。离线恢复失败发生在页面配置请求，未覆盖 Worker 在其首次资源加载途中真实断流。默认样例的 true/false/unknown 三态得到保护；本脚本没有另造一条模拟资料编辑。首次可编辑 3 秒工程目标仍 OPEN_NOT_MET，本轮未做新性能计时，CI 预算和严格判断不得因该子项调整。T07 整体及真实资产、公开托管与正式材料门禁继续保持未完成。
