# 03｜后端方法级实施合同 · V5

本文件为后续实现合同；除 reference 中明确存在的类外，其余均待实现。类型以canonical models.py及其生成contracts为准；表中的业务命令类型若尚未定义，必须先补canonical模型再实现handler。公共方法有类型标注、结构化错误和单元测试，不写一个包办所有工作的 HomeSafeManager。

## 1. API 层：只做传输和权限

| 模块 | handler 签名（简写） | 路由 | 应用服务 |
|---|---|---|---|
| scenes.py | create_scene(body: SceneCreate, actor: Actor) -> Scene | POST /api/v1/scenes | SceneService.create_from_template |
| scenes.py | get_scene(scene_id: str, revision: int\|None) -> Scene | GET /scenes/{id} | SceneService.get_snapshot |
| scenes.py | patch_object(scene_id, object_id, body: ObjectPatch) -> Scene | PATCH /scenes/{id}/objects/{oid} | SceneService.update_object |
| scenes.py | replace_scene(scene_id, body: SceneReplace) -> Scene | PUT /scenes/{id} | SceneService.replace_snapshot |
| assessments.py | assess_scene(scene_id, body: AssessmentRequest) -> Assessment | POST /scenes/{id}/assessments | AssessmentService.evaluate |
| assessments.py | get_assessment(assessment_id) -> Assessment | GET /assessments/{id} | AssessmentRepository.get |
| assessments.py | compare(body: CompareRequest) -> Comparison | POST /comparisons | RemediationService.compare |
| assets.py | import_glb(file, metadata, actor) -> AssetRenderDTO | POST /assets/import | AssetService.import_manual |
| assets.py | calibrate_asset(asset_id, body: AssetCalibration) -> AssetRenderDTO | PUT /assets/{id}/calibration | AssetService.set_calibration |
| generations.py | create_generation(body, idempotency_key, actor) -> JobDTO | POST /generations | GenerationService.request |
| generations.py | get_generation(job_id, actor) -> JobDTO | GET /generations/{id} | GenerationService.get |
| reports.py | create_report(body: ReportRequest) -> ReportDTO | POST /reports | ReportService.render_html |
| health.py | healthz() -> HealthDTO | GET /healthz | 不访问收费服务 |

完整路径前缀统一 /api/v1（healthz 除外）。公开体验不开放 generation/import/approve；这些请求必须经过管理员权限。异常返回 `{code,message,request_id}`（扩展结构化details前先更新canonical ErrorDTO），不得把 stack trace、API Key 或云端签名 URL 暴露给浏览器。

HTTP 映射：格式错误 422；未授权 401；禁止访问 403；不存在 404；revision/幂等冲突 409；大小超限 413；配额限制 429；供应商暂不可用 503。`needs_review` 是业务结果，非 HTTP 错误。

## 2. Application 层

### SceneService

构造：`SceneService(scenes: SceneRepository, assets: AssetRepository, uow: UnitOfWork, clock: Clock)`。

| 方法 | 输入/输出 | 约束与后置条件 | 测试 |
|---|---|---|---|
| create_from_template(template_id: str, actor_id: str) -> SceneSnapshot | 只允许注册模板 | 新 id、revision=1，模板标记 is_demo；一次事务 | A01 |
| get_snapshot(scene_id: str, revision: int\|None=None) -> SceneSnapshot | 不存在抛 NotFound | 返回快照副本，保存版本不可原地修改 | A02 |
| update_object(scene_id, object_id, patch: ObjectPatch, expected_revision: int) -> SceneSnapshot | 校验尺寸/位置/角色引用 | CAS 失败 RevisionConflict；成功 revision+1 | A03/A04 |
| replace_snapshot(scene_id, content: SceneContent, expected_revision) -> SceneSnapshot | 用于撤销/重做/导入 | 即便内容回到旧状态也创建新 revision | A05 |
| clone_scene(scene_id, revision, actor_id) -> SceneSnapshot | 样例独立副本 | 不共享可变对象，不影响其他访客 | A06 |

### AssetService

构造：`AssetService(storage: AssetStorage, validator: AssetValidator, assets: AssetRepository, evidence: EvidenceRepository)`。

- `import_manual(stream: BinaryIO, metadata: AssetImportMetadata) -> VisualAsset`：流式限额，计算 SHA256；source_kind=lux3d_web 时必须有脱敏生成证据引用；没有证据只能 unverified，不能伪造 taskId。
- `import_provider_output(job: GenerationJob, artifact: DownloadedArtifact) -> VisualAsset`：关联 provider_task_id、请求参数 hash、原件 hash；返回 calibration_pending。
- `set_calibration(asset_id, calibration: AssetCalibration) -> VisualAsset`：保存局部模型轴向、原点偏移、示例尺寸；资产级校准不是某个家庭对象的实测证明。
- `approve(asset_id, reviewer_id: str) -> VisualAsset`：结构检查、完整glTF校验和目标浏览器检查通过、来源可追溯且版权范围已确认，才approved；approved只表示展示准入。
- `get_file(asset_id, variant: str) -> AuthorizedFile`：只返回存储内注册文件，禁止任意路径穿越。

### AssessmentService

构造：`AssessmentService(scenes, profiles, rule_engine: RuleEngine, assessments, clock)`。

- `evaluate(scene_id: str, revision: int, profile_ids: list[str], ruleset_version: str) -> Assessment`：先固定snapshot、配置和profiles；PlacementValidator与ObservationValidator通过后调用统一RuleEngine，保存findings、coverage和comparison_basis；无外部HTTP/SDK。
- `build_context(snapshot, profiles, config) -> EvaluationContext`：检查数字、几何、source=demo、必需属性；不自动补全未知值。
- `explain(assessment_id, finding_key: str) -> FindingExplanation`：返回涉及对象、关系边、已知输入、缺失项、规则依据与局限。

必须测试：相同输入重算语义相同；不同 revision 不串缓存；一次修改后两个 profile 均重算；规则异常转 system_error 阻断该评估，不输出安全状态。

### RemediationService

- `begin(scene_id: str, baseline_revision: int) -> RemediationSession`：固定基线，创建独立候选。
- `compare(before_assessment_id, after_assessment_id) -> Comparison`：调用ComparisonGuard；profile/room/route/config/ruleset或同对象traits/尺寸/支撑层级改变则ComparabilityError；若确需跨配置比较，显式标不可等价，不算整改改善。
- `detect_tradeoffs(comparison: Comparison) -> list[Tradeoff]`：先通过ComparisonGuard，再按具体findings识别不同profile的条件变化；禁止只比较总数。needs_review增多和scope变化单独展示。
- `record_real_world_report(session_id, action_id, statement, evidence_ref) -> Remediation`：仅 user_reported_completed；不修改实际规则输入，除非经单独属性变更和重算。

### GenerationService / CreditBudgetService（P1，P0不启动）

- `GenerationService.request(command: GenerateAssetCommand, idempotency_key: str, actor: Actor) -> GenerationJob`：管理员 + 功能开关 + 人工确认预估费用；canonical request hash；原子写 job 和预算 reservation；不在 handler 中调用云端。
- `GenerationService.get(job_id, actor) -> JobDTO`：仅拥有者/管理员；不泄露 raw URLs。
- `GenerationService.attach_verified_task(job_id, provider_task_id: str, evidence_ref) -> GenerationJob`：仅用于 submitting_unknown 人工核对；记录审计，防止绑错任务。
- `GenerationService.request_retry(job_id, approval: RetryApproval) -> GenerationJob`：只有明确失败/明确未受理且新批准时创建新 attempt；不是 silent retry。
- `CreditBudgetService.reserve(job_id, estimated_credits: int, approved_ceiling: int) -> Reservation`：估算不明拒绝；SQLite 事务检查项目余额；不冒称平台真实余额。
- `CreditBudgetService.reconcile(job_id, observed_actual: int\|None, evidence_ref) -> LedgerEntry`：未核实扣费保持 pending，不自动退款。
- `CreditBudgetService.remaining_project_budget() -> BudgetSnapshot`：同时返回 reserved、observed_actual、unreconciled 和预算来源。

### ReportService

- `render_html(assessment_id, comparison_id: str\|None) -> ReportArtifact`：转义所有用户文本；内嵌 scene revision、ruleset、输入假设、demo/实测区别、三态结果、整改状态和局限。
- `render_json(...) -> dict`：可机器复现，引用 hash 而不泄露私人照片路径。
- `export_public_bundle(release_id, evidence_ids: list[str]) -> ReleaseBundle`：白名单导出；隐私扫描；仅收录明确 public 的证据；测试/提交模板未填标 BLOCKED。

## 3. Domain 层

| 类 | 方法 | 职责/不做什么 |
|---|---|---|
| FootprintService | corners(obj) -> tuple[Vec2,...]; overlaps(a,b)->bool; distance(a,b)->float | 按已确认尺寸 + yaw 计算 OBB；不从模型网格估计人体安全 |
| NavigationService（P1） | build_grid(scene, clearance)->NavGrid; find_path(grid,start,goal)->PathResult; explain_blockers(...)->list[str] | 地面近似通行；不可取代轮椅实测、楼梯或动态转弯验证 |
| RelationGraphBuilder | build(context)->RelationGraph; trace(start_id,target_id,edge_types)->list[RelationPath] | 边携带参数、证据、unknown；不将视觉连线当数学事实 |
| RuleEngine | evaluate(scene: Scene | dict)->Assessment | 按顺序运行显式规则；无 eval/exec 无大模型裁决 |
| SafetyRule（Protocol） | applicability(context,obj)->applicable/not_applicable/unknown; evaluate(context,obj)->list[Finding] | 仅明确不适用才跳过；未知适用性和缺失输入needs_review；不准抛异常后伪造 not_triggered |
| FindingDiffer | compare(before: Assessment,after: Assessment)->Comparison | 稳定 key；对象移出 scope 独立标记，不算已解决 |
| CandidatePlanner（P1） | propose(snapshot,selected_id,config)->list[Candidate]; rank(candidates)->list[Candidate] | 有限枚举 + 规则复算；不宣称全局最优或自动安全 |
| CanonicalHasher | hash_scene(snapshot)->str; hash_request(command)->str | 按集合排序、单位固定；当前完整input_hash包含观察来源与展示字段，semantic_hash如需另建须有明确定义 |

当前参考已实现RuleEngine、FindingDiffer、ComparisonGuard、CoverageService、PlacementValidator、ObservationValidator；应用服务与HTTP仍待实施。NavigationService不在P0。

## 4. Ports 层

```python
class Lux3DGateway(Protocol):
    def create_image_task(self, *, image_url: str, version: str="G1-Turbo", face_count: int=20_000) -> str: ...
    def retrieve_task(self, task_id: str) -> ProviderTask: ...
class AssetStorage(Protocol):
    def put_stream(self, key: str, stream: BinaryIO, max_bytes: int) -> StoredFile: ...
    def open(self, key: str) -> BinaryIO: ...
    def delete(self, key: str) -> None: ...
class SceneRepository(Protocol):
    def get_snapshot(self, scene_id: str, revision: int|None=None) -> SceneSnapshot: ...
    def append(self, snapshot: SceneSnapshot, expected_revision: int) -> None: ...
class JobRepository(Protocol):
    def find_by_idempotency_key(self, owner_id: str, key: str) -> GenerationJob|None: ...
    def claim_due(self, worker_id: str, lease_seconds: int) -> GenerationJob|None: ...
    def save_transition(self, job_id: str, expected_status: str, patch: JobPatch) -> None: ...
```

Ports 不依赖 SDK 原始 dict。DTO 映射集中在 adapter，SDK 升级不影响规则层。

## 5. Infrastructure 与 Worker

### AholoSdkGateway（P1；参考fake适配已存在）

`create_image_task()` 调用官方 `lux3d.img_to_3d.create(...)`，参数显式 version / face_count / output_format / ai_predict_size；`retrieve_task()` 调官方 `lux3d.tasks.retrieve(int(task_id))`。仅该类拥有 SDK client；日志只记录内部 job_id、状态与脱敏错误。方法存在见 S3/S4，是否支持账户权益需实测。

### GenerationWorker（P1）

- `run_once(now: datetime) -> WorkResult`：领取一个 due job，分发下一步，不在事务中网络等待。
- `submit(job) -> Transition`：持久化 submitting 意图后发单次 POST；成功绑定 taskId；连接/读取超时归 submitting_unknown。
- `poll(job) -> Transition`：10–15 秒级轮询（按 S3），暂态错误带退避；等待超时转 stalled 而不是 vendor_failed。
- `materialize(job, provider_task) -> Transition`：供应商成功不等于资产可用；下载、校验、入库后才 completed。
- `resume_expired_leases(now) -> int`：恢复 query/download，不盲目重发未知 POST。

### AssetDownloader / AssetValidator / LocalAssetStorage

- `AssetDownloader.download(url, destination, policy) -> DownloadedArtifact`：HTTPS、配置 CDN 允许域、每次重定向重验、禁止私网/环回/DNS 重绑定、流式限额、超时；不接受普通用户任意 URL。
- `AssetValidator.validate_glb(path) -> ValidationReport`：魔数 glTF、版本2、长度/JSON/BIN一致、外部 uri 禁止或严格白名单、mesh/texture/byte预算；不展开未知 zip。
- `LocalAssetStorage.resolve(key) -> Path`：解析后仍须位于 root；阻止 `../`、绝对路径、符号链接逃逸。
- `SqliteUnitOfWork.__enter__/commit/rollback`：测试 fail-injection 保证任务与预算的一致性。

这些安全检查必须由成熟库或严格测试支撑，不应照抄几行伪代码就认为已具备生产安全。

## 6. 主流程所需的补充传输接口

- `list_assets(cursor, limit) -> AssetPage`：GET /api/v1/assets；public_demo仅返回approved且允许公开的资产。
- `get_asset(asset_id) -> AssetRenderDTO`：GET /api/v1/assets/{asset_id}；私有metadata需授权。
- `download_asset(asset_id) -> FileResponse`：GET /api/v1/assets/{asset_id}/file；调用AssetService.get_file，public只能公开衍生件，不返回raw文件路径。
- `get_report_html(report_id)` / `get_report_json(report_id)`：对应 /reports/{id}/html 和 /json；访问受report可见性约束，用户文本已转义。
- `InputService.register_image(stream, consent: bool, actor: Actor) -> RegisteredInput`：POST /api/v1/inputs；P1管理员裁剪图片上传，返回registered_input_id供GenerationRequest.input_asset_id引用；不能直接提交任意第三方URL。

public_demo模式拒绝所有持久化修改、上传与收费请求；可提供只读样例浏览和录屏。完整交互首版在localhost/admin环境验收。匿名可编辑沙箱不属于P0，不可误称当前公开模式已支持多人在线编辑。


## V5补充方法与实际实现清单

| 类/方法 | 当前状态 | 合同 |
|---|---|---|
| PlacementValidator.validate_transform / find_solid_penetrations / validate_supported_height | reference已实现 | 不合布局抛ValueError；应用映射为422及字段错误，不保存候选 |
| ObservationValidator.validate_height_reference | reference已实现 | 明确坐标系，禁止超出所属物体/房间 |
| CoverageService.summarize | reference已实现 | 没路线/没角色显式missing_input；多个对象可部分评估 |
| ComparisonGuard.build_basis / assert_same_basis | reference已实现 | 改检查目标/阈值不能算移动家具改善 |
| FindingDiffer.compare(Assessment,Assessment) | reference已实现 | 不再接受仅finding列表，防止调用方漏校验基础 |
| ReleaseVerifier.verify(root,manifest) | reference已实现 | fail-closed；外部媒体解析/owner review仍必要 |
| PublicDTOMapper.to_public_scene / to_public_assessment | 待实现 | 丢弃private evidence_ref，禁止raw filesystem path/签名URL |
| DemoService.evaluate_template(template_id,transforms,client_revision) | 可选 | 只允许模板注册对象的变换，同内核计算、不写DB、不收费 |

当前generated OpenAPI涵盖核心JSON接口，均DESIGN_ONLY。导入优先实现CLI `homesafe assets import --file --metadata`；不必做上传网页。二进制文件GET、上传multipart、删除和属性编辑API实施前扩展canonical DTO/生成器与权限测试，不随意从旧19接口数量推断已经完备。

校准保存：AssetService.set_calibration后AssetRepository保存完整AssetCalibration；get_render_dto返回当前校准revision，前端缓存key=(asset_id,content_hash,calibration.revision)。PUT校准与approve按权限分开，不让访客改全局资产。

正式SDK层还必须核对请求与响应taskId、成功结果是否有可下载文件。reference的fake测试不证明真实SDK内部重试行为，启用P1前需传输故障注入和实际账号授权。


### 内部类型与传输类型的边界
SceneSnapshot为持久化记录（Scene+revision+hash），不是第二套场景字段；内部仓储实体可独立，但转换使用canonical Scene。VisualAsset含私有来源与路径，AssetRenderDTO是对外渲染子集，不能把私有实体直接返回。当前Assignment/内部命令类未全部实现，T00–T04根据这些方法合同建立，不将内部伪代码误认为现有服务。
