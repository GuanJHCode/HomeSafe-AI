"""Build-time contract aggregation; never import from a runtime module."""
from __future__ import annotations
from .models import (Assessment, ChallengeResult, Comparison, Model, ObservationEdit,
                     ObservationOption, ObservationResult, PlacementIssue, Scene)
from .asset_models import AssetRenderDTO, PublicAssetCatalog
from .api_models import (AssessmentRequest, ChallengeGoal, CompareRequest, DemoEvaluationRequest,
                         ErrorDTO, GenerationRequest, HealthDTO, JobDTO, ObjectPatch,
                         ReportDTO, ReportRequest, SceneCreate, SceneReplace)

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
