# Independent final handoff consistency review — startup phase

Reviewer: `/root/review_delivery`, independent of the central-document author. Date: 2026-11-04 UTC. Workspace: `/workspace/HomeSafe-AI-startup`, branch `codex/startup-profile-20261104`, source base `64e166540495126f618dd65aa8dc88760ed70604`.

**Decision: PASS for final handoff/version-scope consistency.** Retain reviewed PR-1 tracing and PR-2 model separation plus CI improvements; PR-3 is a completed **DISCARDED** experiment and is absent from the retained product. First-editable remains **OPEN_NOT_MET**. This document is not a performance-budget pass, public release approval or new remote CI result.

## Final evidence reconciliation

Reviewed final `START_HERE.md`, `evidence/HANDOFF.md`, `evidence/task-status.json`, `evidence/STARTUP_ADJUSTMENTS_20261104.md`, `docs/ADR-0003-startup-profiling-and-bounded-optimization.md`, the benchmark archive/review, and referenced rollback/final-test receipts. No blocking consistency findings remain.

- **Retained final local result:** one predeclared post-rollback `enforce required` run, first-editable cold samples 3913.5 / 4086.1 / 3784.6 / 3843.3 / 4049.8 ms; p50 3913.5, p95 **4086.1 ms FAIL**. Cold-rule p95 4086.1 ms passes 12000 ms; hot p95 **12.6 ms PASS** against 150 ms. Ten accepted edits, ten required traces and 30 hot evaluations after three warmups are separately audited by `/root/review_ux` in [the final receipt review](startup-benchmark/independent-final-retained-enforce-review.json).
- **Historical PR-2 acceptance evidence:** five improving pairs and median saving **334.4 ms** justify the bounded optimization signal. Its earlier 3858.5/12.5 enforce values remain explicitly historical, not the final 4086.1/12.6 values. Cross-run or cross-browser absolute times are not subtracted to claim another gain.
- **PR-3:** only 3/5 improving pairs and median saving **43.9 ms**, failing both predeclared adoption conditions. Candidate BFCache/lifecycle, early unique-Worker entry and chunk-retry capabilities are recorded only as discarded history. Candidate hot evaluation and extra candidate full enforce are **NOT_RUN / NOT_RUN_DISCARDED**; PR-2's hot values are not attributed to PR-3.
- **Rollback:** [independent rollback evidence](review-startup-pr3-rollback-20261104.json) confirms all 28 distribution files match frozen PR-2 and both candidate patches replay in isolation. Direct inspection confirms active `PreparedStartup.ts`, `mountApp.ts`, the bootstrap probe and its CI invocation are absent. The retained distribution/core are manifest `3ee69e5e576a0f9a54efdb1fb050c88354b814a4a212f0a1df4dc000f2fdb9f4` and core `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8`.
- **Latest remote evidence:** source64e1665 run41807603537 remains functional PASS_CI_LOCALHOST, first-editable 3386 ms FAIL, hot approximately 9.9 ms PASS. No new-source push, merge, deployment or remote CI run is claimed. The proposed three new fixed CI runs remain NOT_RUN pending the applicable authorization.

The ADR's final diagnostic paragraph uses **one cold trial 2** from the final retained run: loadPyodide 2725.1 ms, Pydantic import 151.6 ms, canonical import 573.0 ms, first evaluation 60.3 ms, initialization wall 3467.2 ms, measured interval union 3466.2 ms and residual approximately 1.0 ms. These figures match the raw trace. The document explicitly avoids summing overlapping/marginal stages or calling all runtime time compilation, all canonical import pure schema cost, or CPU competition a proven cause.

## Final correctness receipts and document checks

Inspected [the final command summary](startup-final-checks/summary.json) and every corresponding stdout/stderr file; all recorded digests match and all five commands exited 0. Raw outputs confirm **334 native tests**, **36 app tests**, **30 JavaScript tests**, **3 matching contracts** and **8 package checks**. The CI shell regressions are included in the 334 native total, not added again. This command set did not repeat browser/performance/build tests; post-rollback type/build and distribution identity use the separately identified rollback receipts. The reviewer did not rerun these test suites.

Additional independent checks:

- All local link targets in the five central/benchmark documents exist.
- The entire pre-existing HANDOFF body remains byte-for-byte preserved below the new current-state sections.
- Machine state agrees with the final result: PR-1 DONE, PR-2 DONE_ADOPTED, PR-3 `feature_done=false`/DISCARDED, T07 IN_PROGRESS with its 3-second subtask OPEN_NOT_MET, PR-4 stability OPEN, and T03/T04/T09 BLOCKED.
- The source64 remote CI status is separate from this local phase's NOT_RUN remote status.
- Prior benchmark data/code/registration bytes remain unchanged; the archive index now includes the three final-retained-enforce receipts and all 26 selected text artifacts.
- `git diff --check` passed at review time.

## External blockers and archive boundaries

The public asset manifest remains empty. Two real Lux3D originals are acknowledged as delivered historically, with prior checksum/Node geometry evidence; this environment's unavailable GLB bytes and unconfirmed publication rights still block actual-model browser/load/release acceptance. Historical GLB proxy403 is not conflated with new text/artifact generic `download failed` reports. Verified full text attachments and restored-LF checksum matches remain usable; the complete CI artifact ZIP remains locally NOT_OBTAINED and content/digest inspection NOT_RUN. No file-ID retrieval is represented as successful byte download.

No approved target public host, anonymous HTTPS/other-network acceptance, Edge/Safari/user-device coverage, final competition materials or submission receipt is invented. Local synthetic scenes and controlled iframes do not close those gates. No new paid generation or private asset publication is reported.

The final package manifest and root CHECKSUMS are parent-owned and will be regenerated **after this document is frozen**. Their subsequent independent exact-file/hash and exclusion verification will be recorded outside the repository in `/workspace/scratch` to avoid a self-referential checksum cycle. This review approves the document/evidence interpretation now, not an as-yet-unverified regenerated package list.

The reviewer wrote only review/benchmark evidence, ran lightweight offline consistency checks, and started no new browser, performance measurement or broad test suite. No commit or remote write was performed. Final integrated evidence must continue to report the failed 3-second gate even when the source package integrity checks pass.
