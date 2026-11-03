"""Local practice challenge. Not a safety score, leaderboard, or real-world certificate."""
from copy import deepcopy
from .engine import RuleEngine, FindingDiffer, digest
from .models import Scene, TransformInput
from .validation import validate_scene

class ChallengeService:
    def __init__(self, template: Scene | dict, movable_ids: list[str], goals: list[dict]):
        self.initial = validate_scene(template)
        if not self.initial.is_demo:
            raise ValueError('challenge requires a labeled synthetic demo template')
        objects = {o.id for o in self.initial.objects}
        if not movable_ids or not set(movable_ids) <= objects:
            raise ValueError('movable object missing')
        self.movable_ids = frozenset(movable_ids)
        self.goals = deepcopy(goals)
        if not goals or any(not {'rule_id','profile_id','object_id'} <= set(g) for g in goals):
            raise ValueError('explicit nonempty challenge goals required')
        initial = RuleEngine().evaluate(self.initial)
        for goal in goals:
            if not self.match(initial, goal):
                raise ValueError('challenge goal is not evaluated in template')
        self.reset()

    def reset(self):
        self.scene = self.initial.model_copy(deep=True)
        self.history = []
        self.steps = 0
        self.conflict_events = 0
        self.invalid_attempts = 0
        self.assessment = RuleEngine().evaluate(self.scene)
        return self.result()

    def match(self, assessment, goal):
        return [f for f in assessment.findings if f.rule_id == goal['rule_id']
                and f.profile_id == goal['profile_id'] and goal['object_id'] in f.object_ids]

    def apply_transform(self, object_id: str, transform: dict):
        if object_id not in self.movable_ids:
            raise ValueError('object is locked in this challenge')
        pose = TransformInput.model_validate(transform)
        candidate = self.scene.model_dump()
        target = next(o for o in candidate['objects'] if o['id'] == object_id)
        if target['position'] == pose.position.model_dump() and target['yaw_rad'] == pose.yaw_rad:
            return self.result()  # polling/no-op does not create a move
        target.update(position=pose.position.model_dump(), yaw_rad=pose.yaw_rad)
        candidate['revision'] += 1
        try:
            assessment = RuleEngine().evaluate(candidate)
        except ValueError:
            self.invalid_attempts += 1
            raise
        delta = FindingDiffer().compare(self.assessment, assessment)
        if self.is_tradeoff(delta, self.assessment, assessment):
            self.conflict_events += 1
        self.history.append(self.scene.model_dump())
        self.scene = validate_scene(candidate)
        self.assessment = assessment
        self.steps += 1
        return self.result(delta)

    def is_tradeoff(self, delta, before, after):
        reduced_roles = {f.profile_id for f in before.findings if f.key in delta.no_longer_triggered}
        new_roles = {f.profile_id for f in after.findings if f.key in delta.new_triggered}
        return any(a != b for a in reduced_roles for b in new_roles)

    def undo(self):
        if not self.history:
            return self.result()
        previous = self.history.pop()
        previous['revision'] = self.scene.revision + 1
        assessment = RuleEngine().evaluate(previous)
        delta = FindingDiffer().compare(self.assessment, assessment)
        self.scene = validate_scene(previous)
        self.assessment = assessment
        self.steps += 1  # no minimum-moves safety claims
        return self.result(delta)

    def result(self, delta=None):
        goal_results = [bool(self.match(self.assessment, g))
                        and all(f.status == 'not_triggered' for f in self.match(self.assessment, g))
                        for g in self.goals]
        return {
            'scene': self.scene.model_dump(mode='json'),
            'assessment': self.assessment.model_dump(mode='json'),
            'comparison': delta.model_dump(mode='json') if delta else None,
            'challenge': {
                'status': 'goal_met' if all(goal_results) else 'in_progress',
                'goal_results': goal_results, 'steps': self.steps,
                'conflict_events': self.conflict_events, 'invalid_attempts': self.invalid_attempts,
                'remaining_triggered': sum(f.status == 'triggered' for f in self.assessment.findings),
                'remaining_needs_review': sum(f.status == 'needs_review' for f in self.assessment.findings),
                'setup_objects': len(self.assessment.setup_items),
                'label': '仅本教学关卡目标；未解决的检查和未覆盖内容仍须核查，不表示家庭安全。'
            }
        }
