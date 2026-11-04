"""Explicit simulated property edits for free practice, never challenge moves."""
from datetime import datetime, timezone
from .models import BoolObservation, ObservationEdit, ObservationOption, ObservationResult
from .validation import validate_scene
from .engine import RuleEngine, FindingDiffer

# Applicability and the editable field allowlist live with the canonical models.
# No trait, geometry, capability, route or threshold can be confirmed here.
FIELDS = (
    ('requires_anchor_check', 'anchored', '柜体已固定'),
    ('window_opening', 'protection_reported', '窗户防护已提供'),
    ('contains_hazardous_items', 'locked', '收纳已上锁'),
    ('loose_cord', 'accessible', '线缆可被接触'),
    ('loose_cord', 'secured', '线缆已固定'),
    ('rug', 'secured', '地毯已固定'),
    ('child_gate', 'raised_threshold_present', '门栏有凸起门槛'),
)


def observation_options(data):
    scene = validate_scene(data)
    if not scene.is_demo:
        raise ValueError('property practice accepts synthetic demo scenes only')
    return [ObservationOption(object_id=obj.id, field=field, label=label,
                              observation=getattr(obj.properties, field))
            for obj in scene.objects for trait, field, label in FIELDS
            if getattr(obj.traits, trait).value is True]


def edit_observation(data, edit):
    scene = validate_scene(data)
    edit = ObservationEdit.model_validate(edit)
    options = observation_options(scene)
    if not any(item.object_id == edit.object_id and item.field == edit.field for item in options):
        raise ValueError('property is not available for this confirmed object trait')
    before = RuleEngine().evaluate(scene)
    obj = next(item for item in scene.objects if item.id == edit.object_id)
    if getattr(obj.properties, edit.field).value != edit.value:
        candidate = scene.model_dump()
        target = next(item for item in candidate['objects'] if item['id'] == edit.object_id)
        target['properties'][edit.field] = BoolObservation(
            value=edit.value,
            source_kind='unknown' if edit.value is None else 'simulated',
            verification_state='unknown' if edit.value is None else 'provided',
            observed_at=None if edit.value is None else datetime.now(timezone.utc).isoformat(),
        ).model_dump()
        candidate['revision'] += 1
        scene = validate_scene(candidate)
    after = RuleEngine().evaluate(scene)
    return ObservationResult(scene=scene, assessment=after,
                             comparison=FindingDiffer().compare(before, after))
