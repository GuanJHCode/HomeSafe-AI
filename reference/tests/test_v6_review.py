import copy, json
from pathlib import Path
import pytest
from homesafe_core.engine import RuleEngine, FindingDiffer
from homesafe_core.models import Scene, Rect, AssetRenderDTO
from homesafe_core.validation import PlacementValidationError
from homesafe_core.challenge import ChallengeService
from homesafe_core.browser_bridge import dispatch_json

ROOT=Path(__file__).resolve().parents[2]
def scene(name='before'): return json.loads((ROOT/f'examples/scene-{name}.json').read_text())
def obj(s, oid): return next(o for o in s['objects'] if o['id']==oid)
def obs(v): return {'value':v,'source_kind':'demo' if v is not None else 'unknown',
                    'verification_state':'provided' if v is not None else 'unknown'}
def goals():
    return [{'rule_id':'R001','profile_id':'child','object_id':'chair'},
            {'rule_id':'R005','profile_id':'elder','object_id':'chair'}]
def pose(name): 
    o=obj(scene(name),'chair')
    return {'position':o['position'],'yaw_rad':o['yaw_rad']}

def with_unknown_furniture(n=6):
    s=scene()
    for i in range(n):
        o=copy.deepcopy(obj(s,'chair'))
        o.update(id=f'unknown-{i}',category='unknown_furniture',
                 position={'x':.3+i*.3,'y':0.,'z':.4},
                 dimensions_m={'width':.1,'height':.1,'depth':.1})
        o['traits']={name:obs(None) for name in o['traits']}
        o['properties']={}
        s['objects'].append(o)
    return s

def test_unknown_noise_is_aggregated_not_cartesian_windows():
    base=RuleEngine().evaluate(scene())
    result=RuleEngine().evaluate(with_unknown_furniture())
    assert len(result.findings)==len(base.findings)
    assert len(result.setup_items)==6
    assert all(c.state=='missing_input' for c in result.coverage if c.profile_id)
    assert all(len(i.unknown_traits)==8 for i in result.setup_items)

def test_category_hint_does_not_confirm_any_trait():
    s=with_unknown_furniture(1);obj(s,'unknown-0')['category']='cabinet'
    result=RuleEngine().evaluate(s)
    assert 'requires_anchor_check' in result.setup_items[0].suggested_true_traits
    assert all(f.status=='needs_review' for f in result.findings if 'unknown-0' in f.object_ids)
    assert obj(s,'unknown-0')['traits']['requires_anchor_check']['value'] is None

def test_suspected_window_still_reports_unknown_relation():
    s=scene();obj(s,'window')['traits']['window_opening']=obs(None)
    a=RuleEngine().evaluate(s)
    assert any(f.rule_id=='R001' and f.status=='needs_review' for f in a.findings)
    assert any(f.rule_id=='R002' and f.status=='needs_review' for f in a.findings)

@pytest.mark.parametrize('oid,prop,rid',[('window','protection_reported','R002'),('cabinet','anchored','R003')])
def test_resolved_unknown_is_not_layout_improvement(oid,prop,rid):
    s=scene();obj(s,oid)['properties'][prop]=obs(None);a=RuleEngine().evaluate(s)
    obj(s,oid)['properties'][prop]=obs(True);b=RuleEngine().evaluate(s)
    d=FindingDiffer().compare(a,b)
    key=next(f.key for f in a.findings if f.rule_id==rid and oid in f.object_ids)
    assert key in d.resolved_unknown and key not in d.no_longer_triggered
    assert d.change_kinds==['observation']

def test_unknown_confirmed_as_triggered_is_new_trigger():
    s=scene();obj(s,'window')['properties']['protection_reported']=obs(None)
    a=RuleEngine().evaluate(s);obj(s,'window')['properties']['protection_reported']=obs(False)
    d=FindingDiffer().compare(a,RuleEngine().evaluate(s))
    assert d.new_triggered and not d.resolved_unknown

def test_layout_issue_has_related_ids_and_preserves_legacy_message():
    s=scene();obj(s,'chair')['position']=copy.deepcopy(obj(s,'cabinet')['position'])
    with pytest.raises(PlacementValidationError,match='solid penetration') as caught:
        RuleEngine().evaluate(s)
    issue=next(i for i in caught.value.issues if i.code=='SOLID_PENETRATION')
    assert {issue.object_id,*issue.related_object_ids}=={'chair','cabinet'}
    assert issue.field=='position'

def test_invalid_height_issue_field():
    s=scene();obj(s,'storage')['properties']['storage_height']['value']=100.
    with pytest.raises(PlacementValidationError) as caught: RuleEngine().evaluate(s)
    assert any(i.code=='HEIGHT_OUTSIDE_CONTAINER' and i.field.endswith('.value') for i in caught.value.issues)

def test_route_rect_has_center_documentation():
    props=Rect.model_json_schema()['properties']
    assert 'CENTER' in props['x']['description'] and 'CENTER' in props['z']['description']

def test_challenge_goals_do_not_require_falsifying_unknowns():
    c=ChallengeService(scene(),['chair'],goals())
    result=c.apply_transform('chair',pose('improved'))
    assert result['challenge']['status']=='goal_met'
    assert result['challenge']['remaining_needs_review']>0
    assert any(f['rule_id']=='R002' and f['status']=='needs_review' for f in result['assessment']['findings'])

def test_conflict_counter_is_transition_based_and_noop_not_step():
    c=ChallengeService(scene(),['chair'],goals())
    c.apply_transform('chair',pose('conflict'))
    a=c.result()['challenge']
    assert a['steps']==1 and a['conflict_events']==1
    c.apply_transform('chair',pose('conflict'))
    assert c.result()['challenge']==a
    c.apply_transform('chair',pose('improved'))
    assert c.result()['challenge']['steps']==2

def test_invalid_move_keeps_last_valid_scene():
    c=ChallengeService(scene(),['chair'],goals());before=c.scene.model_dump()
    invalid={'position':obj(scene(),'cabinet')['position'],'yaw_rad':0.}
    with pytest.raises(PlacementValidationError):c.apply_transform('chair',invalid)
    assert c.scene.model_dump()==before and c.steps==0 and c.invalid_attempts==1

def test_challenge_undo_has_monotonic_local_revision():
    c=ChallengeService(scene(),['chair'],goals())
    c.apply_transform('chair',pose('improved'));old=c.scene.revision
    c.undo()
    assert c.scene.revision>old and c.result()['challenge']['status']=='in_progress'

def test_challenge_cannot_move_window_or_edit_observations():
    c=ChallengeService(scene(),['chair'],goals())
    with pytest.raises(ValueError):c.apply_transform('window',pose('improved'))
    with pytest.raises(ValueError):c.apply_transform('chair',dict(pose('improved'),anchored=True))

@pytest.mark.parametrize('op,payload',[
    ('exec',{'python':'print(1)'}),
    ('evaluate',{'scene':{},'python':'print(1)'}),
    ('challenge_move',{'object_id':'chair','transform':{},'properties':{}})])
def test_rpc_has_no_arbitrary_code_or_unlisted_fields(op,payload):
    out=json.loads(dispatch_json(json.dumps({'op':op,'payload':payload})))
    assert out['ok'] is False

def test_bridge_evaluate_matches_native():
    s=scene()
    out=json.loads(dispatch_json(json.dumps({'op':'evaluate','payload':{'scene':s}})))
    assert out['ok'] and out['result']==RuleEngine().evaluate(s).model_dump(mode='json')

def test_bridge_placement_error_structured():
    s=scene();obj(s,'chair')['position']['x']=100.
    out=json.loads(dispatch_json(json.dumps({'op':'evaluate','payload':{'scene':s}})))
    assert out['error']['code']=='INVALID_PLACEMENT' and out['error']['issues'][0]['object_id']=='chair'

def test_bridge_size_limit():
    assert json.loads(dispatch_json(' '*512001))['ok'] is False

def test_unknown_suggestion_changes_require_rebaseline():
    s=with_unknown_furniture(1);a=RuleEngine().evaluate(s)
    obj(s,'unknown-0')['category']='cabinet'
    with pytest.raises(ValueError,match='scope_changed'):
        FindingDiffer().compare(a,RuleEngine().evaluate(s))
