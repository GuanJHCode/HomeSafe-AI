#!/usr/bin/env python3
"""Build a deterministic, explicitly selected Python bundle. No SDK, release tools or credentials."""
import hashlib, io, json, zipfile, shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1]
FILES=("__init__.py","models.py","geometry.py","validation.py","rule_support.py",
       "policy.py","rules.py","engine.py","challenge.py","browser_bridge.py")
def stage():
    dest=R/"browser-spike/python";dest.mkdir(parents=True,exist_ok=True)
    buffer=io.BytesIO();records=[]
    with zipfile.ZipFile(buffer,"w",zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            raw=(R/"reference/homesafe_core"/name).read_bytes()
            info=zipfile.ZipInfo("homesafe_core/"+name,(2026,11,3,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,raw)
            records.append({"path":name,"sha256":hashlib.sha256(raw).hexdigest()})
    raw=buffer.getvalue();(dest/"homesafe_core.zip").write_bytes(raw)
    manifest={"bundle_sha256":hashlib.sha256(raw).hexdigest(),"files":records,
              "contains_paid_sdk":False,"contains_release_tool":False}
    (dest/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    samples=R/"browser-spike/examples";samples.mkdir(exist_ok=True)
    for name in ("before","conflict","improved"):
        for kind in ("scene","assessment"):
            shutil.copyfile(R/f"examples/{kind}-{name}.json",samples/f"{kind}-{name}.json")
    print("Staged",len(FILES),"modules; runtime/vendor packages are NOT included.")
    return manifest
if __name__=="__main__":stage()
