# V6.1 开发预览实施与验证

日期 2026-11-04，Asia/Shanghai。功能分支 `codex/v6.1-browser-3d`，起点为 GitHub 已核对的 `master` 提交 `2f562a3d0c6cae7aedbe2ea13a469a98a24ee57f`。

## T02 实现范围

| 环节 | 实现 |
| --- | --- |
| 场景 | `SceneRuntime` 按 canonical 场景生成客厅、轮廓和通道。角色切换只改变相机观察方式。 |
| 变换 | `TransformController` 在拖动期间本地预览，松手提交一次。Python 返回的 PlacementIssue 控制对象和边界提示，回弹至已提交位置。 |
| 工作区 | `WorkspaceController` 先提出布局，再接受与之匹配的评估。合法移动创建一条历史；撤销、重做和重置也先取得评估结果。 |
| 评估 | `EvaluationController` 复用既有 module Worker，按客户端版本和请求生命周期丢弃迟到响应，比较结果匹配前后输入摘要。规则不可用时可重建 Worker。 |
| 解释 | `FindingsPresenter` 按角色显示依据、未知、覆盖与冲突。评估进行时隐藏上一版本检查与清单。 |
| 挑战 | `ChallengeController` 调用 Python 的挑战会话。移动请求仅包含椅子的平移和旋转。剩余问题与覆盖均来自本次结果。 |
| 清单 | `ReportBuilder` 用同一个当前布局和输入摘要生成 JSON 与打印清单，将模拟布局变化、资料补充和现场核查分组。 |
| 资产 | `AssetLoader` 可从同源加载经审核的自包含 GLB，检查文件摘要、校准和包围盒，并在同一对象节点下替换占位几何。当前样例使用程序占位家具。 |

## 构建与测试边界

同源预览资源暂存通过。终端 npm registry 域名解析返回 `ENOTFOUND`，离线缓存返回 `ENOTCACHED`。完整 `npm run build` 已执行，暂存成功后在 `vue-tsc` 缺失处退出 127。当前无 `apps/web/dist`，无可核对的静态部署产物，应用级 Vue 和 Three.js 严格检查尚未完成。直接依赖已固定版本，npm 安装受阻，尚无 npm 锁文件。

`stage_web_preview.py --verify-dist` 在真实构建目录缺失时拒绝继续。在隔离的合成目录中验证了允许清单、SHA-256 校验和拒绝被改写的暂存文件。该夹具仅用于检查校验器。

正式构建就绪后，可在真实 Chrome 执行 `node scripts/check_web_preview.mjs http://127.0.0.1:4173/ /absolute/path/to/chrome /absolute/path/to/puppeteer-core.js`。该脚本使用已安装的浏览器和 Puppeteer Core，验证真实鼠标拖动、回弹、角色切换、布局历史、挑战剩余事项、JSON 下载与刷新。

| 检查 | 实际结果 |
| --- | --- |
| Python 参考套件 | 187 项通过，Pydantic 2.13.5 与 2.12.5 各执行一次 |
| 生成契约与包检查 | 3 份契约匹配，8 项包检查通过 |
| 浏览器探针 JS 回归 | 15 项通过 |
| 预览控制器与变换 | 16 项通过。合成 GLB 测试由于 Three.js 缺失未能加载 |
| TypeScript 5.8.3 | 生成契约、应用领域控制器和变换控制器的直接严格检查通过 |
| 同源 Python bundle 暂存 | 10 个模块，二进制与文件清单已重新生成 |
| 官方 Pyodide + TS 控制器集成 | `node scripts/check_web_core.mjs` 通过。覆盖合法移动、冲突、非法重叠、历史、挑战与清单摘要。达标后实际剩 2 项已触发、4 项待核查、5 类未覆盖 |
| 应用 Chrome 验收 | NOT_RUN，Puppeteer 启动 Chrome 失败。应用构建和 localhost 监听也未就绪 |
| 赛事提交预检 | BLOCKED，退出码 2，缺最终素材、真实资产映射与公开交互证据 |

## T03 资产交接

请提供经核准的 `chair.glb` 和 `cabinet.glb`，均为自包含 GLB。每件配套提供 Lux3D 网页生成记录、使用的素材权利、允许公开分发的决定、生成参数及实际扣费证据、原件和优化件的 SHA-256。网页无任务号时留空。

导入时保留业务对象 `chair`、`cabinet`，使用资产记录里的单位、方向、底部中心、包围盒、校准版本和人工复核结果。预测尺寸只能作为校准候选。完成后应在真实浏览器验证加载、拖动、旋转、撤销和评估，并记录对应场景和资产映射。本轮没有发生 Lux3D 生成或收费调用。

## T04 目标托管复验

目标是项目文档中的 ModelScope 创空间或用户明确批准的静态托管。本轮没有可验证的项目部署入口。当前证据状态为 BLOCKED，匿名 HTTPS、刷新、子路径、iframe、浏览器 Worker 和资源 MIME 均为 NOT_RUN。

在具备 npm registry 访问的工作机按 [START_HERE](../START_HERE.md) 运行安装、严格检查、测试与完整构建。首次成功解析依赖后审核并保留真实的 `apps/web/package-lock.json`。部署前审核依赖的分发许可和通知。校验 `dist/CHECKSUMS.sha256`，只上传 `apps/web/dist` 清单中的开发预览文件。托管子路径应把无斜杠入口重定向到带斜杠地址。响应需为 HTTPS，JS 和 module Worker 使用 JavaScript MIME，WASM 使用 `application/wasm`。

先匿名打开和刷新公开入口，再用真实浏览器检查两条交互模式、相机切换、非法摆放回弹、导出，以及拦截一次 WASM 后重试。分别保存无缓存启动、热启动、评估耗时、实际网络响应和最终提交 SHA。回执记录于 [部署检查表](deployment-checklist.json)，赛事发布门禁继续使用 `python scripts/check_submission.py`。
