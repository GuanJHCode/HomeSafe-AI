"""Synthetic download responses only. No real network or browser acceptance."""
import hashlib
import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import download_pyodide as downloader


@pytest.fixture
def pin(tmp_path, monkeypatch):
    payloads = {'pyodide.mjs': b'synthetic runtime', 'pyodide-lock.json': b'{"info":{}}'}
    lock = tmp_path / 'pin.json'
    lock.write_text(json.dumps({'base_url': 'https://example.invalid/', 'files': [
        {'path': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        for name, raw in payloads.items()
    ]}))
    monkeypatch.setattr(downloader, 'PIN', lock)
    return payloads


def test_official_bytes_are_not_rewritten(tmp_path, pin):
    dest = tmp_path / 'runtime'
    downloader.download(dest, lambda url, timeout: io.BytesIO(pin[url.rsplit('/', 1)[-1]]))
    assert {p.name: p.read_bytes() for p in dest.iterdir()} == pin
    assert 'version' not in json.loads((dest / 'pyodide-lock.json').read_text())['info']


def test_corrupt_download_leaves_no_publishable_directory(tmp_path, pin):
    dest = tmp_path / 'runtime'
    with pytest.raises(ValueError, match='hash/size'):
        downloader.download(dest, lambda url, timeout: io.BytesIO(b'changed'))
    assert not dest.exists()


def test_existing_destination_is_preserved(tmp_path, pin):
    dest = tmp_path / 'runtime'
    dest.mkdir()
    (dest / 'keep').write_text('existing')
    with pytest.raises(ValueError, match='must not exist'):
        downloader.download(dest)
    assert (dest / 'keep').read_text() == 'existing'
