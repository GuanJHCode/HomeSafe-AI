"""Canonical offline asset types. Not imported by the browser runtime."""
from __future__ import annotations
from typing import Annotated, Literal
from pydantic import Field, model_validator
from .models import Dimensions, Id, Model, Number, Vec3

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
