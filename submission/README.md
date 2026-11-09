# HomeSafe AI：官方提交前候选材料

当前路线：**八页项目报告 PDF＋真实运行视频＋可复现源码**。材料已按内容审查修复，仍是候选稿；本人账号／团队／素材权利和最终须知确认未代填，尚未报名、部署或正式提交。仓库 push 不等于参赛提交。

## 当前审查入口

| 内容 | 实际文件与用途 |
| --- | --- |
| 当前项目报告 R2 | [八页 PDF](materials/2026-11-09/HomeSafe-AI_project-report_candidate_R2_20261109.pdf)：作品、双角色完整案例、Lux3D 过程与迭代、版本与边界；保留 R1 真实图像，更新第 4／8 页及来源归属说明 |
| 当前演示 V4 | [90.92 秒 MP4](materials/2026-11-09/HomeSafe-AI_demo_candidate_V4_20261109.mp4)：V3 实录保序保留，63.16–65.16 秒增加明确标注的恢复姿态定格；无音轨，不伪装新增连续实操 |
| 当前附件校验清单 | [媒体 manifest](materials/2026-11-09/manifest.json)、[剪辑记录](materials/2026-11-09/video-V4-edit-manifest.json)；字节、SHA-256、版本关系可独立检查 |
| 从两件原始 GLB 开始复现 | [本地审核说明](../docs/LOCAL_MODEL_REVIEW_20261109.md)：校验原件→确定性法线修复→校验派生摘要→随仓库校准→绑定→loopback 真实交互；不需私有 inputs 或校准 |
| 原件与历史材料 | [审核原件目录](../review-assets/2026-11-09/README.md)：两件原始 GLB、V3、四页复验 PDF；[R1 八页历史快照](../review-assets/2026-11-09/project-report-R1/README.md)；所有原字节保留 |
| 当前素材／场景／功能绑定 | [提交 manifest](submission-manifest.json)、[真实模型验收](evidence/2026-11-09/product-acceptance.json)、[版本对应](evidence/2026-11-09/version-lineage.json)、[脱敏来源摘要](evidence/2026-11-09/retained-generation-summary.json) |
| 官方要求与本人最小动作 | [提交前核对](../docs/SUBMISSION_PREPARATION_20261109.md)、[待本人记录](evidence/2026-11-09/owner-review-pending.json)；缺证据保留未知，不代签或填 true |

## 版本与真实验证范围

- 本轮源码冻结为 `3b64dd41578176456a2f62337a66dd19c823dd31`。R2 的真实截图／模型渲染捕获为 `72964d3`，V3 原实录捕获为 `5826dab`；V4 是该 V3 的展示剪辑。不能称三个提交完全相同。
- [范围比较](evidence/2026-11-09/scoped-source-comparison.json)实际验证 11 个视频 Python 运行模块、35 个报告前端／内核文件、2 个场景／校准文件的范围摘要。[八阶段对照](evidence/2026-11-09/video-runtime-replay-comparison.json)将保留 V3 的场景、revision、input_hash 和完整导出结果与冻结版逐项比较一致。视频前端有明确列出的差异，未隐去。
- 冻结版 fresh 构建及真实两模型九阶段、99 条 finding 的原生 Python 重算通过；导出、同字节预览、打印、撤销／重启、双角色取舍及越界回弹按实际范围记录。移动端仅按钮／重启验收，325px 画布可能裁切房间；没有外部真机／另一网络或公网真实模型性能证据。
- [716a28a CI](../evidence/current-ci/716a28a-ci-summary.json)是已重新核实的历史基线：run42568889355／attempt1／job129001439549，37 步全部成功；首次可编辑／冷规则 p95 均 2429.7ms，热评估 6.5ms；Python358、应用44、JS24＋38。审查附件的 3447.5ms、445／66 不能用于该 job。本轮新增代码和材料的 CI 必须查本次推送 SHA，不能使用历史绿色代替。
- 本轮本地 Python379、应用44、JS62、类型、契约、构建和真实 Pyodide 通过；内部 3000／12000／150ms 门槛保持原样，它不是已证实的比赛硬性要求。当前新 CI 和最终推送结果由对应 Git 提交与最终回执确认。

## 来源、运行件与使用范围分别记录

原始 GLB 保留 20／24 个零法线，运行使用确定性修复派生件；原件、派生件摘要和方向／原点／合成非等比尺寸配置分开记录。`assets/feature_asset_map.json` 只是当前材料中的真实功能对应，不批准正式资产目录。`assets/asset-manifest.json` 仍为空，普通构建明确使用程序占位；本地审核模式实际加载两件模型并保留 `reviewed=false` 及权利未核实状态。

来源为原创 AI 单物体参考图与历史 Lux3D 图生 3D 任务。保留的完成截图证明任务完成与缩略图，不证明当时黑屏的主 3D 预览正常，也不是平台签名认证。设置主要来自保留来源记录；本次仅公开脱敏摘要，不追加独立参考图、账户截图、私人来源 JSON 或派生 GLB。模型资产 ID 的历史 `private-` 前缀不代表平台模型当时为私有。

用户授权本次相关材料公开分享，与本账号／套餐／订单适用的参赛、评审、展示、再分发范围是不同事实。后者尚未核实，未知不等于已认定违规，也不能写成平台已许可。本项目为手工合成场景和规则演练，不识别真实家庭，不作医学或事故率／安全保证。

## 最后由本人完成的事项

1. 确认团队、账号／订单及所有素材的参赛／展示使用范围，完成真实本人声明和最终表单限制核对。
2. 阅读登录后最终须知，决定接受并由队长提交获准的 R2／V4；截止为 **2026-11-19 19:00 北京时间**，以系统成功提交时间为准。
3. 保存实际项目编号和回执；此前 `official_receipt` 保持空值。视频路线无需为提交另建网站。

执行 `python scripts/check_submission.py` 应仍输出 `BLOCKED`／退出 2，但现在只剩本人核对及素材权利，不再为空的附件／场景／版本／功能映射，也不以虚构公网 URL 清除门禁。详见[本轮整改与独立复审](../evidence/SUBMISSION_FINALIZATION_20261109.md)。

## 历史草稿

[2026-11-04 文字报告](drafts/report-20261104.md)、[旧录屏执行单](drafts/recording-plan.md)、[旧私下材料运行单](drafts/private-materials-runbook.md)、[传播草稿](drafts/social-post.md)和[模板](templates)继续保留，不能替代上方当前附件，也不当作已发布、已签署或已获正式回执。旧四页 PDF 是内部内容复验快照，R1 第 8 页是制作时状态，均不改写历史。
