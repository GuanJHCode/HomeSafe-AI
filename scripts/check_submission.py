#!/usr/bin/env python3
import sys,json,argparse
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'reference'))
from homesafe_core.release import ReleaseVerifier
p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,default=R/'submission/submission-manifest.json');a=p.parse_args()
try:
 manifest=json.loads(a.manifest.read_text())
 errors=ReleaseVerifier().verify(R,manifest)
 # Both supported delivery profiles are validated by the same core verifier.
 # Local checks do not prove current network availability; owner must open anonymous browser.
except Exception as e:errors=['Invalid release input: '+str(e)]
if errors:
 print('BLOCKED: product/materials are not verified for submission')
 for e in errors:print('-',e)
 raise SystemExit(2)
print('Local release profile checks passed; owner review still required. Not proof of official acceptance.')
