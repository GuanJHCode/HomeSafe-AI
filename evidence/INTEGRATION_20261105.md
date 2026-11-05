# a192 与真实模型私下分支的本地集成（2026-11-05 UTC）

已只读确认远端 `refs/heads/codex/v6.1-browser-3d` 精确为 `a192d51184393187a9e1d98e9c92cd2da06b1dd7`，然后通过HTTPS取回源码，在新隔离工作区创建 `codex/integrate-private-models-20261105`，以a192为首父合入 `9a0818f7c769e084bdaea0f723cb4266a0ab1224`。共同基线是 `ba21f54ace3218cfa2d695092b735165c923b1b9`；原独立分支/工作区和历史恢复包保留。本地集成没有推送或发布，a192远端CI另有父线程诊断，下文区分其记录与本地实际结果。

## 合并内容与冲突处理

- a192的受控页面/Worker断网验收、开发报告/真实占位录屏工具、原独立审查与合成文本证据全部保留；其新增CI功能命令逐字节保留。
- 9a的真实原件/派生件方向、纹理、实际代理、零法线修复与9项测试、逐模型503/SRI恢复、375px/WebGL恢复及拖动导出验收和公开来源核对全部保留。
- 只有 `START_HERE.md`、`evidence/HANDOFF.md`、`evidence/task-status.json`、`package-manifest.json`、`CHECKSUMS.sha256` 产生文本冲突。入口文档合并双方新增段落，基线历史仅保留一份；状态按任务/子任务ID三方合并，保留两边独立完成项和各阶段证据；清单取显式allowlist并集后重算所有摘要，不选择某一整份覆盖。
- 9a四脚本及法线测试精确保留。a192网络/材料工具的原业务验收流程保留；两类必要的限定修复为材料capture事实范围，以及下述CI导航缓存初始化/诊断/初始请求准备。CI只追加一条合成占位缓存回归命令，严格性能段逐字节保留。产品App、Python规则内核和canonical契约未改。JSON冲突中的当前验证范围/同步状态由本集成记录替代，旧阶段未推送/下载失败/无法读取a192等陈述保留为历史。

a192现已从远端取得并合入，用户无需再转移其源码包。另一环境原有PDF/MP4等私下二进制不在Git，本轮没有假称从源码恢复了这些媒体；可按已集成工具在当前环境另行生成带当前来源标识的开发材料。

## 发现的材料事实错误与修复

首次用原a192生成器在集成环境运行trial，工具退出0并生成4页PDF/25.08秒真实占位短片，但PDF和manifest固定写“当前环境没有原件、实际Lux3D验收被阻断”。独立审查实际核对了两件匹配SHA原件和该次PDF，确认这是新环境中的错误陈述，不能把工具exit0当作材料事实验收通过。旧PDF/HTML/视频/manifest和独立红灯全部留私下，安全反例摘要见 `evidence/integration/material-facts-counterexample.json`。

先新增AVAILABLE/UNAVAILABLE/NOT_ASSESSED三组实际render用例，旧模板3项红灯；再将录屏注释、两处环境字段、报告callout/开放事项/页脚和manifest/summary统一限定为“本次占位capture未使用或评估真实模型”。原件是否可用、独立真实模型验收和分发许可应另查证据，不由占位录屏工具推断。三项回归绿灯，所有JS51项通过；App/Core、录制时序、视频转换、输入/导出绑定和正式门禁未改。

修复后以新私下目录重新运行trial：4页中文PDF、26.08秒H.264真实占位短片，7个产物摘要通过，PDF不再误报原件缺失，manifest记 `NOT_ASSESSED_BY_PLACEHOLDER_CAPTURE` / `NOT_USED_IN_THIS_CAPTURE`。这不是180–240秒完整视频或正式参赛材料。两次捕获时HEAD均为a192，工作区为尚未提交的merge，App/Core对HEAD及ba21锚点一致、内容摘要均为 `7ec6dee5de77002c726a3c517602e96be17905f815bb873552bf625acb68cbb8`；没有在捕获中改变HEAD/App/Core/dist。当前短试没有冒称已恢复另一环境198.52秒原视频。

## a192远端CI失败与本地缓存修复

父线程的astra诊断已按官方Library助手物化（`libfile_a2b95f5874208191b8c4fa2c1c80dd73`，版本1；摘要见 `evidence/integration/ci-cache-diagnostic-summary.json`）。它记录CI41980778267/job127090136585在a192的第二页 `assert.ok(firstResponse?.ok())` 失败，较早功能步骤已通过、后续trace/embedding未执行、严格性能skipped；原artifact未取得，原请求是否304仍是高置信推断，不冒称本线程读取了原CI HTTP响应。

旧脚本在第二页goto之后才禁共享HTTP缓存。标准ETag/Last-Modified和强制重验证夹具中，实施者及独立审查者均直接观察旧序发条件请求、实际HTTP304、Puppeteer ok=false但缓存HTML正常显示，停在原成功断言的第6阶段。修复将原cache-disable调用移至Network.enable之后、Fetch/goto之前，保留成功断言以及全部断网、取消、重建、未知和导出断言，不把304普遍放行。

新增诊断同时保留Puppeteer status/statusText/URL/fromCache/fromServiceWorker及CDP Document普通/extra响应状态；请求extra headers可记录实际自动重验证头。只选缓存相关有限header，不收集Cookie/Authorization；失败时还打印到stderr，避免artifact不可读时缺状态。直接观察到CDP普通200/extra304和Puppeteer304，与原CI只可推断的事实分开。

一次并行补测又保留了准备阶段反例：新导航已200，但其他bootstrap请求先断流，清理使被hold的config变ERR_ABORTED。没有接受ERR_ABORTED代替原INET_DISCONNECTED断言；最终在goto前注册三个bootstrap响应，明确读完JSON正文后才对唯一hold的config切断网络。未依赖header-only网络空闲或固定sleep掩盖竞态。独立三JSON正文各延迟2秒的实际夹具8阶段通过；最初某个私下外层探针假定应有failure.json而ENOENT，按探针假设错误保留，不作为产品红灯。

新增 `check_network_cache_browser.mjs` 在当前placeholder dist上自建loopback夹具，当前源码只退回调用位置形成明确标注的旧序重放，不需要CI浅克隆拥有历史Git对象。最终5项实际及独立回归通过：旧序200→304、exit1/6阶段；提前禁缓存200→200、exit0/8阶段；JSON头先到/正文延迟1秒同样8阶段；404/500各明确exit1且stderr状态诊断存在。受控注入的1秒是夹具输入，修复没有固定延时。当前最终diff本机使用Chromium154；astra留存的Chrome156控制实验单独归属，不声称当前重跑156。新集成远端CI仍NOT_RUN_NO_PUSH。

## 实际集成验证

- Python343、应用39、JS51（含新增3项材料事实回归）通过；canonical契约、严格TS契约、Vue类型检查、构建/分发校验及真实Pyodide一致性通过。相关源代码修改后没有无故重复不受影响的原生检查。
- 实施者和独立审查者分别实际运行a192受控网络脚本：页面/真实Worker禁缓存离线请求被阻断，已加载会话的本地编辑/导出/快照重算及显式恢复通过。它不等于断网冷启动或另一真实网络。
- 实施者和独立审查者分别在集成代码上运行真实两件私下派生模型完整 `--resilience`：正常拖动/旋转/回弹/挑战/导出/Worker恢复、4种503/SRI单件故障、375px按钮、新canvas重建以及真实绑定下拖动导出保护通过。两个公开模型清单仍为空，原/派生字节及持久候选false保持。
- 本地 `/preview/` 分发HTTP字节校验通过，startup trace的happy/failed_init/cancel_parallel_init及同源/跨源受控iframe实际通过；实际URL只绑定loopback，公开HTTPS/部署NOT_RUN。修复后4页PDF逐页、短片关键帧和652帧/26.08秒、7产物/39源文件聚合摘要均经独立实际核验。
- 当前提交预检实跑仍BLOCKED/退出2；正式性能p95未重测，3秒OPEN_NOT_MET按用户优先级保留，严格CI预算/enforce不变。a192远端CI没有由本线程重新查询或升级为集成CI通过。

机器收据和源保留核对见 `evidence/integration/`；[最终独立审查](REVIEW_INTEGRATION_20261105.md)为限定PASS，包含新事实修复、缓存旧红新绿、完整正文屏障和最终5项回归。最终提交/恢复校验由交付回执记录。本地可做集成不会关闭模型公开分发权、账号声明、获准托管、真机/另一网络及正式G4门禁。

## 私下边界

原/派生GLB仅从当前私下绝对路径传给loopback harness，不能进入 `assets/public`、静态dist、Git对象、源码恢复包或公开CI artifact。公开asset manifest和feature map继续为空；构建必须只含明确占位和固定运行时。原始网页/条款全文、账户图像、私下截图/PDF/视频、浏览器profile及依赖/vendor均不得加入源码allowlist。最终发布前仍需账号/套餐/订单的实际分发许可、获准目标和真机/第二网络验收。
