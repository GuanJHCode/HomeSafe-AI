"""Canonical optional interface types, including contract-only request shapes."""
from __future__ import annotations
from typing import Annotated, Literal
from pydantic import Field
from .models import Id, Model, PlacementIssue, Scene, TransformInput

class ChallengeGoal(Model):
    rule_id: str
    profile_id: str
    object_id: str

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
