# 真实模型私下材料：独立工具审查

日期：2026-11-05 UTC。审查工作区为 integrated-app，分支 codex/private-real-materials-20261105；实际 HEAD 为 5001222413937586604e8d944ba83787c7cb06fa，新增材料工具及文档尚未提交。本审查没有推送、部署、上传模型或媒体，也没有改产品 App/Core。

当前结论：PASS_SCOPED_TOOLS_AND_PRIVATE_TRIAL_AFTER_HTTP_FRONT_AND_WORKER_FIXES。私下模型输入链、默认占位行为的保留、精确覆盖机制、11项合同/报告测试，以及实际 Chromium 的“两模型加规则就绪”已独立检查。随后独立复核第四次短试的四页PDF、视频关键帧、完整帧数/PTS和同版导出，短试限定通过。完整180–240秒媒体及最终模板PDF仍为 PENDING_INDEPENDENT_FULL_MEDIA_REVIEW；不能据此关闭 T10 或 G4。FFmpeg包装器与产品基线条件行的补充审查见下文。

## 本次实际检查

检查了 create_development_materials.mjs、private_materials_inputs.mjs、development_materials_report.mjs 及两份相关测试，参照既有 check_private_assets.mjs/private intake 和此前真实模型独立审查。执行：

    node --test scripts/private_materials_inputs.test.mjs scripts/development_materials_report.test.mjs
    git diff --check

最终11项测试通过，diff检查通过。初版9项虽然通过，仍遗漏实际 Node HTTP 与错误方向两项边界；以下失败结果在修复前真实取得，没有把旧红灯改写成通过。

所有本次独立探针结果均留在忽略目录 evidence/private/reviewer-private-materials-code-20261105/。探针为 Node 24 ESM 内联脚本（node --input-type=module）及Python标准库脚本；没有重新录制浏览器操作或修改实施侧媒体，PDF渲染和视频取帧仅产生新的私下审查副本。独立浏览器为 /usr/bin/chromium，Chrome/154.0.8037.57，puppeteer-core 24.15.0，隔离上下文及 loopback；不是 Chrome156、真实手机或公网验收。

## 三类真实失败与复审

### 1. Node HTTP200 被错误中止

初版 scene 覆盖用全局 fetch，随后调用 response.ok()。Node Response.ok 是布尔值。独立真实 loopback HTTP200 JSON 夹具调用实际 attachPrivateMaterialInputs 路径，得到 TypeError: response.ok is not a function，原本应 respond 的请求变成 abort(failed)，预期响应断言退出1。此探针使用真实 Node HTTP，但浏览器事件边界是可控替身，不称完整浏览器运行。

红灯：scene-fetch-response-counterexample.json。

实施改为 response.ok，新增真实 Node HTTP200 回归；最终11项测试中的该用例通过。随后精确 CDP 的独立真实浏览器探针实际完成两份 scene 覆盖，errors=[]，作为浏览器路径的绿色证据。原错误JSON未覆盖。

### 2. 校准收据与实际正面脱节

独立使用匹配真实原件/派生件/repair SHA 的输入，只把复制的校准 orientation 从 Y180 改成 identity，保持 source_front_candidate=+Z 和旧 PASS 检查。初版输入加载器接受并临时设置 reviewed=true，同时证据仍宣称 scene_front=-Z；实际 Quaternion 将 +Z 映到 +Z。180度前后宽深相同，因此仅边界尺寸校验不能排除此反例。

红灯：wrong-front-counterexample.json；输入副本为 wrong-front-inputs.json 和 wrong-front-calibration.json。真实 GLB、原始校准和 repair 记录均未修改。应拒绝断言真实退出1。

实施新增 strategy/revision、有限单位 Quaternion、实际 Y180、bounds/target dimensions 和 pivot 合同检查。最终11项测试包含 identity Quaternion 拒绝用例。独立重新加载上述原反例，确实以“Y-up +Z source front must actually map to scene -Z”拒绝，结果在 browser-precise-cdp-initialization-green.json 中 identityRejected=true。数学方向合同不代替后续对材料实际画面的目视检查。

### 3. 全局 Puppeteer 透传拦截挂起 Worker

HTTP修复后，独立实际页面出现两件模型成功加载、五项私下覆盖全部完成、errors/blockedExternal均空，但规则一直停在“正在加载场景和同源规则”，没有报告。第一次自开同版 dist loopback 服务，第二次使用实施侧 127.0.0.1:42731/preview/，均保留结果：

- browser-initial-load-probe.json：两模型已加载，但等待报告20秒失败。
- browser-worker-initialization-probe.json：Worker 已加载入口、辅助模块、pyodide.mjs 及 core manifest/zip；其后 runtime/stdlib/lock/asm 请求无 response/finished，等待报告15秒失败。
- worker-broad-interception-ab.json：相同 dist、Chrome154、每例新浏览器上下文；无拦截获得已接受报告；全局 page.setRequestInterception(true) 且所有请求原样 continue，仍等待报告12秒失败。该轮挂起的是 worker-controller.mjs，continue 调用无错误。因此结论限于该环境全局拦截会干扰 Worker 加载，不把某一固定资源解释为唯一根因。

实施改为主页面 CDP Fetch.enable 精确五个 URL（catalog、两个 scene、两个 GLB），其余请求不暂停；外部 HTTP请求被动记录并要求为空。GLB 自包含及 SHA 合同保留，原广域拦截失败没有删除。

独立实际浏览器绿色结果：browser-precise-cdp-initialization-green.json。两件真实派生 GLB 摘要正确、五项覆盖完成、Worker runtime/WASM/stdlib/wheels均HTTP200、规则 aria-busy=false 且无 alert/pageerror，页面报告摘要为 6e7b888295fee7342f52cdf98b4c13e3a4028756ac19f9fa4f1d3ba9270cd63b；errors、blockedExternal、externalRequests均为空。该探针只验证初始实际加载和规则就绪，没有把新180–240秒操作或PDF验收计为已完成。独立自开服务器与浏览器均已关闭，实施侧服务器由实施者管理。

## 工具与权限边界

- 默认未提供 private-models 时仍要求公开 catalog/dist 为占位空清单，并标记本片未使用真实模型；私下模式为显式参数。
- 真实模型仅通过隔离浏览器精确请求覆盖提供，不写静态服务器、public、dist 或公开 catalog。persisted candidates仍 reviewed=false；runtime true仅是私下门禁，不能等同许可核准。
- 输入明确区分原件与零法线修复派生件，核对真实文件、repair、calibration摘要；捕获前后复核输入及工具摘要。两件派生件沿用此前独立证明的 POSITION/索引/UV/图像保留链，不把此次读取 receipt 说成再次执行完整 Khronos/二进制修复审计。
- 场景仍为 synthetic_demo，模型来源链为 lux3d_web。+Z→场景−Z、非均匀教学尺寸拟合不表示实测或保真；来源声明不证明作者、账号适用条款或站外分发许可。
- 私下录屏在两模型和规则就绪后启动，因此不能声称包含冷启动或据视频等待估计性能。原连续帧、实际时长、帧数/PTS、报告版面、导出一致性仍需对最终产物实际验收。
- 本报告仅纳入文字、命令及JSON反例位置，没有嵌入GLB、截图、PDF、视频或原始第三方全文。上述私下目录不纳入源码 allowlist/公开 artifact。

本轮工具审查时摘要：

| 文件 | SHA-256 |
| --- | --- |
| scripts/create_development_materials.mjs | f68c4304cb1463b9b72bcd060d8e1b128bd4fd6e1381e5f22a11800c17506b19 |
| scripts/private_materials_inputs.mjs | fac7ccbbcef34816bd1e48c9425a185fa556996bf7824fe3fb077b79486d7147 |
| scripts/development_materials_report.mjs | 8ef6e347a64f6b5415f7fae39221f0988a404f2bb139b7e4afee5defbb5d266b |
| scripts/private_materials_inputs.test.mjs | 19689d1a24b2457283693dacf6d3ec040eb59bf11681003536af1ac7b0fb786e |
| scripts/development_materials_report.test.mjs | d5b65b44ec99fb2ade4ec8aa9aa7d6926d1f2acf867b3ef9a6edeebdee92d5fb |
| scripts/capture_ffmpeg_fast.py | 5e6f34a150cee333e0e24b105a3747254c2f6ca902147ffe1dbca3806a89db76 |

## 编码入口、标题与产品基线补充审查

第三次短试已经生成交互/导出和PDF，但最终正向文字断言因缺少连续“真实 Lux3D”而退出1。独立读取其 failure.json 确认该实际失败；旧产物保留。formatter标题改为“本次实际使用的真实 Lux3D 模型”，不删除该断言。第四次短试的实际PDF已显示该标题，不能将第三次失败材料改记为成功。

capture_ffmpeg_fast.py 在私下 screencast 中显式作为 ffmpegPath，默认占位分支仍调用原默认入口。独立使用可执行FFmpeg替身真实运行包装器四种参数输入（含Puppeteer式VP9参数、无cpu-used、空参数和重复cpu-used），验证只把 cpu-used 后面的值设为8，其余参数逐项相同；stdin/stdout原字节、stderr和退出码17均透传。wrapper可执行、用execv替换进程，已加入 capture_tool_sha256。结果：ffmpeg-wrapper-contract.json，PASS。该结论指编码参数和字节流透传，不证明更换VP9 preset后像素或感知画质完全一致；实际画面另见短试审查。

短试完成后formatter新增“产品 App/Core 基线”条件行，明确授权500完整SHA及对该基线一致状态。独立render边界使用明确标为合成的未来工具HEAD，与实际产品500作区分，两行均正确出现，结果 product-baseline-row-contract.json 为PASS。随后又将易误解的“静态分发与公开模型清单保持为空”改为“静态分发保持原占位版本，公开模型清单为空”，准确区分应用/runtime静态分发与空模型清单；独立重跑最终4项报告测试及diff检查均通过。第四次短试仍保留旧formatter SHA f33d4d284b0fd01cb446e6d0ced286cbff192a2453b1e924c7608a2b41d6f011，未覆盖其PDF；这两处最终模板变化的PDF版面仍须随完整产物实际检查。

## 第四次真实模型短试的实际产物审查

实施侧短试目录为 evidence/private/development-materials-real-fast-trial-20261105/。本审查读取已生成产物，没有把实施侧捕获写成审查者重新录制。manifest为 TRIAL_ONLY_NOT_DELIVERABLE / DRAFT_NOT_SUBMITTABLE：实际HEAD500，工具dirty，App/Core对HEAD和授权500均一致。11项产物SHA与6个关键源文件SHA全部独立核对相符；初次核查时6项捕获工具SHA也相符，其后仅formatter上述两处文字/产品基线条件行变化另作审查。

实际执行 Poppler pdfinfo/pdftotext/pdftoppm，将四页报告渲染到新的私下审查目录并逐页 view_image。中文、来源链的四条完整SHA、版本表和页脚清晰，未见截断、页脚覆盖或额外空白页；显示真实派生件、非均匀教学拟合、未获公开许可、内核/模型来源区别和NOT_SUBMITTABLE。报告并未声称取得公开入口、用户试玩、本人提交或全屋安全结论。

实际执行 ffprobe -count_frames 与全量packet PTS读取：原VP9和派生H264都是1280×900、25fps、1371帧；MP4时长54.84秒。原片PTS为0.04至54.84，MP4为0至54.8，去掉起点偏移后1371个呈现时间逐项相同，结果 trial-pts-review.json 为PASS。没有用计划等待秒数代替视频时长，54.84秒不符合完整180–240秒要求。

从实际MP4提取并 view_image 查看1、14、18、32、47、49、52、54秒八个关键帧：起始明确标记两件真实Lux3D法线修复派生件和私下范围；椅子坐面开口、柜体双把手与木纹可见；能看见实际拖动预览、主挑战中的柜体姿态变化、越界提示及接受位置恢复；未知、未覆盖与最终清单摘要保留。未发现本轮CPU preset造成文字不可读或明显块状损坏；这属于取样目视结论，不表示逐帧完整播放或像素无损。没有音频或系统原生打印预览的虚假声明。

独立重新运行 check_scene_snapshot.py：MATCHES_CURRENT_CORE，revision3、demo-rules-3.0、input_hash=2dbebe5644748e4973e2f5ccf7fef102b0642981d1c8eec178affe0ab1105a08，与行动清单、快照、manifest、实际PDF及视频清单画面一致。快照source_kind=synthetic_demo、includes_asset_bytes=false，两件对象的asset_id绑定真实私下描述；catalog/两scene/两GLB共五种覆盖均有摘要，错误/外部请求为空。完整独立数据核对和目视清单保存在 trial-independent-review.json；媒体及取帧仅留忽略目录，不嵌入本报告或源码包。

## 当前交接与CI留存复核

本次只读核对 START_HERE、HANDOFF、task-status、submission报告及social稿、deployment-checklist，并读取留存的 evidence/current-ci/5001222-ci-summary.json；没有重新HTTP获取GitHub回执或运行新远端CI。

留存摘要绑定 5001222413937586604e8d944ba83787c7cb06fa / CI41993004005 / job127129460804：功能步骤通过；整体failure保留，唯一失败步骤是严格性能。首次可编辑p95=4324ms>3000ms，冷规则p95=4323.9ms<12000ms、热评估p95约14.8ms<150ms；3秒目标按用户决定不阻塞其他开发，阈值与失败传播未降低。Python343、应用39、JS24+27来自该留存CI摘要，不是本次重新全套测试。CI使用程序夹具和占位场景，不能替代私下真实模型或公网性能。

当前入口/HANDOFF/报告/social已明确500获授权推送、真实模型私下通过但公开权利未获、本轮新工具未推送、无网站发布；历史阶段分别保留。deployment-checklist已把公布日和公示完成日分开，维护按 max(2026-12-31, actual_publicity_completion_date+30days)，完成日未知仍 maintain_until=null/shutdown_allowed=false。原CI41980778267的304仍仅为高置信推断，新受控304夹具不改写原次事实。

本次发现T07根 current_remote_ci 与嵌套checks/remaining存在新旧状态冲突，已报告实施者；其修复后再次只读复核通过。旧检查完整保留在 historical_checks_before_5001222，current字段与remaining现统一为500功能通过、4324/4323.9/14.8及本轮新工具本地未推送。没有由本审查代改状态文件。其他公开权利、获准托管、本人账号/声明、实际Edge/Safari及另一网络、正式G4/提交门禁继续保留。当前无其他具体代码或短试阻断；尚未生成并独立验收的完整媒体不能计为完成。
