"""Eight small independent rules. Category hints do not establish confirmed traits."""
from typing import Protocol
from .geometry import FootprintService as G
from .validation import poly
from .policy import TraitCandidatePolicy
from .rule_support import make, known_geometry, boolean_check

class SafetyRule(Protocol):
    rule_id: str
    role: str
    traits: tuple[str, ...]
    def evaluate(self, scene, profile): ...

class RuleBase:
    policy = TraitCandidatePolicy()
    def candidates(self, scene, trait):
        return [o for o in scene.objects if self.policy.candidate(o, trait)]

class ChildWindowSupportRule(RuleBase):
    rule_id, role = 'R001', 'child'
    traits = ('possible_climb_support', 'window_opening')

    def evaluate(self, scene, profile):
        windows = self.candidates(scene, 'window_opening')
        for support in self.candidates(scene, 'possible_climb_support'):
            for window in windows:
                if support.id != window.id:
                    yield self.check_pair(scene, profile, support, window)

    def check_pair(self, scene, profile, support, window):
        distance = G.distance(poly(support), poly(window))
        known = (support.traits.possible_climb_support.value is True
                 and window.traits.window_opening.value is True
                 and profile.can_climb.value is not None and known_geometry(support, window))
        status = 'needs_review' if not known else (
            'triggered' if profile.can_climb.value and distance <= scene.rule_config.near_window_m
            else 'not_triggered')
        return make(self.rule_id, profile.id, [support.id, window.id], status, {
            'distance_m': distance, 'attention_band_m': scene.rule_config.near_window_m,
            'parameter_source': scene.rule_config.parameter_source, 'approach_route_verified': False,
            'can_climb_source': profile.can_climb.source_kind})

class BooleanPropertyRule(RuleBase):
    trigger_when = False

    def evaluate(self, scene, profile):
        for obj in self.candidates(scene, self.traits[0]):
            observation = getattr(obj.properties, self.property_name)
            known = getattr(obj.traits, self.traits[0]).value is True
            status = boolean_check(observation.value, self.trigger_when) if known else 'needs_review'
            yield make(self.rule_id, profile.id, [obj.id], status,
                       {self.evidence_key: observation.value, 'source': observation.source_kind})

class WindowProtectionRule(BooleanPropertyRule):
    rule_id, role, traits = 'R002', 'child', ('window_opening',)
    property_name, evidence_key = 'protection_reported', 'protection_reported'

class FurnitureAnchorRule(BooleanPropertyRule):
    rule_id, role, traits = 'R003', 'child', ('requires_anchor_check',)
    property_name, evidence_key = 'anchored', 'anchored_reported'

class HazardousStorageReachRule(RuleBase):
    rule_id, role, traits = 'R004', 'child', ('contains_hazardous_items',)

    def evaluate(self, scene, profile):
        for obj in self.candidates(scene, self.traits[0]):
            p, h = obj.properties, obj.properties.storage_height
            world = None if h.value is None else h.value + (
                obj.position.y if h.coordinate_reference == 'object_base' else 0)
            reach = profile.reach_height.value
            unknown = (obj.traits.contains_hazardous_items.value is None
                       or any(v is None for v in (world, reach, p.locked.value))
                       or not known_geometry(obj))
            status = 'needs_review' if unknown else (
                'triggered' if not p.locked.value and world <= reach else 'not_triggered')
            yield make(self.rule_id, profile.id, [obj.id], status, {
                'storage_world_height_m': world, 'configured_reach_height_m': reach,
                'locked_reported': p.locked.value, 'height_source': h.source_kind,
                'lock_source': p.locked.source_kind, 'not_total_access_proof': True})

class ChildLooseCordRule(RuleBase):
    rule_id, role, traits = 'R007', 'child', ('loose_cord',)

    def evaluate(self, scene, profile):
        for obj in self.candidates(scene, self.traits[0]):
            p = obj.properties
            unknown = (obj.traits.loose_cord.value is None
                       or p.accessible.value is None or p.secured.value is None)
            status = 'needs_review' if unknown else (
                'triggered' if p.accessible.value and not p.secured.value else 'not_triggered')
            yield make(self.rule_id, profile.id, [obj.id], status, {
                'accessible_reported': p.accessible.value,
                'secured_reported': p.secured.value, 'source': p.secured.source_kind})

class RouteRule(RuleBase):
    role = 'elder'

    def evaluate(self, scene, profile):
        for route in scene.routes:
            for obj in self.candidates(scene, self.traits[0]):
                overlap = G.on_route(obj.model_dump(), route.model_dump())
                known = (getattr(obj.traits, self.traits[0]).value is True
                         and route.confirmed and known_geometry(obj))
                status = 'needs_review' if not known else (
                    self.overlap_status(obj) if overlap else 'not_triggered')
                yield make(self.rule_id, profile.id, [obj.id], status, {
                    'overlaps_designated_route': overlap,
                    'route_confirmed': route.confirmed, 'alternative_routes_evaluated': False}, route.id)

class ElderRouteObstructionRule(RouteRule):
    rule_id, traits = 'R005', ('blocks_floor_route',)
    def overlap_status(self, obj):
        return 'triggered'

class ElderRugFixationRule(RouteRule):
    rule_id, traits = 'R006', ('rug',)
    def overlap_status(self, obj):
        return boolean_check(obj.properties.secured.value)

class ElderGateThresholdRule(RouteRule):
    rule_id, traits = 'R008', ('child_gate',)
    def overlap_status(self, obj):
        return boolean_check(obj.properties.raised_threshold_present.value, True)

RULE_INSTANCES = (
    ChildWindowSupportRule(), WindowProtectionRule(), FurnitureAnchorRule(),
    HazardousStorageReachRule(), ElderRouteObstructionRule(), ElderRugFixationRule(),
    ChildLooseCordRule(), ElderGateThresholdRule(),
)
