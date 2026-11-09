import hashlib
import importlib.util
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('source_bundle', Path(__file__).resolve().parents[2] / 'scripts/check_lux3d_source_bundle.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def bundle(root, **overrides):
    files = {'proof.jpg': b'procedural evidence fixture; not an actual platform screenshot'}
    for object_id in ['chair', 'cabinet']:
        model = struct.pack('<4sII', b'glTF', 2, 12)
        image = b'procedural reference fixture; not a real reference image'
        model_name, image_name = f'{object_id}.glb', f'{object_id}.png'
        files[model_name], files[image_name] = model, image
        record = {'交付文件': model_name, '文件大小_字节': len(model), 'SHA256': hashlib.sha256(model).hexdigest(),
                  '输入参考图': image_name, '输入参考图SHA256': hashlib.sha256(image).hexdigest(),
                  '核验证据': ['proof.jpg'], '任务编号': 1, '资产ID': 2, '生成方式': 'synthetic record',
                  '参考图来源': 'synthetic fixture', '提示词用途': 'not a generation call',
                  '生成设置': {}, '可见性': 'unknown', 'platform_attestation_verified': True, **overrides}
        files[f'03_来源记录/{object_id}_来源记录.json'] = json.dumps(record).encode()
    for name, raw in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    (root / 'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(raw).hexdigest()}  {name}\n' for name, raw in files.items()))
    return root


def test_retained_consistency_cannot_upgrade_platform_attestation_or_license(tmp_path):
    result = module.verify_bundle(bundle(tmp_path))
    assert result['checked_delivery_files'] == 7
    assert result['physical_files'] == 8
    assert result['platform_attestation_verified'] is False
    assert result['public_redistribution_approved'] is False
    assert result['models'][0]['association_basis'] == 'RETAINED_SOURCE_RECORD_NOT_PLATFORM_SIGNATURE'


@pytest.mark.parametrize('change', ['tamper', 'extra', 'traversal', 'symlink'])
def test_source_bundle_refuses_inconsistent_or_escaping_members(tmp_path, change):
    root = bundle(tmp_path)
    if change == 'tamper':
        (root / 'chair.png').write_bytes(b'different bytes')
    elif change == 'extra':
        (root / 'unlisted.txt').write_text('not covered')
    elif change == 'traversal':
        (root / 'SHA256SUMS.txt').write_text('a' * 64 + '  ../outside\n')
    else:
        (root / 'chair.png').unlink()
        (root / 'chair.png').symlink_to(root / 'cabinet.png')
    with pytest.raises(ValueError):
        module.verify_bundle(root)


def test_self_consistent_manifest_still_refuses_a_wrong_source_association(tmp_path):
    with pytest.raises(ValueError, match='reference image differs'):
        module.verify_bundle(bundle(tmp_path, **{'输入参考图SHA256': '0' * 64}))


def test_cli_receipt_cannot_mutate_the_verified_source_directory():
    private = module.ROOT / 'evidence/private'
    private.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='source-bundle-cli-test-', dir=private) as work:
        work = Path(work)
        source = bundle(work / 'source')
        before = {p.relative_to(source): p.read_bytes() for p in source.rglob('*') if p.is_file()}
        denied = subprocess.run([sys.executable, str(module.__file__), '--source', str(source),
                                 '--output', str(source / 'new-receipt.json')], capture_output=True, text=True)
        assert denied.returncode != 0, 'writing the receipt inside the source must fail before mutation'
        assert before == {p.relative_to(source): p.read_bytes() for p in source.rglob('*') if p.is_file()}
        accepted = subprocess.run([sys.executable, str(module.__file__), '--source', str(source),
                                   '--output', str(work / 'receipt.json')], capture_output=True, text=True)
        assert accepted.returncode == 0, accepted.stderr
        assert module.verify_bundle(source)['status'] == 'PASS_RETAINED_FILE_CONSISTENCY'
