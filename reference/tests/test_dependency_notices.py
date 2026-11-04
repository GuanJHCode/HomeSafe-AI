"""Distribution notices must fail closed when a dependency loses its license."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import zipfile

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from dependency_notices import notice_files
from vendor_pyodide_from_dir import EXPECTED_INFO


def install_fixture_notices(root):
    shutil.copytree(ROOT / 'licenses', root / 'licenses')
    package = root / 'apps/web/node_modules/example'
    package.mkdir(parents=True)
    (package / 'package.json').write_text(json.dumps({'name': 'example', 'version': '1.0'}))
    (package / 'LICENSE').write_text('SYNTHETIC fixture license text only')
    (root / 'apps/web/package-lock.json').write_text(json.dumps({'packages': {
        '': {}, 'node_modules/example': {'version': '1.0'},
        'node_modules/test-only': {'version': '1.0', 'dev': True}}}))


def synthetic_wheel():
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as wheel:
        wheel.writestr('pydantic.dist-info/licenses/LICENSE', 'SYNTHETIC wheel license text only')
    return output.getvalue()


@pytest.fixture
def notices(tmp_path):
    install_fixture_notices(tmp_path)
    runtime = tmp_path / 'runtime'
    runtime.mkdir()
    wheel = synthetic_wheel()
    (runtime / 'pydantic.whl').write_bytes(wheel)
    (runtime / 'pyodide-lock.json').write_text(json.dumps({'info': EXPECTED_INFO, 'packages': {
        'pydantic': {'version': '2.12.5', 'depends': [], 'file_name': 'pydantic.whl',
                     'sha256': hashlib.sha256(wheel).hexdigest()}}}))
    return tmp_path, runtime


def test_notices_retain_text_and_scope_without_claiming_complete_rights(notices):
    files = notice_files(*notices)
    text = files['THIRD_PARTY_NOTICES.txt'].decode()
    assert 'SYNTHETIC fixture license text only' in text
    assert 'SYNTHETIC wheel license text only' in text
    metadata = json.loads(files['dependency-notices.json'])
    assert {'example', 'pydantic', 'Pyodide', 'CPython', 'Emscripten', 'Rust-std-library-copyright'} <= {x['name'] for x in metadata['records']}
    assert metadata['remaining_review']
    assert files == notice_files(*notices)


def test_missing_production_license_blocks_distribution(notices):
    root, runtime = notices
    (root / 'apps/web/node_modules/example/LICENSE').unlink()
    with pytest.raises(ValueError, match='lacks license text'):
        notice_files(root, runtime)


def test_installed_version_drift_blocks_notices(notices):
    root, runtime = notices
    (root / 'apps/web/node_modules/example/package.json').write_text('{"name":"example","version":"2.0"}')
    with pytest.raises(ValueError, match='differs from npm lock'):
        notice_files(root, runtime)


def test_tampered_upstream_notice_blocks_distribution(notices):
    root, runtime = notices
    (root / 'licenses/upstream/Pyodide-314.0.6-LICENSE.txt').write_text('replacement')
    with pytest.raises(ValueError, match='license hash mismatch'):
        notice_files(root, runtime)


def test_wheel_license_inventory_rejects_changed_bytes(notices):
    root, runtime = notices
    (runtime / 'pydantic.whl').write_bytes(b'changed')
    with pytest.raises(ValueError, match='Wheel changed'):
        notice_files(root, runtime)


def test_removed_transitive_crate_notice_is_rejected(notices):
    root, runtime = notices
    path = root / 'licenses/upstream/sources.json'
    source = json.loads(path.read_text())
    source['files'] = [x for x in source['files'] if x['name'] != 'jiter']
    path.write_text(json.dumps(source))
    with pytest.raises(ValueError, match='Cargo dependency lacks correlated license: jiter'):
        notice_files(root, runtime)


def test_changed_build_metadata_is_rejected(notices):
    root, runtime = notices
    (root / 'licenses/upstream/Pyodide-Makefile.envs.txt').write_text('different build')
    with pytest.raises(ValueError, match='license hash mismatch'):
        notice_files(root, runtime)


def test_build_source_pin_cannot_be_removed(notices):
    root, runtime = notices
    path = root / 'licenses/upstream/sources.json'
    source = json.loads(path.read_text())
    source['build_sources'] = [x for x in source['build_sources'] if not x['path'].endswith('Cargo.lock')]
    path.write_text(json.dumps(source))
    with pytest.raises(ValueError, match='build evidence set'):
        notice_files(root, runtime)


def test_static_library_notice_cannot_be_removed(notices):
    root, runtime = notices
    path = root / 'licenses/upstream/sources.json'
    source = json.loads(path.read_text())
    source['files'] = [x for x in source['files'] if x['name'] != 'libffi']
    path.write_text(json.dumps(source))
    with pytest.raises(ValueError, match='Runtime license versions'):
        notice_files(root, runtime)
