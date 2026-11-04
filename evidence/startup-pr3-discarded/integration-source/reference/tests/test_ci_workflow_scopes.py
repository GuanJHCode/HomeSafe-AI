"""Execute actual CI shell fragments with synthetic evidence; no browser timing claims."""
from pathlib import Path
import json
import os
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/reference-checks.yml'


def step(name):
    lines = WORKFLOW.read_text().splitlines()
    start = lines.index(f'      - name: {name}')
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith('      - ')), len(lines))
    block = lines[start:end]
    run = block.index('        run: |')
    return '\n'.join(line[10:] for line in block[run + 1:] if line.startswith('          ')) + '\n'


def run_shell(script, cwd, env):
    return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=cwd,
                          env={**os.environ, **env}, capture_output=True, text=True, timeout=10)


def test_browser_steps_share_single_build_and_strict_order():
    text = WORKFLOW.read_text()
    names = ['Prepare shared nested-path browser host', 'Real browser functional checks on a nested path',
             'Strict real-browser performance budgets', 'Stop shared browser servers', 'Summarize separate validation scopes']
    assert [text.index(f'- name: {name}') for name in names] == sorted(text.index(f'- name: {name}') for name in names)
    assert text.count('npm --prefix apps/web run build') == 1
    assert text.count('cp -R apps/web/dist/.') == 1
    assert 'continue-on-error' not in text
    assert 'if: always()' in text[text.index('- name: Stop shared browser servers'):]
    assert 'if: always()' in text[text.index('- uses: actions/upload-artifact@v4'):]
    functional = step(names[1])
    performance = step(names[2])
    assert 'check_web_performance.mjs' not in functional
    assert 'check_web_performance.mjs http://127.0.0.1:4173/preview/ "$chrome" "$driver" enforce required' in performance
    assert 'check_startup_trace.mjs http://127.0.0.1:4173/preview/ "$chrome" "$driver" ci-evidence/startup-trace' in functional
    assert 'check_startup_bootstrap.mjs http://127.0.0.1:4173/preview/ "$chrome" "$driver" ci-evidence/startup-bootstrap' in functional
    for probe in ['preview', 'experience', 'observations', 'recovery', 'embedding']:
        assert f'check_web_{probe}.mjs http://127.0.0.1:4173/preview/' in functional
    for name in names:
        checked = subprocess.run(['bash', '-n'], input=step(name), capture_output=True, text=True)
        assert checked.returncode == 0, checked.stderr


@pytest.mark.parametrize('probe_exit,first_passed', [(0, True), (1, False)])
def test_actual_performance_shell_preserves_exit_json_and_summary(tmp_path, probe_exit, first_passed):
    (tmp_path / 'ci-evidence').mkdir()
    tools = tmp_path / 'bin'
    tools.mkdir()
    fixture = tmp_path / 'synthetic.json'
    fixture.write_text(json.dumps({'targets': {'first_editable_p95_le_3000_ms': first_passed,
        'cold_rules_le_12000_ms': True, 'hot_evaluation_p95_le_150_ms': True},
        'summary': {'cold_first_editable': {'p95': 2900 if first_passed else 3386}}}))
    (tools / 'python').symlink_to(sys.executable)
    for name, body in {
        'google-chrome': '#!/bin/sh\nexit 0\n',
        'node': '#!/bin/sh\nprintf "%s\\n" "$@" > "$SYNTHETIC_ARGS"\ncat "$SYNTHETIC_PERFORMANCE_JSON"\nexit "$SYNTHETIC_EXIT"\n',
    }.items():
        (tools / name).write_text(body)
        (tools / name).chmod(0o755)
    summary = tmp_path / 'summary.md'
    args = tmp_path / 'args.txt'
    env = {'PATH': str(tools) + os.pathsep + os.environ['PATH'], 'RUNNER_TEMP': str(tmp_path),
        'GITHUB_STEP_SUMMARY': str(summary), 'SYNTHETIC_ARGS': str(args),
        'SYNTHETIC_PERFORMANCE_JSON': str(fixture), 'SYNTHETIC_EXIT': str(probe_exit)}
    outcome = run_shell(step('Strict real-browser performance budgets'), tmp_path, env)
    assert outcome.returncode == probe_exit, outcome.stderr
    assert args.read_text().splitlines()[-2:] == ['enforce', 'required']
    assert json.loads((tmp_path / 'ci-evidence/performance.json').read_text()) == json.loads(fixture.read_text())
    assert ('NOT MET' if probe_exit else 'PASS') in summary.read_text()
    assert ('::error title=Performance budget not met::' in outcome.stdout) == bool(probe_exit)


@pytest.mark.parametrize('functional,performance,expected', [('success', 'failure', ('PASS', 'FAIL')),
    ('failure', 'skipped', ('FAIL', 'NOT_RUN'))])
def test_summary_never_confuses_functional_success_with_overall_performance(tmp_path, functional, performance, expected):
    tools = tmp_path / 'bin'
    tools.mkdir()
    (tools / 'python').symlink_to(sys.executable)
    result = run_shell(step('Summarize separate validation scopes'), tmp_path,
        {'PATH': str(tools) + os.pathsep + os.environ['PATH'], 'GITHUB_STEP_SUMMARY': str(tmp_path / 'summary.md'),
         'FUNCTIONAL_OUTCOME': functional, 'PERFORMANCE_OUTCOME': performance})
    assert result.returncode == 0, result.stderr
    receipt = json.loads((tmp_path / 'ci-evidence/validation-summary.json').read_text())
    assert (receipt['functional_validation'], receipt['performance_budget']) == expected
    assert receipt['real_asset_browser'] == receipt['public_host'] == 'NOT_RUN'


def test_cleanup_terminates_only_recorded_fixture_services_and_removes_pid_files(tmp_path):
    children = [subprocess.Popen(['sleep', '30']) for _ in range(2)]
    try:
        for child, name in zip(children, ['app', 'parent']):
            (tmp_path / f'homesafe-{name}-server.pid').write_text(str(child.pid) + '\n')
        result = run_shell(step('Stop shared browser servers'), tmp_path, {'RUNNER_TEMP': str(tmp_path)})
        assert result.returncode == 0, result.stderr
        for child in children:
            assert child.wait(timeout=3) != 0
        assert not list(tmp_path.glob('*.pid'))
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
            child.wait()


def test_malformed_performance_report_cannot_pass(tmp_path):
    (tmp_path / 'ci-evidence').mkdir()
    tools = tmp_path / 'bin'
    tools.mkdir()
    (tools / 'python').symlink_to(sys.executable)
    for name, body in {'google-chrome': '#!/bin/sh\nexit 0\n',
                       'node': '#!/bin/sh\nprintf "not-json\\n"\nexit 1\n'}.items():
        (tools / name).write_text(body)
        (tools / name).chmod(0o755)
    result = run_shell(step('Strict real-browser performance budgets'), tmp_path,
        {'PATH': str(tools) + os.pathsep + os.environ['PATH'], 'RUNNER_TEMP': str(tmp_path),
         'GITHUB_STEP_SUMMARY': str(tmp_path / 'summary.md')})
    assert result.returncode != 0
    assert (tmp_path / 'ci-evidence/performance.json').read_text() == 'not-json\n'
    assert not (tmp_path / 'summary.md').exists()


def test_failed_host_readiness_cleans_both_spawned_services(tmp_path):
    for name in ['apps/web/dist', 'browser-spike']:
        (tmp_path / name).mkdir(parents=True)
        (tmp_path / name / 'fixture.txt').write_text('synthetic fixture')
    tools = tmp_path / 'bin'
    tools.mkdir()
    for name, body in {'python': '#!/bin/sh\nexec /usr/bin/sleep 30\n',
                       'curl': '#!/bin/sh\nexit 1\n', 'sleep': '#!/bin/sh\nexit 0\n'}.items():
        (tools / name).write_text(body)
        (tools / name).chmod(0o755)
    result = run_shell(step('Prepare shared nested-path browser host'), tmp_path,
        {'PATH': str(tools) + os.pathsep + os.environ['PATH'], 'RUNNER_TEMP': str(tmp_path)})
    assert result.returncode != 0
    for name in ['app', 'parent']:
        pid = int((tmp_path / f'homesafe-{name}-server.pid').read_text())
        with pytest.raises(ProcessLookupError):
            os.kill(pid, 0)
