"""Local submission preflight must not label obvious local/auth URLs public."""
import pytest
from homesafe_core.release import validate_public_demo_url


@pytest.mark.parametrize('url', [
    'https://127.0.0.2/demo/', 'https://[::1]/', 'https://localhost./',
    'https://app.localhost/', 'https://192.168.1.2/', 'https://[fe80::1]/',
    'https://[::ffff:127.0.0.1]/', 'https://0.0.0.0/',
    'https://2130706433/', 'https://0x7f000001/', 'https://127.1/',
    'https://0177.0.0.1/', 'https://127%2e0%2e0%2e1/',
    'https://user:password@example.org/', 'https://user@example.org/',
    'https://example.org/?token=x', 'https://example.org/#secret',
    'https://example.org/?', 'https://example.org/#',
    ' https://example.org/', 'https://example.org/\n',
    'https://example.org\\@127.0.0.1/', 'https://example.org:99999/',
    'https://example.org:0/', 'https://internal/', 'https://app.local/',
    'https://[ff02::1]/', 'https://app.localdomain/', 'https://app.home.arpa/',
    'https://[2001:4860:4860::8888%eth0]/', 'http://example.org/', '', None,
])
def test_non_public_or_non_anonymous_submission_url_rejected(url):
    with pytest.raises(ValueError):
        validate_public_demo_url(url)


@pytest.mark.parametrize('url', ['https://example.org/preview/', 'https://app.example.org:8443/demo', 'https://8.8.8.8/demo'])
def test_public_url_syntax_does_not_claim_live_verification(url):
    assert validate_public_demo_url(url) is None
