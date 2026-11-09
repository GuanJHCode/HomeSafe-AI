"""Delivery choice must be explicit; a legitimate video route keeps shared gates."""
import json
import pytest
from homesafe_core.release import ReleaseVerifier, sha256


def errors(root, profile, **extra):
    return ReleaseVerifier().verify(root, {
        'manifest_version':'2.0','status':'DRAFT','channel':'public',
        'source_commit':'a'*40,'release_profile':profile,'assets':[], **extra,
    })


@pytest.mark.parametrize('profile',[None,'','anything','video',0,[],{}])
def test_unknown_profile_is_not_a_deployment_bypass(tmp_path, profile):
    assert any('unsupported release_profile' in e for e in errors(tmp_path,profile))


def test_video_route_requires_materials_owner_and_version_binding_but_not_website(tmp_path):
    result=errors(tmp_path,'project_report_and_video')
    for required in ['owner_review','product_acceptance','report','video','final_scene','material_binding']:
        assert any(required in e for e in result),required
    assert not any('interactive HTTPS' in e or 'deployment_receipt' in e for e in result)


def test_interactive_route_still_requires_url_and_actual_deployment_receipt(tmp_path):
    result=errors(tmp_path,'interactive_browser_demo_with_video')
    assert any('interactive HTTPS' in e for e in result)
    assert any('deployment_receipt' in e for e in result)


def test_interactive_valid_url_alone_is_not_deployment_evidence(tmp_path):
    result=errors(tmp_path,'interactive_browser_demo_with_video',primary_demo_url='https://app.example.org/demo/')
    assert not any('interactive HTTPS' in e for e in result)
    assert any('deployment_receipt' in e for e in result)


def test_website_receipt_must_bind_source_and_url(tmp_path):
    p=tmp_path/'deployment.json';p.write_text(json.dumps({'status':'VERIFIED_INTERACTIVE',
        'primary_url':'https://other.example.org/','release_commit':'b'*40,
        'evidence_files':['real-log.json'],'owner':'fixture-only'}))
    result=errors(tmp_path,'interactive_browser_demo_with_video',primary_demo_url='https://app.example.org/demo/',
                  deployment_receipt={'path':p.name,'sha256':sha256(p)})
    assert any('deployment evidence not bound' in e for e in result)


def test_video_route_does_not_require_future_official_receipt(tmp_path):
    result=errors(tmp_path,'project_report_and_video',status='READY_FOR_SUBMISSION')
    assert not any('official_receipt' in e for e in result)
    assert any('owner_review' in e for e in result)


def test_video_material_binding_rejects_a_different_source_and_media_hashes(tmp_path):
    p=tmp_path/'binding.json';p.write_text(json.dumps({'source_commit':'b'*40,
        'report_sha256':'b'*64,'video_sha256':'b'*64,'scene_sha256':'b'*64}))
    result=errors(tmp_path,'project_report_and_video',
        report={'path':'r.pdf','sha256':'a'*64},video={'path':'v.mp4','sha256':'a'*64},
        scene={'path':'s.json','sha256':'a'*64},material_binding={'path':p.name,'sha256':sha256(p)})
    assert any('material binding source' in e for e in result)
    assert any('material binding report' in e for e in result)
    assert any('material binding video' in e for e in result)


def descriptor(path):
    return {'path':path.name,'sha256':sha256(path)}


@pytest.mark.parametrize('status,source',[
    ('REJECTED','a'*40),('VERIFIED_SCOPED_VERSION_COMPARISON','f'*40),
])
def test_material_version_evidence_rejects_failed_or_wrong_version(tmp_path,status,source):
    version=tmp_path/'version.json'
    version.write_text(json.dumps({'status':status,'source_commit':source}))
    binding=tmp_path/'binding.json'
    binding.write_text(json.dumps({'status':'VERIFIED_MEDIA_AND_RUNTIME_BINDINGS',
        'source_commit':'a'*40,'report_sha256':'1'*64,'video_sha256':'2'*64,
        'scene_sha256':'3'*64,'version_evidence':descriptor(version)}))
    result=errors(tmp_path,'project_report_and_video',
        report={'sha256':'1'*64},video={'sha256':'2'*64},scene={'sha256':'3'*64},
        material_binding=descriptor(binding))
    assert any('material version' in e for e in result)


def test_material_version_evidence_requires_bound_captures_and_actual_comparison_logs(tmp_path):
    version=tmp_path/'version.json'
    version.write_text(json.dumps({'status':'VERIFIED_SCOPED_VERSION_COMPARISON',
        'source_commit':'a'*40,'video_capture_commit':'c'*40,'report_capture_commit':'d'*40,
        'scoped_comparisons':[{'scope':'runtime','result':'passed',
            'evidence':{'path':'missing.json','sha256':'e'*64}}]}))
    binding=tmp_path/'binding.json'
    binding.write_text(json.dumps({'status':'VERIFIED_MEDIA_AND_RUNTIME_BINDINGS',
        'source_commit':'a'*40,'report_sha256':'1'*64,'video_sha256':'2'*64,
        'scene_sha256':'3'*64,'version_evidence':descriptor(version)}))
    result=errors(tmp_path,'project_report_and_video',report={'sha256':'1'*64,'capture_commit':'e'*40},
        video={'sha256':'2'*64,'capture_commit':'f'*40},scene={'sha256':'3'*64},
        material_binding=descriptor(binding))
    assert any('material version report capture' in e for e in result)
    assert any('material version video capture' in e for e in result)
    assert any('version comparison' in e for e in result)


@pytest.mark.parametrize('logs', [['missing.json'],[{'path':'missing.json','sha256':'e'*64}],{'unexpected':'shape'}])
def test_deployment_receipt_requires_existing_hash_verified_evidence(tmp_path,logs):
    p=tmp_path/'deployment.json'
    p.write_text(json.dumps({'status':'VERIFIED_INTERACTIVE','primary_url':'https://app.example.org/',
        'release_commit':'a'*40,'owner':'fixture-only','evidence_files':logs}))
    result=errors(tmp_path,'interactive_browser_demo_with_video',primary_demo_url='https://app.example.org/',
        deployment_receipt=descriptor(p))
    assert any('deployment evidence' in e for e in result)


def test_matching_version_lineage_accepts_real_comparison_log_without_clearing_owner_gate(tmp_path):
    log=tmp_path/'comparison.json';log.write_text('{"result":"passed","scope":"fixture only"}')
    version=tmp_path/'version.json'
    version.write_text(json.dumps({'status':'VERIFIED_SCOPED_VERSION_COMPARISON',
        'source_commit':'a'*40,'video_capture_commit':'c'*40,'report_capture_commit':'d'*40,
        'scoped_comparisons':[{'scope':'fixture runtime','result':'passed','evidence':descriptor(log)}]}))
    binding=tmp_path/'binding.json'
    binding.write_text(json.dumps({'status':'VERIFIED_MEDIA_AND_RUNTIME_BINDINGS',
        'source_commit':'a'*40,'report_sha256':'1'*64,'video_sha256':'2'*64,
        'scene_sha256':'3'*64,'version_evidence':descriptor(version)}))
    result=errors(tmp_path,'project_report_and_video',report={'sha256':'1'*64,'capture_commit':'d'*40},
        video={'sha256':'2'*64,'capture_commit':'c'*40},scene={'sha256':'3'*64},
        material_binding=descriptor(binding))
    assert not any('material version' in e or 'version comparison' in e for e in result)
    assert any('owner_review' in e for e in result)


def test_matching_website_receipt_accepts_actual_log_without_clearing_owner_gate(tmp_path):
    log=tmp_path/'browser.json';log.write_text('{"result":"fixture only"}')
    p=tmp_path/'deployment.json'
    p.write_text(json.dumps({'status':'VERIFIED_INTERACTIVE','primary_url':'https://app.example.org/',
        'release_commit':'a'*40,'owner':'fixture-only','evidence_files':[descriptor(log)]}))
    result=errors(tmp_path,'interactive_browser_demo_with_video',primary_demo_url='https://app.example.org/',
        deployment_receipt=descriptor(p))
    assert not any('deployment' in e for e in result)
    assert any('owner_review' in e for e in result)
