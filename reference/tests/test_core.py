import copy,json,math,random
from pathlib import Path
import pytest
from pydantic import ValidationError
from homesafe_core.models import Scene, AssetRenderDTO, ContractBundle
from homesafe_core.engine import RuleEngine,FindingDiffer,ComparisonGuard
from homesafe_core.validation import validate_scene
from homesafe_core.geometry import FootprintService as G
R=Path(__file__).resolve().parents[2]

def load(name='before'):
    return json.loads((R/'examples'/f'scene-{name}.json').read_text())
def obj(s,id):return next(o for o in s['objects'] if o['id']==id)
def obs(v):return {'value':v,'source_kind':'demo' if v is not None else 'unknown','verification_state':'provided' if v is not None else 'unknown'}
def find(a,rule,oid):return [f for f in a.findings if f.rule_id==rule and oid in f.object_ids]
def prop(s,id,k,v):obj(s,id)['properties'][k]=obs(v)

@pytest.mark.parametrize('name',['before','conflict','improved'])
def test_example_validation(name):
    s=load(name);a=RuleEngine().evaluate(s)
    assert a.findings and a.coverage and a.unsupported_domains

def test_multi_trait_cabinet_hazard_and_anchor():
    s=load();c=obj(s,'cabinet');c['traits']['contains_hazardous_items']=obs(True)
    c['properties'].update(locked=obs(False),storage_height=dict(obs(.5),coordinate_reference='object_base'))
    a=RuleEngine().evaluate(s)
    assert {f.rule_id for f in a.findings if 'cabinet' in f.object_ids}>={'R001','R003','R004'}
    assert find(a,'R004','cabinet')[0].status=='triggered'

def test_cabinet_can_be_window_support():
    s=load();obj(s,'chair')['position'].update(x=3.,z=.6)
    obj(s,'cabinet')['position'].update(x=5.3,z=3.3)
    assert find(RuleEngine().evaluate(s),'R001','cabinet')[0].status=='triggered'

def test_trait_unknown_not_silently_false():
    s=load();obj(s,'cabinet')['traits']['contains_hazardous_items']=obs(None)
    assert find(RuleEngine().evaluate(s),'R004','cabinet')[0].status=='needs_review'

def test_display_category_not_rule_switch():
    s=load();a=RuleEngine().evaluate(s);obj(s,'cabinet')['category']='cosmetic_name';obj(s,'cabinet')['label']='改名'
    b=RuleEngine().evaluate(s)
    assert [f.model_dump() for f in a.findings]==[f.model_dump() for f in b.findings]

def test_interpenetration_rejected():
    s=load();obj(s,'chair')['position']=copy.deepcopy(obj(s,'cabinet')['position'])
    with pytest.raises(ValueError,match='solid penetration'):RuleEngine().evaluate(s)

def test_floor_cannot_float():
    s=load();obj(s,'chair')['position']['y']=.5
    with pytest.raises(ValueError,match='cannot float'):validate_scene(s)

@pytest.mark.parametrize('height',[-1.,100.,float('nan'),float('inf'),True])
def test_invalid_storage_height(height):
    s=load();obj(s,'storage')['properties']['storage_height']['value']=height
    with pytest.raises(ValueError):RuleEngine().evaluate(s)

def test_storage_coordinate_required():
    s=load();obj(s,'storage')['properties']['storage_height']['coordinate_reference']='not_applicable'
    with pytest.raises(ValueError):validate_scene(s)

def test_rug_can_be_under_chair():
    s=load();obj(s,'chair')['position'].update(x=1.8,z=2.)
    validate_scene(s)

def test_touching_solids_permitted():
    s=load();s['objects']=[o for o in s['objects'] if o['id']!='storage'];c=obj(s,'cabinet');obj(s,'chair')['position'].update(x=c['position']['x']+.6,z=c['position']['z'])
    validate_scene(s)

def test_supported_object_and_no_interpenetration():
    s=load();c=obj(s,'cabinet');o=obj(s,'chair');o['placement_mode']='supported';o['supported_by']='cabinet';o['position']=dict(x=.5,y=1.6,z=3.3);o['dimensions_m']=dict(width=.3,height=.2,depth=.3)
    validate_scene(s)

def test_support_overhang_blocked():
    s=load();o=obj(s,'chair');o['placement_mode']='supported';o['supported_by']='cabinet';o['position']=dict(x=.5,y=1.6,z=3.3);o['dimensions_m']=dict(width=1.,height=.2,depth=.3)
    with pytest.raises(ValueError,match='exceeds'):validate_scene(s)

@pytest.mark.parametrize('field',['width','height','depth'])
@pytest.mark.parametrize('value',[0.,-1.,float('nan'),float('inf'),True])
def test_bad_dimensions(field,value):
    s=load();obj(s,'chair')['dimensions_m'][field]=value
    with pytest.raises(ValueError):validate_scene(s)

@pytest.mark.parametrize('field',['x','y','z'])
def test_outside_room(field):
    s=load();obj(s,'chair')['position'][field]=100.
    with pytest.raises(ValueError):validate_scene(s)

def test_duplicate_ids_rejected():
    s=load();s['objects'].append(copy.deepcopy(s['objects'][0]))
    with pytest.raises(ValueError):validate_scene(s)

def test_missing_provenance_rejected():
    s=load();obj(s,'cabinet')['properties']['anchored']={'value':True}
    with pytest.raises(ValueError):validate_scene(s)

def test_demo_cannot_be_claimed_real():
    s=load();s['is_demo']=False
    with pytest.raises(ValueError,match='demo observations'):validate_scene(s)

def test_no_routes_explicit_coverage():
    s=load();s['routes']=[];a=RuleEngine().evaluate(s)
    assert all(c.state=='missing_input' for c in a.coverage if c.profile_id=='elder')

def test_no_profiles_explicit_coverage():
    s=load();s['profiles']=[];a=RuleEngine().evaluate(s)
    assert not a.findings and any(c.rule_id=='ALL' and c.state=='missing_input' for c in a.coverage)

def test_unconfirmed_route_unknown():
    s=load();s['routes'][0]['confirmed']=False
    a=RuleEngine().evaluate(s)
    assert all(f.status=='needs_review' for f in a.findings if f.profile_id=='elder')

@pytest.mark.parametrize('kind',['route','config','role','scene','dimensions','trait','collision'])
def test_comparison_basis_change_blocked(kind):
    s=load('conflict');a=RuleEngine().evaluate(s)
    if kind=='route':s['routes'][0]['rect']['z']=.6
    elif kind=='config':s['rule_config']['near_window_m']=.7
    elif kind=='role':s['profiles'][0]['can_climb']=obs(False)
    elif kind=='scene':s['scene_id']='different'
    elif kind=='dimensions':obj(s,'chair')['dimensions_m']['height']=.9
    elif kind=='trait':obj(s,'chair')['traits']['possible_climb_support']=obs(False)
    else:obj(s,'chair')['collision_layer']='surface'
    b=RuleEngine().evaluate(s)
    with pytest.raises(ValueError):FindingDiffer().compare(a,b)

def test_deleted_object_not_resolved():
    s=load();a=RuleEngine().evaluate(s);chair_keys={f.key for f in a.findings if 'chair' in f.object_ids}
    s['objects']=[o for o in s['objects'] if o['id']!='chair'];b=RuleEngine().evaluate(s)
    d=FindingDiffer().compare(a,b)
    assert chair_keys<=set(d.removed_from_scope) and not chair_keys & set(d.no_longer_triggered)

def test_unknown_cannot_be_improvement():
    s=load();prop(s,'cabinet','anchored',False);a=RuleEngine().evaluate(s)
    prop(s,'cabinet','anchored',None);d=FindingDiffer().compare(a,RuleEngine().evaluate(s))
    key=find(a,'R003','cabinet')[0].key
    assert key in d.became_unknown and key not in d.no_longer_triggered

def test_continuous_conflict_story():
    a,b,c=[RuleEngine().evaluate(load(n)) for n in ['before','conflict','improved']]
    d=FindingDiffer().compare(a,b);e=FindingDiffer().compare(b,c)
    assert find(a,'R001','chair')[0].key in d.no_longer_triggered
    assert find(b,'R005','chair')[0].key in d.new_triggered
    assert find(b,'R005','chair')[0].key in e.no_longer_triggered
    assert find(c,'R002','window')[0].status=='needs_review'

@pytest.mark.parametrize('rule,oid,property_name,trigger_value',[('R002','window','protection_reported',False),('R003','cabinet','anchored',False),('R006','rug','secured',False),('R008','gate','raised_threshold_present',True)])
@pytest.mark.parametrize('mode',['triggered','not_triggered','needs_review'])
def test_boolean_rule_three_states(rule,oid,property_name,trigger_value,mode):
    s=load();v=trigger_value if mode=='triggered' else not trigger_value if mode=='not_triggered' else None
    prop(s,oid,property_name,v)
    assert find(RuleEngine().evaluate(s),rule,oid)[0].status==mode

@pytest.mark.parametrize('mode',['triggered','not_triggered','needs_review'])
def test_r001_states(mode):
    s=load();s['profiles'][0]['can_climb']=obs(True if mode=='triggered' else False if mode=='not_triggered' else None)
    assert find(RuleEngine().evaluate(s),'R001','chair')[0].status==mode

@pytest.mark.parametrize('mode',['triggered','not_triggered','needs_review'])
def test_r004_states(mode):
    s=load();prop(s,'storage','locked',False if mode=='triggered' else True if mode=='not_triggered' else None)
    assert find(RuleEngine().evaluate(s),'R004','storage')[0].status==mode

@pytest.mark.parametrize('mode',['triggered','not_triggered','needs_review'])
def test_r005_states(mode):
    s=load('conflict' if mode!='not_triggered' else 'improved')
    if mode=='needs_review':obj(s,'chair')['position_confirmed']=False
    assert find(RuleEngine().evaluate(s),'R005','chair')[0].status==mode

@pytest.mark.parametrize('mode',['triggered','not_triggered','needs_review'])
def test_r007_states(mode):
    s=load();prop(s,'cord','secured',False if mode=='triggered' else True if mode=='not_triggered' else None)
    assert find(RuleEngine().evaluate(s),'R007','cord')[0].status==mode

@pytest.mark.parametrize('seed',range(6))
def test_order_invariance(seed):
    s=load();a=RuleEngine().evaluate(s);rnd=random.Random(seed)
    for k in ['profiles','objects','routes']:rnd.shuffle(s[k])
    b=RuleEngine().evaluate(s)
    assert a.input_hash==b.input_hash and a.findings==b.findings

@pytest.mark.parametrize('yaw',[0.,math.pi/4,math.pi/2,-math.pi/4])
def test_geometry_rotations(yaw):
    a=G.rectangle(0.,0.,2.,1.,yaw);b=G.rectangle(5.,0.,.5,.5,0.)
    assert not G.overlaps(a,b) and G.distance(a,b)==pytest.approx(G.distance(b,a))
    assert G.distance(a,a)==0

def test_visual_swap_does_not_change_results():
    s=load();a=RuleEngine().evaluate(s);obj(s,'chair')['asset_id']='different-glb'
    b=RuleEngine().evaluate(s)
    assert a.findings==b.findings and not FindingDiffer().compare(a,b).new_triggered

def test_observation_roundtrip():
    s=load();o=obj(s,'cabinet')['properties']['anchored'];o.update(value=True,source_kind='simulated',verification_state='provided',observed_at='2026-11-03T08:00:00Z',evidence_ref='private-handle')
    out=Scene.model_validate_json(Scene.model_validate(s).model_dump_json()).model_dump()
    assert obj(out,'cabinet')['properties']['anchored']==o

def test_contract_has_calibration_and_observations():
    defs=ContractBundle.model_json_schema()['$defs']
    assert 'calibration' in defs['AssetRenderDTO']['properties']
    assert 'source_kind' in defs['BoolObservation']['properties']
    assert 'coverage' in defs['Assessment']['properties']

def test_asset_calibration_roundtrip():
    asset=dict(asset_id='chair',content_hash='a'*64,render_url='/api/v1/assets/chair/file',provenance_summary='lux3d_web',calibration=dict(revision=1,orientation=dict(x=0.,y=0.,z=0.,w=1.),pivot_offset_after_rotation=dict(x=0.,y=0.,z=0.),normalized_bounds_m=dict(width=1.,height=1.,depth=1.),reviewed=True,strategy='runtime_axis_fit'))
    a=AssetRenderDTO.model_validate(asset)
    assert AssetRenderDTO.model_validate_json(a.model_dump_json())==a
    asset['calibration']['orientation']['w']=2.
    with pytest.raises(ValueError):AssetRenderDTO.model_validate(asset)

@pytest.mark.parametrize('value',['yesterday','2026-11-03T08:00:00','not-a-date'])
def test_observation_timestamp_format(value):
    s=load();obj(s,'cabinet')['properties']['anchored']=dict(obs(True),observed_at=value)
    with pytest.raises(ValueError):validate_scene(s)

def test_measured_observation_needs_timestamp():
    s=load();obj(s,'cabinet')['properties']['anchored']=dict(obs(True),source_kind='user_reported')
    with pytest.raises(ValueError):validate_scene(s)

def test_baked_asset_cannot_double_normalize():
    from homesafe_core.models import AssetCalibration
    args=dict(revision=1,orientation=dict(x=0.,y=0.,z=0.,w=1.),pivot_offset_after_rotation=dict(x=1.,y=0.,z=0.),normalized_bounds_m=dict(width=1.,height=1.,depth=1.),reviewed=True,strategy='baked_standard_glb')
    with pytest.raises(ValueError,match='second time'):AssetCalibration.model_validate(args)
