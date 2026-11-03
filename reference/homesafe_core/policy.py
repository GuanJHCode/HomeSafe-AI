"""Unconfirmed categories are UI hints, never authoritative safety attributes."""
from .models import SceneObject, SetupItem

HINTS = {
    'window': {'window_opening'},
    'support': {'possible_climb_support', 'blocks_floor_route'},
    'chair': {'possible_climb_support', 'blocks_floor_route'},
    'sofa': {'possible_climb_support', 'blocks_floor_route'},
    'cabinet': {'possible_climb_support', 'requires_anchor_check', 'contains_hazardous_items', 'blocks_floor_route'},
    'bookcase': {'possible_climb_support', 'requires_anchor_check', 'contains_hazardous_items', 'blocks_floor_route'},
    'hazardous_storage': {'contains_hazardous_items', 'blocks_floor_route'},
    'cord': {'loose_cord'},
    'rug': {'rug'},
    'child_gate': {'child_gate', 'blocks_floor_route'},
}

class TraitCandidatePolicy:
    """All known traits override hints; unrelated unknowns remain visible in setup/coverage."""

    def candidate(self, obj: SceneObject, name: str) -> bool:
        value = getattr(obj.traits, name).value
        if value is not None:
            return value
        return name in HINTS.get(obj.category, set())

    def unknown_count(self, objects, names) -> int:
        return sum(any(getattr(o.traits, name).value is None for name in names) for o in objects)

    def setup_items(self, objects) -> list[SetupItem]:
        result = []
        for obj in objects:
            unknown = sorted(name for name in type(obj.traits).model_fields
                             if getattr(obj.traits, name).value is None)
            if unknown:
                suggested = sorted(set(unknown) & HINTS.get(obj.category, set()))
                result.append(SetupItem(object_id=obj.id, unknown_traits=unknown,
                                        suggested_true_traits=suggested))
        return sorted(result, key=lambda i: i.object_id)
