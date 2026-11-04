# Independent PR-3 post-apply review

Reviewer: `/root/review_ux`. Date: 2026-11-04. Decision: **PASS for correctness, entry separation and tested lifecycle behavior; performance adoption remains pending the fixed comparison and original enforce run.** PR-3 and the 3-second objective are not closed by functional evidence alone.

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

## Remaining gate

**Run authorization from independent correctness review: PASS for the frozen PR-3 candidate to enter the predeclared performance experiment.** There are no remaining correctness blockers in the reviewed scope. This is not approval to claim a speedup, adopt the optimization or close the performance target.

The parent must compare this single scheduling change against the frozen PR-2 baseline under the registered fixed pair order, then retain all original enforce results. Earlier Worker creation or a smaller entry alone is insufficient evidence of end-to-end benefit. No runtime/model changes, threshold relaxation, rendering-quality reduction, synthetic accepted result or automatic replay was introduced by this PR-3 scope.

Real Lux3D, public HTTPS, other networks and Edge/Safari are outside these results. A successful native BFCache case on this Chromium is not certification for every browser or device.
