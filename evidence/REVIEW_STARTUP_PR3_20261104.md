# Independent PR-3 post-apply review

Reviewer: `/root/review_ux`. Date: 2026-11-04. Final decision: **DISCARD PR-3 because the predeclared benefit gate failed.** The candidate passed correctness, entry separation and tested lifecycle review, but was not adopted. The active product has been restored byte-for-byte to PR-2; the 3-second objective remains OPEN. Candidate behavior described below is preserved historical evidence, not the current product.

This follows the [scratch pre-apply review](REVIEW_STARTUP_PR3_PREAPPLY_20261104.md). The reviewer did not edit product implementation, commit, push or deploy. [Final reviewed fingerprints](review-startup-pr3-functional-fingerprints-20261104.json) identify the code, test scripts and inspected distribution.

## Real counterexamples and fixes

- The original post-adoption page-exit ownership gap was independently reproduced before application. Bootstrap and UI now have explicit, non-overlapping cleanup ownership. Before UI adoption, a page exit cancels the attempt and leaves an explicit retry available; after adoption, the UI cancels a drag, aborts pending startup, disposes its Worker and blocks further editing until explicit recovery. Accepted scene/history are retained.
- The author then reproduced an actual failed-init loading hang: disposing the adopted session aborted its shared signal, so the original finalizer's `active()` guard skipped clearing loading state. [Before](startup-pr3-initial-failure-counterexample.txt). Reviewed the final guard `!disposed && startup === attempt`: it finishes the current failed attempt but cannot finish an explicitly cancelled/page-hidden attempt (`startup=null`), a replacement attempt, or an unmounted component. The original failure handling and stale-result guards remain intact. Independently reran the real failure/retry trace cases successfully.
- A real failed UI module download could not recover through another same-document import. [Before](startup-pr3-module-retry-counterexample.txt). The pre-UI import/mount failure now offers **重新加载页面**, requiring a user click. This starts a new document with no accepted interactive state to discard; cancellation still retries in the same document. Independent browser verification confirms two actual navigations, a second module request and an accepted real edit after recovery.

The mount-error guard retains original synchronous framework errors and cleans a partially claimed/mounted session. Its unit coverage does not claim an exhaustive browser test of every Vue error path.

## Independent browser verification

Ran the checked-in functional probes myself against `http://127.0.0.1:4200/candidate/` using isolated Chrome 154.0.8037.57, after inspecting their assertions:

```text
CI=1 node scripts/check_startup_bootstrap.mjs URL CHROMIUM PUPPETEER /workspace/scratch/review-pr3-bootstrap
CI=1 node scripts/check_startup_trace.mjs URL CHROMIUM PUPPETEER /workspace/scratch/review-pr3-trace
```

[Bootstrap receipt](review-startup-pr3-bootstrap-20261104.json): **three cases PASS**, including an actual held UI chunk while the Worker starts, pre-adoption cancellation/late-import rejection and explicit retry; actual chunk failure/document reload; and post-adoption page exit during a real pointer drag and immediately after posting a real evaluation. Pending proposals remain unaccepted; the accepted position/hash and undo history survive explicit Worker restart. Each stable recovered UI has exactly one active Worker.

[Trace receipt](review-startup-pr3-trace-20261104.json): **three cases PASS**—normal startup, actual failed initialization/retry and cancelled parallel startup/retry. Required trace phases/identity/generation checks pass, prior failed/cancelled traces remain unchanged, and all recovered cases perform a real accepted edit. This independently verifies the shared-abort finalizer correction.

Those probes intentionally inject `PageTransitionEvent` objects with `persisted=true`; this is real Window-handler testing, not proof that a browser chose BFCache. Their network faults use page-only CDP; pointer input and Worker requests are real.

## Separate native BFCache navigation

An additional independent [native navigation harness](review-startup-pr3-native-bfcache-20261104.mjs) performed an actual navigation away and browser Back. [Receipt](review-startup-pr3-native-bfcache-20261104.json): **PASS at 2026-11-04T10:52:42.889Z**. The same document UUID returned with **trusted**, persisted pagehide/pageshow events. An observer installed after the UI's listener saw zero active Workers at pagehide. The restored page kept its last accepted state unavailable for editing until explicit Worker retry; that retry preserved the moved input hash and undo history, with two Workers created in total and one active after recovery.

The installed Puppeteer defaults did not disable BFCache; the effective disabled-feature flags were unchanged. This was not a simulated persisted event, and no special performance result is inferred. It covers post-adoption native return, not native navigation during an unresolved UI import or GPU pixel equivalence.

The first native diagnostic run had an incorrect harness assertion: a microtask queued by an early pagehide listener was treated as a barrier after all event listeners. The [preserved failed observer receipt](review-startup-pr3-native-observer-counterexample-20261104.json) already showed the reused document with zero active Workers on return. The recorder was corrected to observe synchronously from a listener registered after the UI, and the functional case was rerun without product changes. The failure was in the diagnostic assertion, not an unrecorded application fix or a discarded performance sample.

All reviewer browser instances closed after their runs. No performance sampling was performed by this reviewer in these functional checks.

## Entry graph, code and CI checks

The [independent graph receipt](review-startup-pr3-entry-graph-20261104.json) uses TypeScript AST traversal of runtime-only static imports and inspection of the actual generated entry. Its source closure has eight modules with no Vue/App/Three/renderer dependency. The **16,368-byte** built entry has no static module imports and one dynamic import of the **699,922-byte** UI chunk; Vue runtime and Three renderer code are in that dynamic chunk. This establishes actual separation rather than merely finding dynamic-import syntax.

The served preview manifest matches the inspected local distribution byte-for-byte (SHA-256 `c7a4096f70b5ef0ff2023575f82214d24d77806ca3e606228657b4d201c30ff9`). The core ZIP and core manifest are byte-identical to the frozen adopted PR-2 baseline. The performance script still matches the independently reviewed PR-1 fingerprint, retaining the actual DOM editable predicate, real accepted-move validation and 3000/12000/150 ms targets.

Independent post-apply checks: **14 lifecycle tests and eight CI scope tests PASS**. Earlier independent scratch verification had all **50 application tests and typechecking PASS**. The author also completed the final build/typecheck, [nine experience checks](startup-pr3-experience-20261104.json) and [nine recovery checks](startup-pr3-recovery-20261104.json); the last browser run finished at 2026-11-04T10:56:11Z and those browsers closed. This reviewer inspected those final receipts and verified that the reviewed source hashes still match the [frozen candidate](startup-pr3-frozen-fingerprints-20261104.json), without claiming the author's runs as independent executions.

The existing experience probe's initial cancellation selector now waits within the adopted UI's check-results panel. This preserves its original scenario; pre-adoption cancellation is covered by the new bootstrap probe. CI adds that probe to the existing functional step and keeps `enforce required` in the separate strict performance step. This small CI/test-harness adjustment does not weaken the original cancellation or performance requirements.

## Historical authorization before measurement

**Run authorization from independent correctness review: PASS for the frozen PR-3 candidate to enter the predeclared performance experiment.** There are no remaining correctness blockers in the reviewed scope. This is not approval to claim a speedup, adopt the optimization or close the performance target.

That authorization required comparing this single scheduling change against the frozen PR-2 baseline under the registered fixed pair order and retaining all original enforce results. Earlier Worker creation or a smaller entry alone is insufficient evidence of end-to-end benefit. No runtime/model changes, threshold relaxation, rendering-quality reduction, synthetic accepted result or automatic replay was introduced by this PR-3 scope.

Real Lux3D, public HTTPS, other networks and Edge/Safari are outside these results. A successful native BFCache case on this Chromium is not certification for every browser or device.

## Final fixed comparison and discard decision

Independently read and recomputed the [unaltered raw result](startup-benchmark/pr3-optimization-result.json), SHA-256 `20479c43d8430cafb4e81dd45fec35216379b0410e187699725d0fcbc94e8904`. Exactly ten samples follow AB/BA/AB/BA/AB. Every sample contains a real accepted edit that changes its input hash, and both initial and edited hashes agree within each pair. The five A-minus-B savings are **−381.9, +125.3, −70.5, +43.9 and +279.8 ms**: only **3/5** improve and median saving is **43.9 ms**. Both predeclared adoption conditions fail (at least 4/5 and at least 100 ms). Nearest-rank first-editable p95 is **3946.1 ms for PR-2 and 4311.6 ms for PR-3**; neither meets 3000 ms.

The separate [benchmark reviewer](REVIEW_STARTUP_BENCHMARK_20261104.md) audited registration, environment, trace identity and source/distribution linkage. There was no replacement or selective repeat of the fixed sample set. Recommendation: **DISCARD_OPTIMIZATION**, not a causal claim that every deployment of the candidate is slower. Its extra full enforce run is **NOT_RUN_DISCARDED**; its hot evaluation is **NOT_RUN**, and PR-2's earlier hot results must not be assigned to PR-3.

## Independent rollback and recoverability verification

[Independent rollback receipt](review-startup-pr3-rollback-20261104.json), verified 2026-11-04T11:04:46Z: **PASS**. Checked 32 PR-2 browser/runtime/core source hashes, all seven changed product files restored or absent as appropriate, and all **28 distribution paths and bytes identical** to the frozen adopted PR-2. Restored manifest SHA-256 is `3ee69e5e576a0f9a54efdb1fb050c88354b814a4a212f0a1df4dc000f2fdb9f4`. The PR-3 bootstrap probe and its active workflow integration were removed, and the existing experience probe restored.

In a new isolated replay directory, independently applied the archived [seven-file candidate patch](startup-pr3-discarded/candidate.patch) to the restored baseline and then the [integration patch](startup-pr3-discarded/integration.patch). All seven final candidate source hashes and all four integration-file hashes exactly match their archives. This preserves the tested candidate, harness, lifecycle counterexamples and original measurement without leaving PR-3 active. The archive's pre-discard review copy is intentionally historical; this report records the final decision.

The author reported 36 application tests, eight workflow tests, typecheck and build passing after rollback. This reviewer performed the independent hash and patch-replay checks above, without rerunning those author checks or starting a browser. The restored PR-2 is approved to enter the already declared final enforce run. That run validates a different, retained version; it is not a repeat of PR-3 seeking a green result. The separately recorded final result below does not pass the unchanged 3-second gate and therefore does not close T07.

## Final retained-version enforce audit

The parent executed the single [predeclared final enforce](startup-benchmark/final-retained-enforce-registration.json) against restored PR-2, retaining PR-1 tracing. [Exact raw result](startup-benchmark/final-retained-enforce-performance.json), measured **2026-11-04T11:05:54.485Z**; SHA-256 `305dc1a7b4d0b01b75782b022465edfc212bda630a60d28406013bc50abafa63`. Independent [offline audit](startup-benchmark/independent-final-retained-enforce-review.json): **audit PASS, performance gate FAIL**.

Recomputed cold first-editable samples: **3913.5, 4086.1, 3784.6, 3843.3, 4049.8 ms**, p50 **3913.5 ms**, p95 **4086.1 ms**. Cold rules p95 **4086.1 ms** passes 12000 ms; hot evaluation p95 **12.6 ms** passes 150 ms. The unchanged 3000 ms first-editable target fails. All ten cold/warm samples perform accepted real edits whose hashes differ from their initial trace hashes. Independently re-ran the reviewed required analyzer offline on all ten full traces and matched every stored analysis; verified Window/Worker epochs, generation/thread, runtime/core identity and completed phases. Checked all registered measurement-file hashes, restored manifest/core, five cold/warm pairs, and 30 hot evaluations after three warmups.

This is the **final retained-version result**, superseding the earlier PR-2 3858.5 ms run for final reporting without erasing that historical receipt. It is not a PR-3 result and not evidence of a passing overall performance gate. No further performance sample was taken by this reviewer. T07/3-second performance remains OPEN. Results apply to isolated Chrome/localhost with the procedural scene; real Lux3D, anonymous HTTPS, other networks and Edge/Safari remain outside this validation.
