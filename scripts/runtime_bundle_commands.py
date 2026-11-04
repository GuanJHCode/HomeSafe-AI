"""Shared probe body executed in a fresh interpreter containing only the staged core.

This is a test harness, not a browser command or a runtime package module.
"""


def verify_runtime_bundle(data):
    import copy
    import json
    import sys
    import time

    assert not any(name == 'homesafe_core' or name.startswith('homesafe_core.') for name in sys.modules)
    sys.path.insert(0, data['import_root'])
    imported_at = time.perf_counter()
    from homesafe_core.browser_bridge import dispatch_json
    from homesafe_core.challenge import main_challenge_scene
    from homesafe_core import models
    import_ms = (time.perf_counter() - imported_at) * 1000
    offline = ('asset_models', 'api_models', 'contract_bundle', 'asset_publication', 'release', 'lux3d_adapter')

    def check_modules():
        assert not any('homesafe_core.' + name in sys.modules for name in offline)
        modules = {name: module.__file__ for name, module in sys.modules.items()
                   if name == 'homesafe_core' or name.startswith('homesafe_core.')}
        assert all(path.startswith(data['import_root'] + '/') for path in modules.values()), modules
        classes = {name for name, value in vars(models).items()
                   if isinstance(value, type) and value.__module__ == models.__name__}
        assert classes == set(data['expected_classes']), classes
        assert all(getattr(models, name).__pydantic_complete__ for name in classes)
        return {'modules': modules, 'class_names': sorted(classes), 'all_models_eager_complete': True,
                'offline_modules_loaded': False}

    before_state = check_modules()
    prior_calls = []
    first_use = []

    def call(op, payload=None, record=False):
        request = json.dumps({'op': op, 'payload': payload or {}}, ensure_ascii=False)
        started = time.perf_counter()
        answer = json.loads(dispatch_json(request))
        duration_ms = (time.perf_counter() - started) * 1000
        assert answer['ok'], answer
        if record:
            assert op not in prior_calls, f'{op} already warmed'
            first_use.append({'operation': op, 'duration_ms': duration_ms, 'prior_calls': prior_calls.copy()})
        prior_calls.append(op)
        return answer['result']

    def error(op, payload, code):
        answer = json.loads(dispatch_json(json.dumps({'op': op, 'payload': payload})))
        assert not answer['ok'] and answer['error']['code'] == code, answer

    before, conflict, improved = [data['samples'][name] for name in ('before', 'conflict', 'improved')]
    goals = [{'rule_id': 'R001', 'profile_id': 'child', 'object_id': 'chair'},
             {'rule_id': 'R005', 'profile_id': 'elder', 'object_id': 'chair'}]

    def pose(scene, oid):
        obj = next(obj for obj in scene['objects'] if obj['id'] == oid)
        return {key: obj[key] for key in ('position', 'yaw_rad')}

    # Realistic first-use order: one accepted initial evaluation, then the first
    # challenge, then an explicit exit before the first observation operations.
    assert call('evaluate', {'scene': before}, record=True) == data['expected']['before']
    call('challenge_start', {'scene': before, 'movable_ids': ['chair'], 'goals': goals}, record=True)
    assert call('challenge_move', {'object_id': 'chair', 'transform': pose(conflict, 'chair')}, record=True)['challenge']['conflict_events'] == 1
    assert call('challenge_end') == {'ended': True}
    assert len(call('observation_options', {'scene': before}, record=True)) == 7
    changed = call('observation_edit', {'scene': before, 'edit': {'object_id': 'cabinet', 'field': 'anchored', 'value': True}}, record=True)
    assert changed['comparison']['change_kinds'] == ['observation']

    # Full command and error closure follows the recorded first-use sequence.
    for name, scene in data['samples'].items():
        assert call('evaluate', {'scene': scene}) == data['expected'][name]
    assert call('compare', {'before': before, 'after': improved})['after_input_hash'] == data['expected']['improved']['input_hash']
    start = call('challenge_start', {'scene': before, 'movable_ids': ['chair'], 'goals': goals})
    assert call('challenge_state') == start
    assert call('challenge_move', {'object_id': 'chair', 'transform': pose(conflict, 'chair')})['challenge']['conflict_events'] == 1
    assert call('challenge_move', {'object_id': 'chair', 'transform': pose(improved, 'chair')})['challenge']['status'] == 'goal_met'
    assert call('challenge_undo')['assessment']['input_hash'] == data['expected']['conflict']['input_hash']
    assert call('challenge_reset')['challenge']['steps'] == 0
    error('observation_edit', {'scene': before, 'edit': {'object_id': 'cabinet', 'field': 'anchored', 'value': True}}, 'INVALID_COMMAND')
    assert call('challenge_end') == {'ended': True}
    error('challenge_state', {}, 'INVALID_COMMAND')
    scene = before
    for value in (True, False, None):
        result = call('observation_edit', {'scene': scene, 'edit': {'object_id': 'cabinet', 'field': 'anchored', 'value': value}})
        assert result['comparison']['change_kinds'] == ['observation']
        scene = result['scene']
    main = main_challenge_scene(before).model_dump(mode='json')
    main_goals = [dict(goal, object_id='cabinet') for goal in goals]
    call('challenge_start', {'scene': main, 'movable_ids': ['cabinet'], 'goals': main_goals})
    assert call('challenge_move', {'object_id': 'cabinet', 'transform': {'position': {'x': 4.5, 'y': 0, 'z': 3.2}, 'yaw_rad': 0}})['challenge']['status'] == 'goal_met'
    illegal = copy.deepcopy(before)
    illegal['objects'][0]['position']['x'] = -100
    error('evaluate', {'scene': illegal}, 'INVALID_PLACEMENT')
    deep = 0
    for _ in range(70):
        deep = [deep]
    error('evaluate', {'scene': deep}, 'INPUT_TOO_DEEP')
    error('observation_edit', {'scene': before, 'edit': {'object_id': 'cabinet', 'field': 'anchored', 'value': True, 'source_kind': 'measurement'}}, 'INVALID_COMMAND')
    call('challenge_end')
    error('observation_edit', {'scene': before, 'edit': {'object_id': 'cabinet', 'field': 'anchored', 'value': True, 'source_kind': 'measurement'}}, 'INVALID_INPUT')
    error('unknown', {}, 'INVALID_COMMAND')
    after_state = check_modules()
    assert before_state == after_state
    return {'result': 'PASS', 'canonical_import_ms': import_ms, 'first_use': first_use,
            'first_use_scope': 'One initial evaluation precedes first challenge; explicit exit precedes first observation. Python dispatch+JSON timing, not browser/UI latency.',
            'before_commands': before_state, 'after_commands': after_state,
            'command_coverage': ['evaluate', 'compare', 'challenge_start', 'challenge_state', 'challenge_move',
                                 'challenge_undo', 'challenge_reset', 'challenge_end', 'observation_options', 'observation_edit'],
            'cases': ['three fixture assessments byte-equivalent as JSON', 'tutorial and main challenge',
                      'challenge observation isolation', 'observation true/false/unknown', 'strict provenance input',
                      'structured illegal placement', 'deep JSON', 'unknown command']}
