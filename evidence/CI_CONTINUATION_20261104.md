# 完整构建与隔离浏览器接续

基线：远端功能分支 `97ed57aad0d10b1301a5d8fd658278c6f50a0157`，对应本地源码 `8657505`；master 仍为 `2f562a3`。前两次代码上传的文件树均已逐次核验一致。远端写入沿用本会话的推送授权，仅更新功能分支。

首次 CI：[运行 41767174835](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41767174835)。Ubuntu 24.04、Python 3.13.17、Node 24.22.1；Python 206 项、浏览器探针 JS 15 项、全部应用测试 17 项通过，包含 Three.js 合成 GLB 测试。该测试不代表真实 Lux3D 模型验收。

完整 Vue 类型检查失败：`findings.test.ts`、`report.test.ts`、`workspace.test.ts` 中 JSON 夹具导入被 TypeScript 推导成含可选 undefined 的联合 evidence 字典，直接断言为 canonical Assessment 报 TS2352。失败证据来自上述真实 CI，保留原回归和完整测试类型检查；仅在已由 Python 契约验证的测试 JSON 边界经 unknown 转换，不放宽生产契约。

新增固定摘要下载工具，从官方 CDN 获取已核验版本的原始字节；不改写官方 lock，不增加 info.version。vendor 脚本仍分预览和复制两步执行。新增 3 项合成下载回归，本机 Python 总计 209 项通过。本机 npm 仍返回 ENOTFOUND。

本轮扩展 CI：完整构建、同源 Python 集成、临时 Linux Chrome 中的真实探针与三维交互、子路径和刷新、构建与证据 artifact。没有操作用户 Mac 的 Chrome，也不发布公网网站。新增 CI 尚待实际执行；运行结果将单独补记，不能把配置存在记作验收通过。

官方工具需求遵循 [资产方案](../docs/v6.1/03-assets.md)：Lux3D 网页生成并手动导出两件 GLB 是主路径；官方 API/SDK 不是当前阻断项，也没有获准收费调用。仍需真实椅子、柜体、来源和公开分发权利、摘要及人工校准。官方 Pyodide 分发已核验，保持原样使用。
