#!/usr/bin/env python3
"""Verify a retained delivery directory, not platform authenticity or redistribution rights.

Reference/model/task associations are explicitly attributed to the retained JSON.
Screenshots still require visual review; checksums are not platform signatures.
"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def member(root, name):
    if not isinstance(name, str) or not name or '\\' in name or '\x00' in name:
        raise ValueError('invalid bundle member')
    parts = PurePosixPath(name).parts
    if PurePosixPath(name).is_absolute() or any(p in {'.', '..'} for p in parts):
        raise ValueError('bundle paths must stay relative')
    path = root
    for part in parts:
        path = path / part
        if path.is_symlink():
            raise ValueError('bundle symlink is not accepted')
    if not path.is_file() or not path.resolve().is_relative_to(root):
        raise ValueError('bundle member missing or outside selected directory')
    return path


def verify_bundle(source):
    source = Path(source)
    if source.is_symlink():
        raise ValueError('select a real source directory')
    root = source.resolve(strict=True)
    checksum_file = member(root, 'SHA256SUMS.txt')
    expected = {}
    for line in checksum_file.read_text(encoding='utf-8-sig').splitlines():
        match = re.fullmatch(r'([0-9a-fA-F]{64})  (.+)', line)
        if not match or match[2] in expected or match[2] == 'SHA256SUMS.txt':
            raise ValueError('invalid or duplicate checksum entry')
        expected[match[2]] = match[1].lower()
    actual = set()
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('bundle symlink is not accepted')
        if path.is_file() and path != checksum_file:
            actual.add(path.relative_to(root).as_posix())
    if not expected or set(expected) != actual:
        raise ValueError('checksum coverage must match every delivery file except itself')
    checked = {}
    for name, expected_sha in expected.items():
        raw = member(root, name).read_bytes()
        if digest(raw) != expected_sha:
            raise ValueError('delivery bytes differ from checksum: ' + name)
        checked[name] = {'sha256': expected_sha, 'bytes': len(raw)}
    models = []
    for object_id in ['chair', 'cabinet']:
        record_name = f'03_来源记录/{object_id}_来源记录.json'
        if record_name not in checked:
            raise ValueError('source record is not covered by the checksum')
        record = json.loads(member(root, record_name).read_text(encoding='utf-8'))
        model_name, image_name = record['交付文件'], record['输入参考图']
        if model_name not in checked or image_name not in checked:
            raise ValueError('reference and model must both be retained checksum members')
        model, image = checked[model_name], checked[image_name]
        if model['sha256'] != record['SHA256'].lower() or model['bytes'] != record['文件大小_字节']:
            raise ValueError('source record model identity differs from actual bytes')
        if image['sha256'] != record['输入参考图SHA256'].lower():
            raise ValueError('source record reference image differs from actual bytes')
        raw = member(root, model_name).read_bytes()
        if len(raw) < 12 or struct.unpack('<4sII', raw[:12]) != (b'glTF', 2, len(raw)):
            raise ValueError('original model does not have the declared GLB container header')
        evidence = record.get('核验证据', [])
        if not evidence or any(name not in checked for name in evidence):
            raise ValueError('all record evidence must be retained checksum members')
        models.append({
            'object_id': object_id, 'original_model': {'member': model_name, **model},
            'reference_image': {'member': image_name, **image},
            'source_record': {'member': record_name, **checked[record_name]},
            'recorded_task_id': record['任务编号'], 'recorded_asset_id': record['资产ID'],
            'recorded_generation_method': record['生成方式'],
            'recorded_input_origin': record['参考图来源'],
            'recorded_prompt_use': record['提示词用途'],
            'recorded_settings': record['生成设置'],
            'recorded_visibility': record['可见性'],
            'retained_evidence': [{'member': name, **checked[name]} for name in evidence],
            'association_basis': 'RETAINED_SOURCE_RECORD_NOT_PLATFORM_SIGNATURE',
        })
    return {
        'status': 'PASS_RETAINED_FILE_CONSISTENCY', 'schema_version': 1,
        'scope': 'PRIVATE_DELIVERY_DIRECTORY_CONSISTENCY_ONLY',
        'physical_files': len(checked) + 1, 'checked_delivery_files': len(checked),
        'checksum_manifest_sha256': digest(checksum_file.read_bytes()), 'models': models,
        'platform_attestation_verified': False, 'public_redistribution_approved': False,
        'independent_review_required': ['reference/task/asset screenshots and their observable limits',
                                        'original-to-derived/import/runtime association'],
        'limits': ['AI origin, prompts, settings and task/model association are source-record claims.',
                   'A checksum is not a platform signature or a new platform download observation.',
                   'No geometry quality, actual scale, platform preview or redistribution approval inferred.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.absolute()
    private = ROOT / 'evidence/private'
    if not output.resolve().is_relative_to(private) or any(p.is_symlink() for p in [output, *output.parents]):
        parser.error('output must be a nonsymlink path under evidence/private')
    if output.resolve().is_relative_to(args.source.resolve()):
        parser.error('receipt must stay outside the read-only source directory')
    result = verify_bundle(args.source)
    raw = json.dumps(result, ensure_ascii=False, indent=2).encode('utf-8') + b'\n'
    if output.exists() and output.read_bytes() != raw:
        parser.error('refuse to overwrite a different receipt; select a fresh output path')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)
    print(json.dumps({'status': result['status'], 'checked_delivery_files': result['checked_delivery_files'],
                      'physical_files': result['physical_files'], 'output': str(output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
