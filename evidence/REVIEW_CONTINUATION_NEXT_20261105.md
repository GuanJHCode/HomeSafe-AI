# be32202 后续两项功能独立复审（2026-11-05 UTC）

审查基线为本地 `be32202bbaeafd9fcfde84601c22fb5a981fab6c`，分支为 `codex/continuation-after-download-20261105`。本报告只对 `T07-draft-export-guard` 与 `T05-neutral-not-triggered-copy` 分别给出结论；没有修改产品实现、提交或推送。审阅了对应源码与测试、修复前反例，并在本环境 Chromium 154 的 `/preview/` 合成客厅中独立复测。

## T07-draft-export-guard：PASS_INDEPENDENT_SCOPED

修复前的[真实拖动记录](continuation-next/red-draft-observed.log)显示 `canvas.dragging=true` 时仍能导出旧 `a5f096...` 摘要，松开后接受的布局变为 `3f65d4...`；[失败断言](continuation-next/red-draft-guard.log)留存了旧报告可见的反例。现有 `TransformController` 在成功按下可移动家具时立即通知 `drafting=true`，合法提交、取消、无位移松开、失去 pointer capture、回弹及销毁时清除；`App.vue` 隐藏旧报告并显示预览提示，`useLivingRoom` 的 JSON、场景快照、打印三个入口各自拒绝 drafting、busy、failure 状态。

我独立运行 `CI=1 node scripts/check_web_draft_export.mjs http://127.0.0.1:4173/preview/ /usr/bin/chromium /workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js`，结果 [PASS](continuation-next/independent-draft-checker.log)：按住未移动与预览时报告/输出不可见；对隐藏按钮直接调用 `.click()` 也没有下载或打印；pointercancel/视角切换恢复原摘要，合法提交后 JSON、快照、打印恢复且新接受摘要一致。我另以[独立浏览器脚本](continuation-next/independent-draft-browser.mjs)复测原地按住、原地松开及按住时改变家具选择，结果 [PASS](continuation-next/independent-draft-browser.log)，后两种取消路径均恢复原接受摘要。`node --test apps/web/tests/findings.test.ts apps/web/tests/transform.test.ts` 为 6/6；transform 测试还覆盖拒绝回弹、失去捕获、按钮旋转和销毁。

## T05-neutral-not-triggered-copy：PASS_INDEPENDENT_SCOPED

修复前 [Node](continuation-next/red-neutral-copy-node.log) 与[真实浏览器](continuation-next/red-neutral-copy-browser.log)反例表明：模拟 `cabinet.anchored=true` 后 R003 已是 `not_triggered`，行动文案仍称“布局调整后重新核查”。本次仅改 `FindingsPresenter` 的该状态展示文案为“当前输入条件未触发；仍需现场复核。”，没有改变 Python 规则、状态、依据、比较类型或其他状态分支。

我独立运行 `CI=1 node scripts/check_web_observations.mjs http://127.0.0.1:4173/preview/ /usr/bin/chromium /workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js /tmp/homesafe-review-observations-next-repeated`；浏览器[结果 PASS](continuation-next/independent-observations-browser.log)。对前一轮实际下载的[报告 JSON](continuation-next/independent-confirmed-report.json)另作独立解析断言：[结果 PASS](continuation-next/independent-neutral-report.log)。R003 的 `findings` 与 `actions.observations` 均为 `not_triggered` 和新文案，依据仍为 `anchored_reported=true, source=simulated`，`comparison.changeKinds=["observation"]` 且 `actions.layout=[]`。单测与浏览器 UI 断言同时通过。

## 版本、边界与交接

审查时源码 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `apps/web/src/App.vue` | `865acbe4161209350c330ec05b1a2d2a1822bbecd9afcda6279221c88b1092a8` |
| `apps/web/src/useLivingRoom.ts` | `f0e8824e51304da58c490d213f79f9342f9124457621f79e8b19982c28962738` |
| `apps/web/src/scene/TransformController.ts` | `90710132b478f65bea24e465c826a3419b6d28561ec2fb6307766f3e9d36c9ba` |
| `apps/web/src/domain/FindingsPresenter.ts` | `0df87efed4d27edd8412c0faff7ec668cdeb86c535873d3cccbc26ede1fd0ae5` |
| `scripts/check_web_draft_export.mjs` | `b1eb4eb776b8f62a653e4832a40cb1830955a2f55606b5b7943fc91a76c04731` |
| `scripts/check_web_observations.mjs` | `79910e3b902a62640b3e32ff2b8da47c3d0a66f2238c589c8e183a47b08f05f3` |

根任务的[最终本地回归](continuation-next/final-js.log)还记录 JS 48/48、[应用测试](continuation-next/final-app.log)39/39、[Python](continuation-next/final-native.log)334/334，以及 preview、experience、observations、recovery 浏览器 PASS；这些是辅助证据，两个 scoped 结论以独立源码审查和上述复测为依据。`git diff --check` 与 `evidence/task-status.json` JSON 解析通过。现有 CI 性能预算和失败判断未改；本轮按用户顺序未做新性能计时，首次可编辑 3 秒仍 `OPEN_NOT_MET`。真实 Lux3D 原件在本环境不可读，公开模型权利、正式托管/其他设备验收与新远端 CI 仍未完成。`T05`、`T07` 整体不得因此关闭。

状态文档只读终核：`START_HERE.md`、`HANDOFF.md` 和 `task-status.json` 将 `be32202` 标为本地已提交基线、`394eb04` / CI 41948477248 标为最新已核实远端，旧 `64e1665` 阶段标为历史；3 秒目标明确为未达标但暂不阻断其他开发。三个本轮子项已分别标为 DONE；T03/T04 整体仍 BLOCKED，T05/T07 整体仍 IN_PROGRESS，首次可编辑 3 秒仍 OPEN_NOT_MET。未发现与两个 scoped 结论冲突的陈述。
