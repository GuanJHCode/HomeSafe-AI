# Final retained PR-2 correctness validation

Executed once on 2026-11-04 after PR-3 was discarded and the retained PR-2 source/distribution restored. This is correctness validation, not another performance experiment. [Machine-readable command receipts](summary.json) contain exact argv, UTC start/end times, exit codes, counts and raw-log SHA-256 hashes.

| Command | Exit | Result | Raw output |
| --- | ---: | --- | --- |
| `/workspace/homesafe-venv/bin/python -m pytest reference/tests -q` | 0 | 334 passed; includes 8 CI workflow cases | [stdout](native.stdout.log), [stderr](native.stderr.log) |
| `npm --prefix apps/web test` | 0 | 36 passed, 0 failed | [stdout](app.stdout.log), [stderr](app.stderr.log) |
| `node --test browser-spike/*.test.mjs scripts/*.test.mjs` | 0 | 30 passed, 0 failed | [stdout](javascript.stdout.log), [stderr](javascript.stderr.log) |
| `/workspace/homesafe-venv/bin/python scripts/generate_contracts.py --check` | 0 | 3 files unchanged | [stdout](contracts.stdout.log), [stderr](contracts.stderr.log) |
| `/workspace/homesafe-venv/bin/python scripts/validate_package.py` | 0 | 8 checks, 0 failures | [stdout](package.stdout.log), [stderr](package.stderr.log) |

The app stderr contains only npm's informational newer-version notice. No product/source changes, commits or pushes were made during these checks. No browser, performance, rebuild or package-export commands were run.

The already-completed post-rollback typecheck/build is recorded in [rollback verification](../startup-pr3-rollback-verification-20261104.json). The [independent rollback review](../review-startup-pr3-rollback-20261104.json) confirms all 28 distribution paths and bytes match frozen PR-2; distribution manifest SHA-256 is `3ee69e5e576a0f9a54efdb1fb050c88354b814a4a212f0a1df4dc000f2fdb9f4`. Those checks are reused rather than rebuilding an unchanged artifact.

The parent owns the remaining package-manifest/CHECKSUMS refresh and any package export. This validation neither runs export against an expected stale manifest nor claims export readiness. Functional PASS does not override the separately recorded unmet three-second startup budget, real-asset limitations or public-host NOT_RUN status.
