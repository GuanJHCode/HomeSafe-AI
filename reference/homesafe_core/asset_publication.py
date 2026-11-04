"""Local publication gate. Evidence hashes bind records, not proof of authorship."""
import hashlib
from pathlib import Path

from .models import Scene
from .asset_models import AssetRenderDTO, PublicAssetCatalog
from .release import contained_file, validate_glb_bytes
from .validation import validate_scene


def prepare_public_assets(root: Path, scene: Scene | dict, manifest: dict):
    catalog = PublicAssetCatalog.model_validate(manifest)
    bound = validate_scene(scene).model_copy(deep=True)
    objects = {obj.id: obj for obj in bound.objects}
    bindings = {}
    asset_ids = set()
    hashes = set()
    render_assets = []
    files = {}

    for record in catalog.assets:
        if record.asset_id in asset_ids or record.content_hash in hashes:
            raise ValueError('duplicate asset; reuse one asset ID for multiple object bindings')
        asset_ids.add(record.asset_id)
        hashes.add(record.content_hash)
        evidence = contained_file(root, record.generation_evidence.path).read_bytes()
        if not evidence or hashlib.sha256(evidence).hexdigest() != record.generation_evidence.sha256:
            raise ValueError('asset generation evidence hash mismatch')
        path = contained_file(root, record.render_url)
        if path.stat().st_size > 50_000_000:
            raise ValueError('GLB size outside project limit')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != record.content_hash:
            raise ValueError('asset content hash mismatch')
        validate_glb_bytes(raw)
        if record.render_url in files:
            raise ValueError('duplicate public asset path')
        files[record.render_url] = raw
        render_assets.append(AssetRenderDTO.model_validate(
            record.model_dump(include=set(AssetRenderDTO.model_fields))))

        for object_id in record.object_ids:
            if object_id not in objects or object_id in bindings:
                raise ValueError('missing or duplicate object binding')
            obj = objects[object_id]
            if obj.asset_id is not None and obj.asset_id != record.asset_id:
                raise ValueError('scene asset conflicts with catalog binding')
            obj.asset_id = record.asset_id
            bindings[object_id] = record.asset_id

    if any(obj.asset_id and bindings.get(obj.id) != obj.asset_id for obj in bound.objects):
        raise ValueError('scene asset has no catalog binding')
    return bound, render_assets, files
