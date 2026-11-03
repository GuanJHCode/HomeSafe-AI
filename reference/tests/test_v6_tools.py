import importlib.util, json, hashlib
from pathlib import Path
from types import SimpleNamespace
import pytest

R=Path(__file__).resolve().parents[2]
def load_script(name,path):
    spec=importlib.util.spec_from_file_location(name,R/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
local=load_script("local_lux","tools/lux3d_local.py")
vendor=load_script("vendor_runtime","scripts/vendor_pyodide_from_dir.py")

def test_local_generation_wait_failure_does_not_recreate(tmp_path):
    calls=[]
    client=SimpleNamespace(img_to_3d=SimpleNamespace(create_from_file=lambda *a,**k:(calls.append(k) or 123)),
        tasks=SimpleNamespace(wait_for=lambda t:(_ for _ in ()).throw(TimeoutError())))
    path=tmp_path/"job.json";plan={"version":"G1-Turbo","face_count":20000,"ai_predict_size":True}
    with pytest.raises(TimeoutError):local.generate(client,tmp_path/"image.png",path,plan)
    assert len(calls)==1 and calls[0]["ai_predict_size"] is True
    job=json.loads(path.read_text());assert job["provider_task_id"]=="123"
    with pytest.raises(ValueError):local.generate(client,tmp_path/"image.png",path,plan)
    assert len(calls)==1

def test_local_unknown_create_persists_intent(tmp_path):
    def fail(*a,**k):raise TimeoutError()
    client=SimpleNamespace(img_to_3d=SimpleNamespace(create_from_file=fail))
    path=tmp_path/"job.json"
    with pytest.raises(TimeoutError):local.generate(client,tmp_path/"a.png",path,
        {"version":"G1-Turbo","face_count":20000,"ai_predict_size":False})
    assert json.loads(path.read_text())["status"]=="submitting_unknown"

def test_vendor_selects_dependency_closure_no_fonts(tmp_path):
    data=b"fake dependency bytes only for unit test";h=hashlib.sha256(data).hexdigest()
    lock={"info":{"python":"3.14.2","abi_version":"2026_0","arch":"wasm32",
                  "platform":"emscripten_5_0_3"},"packages":{
        "pydantic":{"version":"2.12.5","file_name":"pydantic.whl","sha256":h,"depends":["pydantic_core"]},
        "pydantic_core":{"file_name":"pydantic_core.whl","sha256":h,"depends":[]}}}
    for name in vendor.RUNTIME:
        (tmp_path/name).write_bytes(b"runtime fake")
    (tmp_path/"pyodide-lock.json").write_text(json.dumps(lock))
    (tmp_path/"pydantic.whl").write_bytes(data);(tmp_path/"pydantic_core.whl").write_bytes(data)
    (tmp_path/"fonts").mkdir();(tmp_path/"fonts"/"do-not-copy.ttf").write_bytes(b"fake")
    chosen=vendor.selection(tmp_path)
    assert len(chosen)==7 and all("fonts" not in x["path"] for x in chosen)
    (tmp_path/"pydantic.whl").write_bytes(b"wrong")
    with pytest.raises(ValueError,match="hash mismatch"):vendor.selection(tmp_path)
