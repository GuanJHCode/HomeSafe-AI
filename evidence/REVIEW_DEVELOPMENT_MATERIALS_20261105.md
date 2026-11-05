# T10 开发材料独立审查（2026-11-05 UTC）

**结论：`T10-development-materials` 开发子项 `PASS_INDEPENDENT_SCOPED`，可标记完成；T10 整体与正式提交材料 G4 仍未完成。** 本结论只针对固定 localhost 合成客厅的中文 PDF 工作稿和真实 Chromium 操作录屏。材料均明确标为 `DRAFT_NOT_SUBMITTABLE` / `LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING`，不能作为真实 Lux3D、公网部署、用户试玩或参赛正式材料的验收。审查者未修改产品实现、提交、推送或部署。

## 产物与版本绑定

最终私下产物位于 `evidence/private/development-materials-final-20261105-2/`，仅供私下开发审阅与交付，不作公开或正式参赛版本；非敏感生成审计见 [材料审计](network-materials/materials/final-audit.json)，独立复核数据见 [完整性复核](network-materials/materials-review/independent-integrity.json)与[画面复核](network-materials/materials-review/independent-visual.json)。我重新计算了 7 个产物 SHA-256，与私下 manifest 全部一致：4 页报告 PDF 为 `5b0d4446bd7def725f37e5ef97fb105c113e65aee6671cf7c6ac0417234a3197`，198.52 秒 MP4 为 `dc3c7e275afe0de9801466da14f8784438ee5f1dbe2267170c6f61a323b7e7f3`，原 WebM 为 `f67e2f006da1a45f818aafbcfd417326fd5959f3d1545cb402ef24e3927cb9d7`。

manifest 记录基线提交 `ba21f54ace3218cfa2d695092b735165c923b1b9`、分支 `codex/network-materials-20261105`、**工作树有未提交材料/证据改动**，并明确 App/Core 与该 HEAD 一致。我独立重算 App/Core 范围 39 个文件的摘要 `7ec6dee5de77002c726a3c517602e96be17905f815bb873552bf625acb68cbb8`，核对 6 个关键源码/场景文件和 dist manifest/checksums，均与 manifest 相符；该范围的 `git status` 为空。录制前的本地 HTTP 核对回执中 28 个资源均为 200，我逐项复算其 SHA-256 与字节数，对应当前 dist 文件；这是**本地 HTTP 字节证据**，不构成公网验收。公开资产清单和 dist 资产清单均为空，本片只显示程序占位家具。

## PDF、导出和浏览器录屏

我用 `pdfinfo`、`pdftotext`、`pdffonts` 及逐页渲染检查报告 4 页和打印清单 2 页。Noto Sans CJK SC 字体嵌入，中文可提取；标题、正文、表格、页脚均可读，未见裁切或文字重叠。第 4 页较长路径在表格内换行但仍可读。报告写明实际输入、来源、规则、开放问题和开发稿边界，没有把历史测试数字或 4812.2 ms 历史性能值说成本次重测，也没有声称 3 秒是官方要求或降低 CI 门槛。报告明确本环境模型取得 helper 返回 `download failed`、HTTP 状态未知；真实 Lux3D 浏览器视觉与权利待验，公网 HTTPS 未运行。

从实际页面导出的行动清单 JSON 与场景快照同为 `source_kind=synthetic_demo`、布局 `v2`、输入摘要 `c8c61e185bd547373f4a10979f6e0d4310b325058950c3b20fc58ecffad86ebc`、规则 `demo-rules-3.0`。我另行运行 `scripts/check_scene_snapshot.py` 得到 `MATCHES_CURRENT_CORE`；行动清单中 2 项已触发、4 项待核查、5 类未覆盖，与报告和挑战页一致。打印版包含相同布局、摘要和规则版本；逐页目视与文字搜索均确认不含“录屏注释”。录屏只显示点击“打印清单”，报告也明确没有录到系统原生打印预览；独立生成的打印 PDF 是当前页面 print CSS 的结果。

我检查了最终视频 0、20、40、60、80、100、120、140、160、180、195 秒附近实帧，见到儿童/老人视角、检查卡、椅子拖动引发双角色取舍、撤销再摆位、目标完成而仍有待核查项、行动清单与导出区域。画面上的横条明确写“录屏注释”及开发预览限制，不伪装成产品控件。1 fps 抽样得到 199 帧、136 个不同画面，最长低变化段 8 秒；有阅读段，但未见以长时间静帧填足片长。原 WebM 为 VP9，末包 PTS 198.52 秒、4963 帧；H.264 MP4 为 198.52 秒、4963 帧。当前生成脚本只有一次 Puppeteer screencast 和一次无裁剪/变速参数的 ffmpeg 转码，帧数与时长一致，支持未裁剪、未变速的判断；这不是对每一帧像素无损同一性的声明。视频无音频，也不是用户试玩。

## 反例与剩余门禁

[失败反例](network-materials/materials/failure-counterexamples.json)保留：首次短试因函数初始化顺序报错；首次完整版 241.92 秒超过 180–240 秒范围，且打印 PDF 出现两处录屏注释。最终版在 25 fps 真实 screencast 下为 198.52 秒，打印注释为零；旧失败件未冒充交付件。工具脚本在材料生成时属于工作树未提交文件，当前审查对其源码和产物交叉验证；正式可复现交付仍应随最终版本固定工具来源。

本次材料流程未重跑全应用测试或性能计时。报告提及的 Python 334、应用 39、JS 48 项是 `ba21f54` 继承基线记录；root 本轮另跑的测试应按其独立回执认定。首次可编辑 ≤3 秒仍是 OPEN 的项目工程目标，严格 CI 预算不变。真实模型字节在本环境不可用，真实模型浏览器交互/视觉和发布权利仍阻塞；公开 HTTPS、正式入口及 G4 最终材料也未验收。因此只关闭上述**开发材料子项**，不关闭 T10 整体或任何正式提交门禁。
