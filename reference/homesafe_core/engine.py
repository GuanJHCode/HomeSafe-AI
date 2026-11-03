"""V6 rule orchestration: deterministic, bounded hints, explicit coverage."""
from .models import Scene, Finding, Coverage, ComparisonBasis, Assessment, Comparison
from .validation import validate_scene
from .rule_support import digest, canonical_scene, known_geometry, boolean_check, make
from .policy import TraitCandidatePolicy
from .rules import RULE_INSTANCES

RULES = {role: [r.rule_id for r in RULE_INSTANCES if r.role == role] for role in ('child','elder')}
UNSUPPORTED = ['真实攀爬/人体可达性','家具倾倒物理','动态步态与转身','全屋及全部伤害类型','安装质量核验']

class CoverageService:
    def summarize(self, scene: Scene, findings: list[Finding]) -> list[Coverage]:
        result = []
        if not scene.profiles:
            result.append(Coverage(rule_id='ALL', profile_id=None, state='missing_input',
                                   reason='未提供任何成员配置，未执行成员检查'))
        for role in RULES:
            if not any(p.role == role for p in scene.profiles):
                result.append(Coverage(rule_id='ROLE:'+role, profile_id=None, state='missing_input',
                                       reason='未配置此角色；不表示此角色不存在风险'))
        for profile in scene.profiles:
            for rule in RULE_INSTANCES:
                if rule.role == profile.role:
                    result.append(self.for_rule(scene, profile, rule, findings))
        return result

    def for_rule(self, scene, profile, rule, findings):
        subset = [f for f in findings if f.profile_id == profile.id and f.rule_id == rule.rule_id]
        pending = sum(f.status == 'needs_review' for f in subset)
        unclassified = TraitCandidatePolicy().unknown_count(scene.objects, rule.traits)
        if profile.role == 'elder' and not scene.routes:
            state, reason = 'missing_input', '没有指定通道，相关检查未执行'
        elif pending or unclassified:
            state = 'missing_input'
            reason = f'待核查关系{pending}项；未确认对象特征{unclassified}件，见对象资料，不默认为否'
        elif subset:
            state, reason = 'evaluated', '仅覆盖明确建模的对象及指定关系'
        else:
            state, reason = 'not_applicable', '已确认特征无适用项；未建模内容不在覆盖范围'
        return Coverage(rule_id=rule.rule_id, profile_id=profile.id, state=state,
                        evaluated_count=len(subset)-pending,
                        pending_count=pending + unclassified, reason=reason)

class ComparisonGuard:
    def build_basis(self, scene: Scene, ruleset: str) -> ComparisonBasis:
        d=canonical_scene(scene)
        context={k:d[k] for k in ('scene_id','is_demo','room','profiles','routes','rule_config')}
        obj_scope={}
        for obj in scene.objects:
            # Semantic classification, dimensions and support hierarchy changes are input revisions.
            # Position/yaw/visual asset/label are not comparison scope changes.
            obj_scope[obj.id]=digest({
                'traits':obj.traits.model_dump(), 'dimensions':obj.dimensions_m.model_dump(),
                'collision_layer':obj.collision_layer,'placement_mode':obj.placement_mode,
                'supported_by':obj.supported_by,
                'unconfirmed_hint_traits': sorted(set(TraitCandidatePolicy().setup_items([obj])[0].suggested_true_traits))
                    if TraitCandidatePolicy().setup_items([obj]) else []})
        return ComparisonBasis(scene_id=scene.scene_id,ruleset_version=ruleset,
                               context_hash=digest(context),object_scope=obj_scope,
                               layout_hash=digest({o.id:[o.position.model_dump(),o.yaw_rad] for o in scene.objects}),
                               observation_hash=digest({o.id:o.properties.model_dump() for o in scene.objects}))
    def assert_same_basis(self,before: Assessment,after: Assessment):
        a,b=before.comparison_basis,after.comparison_basis
        if (a.scene_id,a.ruleset_version,a.context_hash)!=(b.scene_id,b.ruleset_version,b.context_hash):
            raise ValueError('comparison_basis_changed: role/config/room/route or scene changed; not ordinary remediation')
        for oid in a.object_scope.keys() & b.object_scope.keys():
            if a.object_scope[oid]!=b.object_scope[oid]:
                raise ValueError(f'object_scope_changed:{oid}; rebaseline explicitly')


class RuleEngine:
    RULESET_VERSION = 'demo-rules-3.0'

    def evaluate(self, data: Scene | dict) -> Assessment:
        scene = validate_scene(data)
        findings = []
        for profile in scene.profiles:
            for rule in RULE_INSTANCES:
                if rule.role == profile.role:
                    findings.extend(rule.evaluate(scene, profile))
        findings.sort(key=lambda f: (f.rule_id, f.profile_id, f.object_ids, f.scope_id))
        return Assessment(
            scene_id=scene.scene_id, scene_revision=scene.revision,
            input_hash=digest(canonical_scene(scene)), ruleset_version=self.RULESET_VERSION,
            comparison_basis=ComparisonGuard().build_basis(scene,self.RULESET_VERSION),
            findings=findings, coverage=CoverageService().summarize(scene,findings),
            setup_items=TraitCandidatePolicy().setup_items(scene.objects),
            unsupported_domains=UNSUPPORTED)

class FindingDiffer:
    def compare(self, before: Assessment, after: Assessment) -> Comparison:
        ComparisonGuard().assert_same_basis(before, after)
        old = {f.key:f for f in before.findings}
        new = {f.key:f for f in after.findings}
        if len(old)!=len(before.findings) or len(new)!=len(after.findings):
            raise ValueError('duplicate finding keys')
        groups = {key:[] for key in (
            'new_triggered','no_longer_triggered','still_triggered','became_unknown',
            'needs_review','removed_from_scope','added_to_scope','resolved_unknown')}
        for key, finding in new.items():
            self.classify(key, old.get(key), finding, groups)
        groups['removed_from_scope'] = list(set(old)-set(new))
        groups['added_to_scope'] = list(set(new)-set(old))
        kinds = self.change_kinds(before, after, groups)
        return Comparison(before_input_hash=before.input_hash,after_input_hash=after.input_hash,
                          change_kinds=kinds, **{k:sorted(v) for k,v in groups.items()})

    def classify(self, key, previous, finding, groups):
        if finding.status == 'triggered':
            group = 'still_triggered' if previous and previous.status=='triggered' else 'new_triggered'
            groups[group].append(key)
        elif finding.status == 'needs_review':
            groups['needs_review'].append(key)
            if previous and previous.status != 'needs_review':
                groups['became_unknown'].append(key)
        elif previous:
            if previous.status == 'triggered':
                groups['no_longer_triggered'].append(key)
            elif previous.status == 'needs_review':
                groups['resolved_unknown'].append(key)

    def change_kinds(self, before, after, groups):
        a,b = before.comparison_basis, after.comparison_basis
        kinds = []
        if a.layout_hash != b.layout_hash:
            kinds.append('layout')
        if a.observation_hash != b.observation_hash:
            kinds.append('observation')
        if groups['removed_from_scope'] or groups['added_to_scope']:
            kinds.append('scope')
        if not kinds and before.input_hash != after.input_hash:
            kinds.append('visual_or_metadata')
        return kinds
