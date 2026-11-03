#!/usr/bin/env python3
"""Reproducible package checks. Not product acceptance or medical validation."""
import sys,json,subprocess,re
from pathlib import Path
import jsonschema
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'reference'))
from homesafe_core.models import Scene,Assessment,Comparison
from homesafe_core.engine import RuleEngine,FindingDiffer

checks=[]
def check(label,fn):
    try:fn();checks.append((label,True,''));print('PASS',label)
    except Exception as e:checks.append((label,False,str(e)));print('FAIL',label,str(e))

def generator():
    p=subprocess.run([sys.executable,str(R/'scripts/generate_contracts.py'),'--check'],capture_output=True,text=True)
    if p.returncode:raise ValueError(p.stdout+p.stderr)
check('generated contracts match canonical models',generator)
schema=json.loads((R/'contracts/domain.schema.json').read_text())
check('JSON Schema Draft 2020-12',lambda:jsonschema.Draft202012Validator.check_schema(schema))
for name in ['before','conflict','improved']:
    def example(name=name):
        data=json.loads((R/f'examples/scene-{name}.json').read_text())
        document={'$ref':'#/$defs/Scene','$defs':schema['$defs']}
        jsonschema.Draft202012Validator(document).validate(data)
        expected=json.loads((R/f'examples/assessment-{name}.json').read_text())
        actual=RuleEngine().evaluate(data).model_dump(mode='json')
        if actual!=expected:raise ValueError('example is stale')
    check('schema and deterministic example '+name,example)

def comparison():
    a=Assessment.model_validate_json((R/'examples/assessment-before.json').read_text())
    b=Assessment.model_validate_json((R/'examples/assessment-conflict.json').read_text())
    assert FindingDiffer().compare(a,b).model_dump(mode='json')==json.loads((R/'examples/comparison.json').read_text())
check('example comparison reproducible',comparison)

def oas():
    spec=json.loads((R/'contracts/http/openapi.json').read_text());ids=[]
    for path,methods in spec['paths'].items():
        for op in methods.values():ids.append(op['operationId']);assert op['x-implementation-status']=='DESIGN_ONLY'
    assert len(ids)==len(set(ids))
    def walk(v):
        if isinstance(v,dict):
            if '$ref' in v:
                ref=v['$ref'];assert ref.startswith('#/')
                cur=spec
                for part in ref[2:].split('/'):cur=cur[part.replace('~1','/').replace('~0','~')]
            for child in v.values():walk(child)
        elif isinstance(v,list):
            for child in v:walk(child)
    walk(spec)
check('OpenAPI internal pointers and operation IDs (not HTTP validation)',oas)

def local_links():
    for p in R.rglob('*.md'):
        if 'history' in p.parts:continue
        for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
            if link.startswith(('http:', 'https:', '#', 'mailto:')):continue
            target=link.split('#')[0]
            if target and not (p.parent/target).exists():raise ValueError(f'{p.relative_to(R)} -> {link}')
check('active Markdown local links',local_links)
print(f'{len(checks)} package checks, {sum(not x[1] for x in checks)} failures')
raise SystemExit(1 if any(not x[1] for x in checks) else 0)
