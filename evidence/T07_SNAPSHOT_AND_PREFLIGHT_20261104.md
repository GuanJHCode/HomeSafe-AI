# T07 场景快照与 T09 提交预检补缺

工作基线：`f6245e1`，隔离续作目录 `/workspace/HomeSafe-AI-continuation`。`.agents/skills` 不存在。范围是当前合成样例的本地可复核交付，不关闭真实资产、公开部署或正式提交任务。

## 核对发现

`docs/v6.1/01-architecture.md` 和 `docs/04-frontend-contracts.md` 已要求导出内存场景。原 UI 只有行动清单 JSON，包含解释与摘要但没有 canonical Scene，不能保存用户调整后的输入用于本地重算。本轮增加单独“导出场景快照”，保留原来的行动清单及打印按钮。

快照含完整 canonical scene、当前 assessment 的 scene_id/revision/input_hash/ruleset、合成来源标识和导出时间。它不包含模型文件、撤销历史或挑战进度；不提供页面导入恢复或云端保存，界面和文件均明确说明。保留未知及逐项资料来源，不把模拟资料填写当现场核查。与清单共用当前结果门禁，评估/恢复未完成或错误时不可导出旧输入冒充当前结果。

`check_scene_snapshot.py` 通过同一 Python RuleEngine 重算下载的 Scene，核对四项身份字段及来源；同 revision 改布局也会因输入 hash 不符失败。不在 TypeScript 复制规则或重写 canonical hash，也不从快照推断挑战获胜。

提交预检原来的主 URL 判断只排除四个 host 字符串，`https://127.0.0.2/`、IPv6 loopback、尾点 localhost、userinfo URL 会被当作可接受的 public URL 语法。当前 DRAFT 仍受其他材料门禁阻止，这不是历史已提交的假回执。本轮用专用解析器拒绝本地/私有/保留 IP、浏览器数字IP变体、已知本地DNS后缀、userinfo、query/fragment、非法端口及空白/反斜线。语法通过不证明 DNS、公网或匿名交互可用，部署回执要求保留。

## 实现与测试

新增 `SceneSnapshotBuilder.ts`、快照下载动作/按钮、独立 Python 检查器。浏览器回归增加初始/移动后/引导挑战快照下载，并直接使用 Python 检查实际下载字节；输出保留 snapshot JSON 和复算结果。

缺功能用例先运行：TS 快照测试因不存在导出模块失败；URL用例因不存在专用验证器失败。实现后：

- `node --test apps/web/tests/scene-snapshot.test.ts`：3项 PASS。
- `python -m pytest reference/tests/test_submission_url.py reference/tests/test_scene_snapshot.py reference/tests/test_release_export.py -q`：81项 PASS（新 URL36、快照7、既有 release/export38）。
- Vue严格类型检查 PASS（集成版本需最终复跑）。
- `check_submission.py`：BLOCKED／退出码2，缺失真实提交材料、主URL和回执；没有填造材料让门禁通过。

实际集成隔离 Chromium 在 `http://127.0.0.1:4175/preview/` 通过扩展 `check_web_preview.mjs`：初始/移动后/引导挑战三个实际下载快照均由原生 Python 重算为 MATCHES_CURRENT_CORE，位置、hash、revision和合成来源吻合；原有完整交互回归继续 PASS。原始回执为 `evidence/scene-snapshot-browser-20261104.json`，实际下载字节保存在本地 `evidence/continuation-browser/snapshot-*.json`，截图/PDF仅供本地核验，不自动加入源码 allowlist。

独立 agent review_ux 已完成代码与证据复审，81项 Python、3项TS及严格类型检查独立通过；三份实际下载文件独立重算通过，提交门禁仍 BLOCKED/退出码2。结论与范围见 `evidence/REVIEW_SNAPSHOT_SUBMISSION_CONTINUATION_20261104.md` 和对应 JSON。快照导出与URL语法预检子项可关闭；真实GLB、目标公网、其他网络及Edge/Safari仍各自依赖原有外部条件，不被此功能替代。
