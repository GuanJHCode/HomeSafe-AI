"""Runtime-only canonical split preserves definitions and the complete wire contract."""
import ast
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = json.loads((ROOT / 'evidence/model-split-baseline-64e1665.json').read_text())
OFFLINE = {'asset_models', 'api_models', 'contract_bundle', 'asset_publication', 'release', 'lux3d_adapter'}


def digest_ast(node):
    def normalize(value):
        if isinstance(value, ast.AST):
            return {'node': type(value).__name__, **{key: normalize(item) for key, item in ast.iter_fields(value)
                                                    if item is not None and item != []}}
        if isinstance(value, list):
            return [normalize(item) for item in value]
        return value
    return hashlib.sha256(json.dumps(normalize(node), sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def test_class_definitions_and_runtime_support_preserve_baseline_ast():
    found = {}
    for filename, expected in BASELINE['partition'].items():
        module = ast.parse((ROOT / 'reference/homesafe_core' / filename).read_text())
        classes = {node.name: node for node in module.body if isinstance(node, ast.ClassDef)}
        assert set(classes) == set(expected)
        for name, node in classes.items():
            assert name not in found, f'Canonical class duplicated: {name}'
            found[name] = digest_ast(node)
        if filename == 'models.py':
            support = {getattr(node, 'name', None) or node.targets[0].id: digest_ast(node)
                       for node in module.body if isinstance(node, (ast.FunctionDef, ast.Assign))}
            assert support == BASELINE['support_ast_sha256']
    assert found == BASELINE['class_ast_sha256']
    init = ast.parse((ROOT / 'reference/homesafe_core/__init__.py').read_text())
    assert all(isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and
               isinstance(node.value.value, str) for node in init.body)


def test_contracts_unchanged_after_model_split():
    for path, expected in BASELINE['contract_sha256'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
    subprocess.run([sys.executable, str(ROOT / 'scripts/generate_contracts.py'), '--check'], check=True,
                   cwd=ROOT, capture_output=True, text=True)


def test_offline_types_share_the_runtime_base_and_nested_classes():
    from homesafe_core import models, asset_models, api_models
    from homesafe_core.contract_bundle import ContractBundle
    assert asset_models.AssetCalibration.model_fields['pivot_offset_after_rotation'].annotation is models.Vec3
    assert api_models.SceneReplace.model_fields['snapshot'].annotation is models.Scene
    assert ContractBundle.model_fields['scene'].annotation is models.Scene
    for module in [asset_models, api_models]:
        for name in BASELINE['partition'][module.__name__.split('.')[-1] + '.py']:
            assert issubclass(getattr(module, name), models.Model)


def isolated(code, tmp_path, payload):
    result = subprocess.run([sys.executable, '-I', '-c', code], input=json.dumps(payload),
                            cwd=tmp_path, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def test_browser_import_excludes_offline_models(tmp_path):
    result = isolated('''
import json,sys
data=json.load(sys.stdin)
sys.path.insert(0,data['reference'])
from homesafe_core.browser_bridge import dispatch_json
from homesafe_core import models
names={name for name,value in vars(models).items() if isinstance(value,type) and value.__module__==models.__name__}
assert names==set(data['runtime'])
assert all(getattr(models,name).__pydantic_complete__ for name in names)
assert not any('homesafe_core.'+name in sys.modules for name in data['offline'])
assert not any(name in vars(models) for name in data['removed'])
print(json.dumps({'runtime_classes':len(names),'offline_modules_loaded':False}))
''', tmp_path, {'reference': str(ROOT / 'reference'), 'runtime': BASELINE['partition']['models.py'],
               'removed': [name for file, names in BASELINE['partition'].items() if file != 'models.py' for name in names],
               'offline': sorted(OFFLINE)})
    assert result == {'runtime_classes': 26, 'offline_modules_loaded': False}


def test_runtime_bundle_dependency_closure(tmp_path):
    spec = importlib.util.spec_from_file_location('split_stage', ROOT / 'scripts/stage_browser_core.py')
    stage = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage)
    raw, manifest = stage.build_bundle()
    archive = tmp_path / 'runtime.zip'
    archive.write_bytes(raw)
    with zipfile.ZipFile(io.BytesIO(raw)) as packed:
        assert set(packed.namelist()) == {f'homesafe_core/{name}' for name in stage.FILES}
        assert len(stage.FILES) == 11
        assert not any(f'homesafe_core/{name}.py' in packed.namelist() for name in OFFLINE)
    assert hashlib.sha256(raw).hexdigest() == manifest['bundle_sha256']
    samples = {name: json.loads((ROOT / f'examples/scene-{name}.json').read_text())
               for name in ['before', 'conflict', 'improved']}
    expected = {name: json.loads((ROOT / f'examples/assessment-{name}.json').read_text()) for name in samples}
    result = isolated(ZIP_COMMAND_CHECK, tmp_path, {'archive': str(archive), 'samples': samples, 'expected': expected,
                                                 'offline': sorted(OFFLINE)})
    assert result['command_coverage'] == ['evaluate', 'compare', 'challenge_start', 'challenge_state',
                                        'challenge_move', 'challenge_undo', 'challenge_reset', 'challenge_end',
                                        'observation_options', 'observation_edit']
    assert result['models_eager_complete'] is True


ZIP_COMMAND_CHECK = r'''
import copy,json,sys
data=json.load(sys.stdin)
sys.path.insert(0,data['archive'])
from homesafe_core.browser_bridge import dispatch_json
from homesafe_core.challenge import main_challenge_scene
from homesafe_core import models
def call(op,payload=None):
    answer=json.loads(dispatch_json(json.dumps({'op':op,'payload':payload or {}})))
    assert answer['ok'],answer
    return answer['result']
def error(op,payload,code):
    answer=json.loads(dispatch_json(json.dumps({'op':op,'payload':payload})))
    assert not answer['ok'] and answer['error']['code']==code,answer
for name,scene in data['samples'].items():
    assert call('evaluate',{'scene':scene})==data['expected'][name]
before=data['samples']['before']; conflict=data['samples']['conflict']; improved=data['samples']['improved']
assert call('compare',{'before':before,'after':improved})['after_input_hash']==data['expected']['improved']['input_hash']
def pose(scene,oid):
    obj=next(obj for obj in scene['objects'] if obj['id']==oid)
    return {key:obj[key] for key in ['position','yaw_rad']}
goals=[{'rule_id':'R001','profile_id':'child','object_id':'chair'}, {'rule_id':'R005','profile_id':'elder','object_id':'chair'}]
start=call('challenge_start',{'scene':before,'movable_ids':['chair'],'goals':goals})
assert call('challenge_state')==start
assert call('challenge_move',{'object_id':'chair','transform':pose(conflict,'chair')})['challenge']['conflict_events']==1
assert call('challenge_move',{'object_id':'chair','transform':pose(improved,'chair')})['challenge']['status']=='goal_met'
assert call('challenge_undo')['assessment']['input_hash']==data['expected']['conflict']['input_hash']
assert call('challenge_reset')['challenge']['steps']==0
error('observation_edit',{'scene':before,'edit':{'object_id':'cabinet','field':'anchored','value':True}},'INVALID_COMMAND')
assert call('challenge_end')=={'ended':True}
error('challenge_state',{},'INVALID_COMMAND')
assert len(call('observation_options',{'scene':before}))==7
scene=before
for value in [True,False,None]:
    result=call('observation_edit',{'scene':scene,'edit':{'object_id':'cabinet','field':'anchored','value':value}})
    assert result['comparison']['change_kinds']==['observation']
    scene=result['scene']
main=main_challenge_scene(before).model_dump(mode='json')
goals=[dict(goal,object_id='cabinet') for goal in goals]
call('challenge_start',{'scene':main,'movable_ids':['cabinet'],'goals':goals})
assert call('challenge_move',{'object_id':'cabinet','transform':{'position':{'x':4.5,'y':0,'z':3.2},'yaw_rad':0}})['challenge']['status']=='goal_met'
invalid=copy.deepcopy(before);invalid['objects'][0]['position']['x']=-100
error('evaluate',{'scene':invalid},'INVALID_PLACEMENT')
deep=0
for _ in range(70):deep=[deep]
error('evaluate',{'scene':deep},'INPUT_TOO_DEEP')
error('unknown',{},'INVALID_COMMAND')
assert not any('homesafe_core.'+name in sys.modules for name in data['offline'])
assert all(module.__file__.startswith(data['archive']+'/') for name,module in sys.modules.items() if name.startswith('homesafe_core'))
complete=all(value.__pydantic_complete__ for value in vars(models).values() if isinstance(value,type) and value.__module__==models.__name__)
assert complete
print(json.dumps({'command_coverage':['evaluate','compare','challenge_start','challenge_state','challenge_move',
'challenge_undo','challenge_reset','challenge_end','observation_options','observation_edit'],'models_eager_complete':complete}))
'''
