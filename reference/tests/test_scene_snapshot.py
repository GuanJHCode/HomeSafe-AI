"""Downloaded snapshots must reproduce the same input, not merely a plausible hash."""
import copy
import importlib.util
import json
from pathlib import Path

import pytest
from homesafe_core.engine import RuleEngine

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('check_scene_snapshot', ROOT / 'scripts/check_scene_snapshot.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


@pytest.fixture
def snapshot():
    scene = json.loads((ROOT / 'examples/scene-before.json').read_text())
    assessment = RuleEngine().evaluate(scene)
    return {
        'format': 'homesafe_scene_snapshot', 'snapshot_version': '1.0',
        'source_kind': 'synthetic_demo', 'includes_asset_bytes': False,
        'scene': scene, 'assessment': {key: getattr(assessment, key) for key in (
            'scene_id', 'scene_revision', 'input_hash', 'ruleset_version')},
    }


def test_snapshot_recomputes_same_canonical_input(snapshot):
    before = copy.deepcopy(snapshot)
    result = checker.verify_snapshot(snapshot)
    assert result['result'] == 'MATCHES_CURRENT_CORE'
    assert result['input_hash'] == snapshot['assessment']['input_hash']
    assert snapshot == before


@pytest.mark.parametrize('field', ['scene_id', 'scene_revision', 'input_hash', 'ruleset_version'])
def test_snapshot_identity_drift_is_rejected(snapshot, field):
    snapshot['assessment'][field] = 'changed'
    with pytest.raises(ValueError, match='differs'):
        checker.verify_snapshot(snapshot)


def test_same_revision_different_layout_cannot_reuse_input_hash(snapshot):
    chair = next(item for item in snapshot['scene']['objects'] if item['id'] == 'chair')
    chair['yaw_rad'] = 0.1
    with pytest.raises(ValueError, match='differs'):
        checker.verify_snapshot(snapshot)


def test_provenance_and_asset_claims_are_checked(snapshot):
    snapshot['source_kind'] = 'real_measurement'
    with pytest.raises(ValueError, match='provenance'):
        checker.verify_snapshot(snapshot)
    snapshot['source_kind'] = 'synthetic_demo'
    snapshot['includes_asset_bytes'] = True
    with pytest.raises(ValueError, match='exclude asset bytes'):
        checker.verify_snapshot(snapshot)
