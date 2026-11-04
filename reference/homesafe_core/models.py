"""V6 canonical contracts. JSON Schema / TypeScript / OpenAPI are generated.
Not a deployed application; no implicit V1 migration or clinical assertions.
"""
from __future__ import annotations
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime

def validate_observation_time(value: str | None) -> None:
    if value is None: return
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError("observed_at must be an ISO 8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError("observed_at must include a timezone")

Number = Annotated[float, Field(allow_inf_nan=False, strict=True)]
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]
Nonnegative = Annotated[float, Field(ge=0, allow_inf_nan=False, strict=True)]
Id = Annotated[str, Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_.:-]+$')]
Source = Literal['unknown', 'demo', 'user_reported', 'measurement', 'simulated']
Status = Literal['triggered', 'needs_review', 'not_triggered']

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False, validate_assignment=True)

class BoolObservation(Model):
    value: bool | None = None
    source_kind: Source = 'unknown'
    observed_at: str | None = None
    verification_state: Literal['unknown', 'provided', 'owner_checked'] = 'unknown'
    evidence_ref: str | None = None  # private handle; never an unrestricted filesystem path
    @model_validator(mode='after')
    def provenance(self):
        validate_observation_time(self.observed_at)
        if self.value is not None and (self.source_kind == 'unknown' or self.verification_state == 'unknown'):
            raise ValueError('known value requires explicit provenance and observation state')
        if self.value is not None and self.source_kind in {'measurement','user_reported'} and self.observed_at is None:
            raise ValueError('real-world observations require a timestamp')
        if self.value is None and self.verification_state != 'unknown':
            raise ValueError('unknown value must remain unknown')
        return self

class NumberObservation(Model):
    value: Nonnegative | None = None
    source_kind: Source = 'unknown'
    observed_at: str | None = None
    verification_state: Literal['unknown', 'provided', 'owner_checked'] = 'unknown'
    evidence_ref: str | None = None
    coordinate_reference: Literal['world_floor', 'object_base', 'not_applicable'] = 'not_applicable'
    @model_validator(mode='after')
    def provenance(self):
        validate_observation_time(self.observed_at)
        if self.value is not None and (self.source_kind == 'unknown' or self.verification_state == 'unknown'):
            raise ValueError('known value requires explicit provenance and observation state')
        if self.value is not None and self.source_kind in {'measurement','user_reported'} and self.observed_at is None:
            raise ValueError('real-world observations require a timestamp')
        if self.value is None and self.verification_state != 'unknown':
            raise ValueError('unknown value must remain unknown')
        return self

class Vec3(Model):
    x: Number
    y: Number
    z: Number

class Dimensions(Model):
    width: Positive
    height: Positive
    depth: Positive

class Traits(Model):
    possible_climb_support: BoolObservation = Field(default_factory=BoolObservation)
    requires_anchor_check: BoolObservation = Field(default_factory=BoolObservation)
    contains_hazardous_items: BoolObservation = Field(default_factory=BoolObservation)
    blocks_floor_route: BoolObservation = Field(default_factory=BoolObservation)
    window_opening: BoolObservation = Field(default_factory=BoolObservation)
    loose_cord: BoolObservation = Field(default_factory=BoolObservation)
    rug: BoolObservation = Field(default_factory=BoolObservation)
    child_gate: BoolObservation = Field(default_factory=BoolObservation)

class Properties(Model):
    anchored: BoolObservation = Field(default_factory=BoolObservation)
    protection_reported: BoolObservation = Field(default_factory=BoolObservation)
    locked: BoolObservation = Field(default_factory=BoolObservation)
    accessible: BoolObservation = Field(default_factory=BoolObservation)
    secured: BoolObservation = Field(default_factory=BoolObservation)
    raised_threshold_present: BoolObservation = Field(default_factory=BoolObservation)
    storage_height: NumberObservation = Field(default_factory=NumberObservation)

class SceneObject(Model):
    id: Id
    asset_id: Id | None = None
    label: str = ''
    category: str  # display + unconfirmed candidate hints; never exclusive rule dispatch or confirmed traits
    position: Vec3
    yaw_rad: Number
    dimensions_m: Dimensions
    dimensions_confirmed: bool
    position_confirmed: bool
    collision_layer: Literal['solid', 'surface', 'fixture', 'marker']
    placement_mode: Literal['floor', 'wall', 'surface', 'supported']
    supported_by: Id | None = None
    traits: Traits
    properties: Properties
    @model_validator(mode='after')
    def placement_reference(self):
        if (self.placement_mode == 'supported') != (self.supported_by is not None):
            raise ValueError('supported placement must have exactly one explicit support reference')
        if self.supported_by == self.id:
            raise ValueError('object cannot support itself')
        if self.collision_layer == 'solid' and self.placement_mode not in {'floor', 'supported'}:
            raise ValueError('P0 solid objects must be floor-standing or explicitly supported')
        return self

class Profile(Model):
    id: Id
    role: Literal['child', 'elder']
    can_climb: BoolObservation = Field(default_factory=BoolObservation)
    reach_height: NumberObservation = Field(default_factory=NumberObservation)

class Rect(Model):
    x: Number = Field(description='XZ axis-aligned rectangle CENTER x in meters, not left edge.')
    z: Number = Field(description='XZ axis-aligned rectangle CENTER z in meters, not bottom edge.')
    width: Positive
    depth: Positive

class Route(Model):
    id: Id
    label: str
    rect: Rect
    confirmed: bool

class RuleConfig(Model):
    near_window_m: Positive = 0.6
    parameter_source: Literal['demo_heuristic', 'owner_defined'] = 'demo_heuristic'

class Scene(Model):
    schema_version: Literal['2.0'] = '2.0'
    scene_id: Id
    revision: Annotated[int, Field(ge=1)]
    is_demo: bool
    room: Dimensions
    profiles: list[Profile] = Field(max_length=8)
    routes: list[Route] = Field(max_length=16)
    rule_config: RuleConfig
    objects: list[SceneObject] = Field(max_length=100)
    @model_validator(mode='after')
    def identity(self):
        for collection in [self.objects, self.profiles, self.routes]:
            ids = [o.id for o in collection]
            if len(ids) != len(set(ids)):
                raise ValueError('duplicate IDs in a collection')
        # Demonstration observations must never silently become measured family data.
        if not self.is_demo:
            def contains_demo(v):
                if isinstance(v, dict):
                    return v.get('source_kind') == 'demo' or any(contains_demo(x) for x in v.values())
                if isinstance(v, list): return any(contains_demo(x) for x in v)
                return False
            if contains_demo(self.model_dump()):
                raise ValueError('non-demo scene cannot contain demo observations')
        return self

class Finding(Model):
    key: str
    rule_id: str
    profile_id: str
    object_ids: list[str]
    scope_id: str
    status: Status
    evidence: dict[str, str | float | bool | None]
    limitation: str = '当前输入下的辅助检查；未触发不表示安全，示例参数不是安全标准。'

class Coverage(Model):
    rule_id: str
    profile_id: str | None
    state: Literal['evaluated', 'missing_input', 'not_applicable', 'unsupported', 'error']
    evaluated_count: int = 0
    pending_count: int = 0
    reason: str

class ComparisonBasis(Model):
    scene_id: str
    ruleset_version: str
    context_hash: str
    object_scope: dict[str, str]
    layout_hash: str = ''
    observation_hash: str = ''

class SetupItem(Model):
    object_id: Id
    unknown_traits: list[str]
    suggested_true_traits: list[str]
    suggestion_source: Literal['category_hint_unconfirmed'] = 'category_hint_unconfirmed'

class PlacementIssue(Model):
    object_id: str | None = None
    related_object_ids: list[str] = Field(default_factory=list)
    field: str
    code: str
    message: str

class Assessment(Model):
    scene_id: str
    scene_revision: int
    input_hash: str
    ruleset_version: str
    comparison_basis: ComparisonBasis
    findings: list[Finding]
    coverage: list[Coverage]
    unsupported_domains: list[str]
    setup_items: list[SetupItem] = Field(default_factory=list)

class Comparison(Model):
    before_input_hash: str
    after_input_hash: str
    new_triggered: list[str]
    no_longer_triggered: list[str]
    still_triggered: list[str]
    became_unknown: list[str]
    needs_review: list[str]
    removed_from_scope: list[str]
    added_to_scope: list[str]
    resolved_unknown: list[str] = Field(default_factory=list)
    change_kinds: list[Literal['layout', 'observation', 'scope', 'visual_or_metadata']] = Field(default_factory=list)
    change_interpretation: str = '仅为相同检查基础下的条件变化；不证明现实中完成整改。'

ObservationProperty = Literal['anchored', 'protection_reported', 'locked', 'accessible', 'secured', 'raised_threshold_present']

class ObservationEdit(Model):
    object_id: Id
    field: ObservationProperty
    value: bool | None

class ObservationOption(Model):
    object_id: Id
    field: ObservationProperty
    label: str
    observation: BoolObservation

class ObservationResult(Model):
    scene: Scene
    assessment: Assessment
    comparison: Comparison

class ChallengeGoal(Model):
    rule_id: str
    profile_id: str
    object_id: str

class ChallengeProgress(Model):
    status: Literal['goal_met', 'in_progress']
    goal_results: list[bool]
    steps: int
    conflict_events: int
    invalid_attempts: int
    remaining_triggered: int
    remaining_needs_review: int
    setup_objects: int
    label: str

class ChallengeResult(Model):
    scene: Scene
    assessment: Assessment
    comparison: Comparison | None
    challenge: ChallengeProgress

class Quaternion(Model):
    x: Number
    y: Number
    z: Number
    w: Number
    @model_validator(mode='after')
    def normalized(self):
        if abs(sum(v*v for v in (self.x,self.y,self.z,self.w))-1) > 1e-6:
            raise ValueError('orientation must be a unit quaternion')
        return self

class AssetCalibration(Model):
    revision: Annotated[int, Field(ge=1)]
    orientation: Quaternion
    pivot_offset_after_rotation: Vec3
    normalized_bounds_m: Dimensions
    reviewed: bool
    strategy: Literal['runtime_axis_fit', 'baked_standard_glb']
    notes: str = ''
    @model_validator(mode='after')
    def check_strategy(self):
        if self.strategy == 'baked_standard_glb':
            q=self.orientation; p=self.pivot_offset_after_rotation
            if any(abs(v)>1e-9 for v in (q.x,q.y,q.z,p.x,p.y,p.z)) or abs(q.w-1)>1e-9:
                raise ValueError('baked GLB must not be normalized a second time')
        return self

class AssetRenderDTO(Model):
    asset_id: Id
    content_hash: Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]
    render_url: Annotated[str, Field(pattern=r'^(assets/public/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*\.glb|/api/v1/assets/[A-Za-z0-9_.:-]+/file)$')]
    calibration: AssetCalibration
    provenance_summary: Literal['lux3d_web', 'lux3d_api', 'procedural', 'unverified']

class FileEvidence(Model):
    path: Annotated[str, Field(min_length=1)]
    sha256: Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]

class PublishedAsset(AssetRenderDTO):
    object_ids: Annotated[list[Id], Field(min_length=1)]
    rights_scope: Literal['public']
    generation_evidence: FileEvidence

    @model_validator(mode='after')
    def publication_review(self):
        if not self.render_url.startswith('assets/public/'):
            raise ValueError('public preview requires a static asset path')
        if not self.calibration.reviewed or self.provenance_summary == 'unverified':
            raise ValueError('asset calibration and provenance must be reviewed')
        if len(self.object_ids) != len(set(self.object_ids)):
            raise ValueError('duplicate object binding')
        return self

class PublicAssetCatalog(Model):
    manifest_version: Literal['2.0']
    assets: list[PublishedAsset]

class TransformInput(Model):
    position: Vec3
    yaw_rad: Number

class ObjectPatch(Model):
    expected_revision: Annotated[int, Field(ge=1)]
    transform: TransformInput

class AssessmentRequest(Model):
    revision: Annotated[int, Field(ge=1)]

class CompareRequest(Model):
    before_assessment_id: Id
    after_assessment_id: Id

class DemoEvaluationRequest(Model):
    template_id: Id
    client_revision: Annotated[int, Field(ge=1)]
    transforms: dict[str, TransformInput]

class GenerationRequest(Model):
    input_asset_id: Id  # no arbitrary user URL
    version: Literal['G1', 'G1-Turbo']
    face_count: Annotated[int, Field(ge=10000, le=300000)]
    approved_ceiling: Annotated[int, Field(gt=0)]

class ErrorDTO(Model):
    code: str
    message: str
    request_id: str
    issues: list[PlacementIssue] = Field(default_factory=list)

class SceneCreate(Model):
    template_id: Id

class SceneReplace(Model):
    expected_revision: Annotated[int, Field(ge=1)]
    snapshot: Scene

class ReportRequest(Model):
    assessment_id: Id
    comparison_id: Id | None = None

class ReportDTO(Model):
    report_id: Id
    assessment_hash: str
    download_url: str
    format: Literal['html', 'json']

class JobDTO(Model):
    job_id: Id
    status: Literal['queued','submitting','submitting_unknown','polling','downloading','validation_pending','completed','stalled','failed','manual_review']
    asset_id: Id | None = None
    error_code: str | None = None

class HealthDTO(Model):
    status: Literal['ok']
    product_mode: Literal['local','public_demo','public_sandbox']

class ContractBundle(Model):
    """Build root. All active wire types derive from the same Python source."""
    scene: Scene
    assessment: Assessment
    comparison: Comparison
    challenge_goal: ChallengeGoal
    observation_edit: ObservationEdit
    observation_option: ObservationOption
    observation_result: ObservationResult
    challenge_result: ChallengeResult
    asset: AssetRenderDTO
    public_assets: PublicAssetCatalog
    patch: ObjectPatch
    assess_request: AssessmentRequest
    compare_request: CompareRequest
    demo_request: DemoEvaluationRequest
    generation_request: GenerationRequest
    scene_create: SceneCreate
    scene_replace: SceneReplace
    report_request: ReportRequest
    report: ReportDTO
    job: JobDTO
    health: HealthDTO
    error: ErrorDTO
    placement_issue: PlacementIssue
