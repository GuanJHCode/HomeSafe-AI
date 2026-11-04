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

CI 待本次提交触发。子任务在 CI 完成前保持 IN_PROGRESS；T04 整体 BLOCKED。公网地址、匿名 HTTPS 与真实公网交互均 NOT_RUN。真实 Lux3D 资产仍为 0，T03 BLOCKED。
