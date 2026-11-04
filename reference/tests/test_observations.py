import json
from pathlib import Path
import pytest
from homesafe_core import browser_bridge as bridge
from homesafe_core.models import BoolObservation, Scene
from homesafe_core.observations import edit_observation, observation_options

ROOT = Path(__file__).resolve().parents[2]


def scene():
    return Scene.model_validate_json((ROOT / 'examples/scene-before.json').read_text())


def edit(value=None, **extra):
    return {'object_id': 'cabinet', 'field': 'anchored', 'value': value, **extra}


@pytest.fixture(autouse=True)
def clean_session():
    bridge.dispatch({'op': 'challenge_end'})
    yield
    bridge.dispatch({'op': 'challenge_end'})


def test_options_come_only_from_confirmed_traits_not_category_or_unknown():
    data = scene()
    options = observation_options(data)
    assert ('cabinet', 'anchored') in {(item.object_id, item.field) for item in options}
    assert not any(item.object_id == 'chair' for item in options)
    data.objects[2].traits.requires_anchor_check = BoolObservation()
    assert not any(item.object_id == 'cabinet' for item in observation_options(data))


@pytest.mark.parametrize('value,status', [(True, 'not_triggered'), (False, 'triggered')])
def test_simulated_confirmation_is_observation_only_preserves_geometry_and_input(value, status):
    original = scene()
    unchanged = original.model_dump()
    result = edit_observation(original, edit(value))
    assert original.model_dump() == unchanged
    assert result.scene.revision == original.revision + 1
    assert result.comparison.change_kinds == ['observation']
    target = next(obj for obj in result.scene.objects if obj.id == 'cabinet')
    assert target.properties.anchored.value is value
    assert target.properties.anchored.source_kind == 'simulated'
    assert target.properties.anchored.verification_state == 'provided'
    assert target.properties.anchored.observed_at.endswith('+00:00')
    finding = next(f for f in result.assessment.findings if f.rule_id == 'R003' and 'cabinet' in f.object_ids)
    assert finding.status == status
    assert not result.comparison.no_longer_triggered
    actual = result.scene.model_dump()
    actual['revision'] = original.revision
    next(obj for obj in actual['objects'] if obj['id'] == 'cabinet')['properties']['anchored'] = original.objects[2].properties.anchored.model_dump()
    assert actual == unchanged


def test_unknown_can_be_restored_and_noop_does_not_change_revision_or_hash():
    first = edit_observation(scene(), edit(True))
    same = edit_observation(first.scene, edit(True))
    assert same.scene == first.scene
    assert same.assessment.input_hash == first.assessment.input_hash
    assert same.comparison.change_kinds == []
    unknown = edit_observation(first.scene, edit(None))
    observation = next(obj for obj in unknown.scene.objects if obj.id == 'cabinet').properties.anchored
    assert observation.value is None
    assert observation.source_kind == observation.verification_state == 'unknown'
    assert observation.observed_at is None
    assert unknown.comparison.became_unknown


@pytest.mark.parametrize('patch', [
    {'field': 'storage_height'}, {'field': 'requires_anchor_check'}, {'field': 'dimensions_m'},
    {'object_id': 'missing'}, {'object_id': 'chair'}, {'value': 'false'}, {'value': 0},
    {'traits': {}}, {'source_kind': 'measurement'}, {'verification_state': 'owner_checked'},
    {'routes': []}, {'profiles': []},
])
def test_unlisted_fields_and_false_provenance_are_rejected(patch):
    with pytest.raises(ValueError):
        edit_observation(scene(), edit(True) | patch)


def test_bridge_requires_explicit_challenge_exit_and_never_changes_its_counts():
    data = scene().model_dump(mode='json')
    initial = bridge.dispatch({'op': 'challenge_start', 'payload': {'scene': data, 'movable_ids': ['chair'],
        'goals': [{'rule_id': 'R001', 'profile_id': 'child', 'object_id': 'chair'}]}})
    with pytest.raises(ValueError, match='exit the challenge'):
        bridge.dispatch({'op': 'observation_edit', 'payload': {'scene': data, 'edit': edit(True)}})
    assert bridge.dispatch({'op': 'challenge_state'}) == initial
    assert bridge.dispatch({'op': 'challenge_end'}) == {'ended': True}
    updated = bridge.dispatch({'op': 'observation_edit', 'payload': {'scene': data, 'edit': edit(True)}})
    assert updated['comparison']['change_kinds'] == ['observation']
    with pytest.raises(ValueError, match='not started'):
        bridge.dispatch({'op': 'challenge_state'})
    restarted = bridge.dispatch({'op': 'challenge_start', 'payload': {'scene': data, 'movable_ids': ['chair'],
        'goals': [{'rule_id': 'R001', 'profile_id': 'child', 'object_id': 'chair'}]}})
    assert restarted == initial


def test_bridge_rejects_extra_fields_and_never_claims_real_measurement():
    payload = {'scene': scene().model_dump(mode='json'), 'edit': edit(False), 'source_kind': 'measurement'}
    response = json.loads(bridge.dispatch_json(json.dumps({'op': 'observation_edit', 'payload': payload})))
    assert response['ok'] is False
    data = scene().model_dump()
    data['is_demo'] = False
    with pytest.raises(ValueError):
        edit_observation(data, edit(True))
