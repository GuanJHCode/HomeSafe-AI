# 真实模型私下开发材料续作（2026-11-05 UTC）

当前代码事实锚点为已推送的5001222413937586604e8d944ba83787c7cb06fa；[CI41993004005](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41993004005)功能全部通过，仅首次可编辑p95=4324ms未达内部3000ms目标。用户决定3秒不阻塞后续开发，严格CI预算及其真实失败保留。本轮在codex/private-real-materials-20261105本地续作，不推送新提交，不发布网站或媒体。

## 先核对已有成果

a192完整198.52秒材料是占位版本，其私下媒体不在当前Git；本机此前26.08秒也是占位短试，不能称真实模型完整材料。两件原件、方向/纹理/代理与修复派生件的私下浏览器验收、503/SRI/WebGL/375px恢复、挑战和导出已由4203/9a/500阶段实施及独立审查完成，本轮不为凑计数重复整套。开始本轮时缺口是可复核的同版真实模型报告与180–240秒实录，现已完成，见下节。

## 当前完成：4页与221.72秒同版实录

真实模型完整开发材料已由冻结工具提交c1d794b6ba548b450cce7e1a4dffe107500c591d生成：4页中文PDF、221.72秒（3分41.72秒）/5543帧/1280×900/25fps H264、原WebM、JSON/快照/打印清单及来源/覆盖收据。捕获前后Git均干净，6工具摘要不变，39个App/Core文件对C1和500逐字节一致；报告首屏明确产品500基线与工具C1。最终v3/hash2dbebe5644748e4973e2f5ccf7fef102b0642981d1c8eec178affe0ab1105a08/rulesdemo-rules-3.0一致，原生快照复算通过，未知null保留。

完整视频SHA为7e12334805dfca61f4e77ac9461e162cd1d6b0aadf72ad2f1311d95d0d569c79，原片SHA为ae7f6c726269e535c27f7a0692bfb65f7c337db9e1c33bcc092997a5f5315914。实际文件留在ignored `evidence/private/development-materials-real-full-c1d794b-20261105/`，没有上传模型/截图/PDF/视频，也不纳入Git/恢复包。

独立审查实际查看4页PDF和15个阶段关键帧，确认两件纹理/正面可见、双视角/取舍/撤销/两挑战/旋转与回弹/未知/导出可读，没有把关键帧抽样写成逐帧完整看片。5543全部相对PTS一致、11产物及6工具SHA、两原件→派生→repair/calibration和5overlay重建、静态26资源+2元数据及空catalog、原生11findings的规范字段/coverage/unsupported均通过。见[完整技术摘要](private-materials/full-summary.json)和[独立审查](REVIEW_PRIVATE_REAL_MATERIALS_20261105.md)。没有把本地真实模型录屏当作公开分发、正式托管或用户试玩通过。

另已完成ignored私下提交准备包：实际源码、可解析PDF/视频、canonical最终场景、两私下派生GLB/来源证据、实际私下验收与功能到视频阶段的近似映射。原检查器独立运行仍exit2，仅剩8行真正外部/正式门禁（本人审核、正式产品范围、两件各分发权/不得public、匿名HTTPS入口和部署证据），没有文件缺字段/parse/hash/映射错误。正式submission-manifest未改，owner声明未代填，实际私下验收不伪装full_browser_product。原空正式清单的预检也保留BLOCKED。见[准备摘要](private-materials/submission-preparation-summary.json)与[复现执行单](../submission/drafts/private-materials-runbook.md)。

## 新增私下捕获流程

显式--private-models指定ignored私下输入配置。生成器先检查分发中的模型清单与公开源catalog为空、静态分发保持原占位版本，再通过主页面CDP精确五URL临时覆盖catalog、两个canonical场景和两件GLB；模型只在内存里发给当前隔离浏览器，没有写入静态服务或公开目录。占位分发的loopback字节收据和内存覆盖五项SHA/长度分别记录，不能将前者冒称真实模型部署回执。

载入前检查每个原件/派生件SHA、repair来源链、reviewed=false持久校准候选；检查实际Y180Quaternion把Y-up/+Z转为场景-Z及有效边界/底部原点。仅内存descriptor按原private intake临时reviewed=true以走现有运行时门禁，不能视为批准。前/后核对私下输入不变，并确认两件实际加载、无外部页面请求。报告明确使用法线修复派生件而非未修原件，场景仍是synthetic_demo；非均匀教学尺寸不是实测或等比例保真。

实录在模型与规则就绪后开始，不记录冷启动或证明性能。实际流程含儿童/老人观察、检查卡、合法椅子拖动的双角色取舍、撤销、窗边挑战、柜体主挑战摆位/旋转/越界回弹、剩余未知以及同版JSON/快照/打印。Python重算快照必须MATCHES_CURRENT_CORE，三个导出都绑定接受的revision/input_hash/ruleset；快照不含模型字节。原片与压缩片均保留。私下编码包装器仅将VP9压缩工作量preset改为8，不修改输入帧序列、FPS或时间参数，质量参数未改，不承诺不同preset的编码像素或感知画质完全相同。

新增工具经过实际红/绿：Node Response接口误用、旧PASS方向收据接受错误Quaternion、广域Puppeteer拦截卡Worker，以及PDF必需词与标题不一致。见[反例摘要](private-materials/counterexamples.json)。所有旧失败目录和独立原始探针保留，未用后来绿灯覆盖。

## 历史短试与工具冻结范围

第四次真实模型短试工具退出0：4页PDF、54.84秒/1371帧/1280×900 H264，原WebM最后PTS54.84，五覆盖与两GLB摘要准确，无外部请求。最终布局v3/输入2dbebe5644748e4973e2f5ccf7fef102b0642981d1c8eec178affe0ab1105a08/规则demo-rules-3.0，原生复算一致。短试仍TRIAL_ONLY_NOT_DELIVERABLE，不替代完整片；捕获时HEAD500、工具和文档dirty，App/Core与HEAD、ba21及500一致，39源文件聚合SHA7ec6dee5de77002c726a3c517602e96be17905f815bb873552bf625acb68cbb8。完整工具SHA与文件摘要见[短试收据](private-materials/trial-summary.json)。

本轮实际JS59项（含11项材料合同/报告用例）和包检查8项通过；Python343、应用39及Chrome156功能数量来自本次CI500，不能说本轮工具再次重跑全套内核或正式性能。App/Core/契约/依赖与严格性能脚本未改。独立代码/初始加载、短试4页PDF与8关键帧、全部输出/工具SHA、1371帧的相对PTS及导出复算均已限定通过；该短试阶段尚未录完整片；当前完整片和最终审查结果以上方完成段为准。

## 当前交接状态修正

START_HERE/HANDOFF/task-status更新已授权推送500及CI终态，旧a192失败/未推送字段完整保留为历史。T07根与nested checks均同步4324/4323.9/14.8，不用旧4812.2当当前性能。旧报告/social工作稿同步私下真实模型已通过、公开权利未获，旧阶段保留Git/历史段。deployment-checklist按实际公示完成日+30天更新，公布日与完成日分开、均未知，shutdown_allowed仍false；没有安排任务或接受条款。

## 外部条件与后续准备

1. 实际账号/套餐/订单适用许可和原件/派生GLB站外分发权、源码许可选择，须本人或权利方确认；已有SHA来源链、正常/错误法线与私下实际使用说明，公共catalog保持空。
2. 获准主/备用托管项目、URL/子路径、访问权限、维护责任人及发布授权；已有精确分发校验与浏览器验收脚本、CI占位artifact、部署/回滚执行单；没有公开HTTPS可验入口，未采购或部署。
3. 本人登录报名、队伍/选题、字段限制和声明、正式提交授权；已有草稿与预检，不能代造作品ID/回执，最终G0–G4不因私下工作关闭。
4. 实际Edge/Safari设备及另一真实网络；已有Linux Chromium154私下与Chrome156 CI、375px视口、受控iframe/断网证据，不是外部真机或网络验证。条件具备后由agent继续执行。

所有原/派生模型、PNG/PDF/视频、浏览器profile及原始协议/网页均在源码包之外。最终正式材料仍需获准目标与权利冻结；本工作稿不填写提交回执或宣称已上线。
