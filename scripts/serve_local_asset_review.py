#!/usr/bin/env python3
"""Repository originals -> verified repair -> explicit pending calibration -> loopback app.

No private inputs, public catalog edits, license approvals, new downloads or uploads.
The generated allowlist is served only on 127.0.0.1; it is not a deployment bundle.
"""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from repair_private_glb_normals import repair_glb
from stage_browser_core import R

sys.path.insert(0, str(R / 'reference'))
from homesafe_core.asset_models import AssetRenderDTO
from homesafe_core.challenge import main_challenge_scene
from homesafe_core.validation import validate_scene

CONFIG = 'review-assets/2026-11-09/local-review.json'
def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def prepare_review(root, output):
    root, output = Path(root).resolve(), Path(output).absolute()
    if any(p.is_symlink() for p in [output, *output.parents]):
        raise ValueError('Output symlink forbidden')
    if not output.resolve().is_relative_to(root / 'evidence/private') or output == root / 'evidence/private':
        raise ValueError('Use a new output directory under evidence/private')
    if output.exists():
        raise ValueError('Output already exists; retain it and choose a new run directory')
    config_raw = (root / CONFIG).read_bytes()
    spec = json.loads(config_raw)
    if spec['mode'] != 'local_asset_review' or spec['publication_approved'] is not False or spec['license_status'] != 'NOT_VERIFIED':
        raise ValueError('Review mode cannot claim license or publication approval')
    if spec['source_front'] != '+Z' or spec['scene_front'] != '-Z':
        raise ValueError('Expected explicit source +Z to scene -Z mapping')
    if [m['object_id'] for m in spec['models']] != ['chair', 'cabinet']:
        raise ValueError('Exactly chair and cabinet are required')
    scene = validate_scene(json.loads((root / 'examples/scene-before.json').read_bytes()))
    catalog_raw = (root / 'assets/asset-manifest.json').read_bytes()
    if json.loads(catalog_raw)['assets']:
        raise ValueError('This review entry expects the ordinary placeholder-only catalog')
    files, records, descriptors = {}, [], []
    # Validate all original bytes and all deterministic repairs before writing.
    for item in spec['models']:
        source = root / item['original']
        if not source.resolve().is_relative_to(root / 'review-assets/2026-11-09') or source.is_symlink():
            raise ValueError('Original must be the repository review asset')
        raw = source.read_bytes()
        if digest(raw) != item['original_sha256']:
            raise ValueError(f"{item['object_id']} original SHA-256 mismatch")
        derived, repair = repair_glb(raw)
        if digest(derived) != item['derived_sha256'] or len(repair['normal_repairs']) != item['normal_repair_count']:
            raise ValueError('Derived SHA-256 or normal repair count mismatch')
        asset = AssetRenderDTO.model_validate(item['asset'])
        c = asset.calibration
        if c.reviewed or asset.content_hash != digest(derived):
            raise ValueError('Pending calibration must remain reviewed=false and match repaired bytes')
        if (abs(c.orientation.y - 1) > 1e-9 or any(abs(v) > 1e-9 for v in [c.orientation.x,c.orientation.z,c.orientation.w])
                or abs(c.pivot_offset_after_rotation.y + c.normalized_bounds_m.height / 2) > 1e-6
                or abs(c.pivot_offset_after_rotation.x) > 1e-6 or abs(c.pivot_offset_after_rotation.z) > 1e-6):
            raise ValueError('Invalid explicit orientation or bottom-center pivot')
        obj = next(o for o in scene.objects if o.id == item['object_id'])
        if obj.dimensions_m.model_dump() != item['target_dimensions_m']:
            raise ValueError('Synthetic business dimensions must not change')
        obj.asset_id = asset.asset_id
        descriptors.append(asset.model_dump(mode='json'))
        files[asset.render_url] = derived
        files[f"review/original-{item['object_id']}.glb"] = raw
        repair['original_bytes_unchanged'] = source.read_bytes() == raw
        if not repair['original_bytes_unchanged']:
            raise ValueError('Original changed during repair')
        records.append({'object_id':obj.id, 'original_path':item['original'], 'original_bytes':len(raw),
                        'original_sha256':digest(raw), 'derived_bytes':len(derived), 'derived_sha256':digest(derived),
                        'calibration':c.model_dump(mode='json'), 'target_dimensions_m':item['target_dimensions_m'],
                        'repair':repair})
    policy = {k:spec[k] for k in ['mode','publication_approved','license_status']}
    policy['candidates'] = [{'asset_id':a['asset_id'],'content_hash':a['content_hash']} for a in descriptors]
    files['engine/assets.json'] = encoded(descriptors)
    files['engine/scene-before.json'] = encoded(scene.model_dump(mode='json'))
    files['engine/scene-main-challenge.json'] = encoded(main_challenge_scene(scene).model_dump(mode='json'))
    receipt = {'kind':'LOCAL_ASSET_REVIEW','config_sha256':digest(config_raw),'models':records,
               'publication_approved':False,'license_status':'NOT_VERIFIED',
               'calibration_status':'CANDIDATE_PENDING_RUN_REVIEW','formal_catalog_changed':False,
               'source_claim':'Repository retained records; full reference-image/platform-source bundle not supplied in Git',
               'same_as_v3':'Same deterministic derived bytes, asset IDs, orientation, pivot and synthetic dimensions; current UI adds explicit local review notice',
               'catalog_sha256':digest(catalog_raw)}
    output.mkdir(parents=True, exist_ok=False)
    for item in records:
        dest = output / item['object_id']
        dest.mkdir()
        (dest/'model.glb').write_bytes(files[next(a['render_url'] for a in descriptors if a['asset_id'].endswith(item['object_id']))])
        (dest/'repair.json').write_bytes(encoded(item['repair']))
    (output/'preparation.json').write_bytes(encoded(receipt))
    return files, policy, receipt

def served_files(root, files, policy, receipt):
    dist = root / 'apps/web/dist'
    from stage_web_preview import verify_dist
    verify_dist()  # ordinary static build stays independently validated
    for p in dist.rglob('*'):
        if p.is_symlink():
            raise ValueError('Dist symlink forbidden')
        if p.is_file() and p.name not in {'preview-manifest.json','CHECKSUMS.sha256'}:
            files.setdefault(p.relative_to(dist).as_posix(), p.read_bytes())
    config = json.loads(files['engine/config.json'])
    config['localAssetReview'] = policy
    files['engine/config.json'] = encoded(config)
    three = root / 'apps/web/node_modules/three'
    for rel in ['build/three.module.js','build/three.core.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js']:
        target = rel.removeprefix('build/').removeprefix('examples/jsm/')
        files[f'review/{target}'] = (three/rel).read_bytes()
    files['review/models.html'] = (root/'apps/web/tests/local-review-models.html').read_bytes()
    receipt = {**receipt,'files':[{'path':p,'bytes':len(b),'sha256':digest(b)} for p,b in sorted(files.items())]}
    files['review-manifest.json'] = encoded(receipt)
    files['preview-manifest.json'] = encoded(receipt)
    files['CHECKSUMS.sha256'] = ''.join(f'{digest(b)}  {p}\n' for p,b in sorted(files.items())).encode()
    return receipt

def request_path(path, host, origin, fetch_site, port):
    expected = f'127.0.0.1:{port}'
    if host != expected or (origin and origin != f'http://{expected}') or fetch_site == 'cross-site':
        return None
    path = unquote(urlsplit(path).path)
    if not path.startswith('/preview/') or any(p in {'.','..'} for p in path.split('/')):
        return None
    return path[len('/preview/'):] or 'index.html'

def serve(files, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = request_path(self.path,self.headers.get('Host'),self.headers.get('Origin'),self.headers.get('Sec-Fetch-Site'),self.server.server_port)
            if path is None:
                self.send_error(403); return
            body = files.get(path)
            if body is None:
                self.send_error(404); return
            mime = 'application/wasm' if path.endswith('.wasm') else 'model/gltf-binary' if path.endswith('.glb') else mimetypes.guess_type(path)[0] or 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type',mime)
            self.send_header('Content-Length',str(len(body)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers(); self.wfile.write(body)
        def log_message(self, *_):
            pass
    server = ThreadingHTTPServer(('127.0.0.1',port),Handler)
    print(f'LOCAL ASSET REVIEW ONLY: http://127.0.0.1:{server.server_port}/preview/',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--port',type=int,default=4174)
    p.add_argument('--no-build',action='store_true',help='Reuse a verified current ordinary build')
    p.add_argument('--prepare-only',action='store_true')
    a=p.parse_args()
    files,policy,receipt=prepare_review(R,a.output)
    if a.prepare_only:
        print(json.dumps({'status':'PASS_PREPARED','output':str(a.output),'license_status':'NOT_VERIFIED'})); return
    if not a.no_build:
        env={**os.environ,'PATH':str(Path(sys.executable).parent)+os.pathsep+os.environ.get('PATH','')}
        subprocess.run(['npm','--prefix','apps/web','run','build'],cwd=R,env=env,check=True)
    receipt['frontend_build']='FRESH_NPM_BUILD_THIS_INVOCATION' if not a.no_build else 'REUSED_BUILD_SOURCE_COMPILATION_NOT_INDEPENDENTLY_VERIFIED'
    receipt['source_head']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()
    receipt['source_status']=subprocess.check_output(['git','status','--porcelain=v1'],cwd=R,text=True)
    receipt=served_files(R,files,policy,receipt)
    (a.output/'review-manifest.json').write_bytes(encoded(receipt))
    serve(files,a.port)

if __name__=='__main__':
    try:
        main()
    except (OSError,ValueError,KeyError,subprocess.CalledProcessError) as e:
        raise SystemExit(f'BLOCKED: {e}') from e
