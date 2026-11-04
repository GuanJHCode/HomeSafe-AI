#!/usr/bin/env python3
"""Collect installed production package/wheel notices without network or extraction.

This is a distribution inventory, not a legal opinion or a complete audit of
third-party code statically linked into the upstream WASM executable.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile
import tomllib
from html.parser import HTMLParser

from vendor_pyodide_from_dir import dependency_closure, read_lock, safe_file


NOTICE_NAME = re.compile(r'^(?:licen[cs]e|copying|notice)(?:[._-].*)?$', re.I)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def checked_read(path, root):
    if path.is_symlink() or any(p.is_symlink() for p in path.parents):
        raise ValueError('License source symlink forbidden')
    if not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError('License source missing or outside source root')
    raw = path.read_bytes()
    if not raw.strip():
        raise ValueError('Empty license notice')
    raw.decode('utf-8')
    return raw


def notice_files(root: Path, runtime: Path):
    records, sections = [], []

    class LicenseText(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text, self.skip = [], False
        def handle_starttag(self, tag, attrs):
            if tag in {'style', 'script'}:
                self.skip = True
            if tag in {'p', 'div', 'pre', 'br', 'h1', 'h2', 'h3', 'li'}:
                self.text.append('\n')
        def handle_endtag(self, tag):
            if tag in {'style', 'script'}:
                self.skip = False
        def handle_data(self, data):
            if not self.skip:
                self.text.append(data)

    def add(name, version, source, raw, scope, original=None):
        record = dict(name=name, version=version, source=source,
                      sha256=digest(raw), scope=scope)
        text = raw.decode('utf-8')
        if original:
            for key in ('archive_sha256', 'license_expression', 'scope_detail', 'format'):
                if key in original:
                    record[key] = original[key]
            if original.get('format') == 'html':
                parser = LicenseText()
                parser.feed(text)
                text = ''.join(parser.text)
        records.append(record)
        sections.append(f'\n=== {name} {version} — {source} ===\n\n' + text)

    upstream = root / 'licenses/upstream'
    sources = json.loads(checked_read(upstream / 'sources.json', root))
    required = {
        ('Pyodide', '314.0.6'), ('CPython', '3.14.2'), ('CPython-expat', '3.14.2'),
        ('CPython-other-licenses', '3.14.2'), ('Emscripten', '5.0.3'),
        ('Rust-std', '1.93.0'), ('Rust-std-library-copyright', '1.93.0'),
        ('SQLite', '3.39.0'), ('bzip2', '1.0.6'), ('zlib', '1.3.1'), ('zstd', '1.5.7'),
        ('liblzma', '5.2.2'), ('musl', 'emscripten-5.0.3'),
        ('libcxx', 'emscripten-5.0.3'), ('libcxxabi', 'emscripten-5.0.3'),
        ('compiler-rt', 'emscripten-5.0.3'),
        ('libffi', 'f08493d249d2067c8b3207ba46693dd858f95db3'),
        ('hiwire', '6a1e67280a15d929ebeceee54a6358c9c8d5f697'),
    }
    if not required <= {(x['name'], x['version']) for x in sources['files']}:
        raise ValueError('Runtime license versions do not match pinned runtime')
    required_build_sources = {
        'Pyodide-Makefile.envs.txt', 'Pyodide-cpython-Makefile.txt', 'Pyodide-Setup.local.txt',
        'Emscripten-5.0.3-zlib.py.txt', 'Emscripten-5.0.3-bzip2.py.txt',
        'pydantic-core-2.41.5-Cargo.lock',
    }
    if {x['path'] for x in sources['build_sources']} != required_build_sources:
        raise ValueError('Pinned build evidence set is incomplete or changed')
    seen = set()
    for item in sources['build_sources'] + sources['files']:
        if item['path'] in seen:
            raise ValueError('Duplicate upstream license/evidence path')
        seen.add(item['path'])
        if '/' in item['path'] or '\\' in item['path'] or item['path'] in {'.', '..'}:
            raise ValueError('Unsafe upstream notice path')
        if digest(checked_read(upstream / item['path'], root)) != item['sha256']:
            raise ValueError('Pinned upstream license hash mismatch')
    cargo = tomllib.loads(checked_read(upstream / 'pydantic-core-2.41.5-Cargo.lock', root).decode())
    for package in cargo['package']:
        if not package.get('source'):
            continue
        if not any(x['name'] == package['name'] and x['version'] == package['version']
                   and x.get('archive_sha256') == package['checksum'] for x in sources['files']):
            raise ValueError('Cargo dependency lacks correlated license: ' + package['name'])
    if sources.get('missing_crate_notices'):
        raise ValueError('Unresolved crate licenses')
    for item in sources['files']:
        if '/' in item['path'] or '\\' in item['path'] or item['path'] in {'.', '..'}:
            raise ValueError('Unsafe upstream notice path')
        raw = checked_read(upstream / item['path'], root)
        if digest(raw) != item['sha256']:
            raise ValueError('Pinned upstream license hash mismatch')
        add(item['name'], item['version'], item['source'], raw, item.get('scope', 'upstream_runtime_license'), item)

    web = root / 'apps/web'
    lock = json.loads(checked_read(web / 'package-lock.json', root))
    packages = lock['packages']
    for location, item in sorted(packages.items()):
        if not location or item.get('dev') is True:
            continue
        rel = PurePosixPath(location)
        if not location.startswith('node_modules/') or rel.is_absolute() or '..' in rel.parts or '\\' in location:
            raise ValueError('Unsafe installed package path')
        folder = web / location
        package = json.loads(checked_read(folder / 'package.json', root))
        if package.get('version') != item.get('version'):
            raise ValueError('Installed dependency version differs from npm lock: ' + location)
        notices = sorted(p for p in folder.iterdir() if NOTICE_NAME.fullmatch(p.name))
        if not notices:
            raise ValueError('Installed production dependency lacks license text: ' + location)
        for path in notices:
            raw = checked_read(path, root)
            add(package['name'], package['version'], f'{location}/{path.name}', raw,
                'npm_production_closure_conservative_inventory')

    lock, _ = read_lock(runtime)
    closure = dependency_closure(lock['packages'])
    if 'pydantic-core' in closure and closure['pydantic-core']['version'] != '2.41.5':
        raise ValueError('Pydantic-core version differs from audited Cargo lock')
    for name, item in sorted(closure.items()):
        path = safe_file(runtime, item['file_name'])
        raw = path.read_bytes()
        if digest(raw) != item['sha256']:
            raise ValueError('Wheel changed before license inventory: ' + name)
        with zipfile.ZipFile(path) as wheel:
            notices = []
            for entry in wheel.infolist():
                parts = PurePosixPath(entry.filename).parts
                if entry.is_dir() or not any(p.endswith('.dist-info') for p in parts):
                    continue
                if NOTICE_NAME.fullmatch(parts[-1]) or 'licenses' in parts:
                    if entry.file_size > 2_000_000:
                        raise ValueError('Unexpected oversized wheel license')
                    notices.append(entry)
            if not notices:
                raise ValueError('Distributed wheel lacks license text: ' + name)
            for entry in sorted(notices, key=lambda x: x.filename):
                notice = wheel.read(entry)
                if not notice.strip():
                    raise ValueError('Empty wheel license notice')
                add(name, item['version'], f'{path.name}:{entry.filename}', notice,
                    'distributed_wheel_embedded_license')

    status = {
        'schema_version': '1.0',
        'scope': 'Installed npm production closure, distributed wheel notices, pinned Pyodide/CPython build dependencies, full upstream Pydantic-core Cargo.lock and Rust standard-library notices (conservative source inventory)',
        'source_offer': 'Unmodified Pyodide 314.0.6 source: https://github.com/pyodide/pyodide/tree/314.0.6 ; CPython: https://github.com/python/cpython/tree/v3.14.2',
        'remaining_review': ['Source-correlated inventory includes dev/build/other-target components; an exact linked-binary SBOM is not claimed. Upstream build-specific source variance must be reviewed for the final release.',
                             'Project source licensing and Lux3D model redistribution rights are separate; this inventory grants neither.'],
        'records': records,
    }
    header = ('HomeSafe AI — third-party notices\n\n' + status['scope'] + '\n' + status['source_offer'] +
              '\n\nRelease limitation: ' + ' '.join(status['remaining_review']) + '\n')
    return {
        'THIRD_PARTY_NOTICES.txt': (header + '\n'.join(sections)).encode('utf-8'),
        'dependency-notices.json': (json.dumps(status, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
