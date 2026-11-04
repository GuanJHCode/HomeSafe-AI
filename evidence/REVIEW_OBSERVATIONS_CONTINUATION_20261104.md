# 模拟资料补充独立复审

2026-11-04。结论：**PASS，仅批准自由演练资料补充功能子项关闭**。审查者 `/root/review_challenge`，实现者 `/root/challenge`。基线 `f6245e13bc41e36a0efeabeba3ca0fba2174c2f5`；审查者未修改实现、未提交或推送。精确源码指纹、浏览器结果及产物摘要见 [独立回执](review-observations-continuation-20261104.json)。

## 审查与修复

核对 Python 权威可编辑字段和 trait 适用性、严格 RPC 输入、三态语义、模拟来源及生成契约；核对前端异步接受条件、输入/输出摘要绑定、版本与其他场景内容不变、挑战显式退出及原始关卡隔离、清单和打印语义。

独立构造完整摘要绑定的异常响应，发现旧控制器接受：①实际资料变化伪装成 `measurement/owner_checked`；②实际资料变化但 `change_kinds=[]`。两项反例均先在旧实现复现 ACCEPTED。实现者加入失败回归并强化守卫；独立复测后正常响应 ACCEPTED，两种异常均 REJECTED。守卫同时约束无变化时来源不能漂移，未知值不能携带确认时间或证据，已知值只能是带时区时间的 `simulated/provided`。本次未遗留阻断性审查发现。

资料选项仅由 Python 提供，不开放几何尺寸、traits、角色能力、路线或规则编辑。资料变化与空间整改分列，不给布局或挑战成功记功。明确确认后才重建自由演练基线并清空旧历史；挑战模板不继承演练资料。未知保持 null，已知输入仍明确标记模拟，并不成为现场核实。

## 独立执行的验收

- `python -m pytest reference/tests/test_observations.py reference/tests/test_main_challenge.py reference/tests/test_v6_review.py -q`：52 PASS。
- `node --test apps/web/tests/observation.test.ts apps/web/tests/report.test.ts apps/web/tests/workspace.test.ts`：12 PASS。
- `npm --prefix apps/web run typecheck` 和 `python scripts/generate_contracts.py --check`：PASS。
- 另逐项遍历当前 7 个可编辑字段的 true / false / null，共 21 次转换，核对单字段和版本边界、来源及其他输入不变；8 个非法 RPC 编辑全部被结构化拒绝。
- 最终独立隔离 Chromium 154.0.8037.57 在 `http://127.0.0.1:4175/preview/` 执行 `scripts/check_web_observations.mjs`：PASS，退出码 0，stderr 空，无 pageerror，浏览器已关闭。真实 Python/WASM、界面操作、JSON 下载及 PDF 均实际运行。
- 最终浏览器覆盖：确认勾选、三态往返、禁用无变化提交、清空旧历史、移动→撤销→移动→重置仍保留新资料基线且撤销/重做禁用、原始挑战未知值与零步数、显式退出挑战回到演练基线、JSON 和场景快照来源一致、打印清单、刷新恢复演练起点。
- 首次独立运行目视检查确认状态截图和 PDF 第一页，并核对两页 PDF 的提取文本：中文清单可读，模拟来源及时间、“未做现场确认”说明存在，资料更新与空间整改分开。随后最终运行再次生成同类产物并通过自动断言；不声称对任意未来长文档进行排版验收。

最终浏览器产物目录：`/workspace/scratch/review-observations-final`。确认后的输入摘要为 `1f32c77ab7005ea9457f61dd8ea072ec6a74e2bd8f1c21658f62899d9ef7dea9`；恢复未知后回到初始摘要 `d2060f28fe6895fed07349c81caf0f3af6c2408a7197ed3efce52deed93a9429`。资料时间随运行变化，摘要因此不应跨运行硬编码相等。

## 结论边界

本结论仅针对合成客厅的模拟资料练习。未验收真实家庭事实、原始 Lux3D 资产、公网部署、Edge/Safari/手机、真人试玩或不同网络设备。性能门槛由另一项独立评测决定，本功能通过不代表该门槛通过。整体真实资产及公开交付门禁继续保持开放。
