#!/usr/bin/env python3
"""Generate active wire contracts; --check is read-only and detects drift."""
import sys,json,argparse
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'reference'))
from homesafe_core.contract_bundle import ContractBundle

def ts_type(s):
    if '$ref' in s: return s['$ref'].split('/')[-1]
    if 'const' in s: return json.dumps(s['const'],ensure_ascii=False)
    if 'enum' in s: return ' | '.join(json.dumps(v,ensure_ascii=False) for v in s['enum'])
    if 'anyOf' in s: return ' | '.join(ts_type(v) for v in s['anyOf'])
    t=s.get('type')
    if t=='null':return 'null'
    if t in ('integer','number'):return 'number'
    if t=='boolean':return 'boolean'
    if t=='string':return 'string'
    if t=='array':return 'Array<'+ts_type(s['items'])+'>'
    if t=='object':
        if 'properties' in s:
            req=set(s.get('required',[]))
            return '{\n'+'\n'.join('  '+json.dumps(k)+('' if k in req else '?')+': '+ts_type(v)+';' for k,v in s['properties'].items())+'\n}'
        ad=s.get('additionalProperties',{})
        return 'Record<string, '+('unknown' if not isinstance(ad,dict) else ts_type(ad))+'>'
    return 'unknown'

def build():
    schema=ContractBundle.model_json_schema()
    defs=schema['$defs']
    ts='// GENERATED from reference/homesafe_core/models.py. Do not hand-edit.\n'
    ts+='// TS types do not validate untrusted input; Python models + spatial validator do.\n\n'
    ts+='\n\n'.join('export type '+n+' = '+ts_type(s)+';' for n,s in sorted(defs.items()))+'\n'
    paths={}
    ops=[
        ('/api/v1/scenes','post','createScene','SceneCreate','Scene'),
        ('/api/v1/scenes/{scene_id}','put','replaceScene','SceneReplace','Scene'),
        ('/api/v1/reports','post','createReport','ReportRequest','ReportDTO'),
        ('/api/v1/reports/{report_id}','get','getReport',None,'ReportDTO'),
        ('/api/v1/generations','post','createGeneration','GenerationRequest','JobDTO'),
        ('/api/v1/generations/{job_id}','get','getGeneration',None,'JobDTO'),
        ('/healthz','get','healthz',None,'HealthDTO'),
        ('/api/v1/scenes/{scene_id}','get','getScene',None,'Scene'),
        ('/api/v1/scenes/{scene_id}/objects/{object_id}','patch','patchObject','ObjectPatch','Scene'),
        ('/api/v1/scenes/{scene_id}/assessments','post','assessScene','AssessmentRequest','Assessment'),
        ('/api/v1/assessments/{assessment_id}','get','getAssessment',None,'Assessment'),
        ('/api/v1/comparisons','post','compareAssessments','CompareRequest','Comparison'),
        ('/api/v1/assets/{asset_id}','get','getAsset',None,'AssetRenderDTO'),
        ('/api/v1/assets/{asset_id}/calibration','put','calibrateAsset','AssetCalibration','AssetRenderDTO'),
        ('/api/v1/demo/evaluations','post','evaluateDemo','DemoEvaluationRequest','Assessment'),
    ]
    for path,method,name,body,response in ops:
        op={'operationId':name,'x-implementation-status':'DESIGN_ONLY','responses':{
            '200':{'description':'Success','content':{'application/json':{'schema':{'$ref':'#/components/schemas/'+response}}}},
            'default':{'description':'Error','content':{'application/json':{'schema':{'$ref':'#/components/schemas/ErrorDTO'}}}}}}
        params=[]
        for part in path.split('/'):
            if part.startswith('{'):params.append({'name':part[1:-1],'in':'path','required':True,'schema':{'type':'string'}})
        if params:op['parameters']=params
        if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':{'$ref':'#/components/schemas/'+body}}}}
        paths.setdefault(path,{})[method]=op
    def remap(v):
        if isinstance(v,dict):return {k:(x.replace('#/$defs/','#/components/schemas/') if k=='$ref' else remap(x)) for k,x in v.items()}
        if isinstance(v,list):return [remap(x) for x in v]
        return v
    oas={'openapi':'3.1.0','info':{'title':'HomeSafe deferred HTTP fallback contract','version':'3.0.0','description':'V6 primary runtime is browser worker JSON, not HTTP. These legacy/fallback endpoints are design only and must not be implemented as a P0 checklist.'},'paths':paths,'components':{'schemas':remap(defs)}}
    return {'contracts/domain.schema.json':json.dumps(schema,ensure_ascii=False,indent=2)+'\n',
            'contracts/frontend/domain.ts':ts,'contracts/http/openapi.json':json.dumps(oas,ensure_ascii=False,indent=2)+'\n'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    errors=[]
    for rel,text in build().items():
        p=R/rel
        if args.check:
            if not p.exists() or p.read_text()!=text:errors.append(rel)
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    if errors: print('CONTRACT DRIFT:',', '.join(errors));return 1
    print('Canonical contracts '+('match' if args.check else 'generated')+' (3 files; not a live API)');return 0
if __name__=='__main__':raise SystemExit(main())
