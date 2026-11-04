# 场景快照与提交 URL 预检独立审查

日期：2026-11-04 UTC。基线 `f6245e1`，工作树 `/workspace/HomeSafe-AI-continuation`。实现 agent `/root/delivery`；独立审查 agent `/root/review_ux`。

结论：**PASS，仅本轮快照导出/本地复核与 URL 语法门禁子项**。不关闭正式提交、部署或全部 T07/T09；提交预检仍应 BLOCKED。

## 审查范围

- `SceneSnapshotBuilder.ts`、当前结果门禁下的下载动作/按钮及提示、快照单元测试。
- `check_scene_snapshot.py` 和 canonical Scene/RuleEngine 复核路径。
- `validate_public_demo_url`、`check_submission.py` 调用及新的 URL 反例。
- 浏览器验收中实际下载初始、移动后、引导挑战场景，调用 Python 重算的新增部分。

快照保存完整输入和逐项资料来源及未知值，另记身份/输入 hash/规则版本；不保存资产字节、历史或挑战 session。界面、输出文件均明确不支持页面导入恢复。TypeScript 不重新实现规则或 canonical hash；本地检查器重新评估实际 Scene 并逐字段比较，而非仅检查 hash 外形。

## 独立验证

- `python -m pytest reference/tests/test_scene_snapshot.py reference/tests/test_submission_url.py -q`：**43 passed**（7 快照、36 URL）。
- `python -m pytest reference/tests/test_release_export.py -q`：**38 passed**。一次先误用不存在的 `test_export.py` 路径，pytest 明确 no tests ran；随后更正并实际运行上述 38 项，不将误调用计为通过。
- `node --test apps/web/tests/scene-snapshot.test.ts`：**3 passed**；`npm --prefix apps/web run typecheck`：PASS。
- 实现者实际 Chromium 回归的原始 JSON 见本轮 `evidence/continuation-browser` 与主任务集成回执。独立审查读取完整验收代码和运行结果，并对其保存的三份真实下载文件再次运行 `check_scene_snapshot.py`，均为 **MATCHES_CURRENT_CORE**：

| 实际下载 | revision | 重算 input_hash |
| --- | --- | --- |
| `snapshot-initial.json` | 1 | `a5f096ac43e6ba2302be82d381371709f9aaa406d4905a41c4fd17f77c6ecc69` |
| `snapshot-layout.json` | 2 | `18c5d12210fc794416386c9cbae43ac2b66aa7260f28eb76f4c334b53fea7f1f` |
| `snapshot-challenge.json` | 2 | `c8c61e185bd547373f4a10979f6e0d4310b325058950c3b20fc58ecffad86ebc` |

快照浏览器下载由实现者实际运行；独立审查没有把再次本地重算描述为自己的第二轮下载。两份 revision=2 文件具有不同输入 hash，且都能用相同内核独立复算；挑战快照没有保存或恢复胜利状态。

- 独立运行 `check_submission.py`：**BLOCKED、退出码 2**；仍缺最终源码/owner review/产品验收/报告/视频/场景/资产映射/公开 URL/部署回执，没有为通过门禁补造证据。

## 发现和边界

未发现本范围内阻断性实现缺陷。URL 门禁拒绝私有/本地/保留 IP、常见浏览器数字 IP 写法、userinfo、query/fragment、非法端口和明显本地域名等反例；部署回执仍须绑定 URL、源码提交、证据和责任人。URL 语法检查不执行 DNS，也不证明服务器不会重定向、目标匿名可访问或公网交互通过。

快照导出依赖应用已经接受的 scene/assessment 配对；独立 Python 复核才对文件内容与 canonical 输入 hash 做重新证明。它不提供用户上传/导入、真实性认证、现实安全或挑战胜负证明。真实模型、公网、其他网络、Edge/Safari 与正式赛事提交均未被本审查替代。
