#!/usr/bin/env python3
import sys,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'reference'))
from homesafe_core.engine import RuleEngine,FindingDiffer
items=[]
for name in ('before','conflict','improved'):
    a=RuleEngine().evaluate(json.loads((R/f'examples/scene-{name}.json').read_text()));items.append(a)
    print(name,':',[(f.rule_id,f.object_ids,f.status) for f in a.findings if 'chair' in f.object_ids or f.rule_id=='R002'])
print(FindingDiffer().compare(items[0],items[1]).model_dump_json(indent=2))
print('SYNTHETIC REFERENCE DEMO ONLY — no GLB or real safety validation.')
