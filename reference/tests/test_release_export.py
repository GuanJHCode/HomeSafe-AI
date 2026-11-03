import copy,json,struct,sys,hashlib,importlib.util
from pathlib import Path
import pytest
from homesafe_core.release import contained_file,sha256,validate_glb,ReleaseVerifier
R=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('export_sources',R/'scripts/export_sources.py')
exporter=importlib.util.module_from_spec(spec);spec.loader.exec_module(exporter)

def glb_bytes(uri=None):
    # Synthetic triangle for parser tests ONLY. Never labeled a Lux3D output.
    coords=struct.pack('<9f',0,0,0,1,0,0,0,1,0)
    d={'asset':{'version':'2.0'},'buffers':[{'byteLength':36}],
       'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':36}],
       'accessors':[{'bufferView':0,'componentType':5126,'count':3,'type':'VEC3','min':[0,0,0],'max':[1,1,0]}],
       'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}],
       'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0}
    if uri:d['buffers'][0]['uri']=uri
    j=json.dumps(d).encode();j+=b' '*((-len(j))%4)
    body=struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(coords),0x004e4942)+coords
    return struct.pack('<4sII',b'glTF',2,12+len(body))+body

def desc(p,root):return {'path':str(p.relative_to(root)),'sha256':sha256(p)}

def test_glb_structural_subset_valid(tmp_path):
    p=tmp_path/'test.glb';p.write_bytes(glb_bytes());assert validate_glb(p)['meshes']

@pytest.mark.parametrize('payload',[b'',b'not a glb',b'glTF'+b'\0'*30])
def test_invalid_glb(tmp_path,payload):
    p=tmp_path/'bad.glb';p.write_bytes(payload)
    with pytest.raises(ValueError):validate_glb(p)

@pytest.mark.parametrize('uri',['https://example.com/a.bin','data:application/octet-stream;base64,AAAA','../../private'])
def test_external_uri_rejected(tmp_path,uri):
    p=tmp_path/'bad.glb';p.write_bytes(glb_bytes(uri))
    with pytest.raises(ValueError,match='URI'):validate_glb(p)

@pytest.mark.parametrize('relative',['../secret','/etc/passwd','x/../../secret','C:/secret','x\\secret',''])
def test_path_restrictions(tmp_path,relative):
    with pytest.raises(ValueError):contained_file(tmp_path,relative)

def test_symlink_rejected(tmp_path):
    real=tmp_path/'real';real.write_text('a');(tmp_path/'alias').symlink_to(real)
    with pytest.raises(ValueError):contained_file(tmp_path,'alias')

def test_empty_materials_fake_assets_rejected(tmp_path):
    (tmp_path/'r.pdf').write_bytes(b'');(tmp_path/'v.mp4').write_bytes(b'')
    bad={'manifest_version':'2.0','status':'READY_FOR_SUBMISSION','source_commit':'not-a-real-commit',
         'report':desc(tmp_path/'r.pdf',tmp_path),'video':desc(tmp_path/'v.mp4',tmp_path),
         'channel':'public','assets':[{'asset_id':'fake','path':'missing.glb','sha256':'f'*64,'source_kind':'lux3d_web','rights_scope':'official_review_only'}]*6,
         'feature_asset_map':[{'feature_id':'core','asset_id':'fake','video_segment':'00:10'}]}
    errors=ReleaseVerifier().verify(tmp_path,bad)
    assert any('empty' in e for e in errors)
    assert any('duplicate' in e for e in errors)
    assert any('commit' in e for e in errors)
    assert any('missing' in e for e in errors)
    assert any('public' in e for e in errors)
    assert any('mapping' in e or 'map not linked' in e for e in errors)

def test_no_fixed_asset_count(tmp_path):
    errors=ReleaseVerifier().verify(tmp_path,{'manifest_version':'2.0','status':'DRAFT','assets':[]})
    assert errors and not any('six' in e or '六' in e for e in errors)

def test_receipt_only_after_submitted(tmp_path):
    base={'manifest_version':'2.0','status':'READY_FOR_SUBMISSION','assets':[]}
    a=ReleaseVerifier().verify(tmp_path,base)
    base['status']='SUBMITTED';b=ReleaseVerifier().verify(tmp_path,base)
    assert not any('receipt' in e for e in a)
    assert any('receipt' in e for e in b)

def test_commit_must_exist(tmp_path):
    errors=ReleaseVerifier().verify(tmp_path,{'source_commit':'a'*40})
    assert any('commit does not exist' in e for e in errors)

def test_export_only_explicit_sources(tmp_path):
    src=tmp_path/'src';src.mkdir();public=src/'README.md';public.write_text('design')
    private=src/'evidence';private.mkdir();(private/'family.txt').write_text('do not export')
    plan={'files':[dict(desc(public,src),classification='generated_project_source')]}
    dst=tmp_path/'dst'
    assert exporter.export(src,dst,plan)==['README.md'] and not dst.exists()
    exporter.export(src,dst,plan,True)
    assert (dst/'README.md').read_text()=='design' and not (dst/'evidence').exists()

def test_changed_file_export_stops(tmp_path):
    p=tmp_path/'readme';p.write_text('old');plan={'files':[dict(desc(p,tmp_path),classification='generated_project_source')]};p.write_text('new')
    with pytest.raises(ValueError,match='changed'):exporter.verify_plan(tmp_path,plan)

def test_export_unknown_classification_stops(tmp_path):
    p=tmp_path/'file';p.write_text('x');plan={'files':[dict(desc(p,tmp_path),classification='unknown')]}
    with pytest.raises(ValueError):exporter.verify_plan(tmp_path,plan)

def test_export_conflict_no_partial_copy(tmp_path):
    src=tmp_path/'src';dst=tmp_path/'dst';src.mkdir();dst.mkdir()
    a=src/'a';b=src/'b';a.write_text('newa');b.write_text('newb');(dst/'b').write_text('existing')
    plan={'files':[dict(desc(p,src),classification='generated_project_source') for p in [a,b]]}
    with pytest.raises(ValueError,match='manual merge'):exporter.export(src,dst,plan,True)
    assert not (dst/'a').exists() and (dst/'b').read_text()=='existing'

def test_export_destination_symlink(tmp_path):
    src=tmp_path/'src';src.mkdir();p=src/'a';p.write_text('ok')
    actual=tmp_path/'actual';actual.mkdir();dst=tmp_path/'alias';dst.symlink_to(actual,target_is_directory=True)
    plan={'files':[dict(desc(p,src),classification='generated_project_source')]}
    with pytest.raises(ValueError,match='symlink'):exporter.export(src,dst,plan,True)

def test_package_template_blocked():
    m=json.loads((R/'submission/submission-manifest.json').read_text())
    assert ReleaseVerifier().verify(R,m)

@pytest.mark.parametrize('name',['.env','secrets.key','private/a.txt','data/input.txt','.git/config'])
def test_sensitive_files_cannot_be_approved_in_export(tmp_path,name):
    p=tmp_path/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('secret test fixture')
    plan={'files':[dict(desc(p,tmp_path),classification='generated_project_source')]}
    with pytest.raises(ValueError,match='never exported'):exporter.verify_plan(tmp_path,plan)
