#!/usr/bin/env python3
"""Compare anonymous HTTP resources with a locally reviewed preview build.

This is a transport check, not browser acceptance or a deployment declaration.
"""
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
from pathlib import Path, PurePosixPath
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


@dataclass
class Response:
    status: int
    headers: dict
    body: bytes


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def anonymous_fetch(url, limit):
    request = Request(url, headers={'Accept-Encoding': 'identity'})
    try:
        response = build_opener(NoRedirect).open(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        return Response(response.status, dict(response.headers.items()), response.read(limit))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def reference_files(directory):
    directory = Path(directory)
    if directory.is_symlink():
        raise ValueError('reference symlink forbidden')
    paths = list(directory.rglob('*'))
    if any(path.is_symlink() for path in paths):
        raise ValueError('reference symlink forbidden')
    actual = {p.relative_to(directory).as_posix(): p for p in paths if p.is_file()}
    try:
        manifest = actual['preview-manifest.json'].read_bytes()
        info = json.loads(manifest)
        if info['release_type'] != 'development_preview':
            raise ValueError('reference must be a development preview')
        expected = {}
        for entry in info['files']:
            name = entry['path']
            if (not isinstance(name, str) or not name or
                    PurePosixPath(name).as_posix() != name or
                    PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
                    any(c in name for c in '\\?#\r\n\t') or
                    name in {'preview-manifest.json', 'CHECKSUMS.sha256'} or name in expected):
                raise ValueError('reference contains unsafe or duplicate path')
            raw = actual[name].read_bytes()
            if (type(entry['bytes']) is not int or entry['bytes'] != len(raw) or
                    not re.fullmatch('[0-9a-f]{64}', entry['sha256']) or digest(raw) != entry['sha256']):
                raise ValueError(f'reference bytes/hash mismatch: {name}')
            expected[name] = raw
        required = {'index.html', 'engine/rule-worker.mjs', 'vendor/pyodide/pyodide.asm.wasm'}
        if not required <= expected.keys():
            raise ValueError('reference lacks required runtime files')
        expected['preview-manifest.json'] = manifest
        checks = actual['CHECKSUMS.sha256'].read_bytes()
        wanted = {f'{digest(raw)}  {name}' for name, raw in expected.items()}
        lines = checks.decode().splitlines()
        if len(lines) != len(wanted) or set(lines) != wanted:
            raise ValueError('reference checksum list mismatch')
        expected['CHECKSUMS.sha256'] = checks
        if actual.keys() != expected.keys():
            raise ValueError('unlisted reference files present')
        return expected
    except (KeyError, TypeError, OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f'invalid reference: {error}') from error


MIME = {
    '.html': {'text/html'}, '.css': {'text/css'}, '.json': {'application/json'},
    '.js': {'text/javascript', 'application/javascript', 'application/ecmascript', 'text/ecmascript'},
    '.mjs': {'text/javascript', 'application/javascript', 'application/ecmascript', 'text/ecmascript'},
    '.wasm': {'application/wasm'},
}


def verify_deployment(url, dist, fetch=anonymous_fetch, *, allow_local_http=False):
    parts = urlsplit(url)
    try:
        loopback = parts.hostname == 'localhost' or ipaddress.ip_address(parts.hostname or '').is_loopback
    except ValueError:
        loopback = False
    local = parts.scheme == 'http' and allow_local_http and loopback
    if (not parts.hostname or parts.username is not None or parts.password is not None or
            parts.query or parts.fragment or '?' in url or '#' in url or
            any(c.isspace() for c in url) or '\\' in url or
            (parts.scheme != 'https' and not local)):
        raise ValueError('Target must be anonymous HTTPS without query/fragment; HTTP only with explicit loopback flag')
    # Validate port before issuing requests.
    parts.port
    expected = reference_files(dist)
    base_path = parts.path if parts.path.endswith('/') else parts.path + '/'
    base = urlunsplit((parts.scheme, parts.netloc, base_path, '', ''))
    report = {
        'checked_at': datetime.now(timezone.utc).isoformat(), 'url': url, 'base_url': base,
        'scope': 'LOCAL_HTTP_TRANSPORT_ONLY' if local else 'ANONYMOUS_HTTPS_RESOURCE_CHECK',
        'result': 'PASS', 'anonymous_https': 'NOT_RUN' if local else 'PASS',
        'browser_interaction': 'NOT_RUN', 'public_deployment': 'NOT_VERIFIED',
        'reference_manifest_sha256': digest(expected['preview-manifest.json']), 'resources': [],
    }

    def check(target, name, raw):
        item = {'path': name, 'result': 'FAIL'}
        try:
            response = fetch(target, len(raw) + 1)
            headers = {k.lower(): v for k, v in response.headers.items()}
            mime = headers.get('content-type', '').split(';')[0].strip().lower()
            item.update(status=response.status, content_type=mime, bytes=len(response.body), sha256=digest(response.body))
            reasons = []
            if response.status != 200:
                reasons.append('expected HTTP 200 without redirects')
            if response.body != raw:
                reasons.append('bytes differ from local reviewed reference')
            if Path(name).suffix in MIME and mime not in MIME[Path(name).suffix]:
                reasons.append('browser-incompatible MIME')
            item['errors'] = reasons
            item['result'] = 'FAIL' if reasons else 'PASS'
        except (OSError, URLError, ValueError) as error:
            item['errors'] = [f'request failed: {type(error).__name__}']
        return item

    if parts.path and not parts.path.endswith('/'):
        try:
            response = fetch(url, 1024)
            headers = {k.lower(): v for k, v in response.headers.items()}
            destination = urljoin(url, headers.get('location', ''))
            if response.status not in {301, 302, 307, 308} or destination != base:
                raise ValueError('directory redirect must point exactly to the same-origin trailing-slash URL')
            report['entry_redirect'] = destination
        except (OSError, URLError, ValueError) as error:
            report['entry_error'] = f'invalid directory redirect: {type(error).__name__}'
            report['result'] = 'FAIL'
    report['entry'] = check(base, 'index.html', expected['index.html'])
    for name, raw in expected.items():
        report['resources'].append(check(base + quote(name, safe='/'), name, raw))
    if report['entry']['result'] == 'FAIL' or any(item['result'] == 'FAIL' for item in report['resources']):
        report['result'] = 'FAIL'
    if not local:
        report['anonymous_https'] = report['result']
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--allow-local-http', action='store_true', help='Loopback CI transport only; never HTTPS acceptance')
    args = parser.parse_args()
    if args.output and args.output.resolve().is_relative_to(args.dist.resolve()):
        parser.error('--output must be outside the reviewed dist directory')
    try:
        report = verify_deployment(args.url, args.dist, allow_local_http=args.allow_local_http)
    except (ValueError, OSError) as error:
        parser.exit(1, f'BLOCKED: {error}\n')
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text)
    print(text, end='')
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
