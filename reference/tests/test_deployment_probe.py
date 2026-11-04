"""Synthetic HTTP responses test transport checks, never claim public deployment."""
import hashlib
import json
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from tempfile import TemporaryDirectory
import shutil

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from check_deployment import Response, verify_deployment


@pytest.fixture
def build(tmp_path):
    payloads = {
        'index.html': b'<script type="module" src="./assets/app.js"></script>',
        'assets/app.js': b'// synthetic application fixture',
        'engine/rule-worker.mjs': b'// synthetic worker fixture',
        'vendor/pyodide/pyodide.asm.wasm': b'synthetic WASM fixture',
    }
    records = []
    for name, data in payloads.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        records.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = json.dumps({'release_type': 'development_preview', 'files': records}).encode()
    (tmp_path / 'preview-manifest.json').write_bytes(manifest)
    checks = [f"{e['sha256']}  {e['path']}" for e in records]
    checks.append(hashlib.sha256(manifest).hexdigest() + '  preview-manifest.json')
    (tmp_path / 'CHECKSUMS.sha256').write_text('\n'.join(checks) + '\n')
    return tmp_path


def server(build, *, changed=None, mime=None, redirect=None):
    def fetch(url, limit):
        if url == 'https://example.test/preview':
            return Response(308, {'location': redirect or '/preview/'}, b'')
        name = url.split('/preview/', 1)[1] or 'index.html'
        body = (build / name).read_bytes()
        types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'application/javascript',
                 '.wasm': 'application/wasm', '.json': 'application/json'}
        content_type = types.get(Path(name).suffix, 'text/plain')
        if name == changed:
            body = b'<html>login or SPA fallback</html>'
        if mime and name == mime[0]:
            content_type = mime[1]
        return Response(200, {'content-type': content_type}, body[:limit])
    return fetch


def test_anonymous_transport_checks_every_local_reviewed_file(build):
    report = verify_deployment('https://example.test/preview/', build, server(build))
    assert report['result'] == 'PASS'
    assert report['anonymous_https'] == 'PASS'
    assert report['browser_interaction'] == 'NOT_RUN'
    assert report['public_deployment'] == 'NOT_VERIFIED'
    assert len(report['resources']) == 6
    assert report['reference_manifest_sha256'] == hashlib.sha256((build / 'preview-manifest.json').read_bytes()).hexdigest()


def test_missing_slash_requires_exact_directory_redirect(build):
    report = verify_deployment('https://example.test/preview', build, server(build))
    assert report['result'] == 'PASS'
    assert report['entry_redirect'] == 'https://example.test/preview/'
    bad = verify_deployment('https://example.test/preview', build,
                            server(build, redirect='https://login.example.test/'))
    assert bad['result'] == 'FAIL'


def test_root_url_without_slash_is_not_required_to_redirect(build):
    def root(url, limit):
        name = url.split('https://example.test', 1)[1].lstrip('/')
        return server(build)('https://example.test/preview/' + name, limit)
    report = verify_deployment('https://example.test', build, root)
    assert report['result'] == 'PASS'
    assert 'entry_redirect' not in report


def test_repeated_trailing_slash_is_not_silently_normalized(build):
    def repeated(url, limit):
        if '/preview//' in url:
            return Response(404, {'content-type': 'text/html'}, b'not found')
        return server(build)(url, limit)
    report = verify_deployment('https://example.test/preview//', build, repeated)
    assert report['result'] == 'FAIL'
    assert report['base_url'] == 'https://example.test/preview//'


@pytest.mark.parametrize('name', ['index.html', 'engine/rule-worker.mjs',
                                 'vendor/pyodide/pyodide.asm.wasm', 'preview-manifest.json'])
def test_remote_html_fallback_or_changed_bytes_cannot_pass(build, name):
    report = verify_deployment('https://example.test/preview/', build, server(build, changed=name))
    assert report['result'] == 'FAIL'
    assert any(item['path'] == name and item['result'] == 'FAIL' for item in report['resources'])


@pytest.mark.parametrize('name', ['engine/rule-worker.mjs', 'vendor/pyodide/pyodide.asm.wasm'])
def test_worker_and_wasm_require_browser_compatible_mime(build, name):
    assert verify_deployment('https://example.test/preview/', build,
                             server(build, mime=(name, 'text/plain')))['result'] == 'FAIL'


@pytest.mark.parametrize('url', ['http://example.test/preview/', 'https://user:secret@example.test/',
                                'https://example.test/preview/?token=secret', 'https://example.test/#fragment'])
def test_invalid_or_authenticated_target_is_rejected_before_requests(build, url):
    with pytest.raises(ValueError):
        verify_deployment(url, build, lambda *_: pytest.fail('unexpected network'))


def test_local_http_never_counts_as_public_https(build):
    report = verify_deployment('http://127.0.0.1:4173/preview/', build, server(build), allow_local_http=True)
    assert report['result'] == 'PASS'
    assert report['scope'] == 'LOCAL_HTTP_TRANSPORT_ONLY'
    assert report['anonymous_https'] == 'NOT_RUN'
    with pytest.raises(ValueError):
        verify_deployment('http://example.test/preview/', build, server(build), allow_local_http=True)


def test_invalid_local_reference_stops_before_network(build):
    (build / 'assets/app.js').write_bytes(b'modified after review')
    with pytest.raises(ValueError, match='reference'):
        verify_deployment('https://example.test/preview/', build, lambda *_: pytest.fail('unexpected network'))


def test_unlisted_local_file_and_symlink_are_not_accepted(build):
    extra = build / 'unreviewed.txt'
    extra.write_text('must not publish')
    with pytest.raises(ValueError, match='unlisted'):
        verify_deployment('https://example.test/preview/', build, server(build))
    extra.unlink()
    path = build / 'assets/app.js'
    data = path.read_bytes()
    path.unlink()
    outside = build.parent / 'outside.js'
    outside.write_bytes(data)
    path.symlink_to(outside)
    with pytest.raises(ValueError, match='symlink'):
        verify_deployment('https://example.test/preview/', build, server(build))


def test_resource_redirect_is_not_followed_or_counted_as_anonymous(build):
    def login(url, limit):
        return Response(302, {'location': '/login'}, b'')
    report = verify_deployment('https://example.test/preview/', build, login)
    assert report['result'] == 'FAIL'
    assert report['anonymous_https'] == 'FAIL'


def test_real_loopback_http_and_directory_redirect(build):
    """Exercise urllib + actual HTTP; this remains synthetic and never opens Chrome."""
    with TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copytree(build, root / 'preview')
        handler = partial(SimpleHTTPRequestHandler, directory=str(root))
        try:
            httpd = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        except PermissionError:
            if os.environ.get('CI'):
                raise
            pytest.skip('sandbox prohibits listening sockets; required in CI')
        thread = Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            report = verify_deployment(f'http://127.0.0.1:{httpd.server_port}/preview',
                                       build, allow_local_http=True)
            assert report['result'] == 'PASS'
            assert report['anonymous_https'] == 'NOT_RUN'
            assert report['entry_redirect'].endswith('/preview/')
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join()
