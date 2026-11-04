# 完整构建与隔离浏览器接续

基线：远端功能分支 `97ed57aad0d10b1301a5d8fd658278c6f50a0157`，对应本地源码 `8657505`；master 仍为 `2f562a3`。前两次代码上传的文件树均已逐次核验一致。远端写入沿用本会话的推送授权，仅更新功能分支。

首次 CI：[运行 41767174835](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41767174835)。Ubuntu 24.04、Python 3.13.17、Node 24.22.1；Python 206 项、浏览器探针 JS 15 项、全部应用测试 17 项通过，包含 Three.js 合成 GLB 测试。该测试不代表真实 Lux3D 模型验收。

完整 Vue 类型检查失败：`findings.test.ts`、`report.test.ts`、`workspace.test.ts` 中 JSON 夹具导入被 TypeScript 推导成含可选 undefined 的联合 evidence 字典，直接断言为 canonical Assessment 报 TS2352。失败证据来自上述真实 CI，保留原回归和完整测试类型检查；仅在已由 Python 契约验证的测试 JSON 边界经 unknown 转换，不放宽生产契约。

新增固定摘要下载工具，从官方 CDN 获取已核验版本的原始字节；不改写官方 lock，不增加 info.version。vendor 脚本仍分预览和复制两步执行。新增 3 项合成下载回归，本机 Python 总计 209 项通过。本机 npm 仍返回 ENOTFOUND。

本轮扩展 CI：完整构建、同源 Python 集成、临时 Linux Chrome 中的真实探针与三维交互、子路径和刷新、构建与证据 artifact。没有操作用户 Mac 的 Chrome，也不发布公网网站。新增 CI 尚待实际执行；运行结果将单独补记，不能把配置存在记作验收通过。

第二次 CI：[运行 41768151675](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41768151675)，提交 `6ad8e1e`。完整类型检查、209 项 Python、17 项应用测试、官方运行时下载、完整 Vite 构建及 22 个分发文件校验通过。真实浏览器探针运行至故障注入时失败：Puppeteer 的全局拦截把 `Fetch.enable` 发给不支持它的 Worker target。改为仅拦截页面配置请求的 CDP session；不替换真实 Worker 或 Python 评估。该次构建 artifact 已实际生成，浏览器整体仍未通过。补充应用 Worker 重建、打印 PDF 与热启动测量后继续复验。

第三次 CI：[运行 41768555185](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41768555185)，提交 `94c0470`。真实 Chrome 156.0.8078.47 同源探针完整通过，原始输出见 [探针证据](ci-browser-spike-94c0470.json)：冷启动墙钟 3627 ms，热重建 3032 ms；三例评估 76.3 / 21.4 / 16.6 ms。挑战、剩余事项、MIME、Worker 失败后重建恢复均通过。这是临时 Linux localhost 子路径实测，不是公网托管或用户 Mac 的结果。

三维应用已执行至挑战后的第二次导出，因 CDP 重用同名文件而触发验收脚本超时；整体未通过。修复测试临时文件生命周期，同时新增失败回归后为产品导出名加入实际 input_hash 前缀，区分同一 revision 的不同布局。保存 CI 真正解析出的 113 个包记录的 npm lock，后续改为 npm ci，不手写依赖解析结果。

官方工具需求遵循 [资产方案](../docs/v6.1/03-assets.md)：Lux3D 网页生成并手动导出两件 GLB 是主路径；官方 API/SDK 不是当前阻断项，也没有获准收费调用。仍需真实椅子、柜体、来源和公开分发权利、摘要及人工校准。官方 Pyodide 分发已核验，保持原样使用。
