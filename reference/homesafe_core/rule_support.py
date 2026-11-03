"""Shared pure helpers; no UI, SDK or file I/O."""
import hashlib
import json
from .models import Finding

def digest(data) -> str:
    raw = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(raw.encode()).hexdigest()

def canonical_scene(scene):
    data = scene.model_dump()
    data.pop('revision')
    for key in ('objects', 'profiles', 'routes'):
        data[key] = sorted(data[key], key=lambda item: item['id'])
    return data

def known_geometry(*objects) -> bool:
    return all(o.dimensions_confirmed and o.position_confirmed for o in objects)

def boolean_check(value, trigger_when=False):
    if value is None:
        return 'needs_review'
    return 'triggered' if value is trigger_when else 'not_triggered'

def make(rule, pid, objects, status, evidence, scope='scene'):
    ids = sorted(objects)
    return Finding(key=digest([rule, pid, ids, scope])[:24], rule_id=rule,
                   profile_id=pid, object_ids=ids, scope_id=scope,
                   status=status, evidence=evidence)
