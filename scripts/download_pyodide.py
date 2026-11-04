#!/usr/bin/env python3
"""Fetch pinned official bytes to a new local directory; vendor preview/copy is separate."""
import argparse
import hashlib
import json
import re
import tempfile
from pathlib import Path
from urllib.request import urlopen

PIN = Path(__file__).with_name('pyodide-runtime-lock.json')


def download(dest: Path, fetch=urlopen):
    pin = json.loads(PIN.read_text())
    if dest.exists() or dest.is_symlink():
        raise ValueError('download destination must not exist')
    if any(parent.is_symlink() for parent in dest.absolute().parents):
        raise ValueError('download destination ancestor must not be a symlink')
    seen = set()
    for entry in pin['files']:
        name = entry['path']
        if not re.fullmatch(r'[A-Za-z0-9_.+\-]+', name) or name in seen:
            raise ValueError('invalid or duplicate pinned filename')
        seen.add(name)
    with tempfile.TemporaryDirectory(prefix='homesafe-pyodide-', dir=dest.parent) as temp:
        staging = Path(temp) / 'runtime'
        staging.mkdir()
        for entry in pin['files']:
            with fetch(pin['base_url'] + entry['path'], timeout=30) as response:
                raw = response.read(entry['bytes'] + 1)
            if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
                raise ValueError('download hash/size mismatch: ' + entry['path'])
            (staging / entry['path']).write_bytes(raw)
        # Every byte is verified before the final directory becomes available.
        staging.rename(dest)
    return pin


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dest', type=Path, required=True)
    args = parser.parse_args()
    try:
        pin = download(args.dest)
    except (OSError, ValueError) as error:
        raise SystemExit(f'BLOCKED: {error}') from error
    print(f"Downloaded {len(pin['files'])} pinned official files; run vendor preview before --copy.")
