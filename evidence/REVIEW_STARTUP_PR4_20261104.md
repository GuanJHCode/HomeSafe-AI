# Independent review: separate CI functional and performance scopes

Reviewer: `/root/review_delivery`, independent of the author. Date: 2026-11-04 UTC. Workspace: `/workspace/HomeSafe-AI-startup`; base `64e166540495126f618dd65aa8dc88760ed70604`.

**Decision: PASS for the CI step-separation implementation and its local shell regressions.** No blocking findings. This is not completion of the entire PR-4 performance/stability plan: the unchanged 3-second objective remains open, and execution of this modified workflow on GitHub Actions remains **NOT_RUN**.

## Reviewed behavior

Reviewed `.github/workflows/reference-checks.yml`, `reference/tests/test_ci_workflow_scopes.py` and `evidence/CI_SCOPES_STARTUP_20261104.md`. Compared the workflow against the exact base version: every retained browser/transport/performance command is unchanged and appears in its original order. There is one application build and one distribution copy. The same app/parent loopback services and copied distribution are shared by functional checks and the subsequent performance step; no competing browser command or intervening rebuild was introduced.

Functional and performance steps retain GitHub Actions' default success condition. Consequently, a prior functional failure skips performance; the always-run summary maps that skipped outcome to `NOT_RUN`. Successful functional checks followed by performance failure are reported separately as `PASS` and `FAIL`, without making the overall job successful. No `continue-on-error` is present.

The performance invocation still supplies `enforce`. Its Bash pipeline retains the actual nonzero status, preserves available JSON, writes budget results, and returns failure. Malformed or absent JSON cannot produce a successful step. This change does not modify the real-editable predicate, per-trial move/hash verification or 3000/12000/150 ms thresholds. Other concurrently authored startup instrumentation is outside this review.

Setup installs an EXIT trap before launching either server. Failed readiness terminates and waits for both recorded children. Successful setup removes that trap so the services survive to later steps. The always-run cleanup targets only the recorded numeric PIDs and removes their PID files. The always-run summary and artifact upload remain after cleanup, with synthetic/local scope and real-assets/public-host `NOT_RUN` explicit. No artifact-content or public-deployment claim is introduced.

## Independent verification

Ran `/workspace/homesafe-venv/bin/python -m pytest reference/tests/test_ci_workflow_scopes.py -q`: **8 passed in 0.26 seconds**. These tests extract and execute the actual workflow Bash under `-e -o pipefail`; they use explicitly synthetic command outputs and temporary processes, not browser measurements.

- Shell syntax, step order, single build/copy, retained probe commands and strict invocation: PASS.
- Synthetic valid success and failed-budget JSON: original exit status, JSON, summary and error annotation preserved: PASS.
- Functional/performance outcomes remain distinct, including failed functional plus skipped performance: PASS. This verifies summary mapping; GitHub's default scheduling semantics were inspected statically, not executed remotely.
- Malformed performance JSON cannot pass: PASS.
- Failed host readiness terminates both spawned fixture services: PASS.
- Subsequent cleanup terminates recorded fixture processes and removes PID files: PASS.
- Separate independent comparison of every retained browser/transport/performance command against base: PASS.
- `git diff --check`: PASS at review time.

No Chromium run, new timing sample, remote workflow execution, rerun, commit, push or deployment was performed by this review. The earlier source-64e1665 CI result remains historical evidence and does not validate this modified workflow.

## Reviewed implementation fingerprints

| File | SHA-256 |
| --- | --- |
| `.github/workflows/reference-checks.yml` | `0ac4a2afc30c1a8c061a45008fd2b265e46f66e3e65dd532a4d40c9167d758f6` |
| `reference/tests/test_ci_workflow_scopes.py` | `424c1f549287b1961768a07a9f5e819ce8b2aaa639069a971e4a26d3bc8be62e` |

Owner may mark the workflow step-separation subtask independently reviewed. Full performance acceptance, real Lux3D assets, public hosting and final delivery remain governed by their separate evidence and gates.
