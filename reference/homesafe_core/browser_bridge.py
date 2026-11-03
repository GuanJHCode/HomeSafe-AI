"""Fixed JSON command boundary shared by CPython tests and a Pyodide worker.
Never accepts Python source, filesystem paths, credentials, photos, or external URLs.
"""
import json
from pydantic import ValidationError
from .engine import RuleEngine, FindingDiffer
from .validation import PlacementValidationError, validate_scene
from .challenge import ChallengeService

MAX_REQUEST_BYTES = 512_000
MAX_JSON_DEPTH = 64
_session = None

def _scene(data):
    scene = validate_scene(data)
    if not scene.is_demo:
        raise ValueError('public browser mode accepts synthetic demo scenes only')
    return scene

def dispatch(request: dict):
    global _session
    if not isinstance(request, dict) or set(request) - {'op', 'payload'}:
        raise ValueError('invalid command envelope')
    op, payload = request.get('op'), request.get('payload', {})
    if not isinstance(payload, dict):
        raise ValueError('payload must be an object')
    if op == 'evaluate':
        if set(payload) != {'scene'}: raise ValueError('evaluate fields invalid')
        return RuleEngine().evaluate(_scene(payload['scene'])).model_dump(mode='json')
    if op == 'compare':
        if set(payload) != {'before','after'}: raise ValueError('compare fields invalid')
        before = RuleEngine().evaluate(_scene(payload['before']))
        after = RuleEngine().evaluate(_scene(payload['after']))
        return FindingDiffer().compare(before, after).model_dump(mode='json')
    if op == 'challenge_start':
        if set(payload) != {'scene','movable_ids','goals'}: raise ValueError('challenge_start fields invalid')
        _session = ChallengeService(_scene(payload['scene']), payload['movable_ids'], payload['goals'])
        return _session.result()
    if _session is None:
        raise ValueError('challenge not started')
    if op == 'challenge_move':
        if set(payload) != {'object_id','transform'}: raise ValueError('only a transform can be edited')
        return _session.apply_transform(payload['object_id'], payload['transform'])
    if op in {'challenge_undo','challenge_reset','challenge_state'}:
        if payload: raise ValueError('unexpected payload')
        methods = {'challenge_undo':_session.undo,'challenge_reset':_session.reset,
                   'challenge_state':_session.result}
        return methods[op]()
    raise ValueError('unknown command')

class InputDepthError(ValueError):
    """Reject deeply nested envelopes without depending on Python recursion limits."""


def _check_json_depth(value):
    pending = [(value, 0)]
    while pending:
        item, depth = pending.pop()
        if depth > MAX_JSON_DEPTH:
            raise InputDepthError('JSON nesting exceeds the 64-level request limit')
        if isinstance(item, dict):
            pending.extend((child, depth + 1) for child in item.values())
        elif isinstance(item, list):
            pending.extend((child, depth + 1) for child in item)


def dispatch_json(raw: str) -> str:
    try:
        if not isinstance(raw,str) or len(raw.encode('utf-8')) > MAX_REQUEST_BYTES:
            raise ValueError('request too large')
        request = json.loads(raw)
        _check_json_depth(request)
        result = {'ok': True, 'result': dispatch(request)}
    except (InputDepthError, RecursionError):
        result = {'ok': False, 'error': {'code':'INPUT_TOO_DEEP',
                  'message':'JSON nesting exceeds the request limit', 'issues':[]}}
    except PlacementValidationError as exc:
        result = {'ok': False, 'error': {'code':'INVALID_PLACEMENT',
                  'message':str(exc), 'issues':[i.model_dump() for i in exc.issues]}}
    except ValidationError as exc:
        result = {'ok': False, 'error': {'code':'INVALID_INPUT',
                  'message':'Input failed the canonical contract',
                  'issues':[{'field':'.'.join(map(str,e['loc'])),'code':e['type'],
                             'message':e['msg']} for e in exc.errors(include_url=False,include_input=False)]}}
    except (ValueError, TypeError, KeyError) as exc:
        result = {'ok': False, 'error': {'code':'INVALID_COMMAND','message':str(exc), 'issues':[]}}
    return json.dumps(result,ensure_ascii=False,allow_nan=False)
