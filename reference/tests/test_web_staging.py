"""Stage/verify regression fixtures contain synthetic runtime and model bytes."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

import pytest

from test_public_assets import publication
from test_dependency_notices import install_fixture_notices, synthetic_wheel

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import stage_browser_core
import stage_web_preview as preview
import vendor_pyodide_from_dir as vendor


@pytest.fixture
def project(publication, monkeypatch):
    root, scene, catalog = publication
    monkeypatch.setattr(preview, 'R', root)
    monkeypatch.setattr(preview, 'PUBLIC', root / 'apps/web/public')
    monkeypatch.setattr(preview, 'DIST', root / 'apps/web/dist')
    monkeypatch.setattr(stage_browser_core, 'R', root)
    (root / 'assets/asset-manifest.json').write_text(json.dumps(catalog))
    for name in stage_browser_core.FILES:
        target = root / 'reference/homesafe_core' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'reference/homesafe_core' / name, target)
    for name in ('config.same-origin.json', 'rule-worker.mjs', 'worker-controller.mjs', 'startup-trace.mjs'):
        target = root / 'browser-spike' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'browser-spike' / name, target)
    shutil.copytree(ROOT / 'examples', root / 'examples')
    source = root / 'synthetic-runtime'
    source.mkdir()
    for name in vendor.RUNTIME:
        (source / name).write_bytes(b'SYNTHETIC runtime fixture only')
    install_fixture_notices(root)
    wheel = synthetic_wheel()
    (source / 'pydantic.whl').write_bytes(wheel)
    lock = {'info': vendor.EXPECTED_INFO, 'packages': {
        'pydantic': {'version': '2.12.5', 'file_name': 'pydantic.whl',
                     'sha256': hashlib.sha256(wheel).hexdigest(), 'depends': []}}}
    (source / 'pyodide-lock.json').write_text(json.dumps(lock))
    vendor.copy_selected(source, root / 'browser-spike/vendor/pyodide', vendor.selection(source))
    return root


def synthetic_build():
    shutil.copytree(preview.PUBLIC, preview.DIST)
    (preview.DIST / 'assets').mkdir(exist_ok=True)
    (preview.DIST / 'assets/index-fixture.js').write_text('// synthetic build fixture')
    (preview.DIST / 'index.html').write_text('<script type="module" src="./assets/index-fixture.js"></script>')


def test_stage_publishes_only_reviewed_model_bytes_and_bindings(project):
    preview.stage_preview()
    public = preview.PUBLIC
    assert (public / 'assets/public/synthetic-chair.glb').read_bytes() == (project / 'assets/public/synthetic-chair.glb').read_bytes()
    assets = json.loads((public / 'engine/assets.json').read_text())
    assert assets[0]['asset_id'] == 'synthetic-chair'
    assert 'generation_evidence' not in assets[0]
    scene = json.loads((public / 'engine/scene-before.json').read_text())
    assert scene['objects'][0]['id'] == 'chair'
    assert scene['objects'][0]['asset_id'] == 'synthetic-chair'
    assert not (public / 'assets/synthetic-record.md').exists()
    synthetic_build()
    preview.verify_dist()
    assert json.loads((preview.DIST / 'preview-manifest.json').read_text())['lux3d_assets_declared'] == 0


def test_invalid_asset_cannot_partially_stage_a_preview(project):
    (project / 'assets/public/synthetic-chair.glb').write_bytes(b'changed')
    with pytest.raises(ValueError, match='hash'):
        preview.stage_preview()
    assert not preview.PUBLIC.exists()


def test_identical_vendor_corruption_in_public_and_dist_is_rejected(project):
    preview.stage_preview()
    synthetic_build()
    for directory in (preview.PUBLIC, preview.DIST):
        (directory / 'vendor/pyodide/pyodide.asm.wasm').write_bytes(b'corrupt')
    with pytest.raises(ValueError, match='differs'):
        preview.verify_dist()


def test_stale_python_core_is_rejected(project):
    preview.stage_preview()
    synthetic_build()
    (project / 'reference/homesafe_core/models.py').write_text('# changed canonical model')
    with pytest.raises(ValueError, match='core'):
        preview.verify_dist()


def test_extra_public_file_stops_staging(project):
    preview.PUBLIC.mkdir(parents=True)
    extra = preview.PUBLIC / 'unreviewed.txt'
    extra.write_text('unreviewed file')
    with pytest.raises(ValueError, match='Unreviewed'):
        preview.stage_preview()
    assert extra.read_text() == 'unreviewed file'
    assert not (preview.PUBLIC / 'engine').exists()


def test_missing_or_tampered_built_notice_is_rejected(project):
    preview.stage_preview()
    synthetic_build()
    notice = preview.DIST / 'THIRD_PARTY_NOTICES.txt'
    notice.write_text('missing original notices')
    with pytest.raises(ValueError, match='differs'):
        preview.verify_dist()
    notice.unlink()
    with pytest.raises(ValueError, match='Missing preview files'):
        preview.verify_dist()
