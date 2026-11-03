"""V6.1 regressions. Lock layout matches the reported distribution; bytes are synthetic.
These are not tests against a downloaded runtime or a browser.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest
from homesafe_core.browser_bridge import dispatch_json

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('vendor_v61', ROOT / 'scripts/vendor_pyodide_from_dir.py')
vendor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vendor)


@pytest.fixture
def distribution(tmp_path):
    info = {'abi_version': '2026_0', 'arch': 'wasm32',
            'platform': 'emscripten_5_0_3', 'python': '3.14.2'}
    deps = {'pydantic': ['pydantic_core', 'typing_extensions', 'annotated-types', 'typing-inspection'],
            'pydantic_core': ['typing-extensions'], 'typing_extensions': [],
            'annotated-types': [], 'typing-inspection': ['typing-extensions']}
    versions = {'pydantic': '2.12.5', 'pydantic_core': '2.41.5',
                'typing_extensions': '4.15.0', 'annotated-types': '0.7.0', 'typing-inspection': '0.4.2'}
    packages = {}
    for name, dependencies in deps.items():
        filename = f'{name.replace("-", "_")}-{versions[name]}-py3-none-any.whl'
        data = f'SYNTHETIC TEST PAYLOAD: {name}'.encode()
        (tmp_path / filename).write_bytes(data)
        packages[name] = {'name': name, 'version': versions[name], 'file_name': filename,
                          'sha256': hashlib.sha256(data).hexdigest(), 'depends': dependencies}
    for name in vendor.RUNTIME:
        (tmp_path / name).write_bytes(b'SYNTHETIC RUNTIME, NOT EXECUTABLE')
    (tmp_path / 'pyodide-lock.json').write_text(json.dumps({'info': info, 'packages': packages}))
    (tmp_path / 'fonts').mkdir()
    (tmp_path / 'fonts/never-copy.ttf').write_bytes(b'SYNTHETIC NOT A FONT')
    return tmp_path


def mutate_lock(root, change):
    path = root / 'pyodide-lock.json'
    lock = json.loads(path.read_text())
    change(lock)
    path.write_text(json.dumps(lock))


def test_official_shape_has_no_info_version_and_selects_ten_files(distribution):
    lock = json.loads((distribution / 'pyodide-lock.json').read_text())
    assert 'version' not in lock['info']
    records = vendor.selection(distribution)
    assert len(records) == 10
    assert all('fonts' not in x['path'] for x in records)


@pytest.mark.parametrize('key,value', [('python', '3.13.0'), ('abi_version', '2025_0'),
                                      ('arch', 'x86_64')])
def test_incompatible_metadata_rejected(distribution, key, value):
    mutate_lock(distribution, lambda lock: lock['info'].update({key: value}))
    with pytest.raises(ValueError, match='metadata'):
        vendor.selection(distribution)


def test_optional_package_json_version_checked(distribution):
    (distribution / 'package.json').write_text(json.dumps({'name': 'pyodide', 'version': '314.0.5'}))
    with pytest.raises(ValueError, match='package.json'):
        vendor.selection(distribution)


def test_optional_full_lock_digest(distribution):
    digest = hashlib.sha256((distribution / 'pyodide-lock.json').read_bytes()).hexdigest()
    assert len(vendor.selection(distribution, expected_lock_sha256=digest)) == 10
    with pytest.raises(ValueError, match='lock hash mismatch'):
        vendor.selection(distribution, expected_lock_sha256='0' * 64)


def test_truncated_lock_digest_is_not_a_pin(distribution):
    with pytest.raises(ValueError, match='64'):
        vendor.selection(distribution, expected_lock_sha256='3fdaef09...8ad4')


def test_missing_wheel_digest_is_rejected(distribution):
    mutate_lock(distribution, lambda lock: lock['packages']['pydantic'].pop('sha256'))
    with pytest.raises(ValueError, match='sha256'):
        vendor.selection(distribution)


def test_duplicate_normalized_package_is_rejected(distribution):
    mutate_lock(distribution, lambda lock: lock['packages'].update(
        {'typing-extensions': dict(lock['packages']['typing_extensions'])}))
    with pytest.raises(ValueError, match='duplicate'):
        vendor.selection(distribution)


def test_symlink_lock_is_rejected_before_read(distribution):
    original = distribution / 'real-lock.json'
    (distribution / 'pyodide-lock.json').rename(original)
    (distribution / 'pyodide-lock.json').symlink_to(original)
    with pytest.raises(ValueError, match='unsafe'):
        vendor.selection(distribution)


@pytest.mark.parametrize('depth', [70, 2000])
def test_deep_json_is_a_structured_error(depth):
    raw = '{"op":"evaluate","payload":{"scene":' + '[' * depth + '0' + ']' * depth + '}}'
    result = json.loads(dispatch_json(raw))
    assert result['ok'] is False
    assert result['error']['code'] == 'INPUT_TOO_DEEP'
    assert result['error']['issues'] == []


def test_bridge_still_handles_small_invalid_envelopes():
    result = json.loads(dispatch_json('{"op":"arbitrary_code","payload":{}}'))
    assert result['ok'] is False


def test_copy_records_lock_metadata_and_verifies_files(distribution, tmp_path):
    dest = tmp_path / 'selected-runtime'
    records = vendor.selection(distribution)
    vendor.copy_selected(distribution, dest, records)
    manifest = json.loads((dest / 'vendor-manifest.json').read_text())
    assert manifest['version'] == '314.0.6'
    assert manifest['lock_info']['python'] == '3.14.2'
    assert manifest['lock_pin_provided'] is False
    assert len(manifest['files']) == 10
    assert not (dest / 'fonts').exists()
    for record in manifest['files']:
        assert hashlib.sha256((dest / record['path']).read_bytes()).hexdigest() == record['sha256']


def test_copy_refuses_nonempty_destination(distribution, tmp_path):
    dest = tmp_path / 'existing'
    dest.mkdir()
    (dest / 'existing.txt').write_text('must remain untouched')
    with pytest.raises(ValueError, match='empty'):
        vendor.copy_selected(distribution, dest, vendor.selection(distribution))
    assert list(p.name for p in dest.iterdir()) == ['existing.txt']


def test_decoder_recursion_error_becomes_structured_error(monkeypatch):
    import homesafe_core.browser_bridge as bridge
    def fail_decoder(_):
        raise RecursionError('decoder recursion')
    with monkeypatch.context() as patch:
        patch.setattr(bridge.json, 'loads', fail_decoder)
        raw = bridge.dispatch_json('{}')
    assert json.loads(raw)['error']['code'] == 'INPUT_TOO_DEEP'


def test_depth_rejection_does_not_poison_later_evaluation():
    scene = json.loads((ROOT / 'examples/scene-before.json').read_text())
    command = json.dumps({'op': 'evaluate', 'payload': {'scene': scene}})
    before = json.loads(dispatch_json(command))
    dispatch_json('[' * 100 + '0' + ']' * 100)
    after = json.loads(dispatch_json(command))
    assert before['ok'] is True and after == before
