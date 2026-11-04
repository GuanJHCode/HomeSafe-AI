"""Publication regressions use synthetic GLB bytes, never real Lux3D evidence."""
import copy
import hashlib
import json
from pathlib import Path

import pytest

from homesafe_core.asset_publication import prepare_public_assets
from homesafe_core.engine import RuleEngine
from test_release_export import glb_bytes

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def publication(tmp_path):
    scene = json.loads((ROOT / 'examples/scene-before.json').read_text())
    model = tmp_path / 'assets/public/synthetic-chair.glb'
    model.parent.mkdir(parents=True)
    model.write_bytes(glb_bytes())
    evidence = tmp_path / 'assets/synthetic-record.md'
    evidence.write_text('SYNTHETIC parser fixture. Procedural test triangle only.')
    record = {
        'asset_id': 'synthetic-chair',
        'content_hash': hashlib.sha256(model.read_bytes()).hexdigest(),
        'render_url': 'assets/public/synthetic-chair.glb',
        'provenance_summary': 'procedural',
        'calibration': {
            'revision': 1, 'reviewed': True, 'strategy': 'runtime_axis_fit',
            'orientation': {'x': 0.0, 'y': 0.0, 'z': 0.0, 'w': 1.0},
            'pivot_offset_after_rotation': {'x': 0.0, 'y': 0.0, 'z': 0.0},
            'normalized_bounds_m': {'width': 1.0, 'height': 1.0, 'depth': 1.0},
        },
        'object_ids': ['chair'],
        'rights_scope': 'public',
        'generation_evidence': {
            'path': 'assets/synthetic-record.md',
            'sha256': hashlib.sha256(evidence.read_bytes()).hexdigest(),
        },
    }
    return tmp_path, scene, {'manifest_version': '2.0', 'assets': [record]}


def test_empty_catalog_keeps_placeholders(publication):
    root, scene, _ = publication
    bound, assets, files = prepare_public_assets(root, scene, {'manifest_version': '2.0', 'assets': []})
    assert bound.model_dump(mode='json')['objects'][0]['asset_id'] is None
    assert assets == [] and files == {}


def test_reviewed_model_is_bound_without_changing_rule_inputs(publication):
    root, scene, catalog = publication
    original = copy.deepcopy(scene)
    bound, assets, files = prepare_public_assets(root, scene, catalog)
    assert scene == original
    assert bound.objects[0].id == 'chair'
    assert bound.objects[0].asset_id == 'synthetic-chair'
    unchanged = bound.model_dump(mode='json')
    unchanged['objects'][0]['asset_id'] = None
    assert RuleEngine().evaluate(unchanged) == RuleEngine().evaluate(scene)
    assert [asset.asset_id for asset in assets] == ['synthetic-chair']
    assert set(files) == {'assets/public/synthetic-chair.glb'}
    assert files['assets/public/synthetic-chair.glb'] == (root / 'assets/public/synthetic-chair.glb').read_bytes()
    assert 'generation_evidence' not in assets[0].model_dump()
    assert 'object_ids' not in assets[0].model_dump()


@pytest.mark.parametrize('field,value', [
    ('rights_scope', 'official_review_only'),
    ('provenance_summary', 'unverified'),
    ('render_url', '/api/v1/assets/chair/file'),
    ('object_ids', ['missing-object']),
    ('object_ids', ['chair', 'chair']),
    ('content_hash', '0' * 64),
])
def test_ineligible_assets_are_rejected(publication, field, value):
    root, scene, catalog = publication
    catalog['assets'][0][field] = value
    with pytest.raises(ValueError):
        prepare_public_assets(root, scene, catalog)


def test_unreviewed_calibration_is_rejected(publication):
    root, scene, catalog = publication
    catalog['assets'][0]['calibration']['reviewed'] = False
    with pytest.raises(ValueError):
        prepare_public_assets(root, scene, catalog)


def test_changed_generation_evidence_is_rejected(publication):
    root, scene, catalog = publication
    (root / 'assets/synthetic-record.md').write_text('changed evidence')
    with pytest.raises(ValueError, match='evidence'):
        prepare_public_assets(root, scene, catalog)


def test_external_glb_resources_are_rejected(publication):
    root, scene, catalog = publication
    raw = glb_bytes('https://example.invalid/model.bin')
    (root / 'assets/public/synthetic-chair.glb').write_bytes(raw)
    catalog['assets'][0]['content_hash'] = hashlib.sha256(raw).hexdigest()
    with pytest.raises(ValueError, match='URI'):
        prepare_public_assets(root, scene, catalog)


def test_two_assets_cannot_replace_the_same_object(publication):
    root, scene, catalog = publication
    duplicate = copy.deepcopy(catalog['assets'][0])
    duplicate['asset_id'] = 'another-chair'
    catalog['assets'].append(duplicate)
    with pytest.raises(ValueError):
        prepare_public_assets(root, scene, catalog)


def test_scene_references_need_a_matching_catalog_binding(publication):
    root, scene, catalog = publication
    scene['objects'][1]['asset_id'] = 'unlisted-window'
    with pytest.raises(ValueError, match='binding'):
        prepare_public_assets(root, scene, catalog)


def test_symlink_model_is_rejected(publication):
    root, scene, catalog = publication
    path = root / 'assets/public/synthetic-chair.glb'
    other = root / 'actual.glb'
    path.rename(other)
    path.symlink_to(other)
    with pytest.raises(ValueError, match='symlink'):
        prepare_public_assets(root, scene, catalog)
