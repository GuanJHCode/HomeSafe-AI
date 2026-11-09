import importlib.util
import json
from pathlib import Path
import shutil
import sys
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('local_review', ROOT / 'scripts/serve_local_asset_review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

def fixture_root(tmp_path):
    for rel in [review.CONFIG, 'examples/scene-before.json', 'assets/asset-manifest.json']:
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, target)
    return tmp_path

def test_tampered_original_stops_before_output_or_any_approval(tmp_path):
    root = fixture_root(tmp_path)
    (root/'review-assets/2026-11-09/chair_lux3d_g1_30471.glb').write_bytes(b'changed original')
    output = root/'evidence/private/run'
    with pytest.raises(ValueError, match='original SHA-256 mismatch'):
        review.prepare_review(root, output)
    assert not output.exists()
    assert json.loads((root/review.CONFIG).read_text())['publication_approved'] is False
    assert json.loads((root/'assets/asset-manifest.json').read_text())['assets'] == []

def test_review_cannot_approve_license_and_cannot_overwrite_or_escape_output(tmp_path):
    root = fixture_root(tmp_path)
    config = json.loads((root/review.CONFIG).read_text())
    config['publication_approved'] = True
    (root/review.CONFIG).write_text(json.dumps(config))
    with pytest.raises(ValueError, match='license'):
        review.prepare_review(root, root/'evidence/private/run')
    with pytest.raises(ValueError, match='under evidence/private'):
        review.prepare_review(root, root/'public')
    output = root/'evidence/private/exists'
    output.mkdir(parents=True)
    (output/'keep.txt').write_text('retained')
    with pytest.raises(ValueError, match='already exists'):
        review.prepare_review(root, output)
    assert (output/'keep.txt').read_text() == 'retained'

@pytest.mark.parametrize('host,origin,site,path', [
    ('evil.example:4174', None, None, '/preview/'),
    ('127.0.0.1:4174', 'https://evil.example', None, '/preview/'),
    ('127.0.0.1:4174', None, 'cross-site', '/preview/'),
    ('127.0.0.1:4174', None, None, '/preview/%2e%2e/.env'),
    ('127.0.0.1:4174', None, None, '/evidence/private/secret'),
])
def test_loopback_review_rejects_foreign_hosts_origins_and_escape(host, origin, site, path):
    assert review.request_path(path, host, origin, site, 4174) is None

def test_loopback_review_exact_root_and_query():
    assert review.request_path('/preview/', '127.0.0.1:4174', None, None, 4174) == 'index.html'
    assert review.request_path('/preview/engine/assets.json?v=1', '127.0.0.1:4174', 'http://127.0.0.1:4174', 'same-origin', 4174) == 'engine/assets.json'
