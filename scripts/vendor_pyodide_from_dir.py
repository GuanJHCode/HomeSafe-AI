#!/usr/bin/env python3
"""Copy only the runtime + Pydantic closure from an official local distribution.

No downloads and no fonts. The lock's info describes ABI/Python, not the Pyodide
release. Metadata compatibility is NOT an authenticity proof. An optional full
lock SHA-256 provides an exact pin; the Worker also checks py.version on load.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

VERSION = '314.0.6'
EXPECTED_INFO = {'python': '3.14.2', 'abi_version': '2026_0', 'arch': 'wasm32'}
RUNTIME = ('pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm',
           'python_stdlib.zip', 'pyodide-lock.json')


def norm(name):
    if not isinstance(name, str) or not name:
        raise ValueError('invalid dependency name')
    return re.sub(r'[-_.]+', '-', name.lower())


def safe_file(root, name):
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_.+\-]+', name):
        raise ValueError('unexpected package file_name: ' + str(name))
    path = root / name
    if path.is_symlink() or not path.is_file():
        raise ValueError('missing/unsafe file: ' + name)
    return path


def read_lock(source, expected_lock_sha256=None):
    raw = safe_file(source, 'pyodide-lock.json').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected_lock_sha256 is not None:
        if not re.fullmatch(r'[0-9a-fA-F]{64}', expected_lock_sha256):
            raise ValueError('expected lock sha256 must contain all 64 hexadecimal characters')
        if digest != expected_lock_sha256.lower():
            raise ValueError('lock hash mismatch')
    lock = json.loads(raw)
    info = lock.get('info', {})
    if not isinstance(info, dict) or any(info.get(k) != v for k, v in EXPECTED_INFO.items()):
        raise ValueError('incompatible lock metadata; expected ' + json.dumps(EXPECTED_INFO))
    package = source / 'package.json'
    if package.exists() or package.is_symlink():
        package_info = json.loads(safe_file(source, 'package.json').read_text())
        if package_info.get('version') != VERSION:
            raise ValueError('package.json does not identify Pyodide ' + VERSION)
    return lock, digest


def dependency_closure(packages):
    if not isinstance(packages, dict):
        raise ValueError('lock packages must be an object')
    lookup = {}
    for name, entry in packages.items():
        key = norm(name)
        if key in lookup:
            raise ValueError('duplicate normalized package: ' + key)
        if not isinstance(entry, dict):
            raise ValueError('package entry must be an object')
        lookup[key] = entry
    chosen, todo = {}, ['pydantic']
    while todo:
        key = norm(todo.pop())
        if key in chosen:
            continue
        if key not in lookup:
            raise ValueError('dependency missing from lock: ' + key)
        entry = lookup[key]
        if key == 'pydantic' and entry.get('version') != '2.12.5':
            raise ValueError('expected pydantic 2.12.5')
        dependencies = entry.get('depends', [])
        if not isinstance(dependencies, list):
            raise ValueError('package depends must be a list')
        chosen[key] = entry
        todo.extend(dependencies)
    return chosen


def selection(source: Path, expected_lock_sha256=None):
    source = source.resolve()
    lock, _ = read_lock(source, expected_lock_sha256)
    chosen = dependency_closure(lock.get('packages'))
    checks = {name: None for name in RUNTIME}
    for entry in chosen.values():
        filename, digest = entry.get('file_name'), entry.get('sha256')
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', digest):
            raise ValueError('package sha256 missing or malformed: ' + str(filename))
        safe_file(source, filename)
        if filename in checks:
            raise ValueError('duplicate or reserved file_name: ' + filename)
        checks[filename] = digest.lower()
    records = []
    for name, expected in sorted(checks.items()):
        path = safe_file(source, name)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if expected and digest != expected:
            raise ValueError('package hash mismatch: ' + name)
        records.append({'path': name, 'sha256': digest, 'bytes': path.stat().st_size})
    return records


def copy_selected(source, dest, records, expected_lock_sha256=None):
    target = dest.absolute()
    if target.is_symlink() or any(p.is_symlink() for p in target.parents):
        raise ValueError('destination symlink')
    if target.exists() and (not target.is_dir() or any(target.iterdir())):
        raise ValueError('destination must be empty; do not mix runtime versions')
    lock, lock_digest = read_lock(source.resolve(), expected_lock_sha256)
    target.mkdir(parents=True, exist_ok=True)
    for record in records:
        origin = safe_file(source.resolve(), record['path'])
        if hashlib.sha256(origin.read_bytes()).hexdigest() != record['sha256']:
            raise ValueError('source changed after selection: ' + record['path'])
        shutil.copyfile(origin, target / record['path'])
        if hashlib.sha256((target / record['path']).read_bytes()).hexdigest() != record['sha256']:
            raise ValueError('copy hash mismatch: ' + record['path'])
    (target / 'vendor-manifest.json').write_text(json.dumps({
        'version': VERSION, 'lock_sha256': lock_digest, 'lock_info': lock['info'],
        'lock_pin_provided': expected_lock_sha256 is not None, 'files': records,
        'note': 'Wheel hashes checked against lock; ABI metadata is not release authenticity. '
                'Worker verifies runtime version. License notices still require review.'
    }, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--dest', type=Path, default=Path('browser-spike/vendor/pyodide'))
    parser.add_argument('--expected-lock-sha256', help='Optional complete independently obtained 64-char hash')
    parser.add_argument('--copy', action='store_true')
    args = parser.parse_args()
    records = selection(args.source, args.expected_lock_sha256)
    if args.copy:
        copy_selected(args.source, args.dest, records, args.expected_lock_sha256)
    print(json.dumps({'mode': 'COPIED' if args.copy else 'DRY_RUN', 'files': records,
                      'total_bytes': sum(r['bytes'] for r in records)}, indent=2))


if __name__ == '__main__':
    main()
