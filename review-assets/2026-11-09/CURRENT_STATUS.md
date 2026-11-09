# 当前审核状态（2026-11-09）

## 新增源码推送与R1报告公开

源码`aa7227a1943ddef3753fea521119b2a5d5f899d7`已正常快进到原开发分支，远端完整981文件Git树与本地匹配；[CI42567382909](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/42567382909) attempt1终态success，37步骤成功、0失败／跳过。实测首次可编辑p95=2684.4ms、冷规则2684.3ms、热评估7.2ms，通过原3000／12000／150ms预算，未重跑，仅CI合成占位范围。

用户随后明确授权[八页项目报告候选R1](project-report-R1/README.md)也公开推送，使用同一已保存副本的ec32摘要字节与Content Credentials，不另外发布截图／参考图／私有来源JSON／派生GLB。R1捕获729、制作时尚未推送／分享待确认等文字按快照保留；新README记录本次授权及实际公开阶段。新报告提交的CI另按新SHA检查，不能借aa绿色证明后来提交已验。

以下为R1新增公开授权之前的历史核对，保留4ac等当时的事实，不作为最新许可或推送状态。

## 历史4ac基线

已核实的远端基线为`4ac423e90e106541bd706e62f6f3815ea3cce8a3`，四件原有文件已在公开开发分支，匿名客户端下载HTTP200、大小/SHA256/Git blob逐项匹配并经独立下载复核。该次分享不是平台账号适用许可核验。

[CI42558752605](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/42558752605)对应4ac、attempt1、completed/failure。34步骤成功，唯一失败为Strict real-browser performance budgets：cold_first_editable p95=4027.4ms>3000ms；cold_rules_ready p95=4027.4ms<12000ms、hot_evaluation p95=14.9ms<150ms。两个setup后处理跳过。没有重跑或降低门槛。

旧[manifest](manifest.json)的`code_base_commit=29e9eae`与`product_capture_commit=5826dab`、旧四页PDF的推送前时态都保留历史含义，不改成4ac冒充新捕获。当前本地续作增加了[无需私有配置的审核入口](../../docs/LOCAL_MODEL_REVIEW_20261109.md)，串起原件、修复件、显式校准及真实应用；普通正式资产清单仍为空。本轮仅本地开发与新项目报告用户预览，不push、不部署、不正式提交。

新报告与新截图的分享范围尚未确认，不在此目录新增媒体或私人附件身份。V3未重录：本轮新抽帧确认了操作／来源层级，也记录历史来源段较密、完整回弹画面仅约一帧及单视角遮挡等限制；新报告以真实稳定截图补充，不能把它写成新版视频已交付。
