# T04 匿名部署资源核验工具

2026-11-04，基于远端功能分支 c7f59a8792263d0c16197b85a9357def4cbc27c4；master 仍为 2f562a3。未操作用户 Mac Chrome。

## 实现范围

`scripts/check_deployment.py` 以本地已审核 dist 为依据，先校验 manifest/CHECKSUMS、文件摘要、漏项/额外文件与 symlink，再无 Cookie/登录认证地请求首页、每个资源与清单。检查原目标路径、目录 slash 跳转、HTTP 200、准确字节及 HTML/JS/CSS/JSON/WASM MIME；资源重定向不跟随。HTTP 请求有限长读取与超时。只有显式 loopback 模式接受 HTTP；输出不得写入 dist。

回执分别表达资源检查、匿名 HTTPS、浏览器与公开部署。HTTP 工具始终不宣称浏览器或公开部署通过；没有自动修改任务状态。CI 在既有真实 HTTP /preview 子路径中执行检查，无新增托管服务或收费调用。

## 失败反例与独立审查

- 新功能的首轮测试因缺少 check_deployment 模块收集失败，随后实现。
- 独立审查 agent `/root/review_deployment_probe` 发现 P2：根 URL 无 slash 正常返回 200 被误判失败。新增 `test_root_url_without_slash_is_not_required_to_redirect`，先实际失败，再仅对非空目录路径要求跳转。
- 同一审查发现 P2：重复尾 slash 被静默折叠，错误核验另一地址。新增 `test_repeated_trailing_slash_is_not_silently_normalized`，先实际失败，再保留目标原路径。
- 两项修复后独立复审结论 PASS，无剩余阻断问题。agent 独立运行 18 passed / 1 skipped。此结论仅批准本工具代码，不批准公网部署。
- 本机 sandbox 禁止 socket bind，真实 loopback 集成测试明确 SKIPPED；CI 设置下该项不允许跳过。合成响应测试不作为 HTTPS 或浏览器验收。

## 验证与状态

代码远端提交 `0be587345015bc99eeed4208b7a12a9d551d1926`，对应本地 `57a343798909b3e6294a21dd74c303fe56b7bb72`，树均为 `6a33bdc4d520e088ff79ead2b6bbda4630df9a8d`。未改写 master，使用带 expected_sha 的非强制功能分支更新。

- 本地：Python 227 passed / 1 skipped（仅 socket 限制）；15 项探针 JS、契约生成、包验证 8 项、core 暂存及契约 TypeScript 严格检查通过。`check_submission.py` 仍为预期 BLOCKED / 退出码 2。
- [完整 CI 41771015579](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41771015579)，job 126380455412：Python **228 passed，无跳过**；15 项探针 JS、19 项应用测试通过；契约与 Vue/TypeScript 严格检查、Vite 正式构建及 22 文件分发校验通过。
- 新工具在真实 loopback HTTP `/preview` 子路径通过：24 个资源（22 个构建文件 + manifest + CHECKSUMS）、首页与目录跳转通过。摘要、MIME 与明确的 localhost scope 见 [资源回执](ci-deployment-transport-0be5873.json)。匿名公网 HTTPS 未运行。
- Linux Chrome 156.0.8078.47 的同源三样例、挑战/剩余事项、Worker 恢复和完整三维交互回归通过：[探针回执](ci-browser-spike-0be5873.json)、[应用回执](ci-web-preview-0be5873.json)。本次应用冷启动 4063 ms、热刷新 3148 ms，仅为 CI localhost 单次结果。
- [构建 artifact](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41771015579/artifacts/13294682528)，8,602,532 bytes，SHA-256 `5c8e4290a92427ff2308c992c105bd06795b1ed85c6723ca118929587f752f70`，到期 2026-11-18。[元数据](ci-artifact-0be5873.json)、[CI 摘录](logs/deployment-probe-ci-0be5873.txt)。只部署 artifact 中的 apps/web/dist，不发布验收文件。

独立 agent 再次核验上述 GitHub CI，并明确批准关闭 **T04-anonymous-resource-probe**；该子任务现在 DONE。T04 整体仍 BLOCKED。公网地址、匿名 HTTPS 与真实公网交互均 NOT_RUN。真实 Lux3D 资产仍为 0，T03 BLOCKED。下一步仍需获准托管入口与模型来源/校准材料，不伪造完成。
