#!/usr/bin/env python3
import sys,json,argparse
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'reference'))
from homesafe_core.release import ReleaseVerifier
p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,default=R/'submission/submission-manifest.json');a=p.parse_args()
try:
 manifest=json.loads(a.manifest.read_text())
 errors=ReleaseVerifier().verify(R,manifest)
 if manifest.get('release_profile')=='interactive_browser_demo_with_video':
  from homesafe_core.release import contained_file, sha256
  from urllib.parse import urlparse
  url=manifest.get('primary_demo_url') or ''
  host=urlparse(url).hostname
  if not url.startswith('https://') or not host or host in {'localhost','127.0.0.1','0.0.0.0'}:
   errors.append('V6.1 primary public interactive HTTPS URL not recorded')
  receipt=manifest.get('deployment_receipt')
  if not isinstance(receipt,dict):
   errors.append('V6.1 real browser/anonymous access evidence missing')
  else:
   file=contained_file(R,receipt.get('path',''))
   if sha256(file)!=receipt.get('sha256'):errors.append('deployment evidence hash mismatch')
   result=json.loads(file.read_text())
   if result.get('status')!='VERIFIED_INTERACTIVE' or result.get('primary_url')!=url or result.get('release_commit')!=manifest.get('source_commit'):
    errors.append('deployment evidence not bound to final interactive release')
   if not result.get('evidence_files') or not result.get('owner'):
    errors.append('deployment evidence lacks actual logs or responsible owner')
 # Local checks do not prove current network availability; owner must open anonymous browser.
except Exception as e:errors=['Invalid release input: '+str(e)]
if errors:
 print('BLOCKED: product/materials are not verified for submission')
 for e in errors:print('-',e)
 raise SystemExit(2)
print('Local release profile checks passed; owner review still required. Not proof of official acceptance.')
