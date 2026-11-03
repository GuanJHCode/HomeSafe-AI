# 安心屋 HomeSafe AI：二次独立复核与优化建议 V4

日期：2026-11-03。

**结论：继续这个方向；保留主架构，但不要把V3原样转成产品。应先修语义、几何、评估覆盖、契约、发布证据与导出边界，再推进界面和正式资产。**

本次审查对象是上一轮交付的62文件V3 ZIP和合并设计文档，不是远仓可能新增的实现。原件未修改，远仓未写入；没有真实Lux3D收费调用、浏览器实机验收或官方提交。V4是审查补充包，不是修复完成声明。

## 一、实际做了什么

1. 重新检索官方中英文黑客松页面，复核必须使用Lux3D、API可选、提交形式和评分。
2. 阅读V3分层设计、OpenAPI/JSON Schema/TS契约、参考规则内核、SDK适配器、测试、提交预检和推送脚本。
3. 重新执行原62项Python测试、23项包检查、TypeScript严格类型检查，均通过。
4. 新增11项针对性反例/契约/脚本探针，均复现审查缺口。11项探针不等于11种独立根因，R01/R02等属于同一类设计问题。
5. 仅在临时目录构造空报告、空视频、虚拟manifest，验证发布预检是否真正检查资产存在与证据；没有伪造正式提交材料或发送它们。

### 验证结果如何解读

| 项目 | 本次结果 | 不能推出什么 |
|---|---|---|
| 原62项参考测试 | 通过 | 不能推出模型完整、业务组合无遗漏或浏览器可运行 |
| 原23项包检查 | 通过 | 不能推出跨契约语义一致或真资产存在 |
| TypeScript接口 | 通过 | 只覆盖已有接口文件，没有完整前端实现 |
| 原始提交预检 | 正确BLOCKED，exit=2 | 不能推出预检无法被失真的manifest误导 |
| 新11项探针 | 11项复现缺口 | 不是临床/家庭效果实验；部分是参考实现边界和设计缺失 |
| 真实Lux3D/正式应用/官网 | NOT_RUN | 不能写“已全面符合官方”“已经可以提交” |

原测试通过仍然是真的。但它们主要使用一种对象对应一种规则的合成输入，没有覆盖多语义对象、检查范围改变、非法整改、证据真实性等情况。

## 二、赛事方向没有根本偏差，但评分策略可以收敛

官方公开规则仍要求Lux3D参与核心三维内容或关键创作流程；Aholo API和LuxReal为可选。项目报告与可运行Demo链接或真实运行视频是必交项；源码为加分项。没有看到“至少6个模型”“必须在线生成”“必须所有人都能上传家具”等要求。[S1][S2]

官方评分：工具应用30%、趣味体验25%、创新20%、完成度20%、传播5%，专家/玩家评委70%/30%。[S2]

因此建议保留：

- 单客厅、成年照护者、学步儿童与老人双配置。
- Lux3D真正生成关键家具并进入交互、解释、整改流程。
- 三态结果、固定输入快照、模拟与现实自报区分。
- 不使用语言模型自由裁决安全；不做全屋重建、真实人体/事故仿真。

需要收敛：

- “至少6个Lux3D模型”从不可变发布门槛改成项目质量目标。用核心功能映射及真实资产证据判断是否准备充分，不能拿对象实例数冒充独立资产数。
- “完整可达性推演”不能用于首版宣传。现有P0是临近关系、属性核查、指定通道占用，原文已有边界，后续简介必须同步。
- 不为了接口数量开发在线生成系统；先完成有趣且可信的真实操作。

本次官方网页直读没有返回正文，规则文字来自搜索引擎对官方页面的索引，并交叉核对中英文页面。登录后授权协议、表单上限、领奖到场义务仍未获得，不能声称已经全部确认。

## 三、必须修正的六类问题

### F01 / P0：单一类别导致同一家具的多个检查条件丢失

**位置**：`reference/homesafe_core/engine.py:177–207`；`contracts/scene-v1.schema.json:$defs.Object.category`。

**复现R01**：给`category=cabinet`的柜体添加`hazardous_contents=true, locked=false, storage_height_m=0.5`，符合现有场景Schema，但儿童结果只有R003，没有R004。

**复现R02**：把柜体放到窗边，仍不会进入只遍历`category=support`的R001。当前模型没有表达“它也是需要核查的攀爬支点”的独立字段。

**偏差**：现实对象的名称、可能用途与应检查条件被绑成同一个排他枚举。不能简单把柜子改成hazardous_storage，因为会反过来丢掉固定核查。

**修订**：保留`category`用于显示与模板默认值，新增非排他的`traits`及其三态观察。示例：

```python
class ObjectTraits:
    possible_climb_support: Observation[bool]
    requires_anchor_check: Observation[bool]
    contains_hazardous_items: Observation[bool]
    blocks_floor_route: Observation[bool]

class SafetyRule:
    def applicability(self, context, obj) -> ApplicabilityResult: ...
    def evaluate(self, context, obj) -> list[Finding]: ...
```

类别可提供“建议核查哪些trait”，但不能把未确认trait自动记成false。R003、R004、R001应分别评估，一个对象可以产生多个结果。不要求引入复杂本体、图数据库或大模型分类。

**验收**：同一柜体同时具有相关已知属性时能产生多条独立检查；未知支点特征给出待核查或覆盖说明；改变显示名称不改变已确认特征驱动的结果。

### F02 / P0：合法场景不等于可实现的整改布局

**位置**：`engine.py:28–80`；`FootprintService`；`Properties.storage_height_m`。

**复现R03**：将椅子移动到柜体同一位置，验证通过。两实体占地相交，仍可生成“窗边关系不再触发”的改善差异。

**复现R04**：2.7米高的房间中，`storage_height_m=100`通过Schema和参考验证，R004变成`not_triggered`。

**修订**：

```python
class PlacementValidator:
    def validate_transform(self, scene, candidate) -> PlacementResult: ...
    def find_solid_penetrations(self, scene, candidate) -> list[PlacementConflict]: ...
    def validate_supported_height(self, obj) -> list[InputIssue]: ...

class ObservationValidator:
    def validate_height_reference(self, obj, observation, room) -> list[InputIssue]: ...
```

用已有二维足迹加垂直区间形成2.5D检查。明确`collision_layer`：落地实体互相穿透应拒绝或阻断“可实施整改”；地毯、辅助关注区域、允许的物体支撑关系不能简单全部禁止重叠。不要把“边界接触当保守风险提示”的策略不加区分地用于家具摆放，会导致家具无法靠墙。

高度选择一种明确表示：`local_height_m`相对对象底面，或`world_height_m`相对地面，并校验与对象、房间的关系。对超界但用户尚未确认的数据，必须显示非法/不一致，不能生成“未触发”结论。禁止输入NaN、Infinity及非有限数的要求继续保留。

**验收**：椅子不能塞进柜体完成整改；地毯可以位于家具下；已定义的支撑例外有专门用例；非法高度阻断评估并指出字段。

### F03 / P0：未评估和改变检查范围不能冒充改善

**位置**：`engine.py:211`、`FindingDiffer.compare()`、`AssessmentDTO`。

**复现R05**：`routes=[]`合法，结果没有任何老人finding，也没有老人侧覆盖说明。空列表本身并不能证明检查完成。

**复现R06**：家具全部不动，仅把指定通道移到另一位置，R005会被差异器列为`no_longer_triggered`。参考差异器明确把上下文验证交给调用方；这里不声称尚未实现的RemediationService已经失效，问题是服务层契约没有把通道范围变化明确纳入比较条件。

**修订**：

```python
class CoverageService:
    def summarize(self, context, outcomes) -> AssessmentCoverage: ...

class ComparisonGuard:
    def assert_same_basis(self, before, after) -> None: ...
    def identify_scope_changes(self, before, after) -> list[ScopeChange]: ...
```

`AssessmentCoverage`逐rule/profile记录`evaluated / missing_input / not_applicable / unsupported / error`；finding仍保留原三态，二者不要混用。没有路线时明确写“指定通道相关规则未评估”。未建模的浴室、楼梯、烫伤等属于未覆盖，而非默认通过。

比较基础包含同一场景/模板谱系、成员能力语义hash、规则版本、规则参数hash、检查范围hash。成员ID相同但能力改变，不算同一比较基础。移动/删除通道属于`scope_changed`；可以展示新的方案，但不能无提示地计入“移动家具消除了障碍”。仅改变类别导致规则消失也属于评估范围变化。

**验收**：缺通道、缺成员、改阈值、改角色能力、删除对象、改变检查范围均不被计为普通整改成功；保留原`removed_from_scope`、`became_unknown`逻辑。

### F04 / P0：文档、OpenAPI与前端类型的关键数据未闭环

**位置**：`contracts/http/openapi.yaml:942`的AssetDTO、`:1012`的CalibrationInput、`:559`的Properties；`docs/04-frontend-contracts.md`。

**复现C01**：AssetDTO没有calibration字段，但前端设计要求`AssetLoader.normalize(root, calibration)`；校准保存后刷新，契约未提供稳定取回方式。输入只提供yaw，也没有完整描述原始资产需要的朝向修正能力。

**复现C02**：文档写了`PropertyObservation(value, source, observed_at, evidence_ref, confidence_label)`，传输契约仍然只有若干裸布尔/数值，无法保存“样例值、用户自报、实测、模拟改动”的证据区别。

**修订**：定义单一来源的数据模型，再生成/同步JSON Schema、OpenAPI与TypeScript，禁止三份字段手工独立演化。

```text
AssetCalibration
  revision, orientation_quaternion, pivot_offset,
  normalization_scale, source_bounds, reviewed_at

AssetRenderDTO（公开展示用）
  asset_id, content_hash, render_url, calibration, provenance_summary

Observation[T]
  value, source_kind, observed_at, verification_state,
  evidence_ref（按权限导出）, coordinate_reference（需要时）
```

`orientation_quaternion`是项目选择，不是声称Lux3D一定返回某轴向；能正确处理已验证资产即可。若选用预处理后标准化GLB，也可以把规范化结果写入新文件并记录hash、变换、版本，而不是运行时让多个组件自行缩放。

视觉变换与计算代理必须从同一场景实例尺寸/姿态得到，资产局部纠偏另存。观察值标`user_reported`不等于专业验证；不得给一个布尔勾选起名“官方验证通过”。

**验收**：真实GLB导入→校准→批准→重载→更换模型→重新检查，全程视觉/代理一致；JSON往返保持source/时间/模拟状态；公开DTO不泄露私密证据路径和完整供应商签名URL。

### F05 / P0（发布前）：提交预检只信声明，不能验证实际交付

**位置**：`scripts/check_submission.py:7–23`，submission/asset manifest。

**复现G01**：在隔离临时目录中设置gates全部true，放空报告和空视频，提供6条同ID、同虚假hash、指向不存在GLB的记录，令`public_distribution_allowed=false`、`final_commit='not-a-real-git-commit'`，脚本仍exit=0并打印材料就绪。原交接包自身仍被正确BLOCKED；这两件事不矛盾。

**修订**：

```python
class ReleaseVerifier:
    def verify_schema(self, manifest) -> list[Issue]: ...
    def verify_asset_files(self, manifest, release_root) -> list[Issue]: ...
    def verify_scene_asset_usage(self, scenes, assets) -> list[Issue]: ...
    def verify_materials(self, materials) -> list[Issue]: ...
    def verify_version_evidence(self, source_commit, test_evidence) -> list[Issue]: ...
    def verify_distribution_scope(self, artifacts, channel) -> list[Issue]: ...
```

至少校验：受控相对路径、文件存在且非空、GLB结构/哈希、ID唯一、场景实际引用、核心Lux3D来源证据存在、公开分发权限、报告/视频可解析、最终源码版本存在、测试日志对应该版本。无需自研复杂媒体解析器；使用已维护解析工具，失败即阻断。公开Demo需实际无登录访问；网络不可达标未验证而非自动成功。

自动校验不能证明版权合法、报告诚实或专业知识正确；这些保留owner-reviewed签署与证据，不把一切自动化当事实核验。

同时修正状态循环：G4准备门不要求已经有官方回执。`READY_FOR_SUBMISSION`只代表材料准备好；`SUBMITTED`才要求实际回执。最终源码commit与材料版本分别记录，避免把尚未生成的最终报告绑定到不存在的commit。

**验收**：空文件、错hash、重复资产、不存在的模型、假commit、模板报告、缺来源、未授权公开资产都被挡住。配置期望资产数量可作为目标提示，不把“6”冒充官方要求。

### F07 / P0（真实资料推送前）：目录白名单不等于隐私审核白名单

**位置**：`scripts/publish_docs.sh:35–56`。

**复现S01**：脚本递归选择evidence目录，只排除pycache/pyc。合成的未分类证据文件会被选择；.gitignore能忽略private/等名字，但不能识别误放在普通evidence子目录下的家庭截图或账号截图。本次没有真实隐私文件泄露，也没有执行push。

**修订**：默认私有证据在git仓库外；仅通过`PublicEvidenceExporter.build_manifest()`列出的逐文件白名单进入公开目录。白名单要求`visibility=public, owner_reviewed=true`、来源和hash；未知可见性默认拒绝。导出后再扫描密钥/个人信息并人工查看截图，不能声称正则扫描可以识别全部隐私。

公开模型源码可分开：资产不允许再分发时，只提供符合授权范围的评审包/展示，不擅自放公共仓库。推送脚本先dry-run列出精确文件，拒绝未批准文件，不再输出未经检查的“无私人资料”保证。

## 四、两项增强路径上的问题

### F06 / P1，只有启用API时才成为上线阻断：任务来源与底层重试

**位置**：`reference/homesafe_core/lux3d_adapter.py:40–49`。

**复现I01**：请求taskId=123，fake供应商返回taskId=999、status=3，adapter仍返回taskId=123的provider_succeeded。官方响应包含taskId。[S3]

修订：核对响应ID与请求ID，不匹配进入manual_review，不保存为正确资产来源；缺失字段的处理由锁定SDK契约决定。供应商成功但outputs为空，不得转为本地completed。

原`test_create_error_not_retried`只断言fake SDK方法调用一次，不能证明真实SDK/HTTP客户端/代理内部没有重发。本次没读到可用于确认的SDK底层重试实现，不声称其一定会重试；启用收费路径前，应以本地故障注入服务统计真实HTTP创建请求次数，再锁定依赖版本。未知提交状态继续人工核对；不得擅自新增收费重试。

官方文档仍为G1/G1-Turbo、异步任务、推荐10–15秒级轮询、成功下载URL约2小时有效。现有显式参数和持久化方向可以保留。[S3][S4]

### F08 / P1（体验优化）：公开只读版展示不了最强的交互

V3明确将public_demo设置为只读、匿名编辑不在P0；不是已经完成产品中的程序错误，也不违反允许视频提交的规则。但若用它宣传“直接体验整改”，评委不能拖动家具和重新计算，核心交互优势难以展现。[S1][S2]

建议二选一：

- 工期紧：仅承诺本地完整应用＋真实操作视频，在线只读页准确标注“展示版”。
- 准备公开体验：增加不保存私人数据的临时交互模式，而不是打开所有管理员写接口。

推荐接口（新设计，尚未实现）：

```text
POST /api/v1/demo/evaluations
  template_id, allowed_object_transforms, client_revision
```

服务端从固定合成模板构建临时快照，规则/成员/模型从服务端模板取，不接受客户端篡改；只允许注册对象在边界内移动，执行PlacementValidator，限制请求尺寸/对象数/频率。不写共享场景、不上传、不生成、不接受用户外部URL。前端草稿存本地内存，刷新重置；服务端仍用同一Python规则内核，避免前后端两套结果。

返回input_hash/client_revision，前端继续丢弃迟到响应。比“在浏览器重写一套Python规则”更不容易产生两端偏差。

## 五、避免不必要的开发量

### 5.1 第一条可演示链路优先于全套模块

建议先只实现：一间房、椅子/窗/柜体、指定通道、两角色、四条核心规则、拖动重算、unknown、撤销和简单行动清单。这只是开发切片，不是最终固定交付上限。

真实Lux3D椅子/柜子小样与代码并行，不能因准备数据库、完整资产管理台或worker而延后。一旦切片成立，再补齐目标模型和其他有依据的规则。

### 5.2 P0不需要启动生成worker

P0采用网页生成＋手动导入：FastAPI＋SQLite＋浏览器即可。`GenerationWorker/CreditBudgetService/输入上传服务`保留设计接口、不开启部署依赖；只有做P1在线生成时才安装和运行。服务启动不应因缺少AHOLO_API_KEY失败。

资产导入可先做管理员CLI/开发命令，暂不开发完整AssetStudio页面。保留来源、校准、校验和保存能力即可，避免为管理界面消耗核心交互工期。

### 5.3 把资产质量和使用证据放在数量之前

生成椅子、柜体、茶几、沙发等确实参与主要体验的模型；线缆、路线、窗户辅助标记等简单几何可以由代码生成并明确来源。不要为了满足自己写的“6”不断消耗积分。

新增一份`feature_asset_map.json`：从核心功能到资产ID、文件hash、Lux3D生成证据、对应Demo时间点的映射。它比“生成了多少模型”的数字更能说明技术核心使用。

3300积分只作为当时截图余额，准确到期和实际扣费仍看账号。官方计费随模型、质量、导出和处理方式变化，不再沿用公开优惠价当固定成本。[S5]

### 5.4 把性能目标落实到资产预算

先拿两个真实GLB测文件大小、贴图、面数、首屏和帧率，再设全场景预算。文档中的5秒/30FPS是项目目标，不是实测。对6–10个生成资产一次全量加载的做法，优先改成首屏先显示基础场景，核心模型逐步加载；相同模型复用几何，按实际瓶颈优化。

### 5.5 源码可获取不等于模型可获取

现有.gitignore忽略*.glb。发布可复现源码时，必须明确合法获取正式资产的方法：如授权允许，生成独立资产包和SHA256清单，安装脚本校验后导入；不允许公开的内容另做受限评审包。不能让评委克隆后只有占位物，却以为那是最终Lux3D作品。

## 六、测试怎么优化

保留原62项作为回归基础，不删失败的新增用例来保持绿灯。补充三组：

1. **组合与反例**：同对象多trait、实体互穿、非法高度、无通道、改范围、信息缺失、不同上下文比较。
2. **变换不变量**：列表重排不改变结果集合；只换模型不改语义结果；同一布局重算稳定；合法整体平移不改相对距离；换显示名不改变规则适用性。对hash/key变化与语义结果变化分别断言。
3. **真实资产端到端**：Lux3D GLB加载、校准持久化、旋转/拖动、视觉/代理一致、刷新、不同浏览器实际渲染、无网时样例能否运行（只有资源全部本地化后才可承诺）。

连续10次同一演示是稳定性检查，不是泛化验证。加入至少三个不同布局和边界条件，不能只在before/conflict/improved三个预设点上通过。

安全规则内容审核、安装规范适用性、用户理解不能靠单元测试替代。人工体验只邀请成年人；没有用户测试就如实写未做，不影响继续完成技术原型。

## 七、建议修订顺序

| 顺序 | 工作 | 完成条件 |
|---|---|---|
| 1 | F01/F04统一数据契约 | 多trait、Observation、Calibration、Coverage均有唯一模型定义与迁移方案 |
| 2 | F02/F03修内核与比较 | 组合反例、非法布局、缺输入、范围变化测试通过 |
| 3 | 两件真实Lux3D小样贯通 | 不消耗额外架构复杂度，模型显示/校准/来源可复现 |
| 4 | 第一条交互切片 | 能拖动→重算→发现另一角色变化→再调整，不是固定动画 |
| 5 | 逐步补齐规则与核心资产 | 每项有证据、规则来源和局限；性能实测 |
| 6 | F05/F07发布前修订 | 材料门禁查真实文件，发布名单逐项批准 |
| 7 | 可选F08公开临时体验 | 不能调用收费接口，不会修改共享数据 |
| 8 | 可选F06在线生成 | 真实transport重试/状态验证、任务身份核对、额度和权限验证 |
| 9 | 报告视频与官网 | 报告与版本一致；最终提交回执单独确认 |

不要把这个表理解为承诺后台执行或固定耗时。根据工期可裁P1，不得用未实现能力凑演示。

## 八、修订后的定位与交付标准

推荐定位：

> 安心屋是一款面向成年照护者的3D居家空间辅助检查与改造演练工具。它利用Lux3D生成的核心家具，在已确认信息与明确规则下解释儿童相关空间条件和老人指定通道问题，并比较改造对两类成员的影响。

最核心交付：

**真实Lux3D家具 → 可信的对象语义/尺寸 → 可操作场景 → 可解释检查 → 合法布局调整 → 同一检查基础下复算 → 区分待核查与模拟结果的清单。**

不把简单平面检查宣传为完整行为预测；不把“不再触发一条规则”写成家庭安全保证；不把报告模板或绿色测试标志当作官方验收。

## 九、官方资料与复核边界

- [S1] 中文活动页：https://www.aholo3d.cn/hackathon
- [S2] 英文活动页：https://www.aholo.ai/hackathon
- [S3] 官方Python SDK：https://labs.aholo.ai/api-docs/sdk/python
- [S4] 官方接口规范：https://labs.aholo.ai/api-docs/openapi.json
- [S5] 官方积分说明：https://aholo.featurebase.app/zh-CN/help/articles/6916933-dashboardji-fen-yu-api-mi-yao
- [S6] 官方能力与服务分工：https://labs.aholo.ai/api-docs/intro

所有修复类名、方法名、数量建议、公开体验接口和测试目标均为项目设计建议，不是官方要求。官方规则索引复核于2026-11-03；SDK内部重试行为、账号实际权限、积分结算和真实模型表现仍未实证。

附：`evidence/observations.json`保存11项复现输入结果；`reproduce_review.py`可在V3原包上重跑。未执行的产品/真实素材/网络测试不要由这些结果推断通过。
