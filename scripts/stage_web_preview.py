#!/usr/bin/env python3
"""Stage reviewed demo inputs and verify a Vite build against those exact inputs."""
import argparse
import hashlib
import json
import re
import sys

from stage_browser_core import R, build_bundle, stage
from vendor_pyodide_from_dir import VERSION, read_lock, selection
from dependency_notices import notice_files

sys.path.insert(0, str(R / 'reference'))
from homesafe_core.asset_publication import prepare_public_assets
from homesafe_core.challenge import main_challenge_scene

PUBLIC = R / 'apps/web/public'
DIST = R / 'apps/web/dist'
VITE_ASSET = re.compile(r'assets/[A-Za-z0-9_-]+\.(?:js|css)')


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def preview_files():
    spike = R / 'browser-spike'
    source = spike / 'vendor/pyodide'
    manifest_path = source / 'vendor-manifest.json'
    if not manifest_path.is_file():
        raise ValueError('Run vendor_pyodide_from_dir.py preview and --copy first')
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    records = selection(source, manifest['lock_sha256'])
    lock, _ = read_lock(source, manifest['lock_sha256'])
    if (manifest['version'] != VERSION or manifest['files'] != records
            or manifest['lock_info'] != lock['info']):
        raise ValueError('Vendored runtime differs from its selection manifest')
    files = {'vendor/pyodide/vendor-manifest.json': manifest_bytes}
    for entry in records:
        raw = (source / entry['path']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('Vendor file changed after selection')
        files[f"vendor/pyodide/{entry['path']}"] = raw

    scene, assets, models = prepare_public_assets(
        R, json.loads((R / 'examples/scene-before.json').read_text()),
        json.loads((R / 'assets/asset-manifest.json').read_text()))
    files.update(models)
    files['engine/assets.json'] = json_bytes([asset.model_dump(mode='json') for asset in assets])
    files['engine/scene-before.json'] = json_bytes(scene.model_dump(mode='json'))
    files['engine/scene-main-challenge.json'] = json_bytes(main_challenge_scene(scene).model_dump(mode='json'))
    for name in ('rule-worker.mjs', 'worker-controller.mjs'):
        files[f'engine/{name}'] = (spike / name).read_bytes()
    bundle, core_manifest = build_bundle()
    files['engine/python/homesafe_core.zip'] = bundle
    files['engine/python/manifest.json'] = json_bytes(core_manifest)
    config = json.loads((spike / 'config.same-origin.json').read_text())
    for key in ('coreBundle', 'coreManifest'):
        config[key] = f'engine/{config[key]}'
    config['mode'] = 'development_preview'
    files['engine/config.json'] = json_bytes(config)
    files.update(notice_files(R, source))
    return files, assets


def checked_files(directory):
    if directory.is_symlink() or any(parent.is_symlink() for parent in directory.parents):
        raise ValueError('Destination symlink forbidden')
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Unexpected symbolic link: {path.name}')
        if path.is_file():
            yield path.relative_to(directory).as_posix(), path


def stage_preview():
    files, assets = preview_files()
    for name, _ in checked_files(PUBLIC):
        if name not in files:
            raise ValueError(f'Unreviewed public file: {name}; review obsolete staged assets before removing them')
    # Validate every input before writing the public tree. A failed build can be retried.
    stage()
    for name, raw in files.items():
        target = PUBLIC / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    print(f'Staged same-origin runtime, canonical scene and {len(assets)} reviewed asset descriptors.')


def verify_dist():
    expected, assets = preview_files()
    records = []
    actual = set()
    for name, path in checked_files(DIST):
        if name in {'preview-manifest.json', 'CHECKSUMS.sha256'}:
            continue
        if name not in expected and name != 'index.html' and not VITE_ASSET.fullmatch(name):
            raise ValueError(f'Unreviewed preview file: {name}')
        data = path.read_bytes()
        if name in expected and data != expected[name]:
            raise ValueError(f'Build file differs from reviewed source: {name}')
        actual.add(name)
        records.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})

    missing = (set(expected) | {'index.html'}) - actual
    if missing:
        raise ValueError(f"Missing preview files: {', '.join(sorted(missing))}")
    html = (DIST / 'index.html').read_text()
    entrypoints = re.findall(r'(?:src|href)="([^"]+)"', html)
    if (not any(url.endswith('.js') for url in entrypoints)
            or any(not url.startswith('./') or url[2:] not in actual for url in entrypoints)):
        raise ValueError('Preview entrypoints must be relative build files')
    report = {
        'release_type': 'development_preview', 'reviewed_assets': len(assets),
        'lux3d_assets_declared': sum(asset.provenance_summary in {'lux3d_web', 'lux3d_api'} for asset in assets),
        'real_asset_browser_status': 'NOT_RUN', 'files': records,
    }
    manifest_bytes = json_bytes(report)
    (DIST / 'preview-manifest.json').write_bytes(manifest_bytes)
    hashes = [f"{entry['sha256']}  {entry['path']}" for entry in records]
    hashes.append(f"{hashlib.sha256(manifest_bytes).hexdigest()}  preview-manifest.json")
    (DIST / 'CHECKSUMS.sha256').write_text('\n'.join(hashes) + '\n')
    print(f'Verified {len(records)} development preview files; anonymous hosting still requires verification.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-dist', action='store_true')
    args = parser.parse_args()
    try:
        verify_dist() if args.verify_dist else stage_preview()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f'BLOCKED: {error}') from error
