"""Main cabinet practice uses the same rules, identities and uncertainty as the room."""
import json
from copy import deepcopy
from pathlib import Path
import pytest

from homesafe_core.challenge import ChallengeService, main_challenge_scene
from homesafe_core.validation import PlacementValidationError

ROOT = Path(__file__).resolve().parents[2]


def original():
    return json.loads((ROOT / 'examples/scene-before.json').read_text())


def main():
    return ChallengeService(main_challenge_scene(original()), ['cabinet'], [
        {'rule_id': 'R001', 'profile_id': 'child', 'object_id': 'cabinet'},
        {'rule_id': 'R005', 'profile_id': 'elder', 'object_id': 'cabinet'},
    ])


def move(challenge, x, z, yaw=0):
    return challenge.apply_transform('cabinet', {
        'position': {'x': x, 'y': 0, 'z': z}, 'yaw_rad': yaw,
    })


def test_main_baseline_changes_only_two_positions_and_retains_bindings():
    source = original()
    source['objects'][0]['asset_id'] = 'reviewed-chair'
    before = deepcopy(source)
    staged = main_challenge_scene(source).model_dump(mode='json')
    assert source == before
    for obj in staged['objects']:
        if obj['id'] in {'chair', 'cabinet'}:
            obj['position'] = next(o['position'] for o in source['objects'] if o['id'] == obj['id'])
    # Compare canonical dumps because defaulted fields are materialized.
    from homesafe_core.validation import validate_scene
    assert staged == validate_scene(source).model_dump(mode='json')


@pytest.mark.parametrize('x,z,yaw', [(4.5, 3.2, 0), (3.2, 3.2, 0.4), (4.8, 0.8, 1.5707963267948966)])
def test_three_distinct_legal_solutions_keep_unknowns(x, z, yaw):
    challenge = main()
    assert challenge.result()['challenge']['status'] == 'in_progress'
    result = move(challenge, x, z, yaw)
    assert result['challenge']['status'] == 'goal_met'
    assert result['challenge']['steps'] == 1
    assert result['challenge']['remaining_needs_review'] > 0
    assert any(f['rule_id'] == 'R003' and f['status'] == 'needs_review'
               for f in result['assessment']['findings'])
    assert move(challenge, x, z, yaw) == result | {'comparison': None}


def test_main_tradeoff_and_polling_then_undo_and_reset():
    challenge = main()
    result = move(challenge, 4.8, 2.5)
    assert result['challenge']['goal_results'] == [True, False]
    assert result['challenge']['conflict_events'] == 1
    assert challenge.result()['challenge'] == result['challenge']
    assert challenge.result()['challenge'] == result['challenge']
    undone = challenge.undo()
    assert undone['challenge']['goal_results'] == [False, True]
    assert undone['challenge']['steps'] == 2
    assert undone['challenge']['conflict_events'] == 1
    reset = challenge.reset()
    assert reset['challenge']['steps'] == reset['challenge']['conflict_events'] == 0


@pytest.mark.parametrize('x,z', [(0.5, 3.3), (-1, 2), (1.5, 3.3)])
def test_main_illegal_moves_rebound_and_count_separately(x, z):
    challenge = main()
    before = challenge.scene.model_dump()
    with pytest.raises(PlacementValidationError):
        move(challenge, x, z)
    assert challenge.scene.model_dump() == before
    assert challenge.result()['challenge']['invalid_attempts'] == 1
    assert challenge.result()['challenge']['steps'] == 0


def test_main_cannot_edit_locked_objects_or_other_inputs():
    challenge = main()
    with pytest.raises(ValueError):
        challenge.apply_transform('chair', {'position': {'x': 3, 'y': 0, 'z': 1}, 'yaw_rad': 0})
    for field, value in [('traits', {}), ('dimensions_m', {}), ('profiles', []), ('routes', []), ('delete', True)]:
        with pytest.raises(ValueError):
            challenge.apply_transform('cabinet', {'position': {'x': 3, 'y': 0, 'z': 1}, 'yaw_rad': 0, field: value})


@pytest.mark.parametrize('replacement', ['missing', 'needs_review'])
def test_main_goal_cannot_pass_if_missing_or_unknown(replacement):
    challenge = main()
    move(challenge, 4.5, 3.2)
    assert challenge.result()['challenge']['status'] == 'goal_met'
    findings = []
    for finding in challenge.assessment.findings:
        if finding.rule_id == 'R001' and 'cabinet' in finding.object_ids:
            if replacement == 'missing':
                continue
            finding = finding.model_copy(update={'status': 'needs_review'})
        findings.append(finding)
    challenge.assessment = challenge.assessment.model_copy(update={'findings': findings})
    assert challenge.result()['challenge']['status'] == 'in_progress'


@pytest.mark.parametrize('goal_rule,goal_profile,expected_conflicts', [
    ('R001', 'child', 1),  # goal improves; newly triggered elder check need not be a goal
    ('R005', 'elder', 0),  # only an unrelated child condition improves
])
def test_conflict_requires_goal_reduction_but_keeps_new_other_role_findings(goal_rule, goal_profile, expected_conflicts):
    scene = json.loads((ROOT / 'examples/scene-before.json').read_text())
    challenge = ChallengeService(scene, ['chair'], [
        {'rule_id': goal_rule, 'profile_id': goal_profile, 'object_id': 'chair'},
    ])
    result = challenge.apply_transform('chair', {
        'position': {'x': 3, 'y': 0, 'z': 2}, 'yaw_rad': 0,
    })
    # Findings outside the goal set remain visible and may be the new conflict.
    assert any(f['rule_id'] == 'R005' and f['status'] == 'triggered'
               for f in result['assessment']['findings'])
    assert result['challenge']['conflict_events'] == expected_conflicts
