from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from homesafe_core.lux3d_adapter import AholoSdkGateway

def gateway(raw,allow=False):
    client=SimpleNamespace(tasks=SimpleNamespace(retrieve=Mock(return_value=raw)),img_to_3d=SimpleNamespace(create=Mock(return_value=123)))
    return AholoSdkGateway(client,allow_paid_calls=allow),client

@pytest.mark.parametrize('returned',[999,None,True,'not-a-task',0])
def test_mismatching_id_manual_review(returned):
    g,c=gateway({'taskId':returned,'status':3,'outputs':[{'content':'https://example.com/a.glb'}]})
    assert g.retrieve_task('123').status=='manual_review'

@pytest.mark.parametrize('state,expected',[(0,'provider_pending'),(1,'provider_running'),(3,'provider_succeeded'),(4,'provider_failed'),(6,'provider_cancelled'),(9,'manual_review'),(True,'manual_review')])
def test_status_mapping(state,expected):
    g,c=gateway({'taskId':123,'status':state,'outputs':[{'content':'https://example.com/a.glb'}]})
    assert g.retrieve_task('123').status==expected

def test_empty_success_output_manual_review():
    g,c=gateway({'taskId':123,'status':3,'outputs':[]})
    assert g.retrieve_task('123').status=='manual_review'

def test_paid_disabled():
    g,c=gateway({})
    with pytest.raises(PermissionError):g.create_image_task(image_url='https://example.com/a.png')
    c.img_to_3d.create.assert_not_called()

def test_create_exact_parameters():
    g,c=gateway({},True)
    assert g.create_image_task(image_url='https://example.com/a.png')=='123'
    c.img_to_3d.create.assert_called_once_with(img='https://example.com/a.png',version='G1-Turbo',face_count=20000,output_format=['glb'],ai_predict_size=False)

def test_fake_seam_no_retry_not_real_transport_guarantee():
    g,c=gateway({},True);c.img_to_3d.create.side_effect=TimeoutError()
    with pytest.raises(TimeoutError):g.create_image_task(image_url='https://example.com/a.png')
    assert c.img_to_3d.create.call_count==1

@pytest.mark.parametrize('tid',['-1','0','１２３',123,'abc'])
def test_invalid_task_identifier(tid):
    g,c=gateway({})
    with pytest.raises(ValueError):g.retrieve_task(tid)
