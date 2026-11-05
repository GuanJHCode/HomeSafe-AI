# 网络恢复与开发材料续作（2026-11-05 UTC）

本轮基线为本地 `ba21f54ace3218cfa2d695092b735165c923b1b9`，分支 `codex/network-materials-20261105`。原工作树和既有恢复包保留，不推送、不部署、不发布未核准模型。先前下载修复、拖动输出保护、中性说明和私下来源方向工具的审查结论继续按各自版本解释。

## 原模型物化的准确结果

前一次 `library.prepare_materialize` 成功返回原始模型包的传输记录，但未直接提供本地 `workspace_path`；当前技能 `library_file_transfer.py materialize` 在本环境私下目录写入时退出1，原始错误为 `library file transfer failed: download failed`。当时目标已是本环境工作区下的 `evidence/private/lux3d-intake-20261105/`，失败后未重试。

本轮按用户要求和当前 Library 技能，对同一已解析原包引用做**一次有界重试**：先在当前执行环境创建工作区下的 `evidence/private/lux3d-intake-retry-20261105/`，重新准备传输，并将完整返回对象一次性交给当前技能下载助手。准备成功，下载助手仍退出1、返回相同错误，目标文件不存在。工具没有给出 HTTP 状态，因此不把本次错误补充断言为403。没有猜测地址、改用手工下载或绕过拒绝；本轮不再重试。完整工具、ID及绝对路径的本地原回执保留在 `ci-evidence/network-materials/model-retry.json`，不纳入源码包；[源码导出副本](network-materials/model-retry.json)明确脱敏内部标识和绝对工作区路径，保留错误与可复核过程。

父线程后续在原持有环境核实原ZIP为20,814,439字节，SHA-256为 `4c8e15533bfadec18e28a8ffe7209c884ac25d719581055795ab97f71b5978a2`，包内18个文件校验通过，Space条目元数据仍可读；本环境没有重验这些字节。因此当前只能判定字节传输失败，不能判定原模型损坏或权限不足。按最新指示不再请求下载、不更改网络或权限，仅保存已有脱敏证据。

只读诊断另确认：已返回传输记录的准确主机 `sdmntprwestus.oaiusercontent.com` 不在当前生效restricted允许列表中（环境状态observations_current=true / state=enforced）。这是明确可见的配置缺口，但本次helper错误没有HTTP状态或请求ID，现有network_diagnostics为空，没有该请求的代理拒绝日志；不能把配置缺口当作已证实唯一根因。最小待批准变更仅为允许这个准确主机，不加通配、不开放全网；本任务没有执行该变更、读取凭证或重发链接。按[官方排查](https://learn.chatgpt.com/docs/environments/cloud-environments#troubleshoot-setup-and-runtime-access)与[网络隔离说明](https://learn.chatgpt.com/docs/agent-approvals-security#network-isolation)，hosted app/MCP与命令网络不同，准确目标、认证及执行路径的其他限制需分别核对。脱敏事实见[配置缺口记录](network-materials/model-network-gap.json)。

随后用户已批准**只增加 `sdmntprwestus.oaiusercontent.com`**并验证下载，前述“待批准/不更改网络”是批准前的历史状态。当前可用 Cloud Environment 工具只有 `environment_status`、`environment_diagnostics`、`read_environment_diagnostic`，没有受支持的配置写入/发布接口；批准后只读复核仍为 current/enforced、准确主机缺失，配置变更未执行，未再发下载。不能通过改本地 policy 文件或扩大命令网络权限替代真正生效的允许列表。

受支持入口是 Settings → Codex Cloud → Environments → 当前环境 → Edit → Public internet access → Additional allowed domains，仅增加已批准主机，其他规则不变，再 Save/Republish。已运行任务不保证收到新配置，需在实际执行任务确认当前生效策略后，才按 Library 技能重新准备传输；若新返回地址属于不同主机，现有授权不覆盖它。入口及任务生效边界见[官方环境说明](https://learn.chatgpt.com/docs/environments/cloud-environments#connect-to-services)。当前阻断是缺少受支持的配置写入接口，非新增批准缺失；这一配置缺口仍不是helper失败的唯一根因证明。

真实 GLB 摘要核验、纹理/方向目视及实际模型交互仍 `BLOCKED_ORIGINAL_BYTES_UNAVAILABLE`，公开权利仍 PENDING。原包失败不阻止以下独立工作。

## 本轮可执行子项

- `T07-network-interruption-recovery`：在隔离 Chromium 中分别证实窗口/Worker 的受控断流；验证已加载会话的本地评估、失败/取消状态和恢复联机后的显式新 Worker 重试。它不是另一实际公网网络、可离线冷启动、PWA 或 Safari/Edge 验收；不新增 service worker。发现真正产品缺陷才先留反例再最小修复。
- `T10-development-materials`：生成明确标为 `DRAFT_NOT_SUBMITTABLE` 的中文开发报告 PDF 与约3–4分钟真实操作录屏。只用 localhost 合成客厅/程序占位，绑定实际 App 来源、输入摘要/规则版本、生成数据及产物摘要；报告/视频不能冒充真实 Lux3D、公网或正式参赛材料。截图只用于内部审阅，不作 Library 或 Git 交付。

两个子项完成后分别由独立 agent 审查与实际验证，才关闭限定范围。T07/T09/T10整体与G1/G3/G4、账号与正式提交不会因开发材料或受控网络测试而关闭。

用户暂不以3秒首次可编辑p95工程目标阻塞其他开发；该目标仍OPEN_NOT_MET，CI严格性能步骤、预算和失败判断保留。本轮没有新的性能计时声明，也没有正式提交或未来自动化。

## 受控网络恢复：限定子项已完成

新增 `scripts/check_web_network_recovery.mjs`，未改 App、Worker 或 Python 规则。真实 Chromium 154 中，页面与实际 module Worker 的独立 no-store 探针均记录 `net::ERR_INTERNET_DISCONNECTED`；已加载会话仍完成本地移动、撤销/重做、JSON/场景快照和打印调用。快照以当前 Python 内核复算为 `MATCHES_CURRENT_CORE`；独立审查深比7组资料，true 2 / false 1 / unknown 45及来源均保留。

终端 Worker 错误为明确的测试注入；离线显式恢复失败在页面 config 请求，未创建新 Worker，未发布旧报告。恢复联网后只有显式重试创建新 Worker，接受布局与资料保持，失败提案不重放。配置暂停和打印调用计数同属受控测试，不宣称系统打印预览、断网冷启动或另一实际公网网络。

[独立审查](REVIEW_NETWORK_RECOVERY_20261105.md)及[独立原始回执](network-materials/network-review/network-recovery.json)为 `PASS_INDEPENDENT_SCOPED`，只关闭 `T07-network-interruption-recovery`。CI 只增加一条功能验收命令，严格性能步骤与性能脚本和ba21f54逐字节一致。T07整体保持 IN_PROGRESS。

本轮重新运行 Python 334、应用39、JavaScript48项均通过，类型与3份canonical契约检查通过；这批是本轮实际回归，与材料中引用的既有ba21f54历史记录分开。没有重新构建或改变录屏所用冻结 App/Core/分发，也没有新的性能测量。

## 开发材料：限定子项已完成

新增 `scripts/create_development_materials.mjs` 与 `scripts/development_materials_report.mjs`。完整模式实际生成4页中文报告、198.52秒（3分18.52秒）H.264操作视频、2页打印清单以及同版JSON/场景快照；报告为 `DRAFT_NOT_SUBMITTABLE`，视频为 `LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING`。本次无真实模型、无公网、无用户试玩、无正式提交。

捕获绑定ba21f54；当时工具/证据工作区为dirty，App/Core与HEAD一致，独立重算39文件内容摘要为 `7ec6dee5de77002c726a3c517602e96be17905f815bb873552bf625acb68cbb8`。原WebM及MP4均4963帧，末包PTS/媒体时长198.52秒，转换命令无裁剪或变速；独立关键帧与1fps抽样支持实际操作及持续画面变化。报告4页、打印2页均逐页可读，中文字体嵌入；打印版没有录屏注释。28条本地HTTP资源的摘要/字节与冻结dist一致。

报告、快照与打印同为布局v2、输入摘要 `c8c61e185bd547373f4a10979f6e0d4310b325058950c3b20fc58ecffad86ebc`、规则 `demo-rules-3.0`；快照复算 `MATCHES_CURRENT_CORE`。实际视频展示视角/检查卡、椅子移动引出的双角色取舍、撤销及挑战重新摆位、达标后的未决项，以及JSON/快照和打印按钮。镜头没有显示系统原生打印预览，不能把单独生成的print CSS PDF说成原生预览录像。

已保留并修复三类工具反例：首次短试的初始化顺序错误；首轮完整视频241.92秒超过240秒上限；录屏注释混入打印页眉。完整视频重新录制，未裁剪或加速；25fps短试捕获8.0085秒与原片7.92秒相差0.0885秒。原始失败二进制仍在private，源码只含[反例摘要](network-materials/materials/failure-counterexamples.json)。原始full-2独立stdout/stderr未另存，明确不重构；[事后实际命令回执](network-materials/materials/final-audit.json)、完整manifest与独立审查提供产物核验。

[材料独立审查](REVIEW_DEVELOPMENT_MATERIALS_20261105.md)为 `PASS_INDEPENDENT_SCOPED`，只关闭 `T10-development-materials`。可导出的生成来源及摘要见[材料索引](network-materials/materials/README.md)、[完整manifest](network-materials/materials/materials-manifest.json)、[独立完整性](network-materials/materials-review/independent-integrity.json)和[独立画面审查](network-materials/materials-review/independent-visual.json)。开发报告PDF SHA-256为 `5b0d4446bd7def725f37e5ef97fb105c113e65aee6671cf7c6ac0417234a3197`；MP4为 `dc3c7e275afe0de9801466da14f8784438ee5f1dbe2267170c6f61a323b7e7f3`。PDF/MP4以自有占位开发稿私下交付；截图、原WebM和所有未核准原模型均不进Library、Git或源码恢复包。

## 最终状态与可恢复交付

本轮两项限定子项分别独立通过；T03、T04、T07、T09、T10整体及正式G4/提交门禁没有因此关闭。提交预检实际退出2、保持BLOCKED。首次可编辑3秒工程目标仍OPEN_NOT_MET，仅暂不阻塞其他开发；没有新的性能数值，严格CI预算/enforce及失败传播不变。

重新只读核实远端功能分支仍394eb04、master仍2f562a3；[当前CI回读](network-materials/current-remote-ci.json)仍41948477248 attempt1，功能失败、性能skipped。新本地功能未推送，不能声称远端修复CI通过。原失败下载字节缺失，原CI竞态归因仍为高置信而非确定证明。原 `/workspace/HomeSafe-AI` 工作树保持3ed4e488、clean，未覆盖。

源码清单仅追加逐项审核的脚本、Markdown、合成JSON与日志；真实模型、私下媒体、构建和依赖不进源码导出。最终本地提交、恢复ZIP及离线克隆校验由交付回执给出。唯一需环境界面处理的传输配置步骤见上文：用户已批准exact host，但当前没有配置写接口；实际策略生效前不再下载。公开权利、正式托管入口/设备网络验收与账户/表单仍需真实证据。
