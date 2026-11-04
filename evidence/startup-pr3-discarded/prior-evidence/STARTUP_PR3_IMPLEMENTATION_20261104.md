# PR-3 lightweight bootstrap implementation

Date: 2026-11-04. Owner: `/root/ux_report`. Baseline: the adopted PR-2 distribution frozen at `/workspace/homesafe-startup-pr2-baseline/dist`. PR-3 is a controlled candidate pending the parent's registered performance comparison; functional success alone does not authorize an optimization-benefit claim.

## Change and ownership

`main.ts` now starts a lightweight prepared session while dynamically importing the Vue/App/Three mount module. The prepared session reuses the existing EvaluationController, config loader, Worker protocol and source verification. It returns synchronously, observes early rejection immediately and creates only one controller after a live configuration request. It carries the same trace generation, AbortController and handled readiness outcome into the UI, which claims it exactly once. No second evaluation implementation, proxy Worker or implicit global session was added.

Entry generation checks reject late UI import results after cancellation or retry. The UI's first initialization adopts the pending session instead of repeating config fetch/Worker creation. Later Worker retries use the existing controller semantics, preserving accepted workspace state and explicitly resetting challenge state as before. A mutable diagnostic relay transfers early bounded snapshots to the UI's current-generation observer.

Pre-adoption page exit cancels the session and leaves explicit retry available on a persisted return. After adoption, the UI owns its page-exit listener: it cancels a live drag, aborts startup/terminates the Worker, keeps the accepted scene/history, and requires explicit Worker retry. The obsolete bootstrap listener is removed. A pending proposal cannot become accepted or replay automatically. Component unmount removes the UI listener and disposes its resources.

The mount adapter also catches errors reported through Vue's synchronous `errorHandler`, even if `mount()` returns without throwing. It restores the previous handler, disposes the claimed session, unmounts partial UI and preserves the original exception. An interrupted/error loader never satisfies the existing editable predicate.

The built entry is 16,368 bytes with no static module imports; it dynamically imports a 699,922-byte UI chunk. Independent review additionally inspected the runtime source closure for Vue/Three exclusion. This is evidence of separation, not evidence of faster readiness. The staged canonical core bundle and manifest match the frozen PR-2 distribution byte-for-byte. Performance metrics, targets and scene/render quality were not changed.

## Counterexamples preserved and fixed

1. Independent pre-apply review found that removing the bootstrap page-exit listener without adding a UI-owned listener left an adopted Worker alive. It also identified an unrecoverable cancelled loader on persisted return. The owner-specific page-exit listeners and explicit retry paths address both; unit tests use real EventTarget dispatch and verify listener handover.
2. The first post-apply real browser run found a shared-abort finalizer bug: disposing an adopted failed session aborted the same attempt, causing the previous `active()` guard to skip clearing `busy`. The [failed-init counterexample](startup-pr3-initial-failure-counterexample.txt) records the stuck loading state. Finalization now depends on ownership of the current attempt and a live component; replaced/cancelled attempts still cannot update the UI. The existing trace failure/retry regression passes afterward.
3. An actual failed UI module fetch remained cached as failed by the browser, so same-document import retry could not recover. The [module-retry counterexample](startup-pr3-module-retry-counterexample.txt) preserves this failure. Only the pre-UI load/mount failure path now offers an explicit **重新加载页面** action. A user click starts a fresh document; no automatic reload occurs and there is no accepted interactive layout yet. Cancellation still retries in the same document. The browser regression verifies two navigations, recovered loading and an accepted real movement.

## Verification and limits

- Independent scratch pre-review: PASS before applying the exact seven-file candidate. Active application source was untouched until the parent gave GO.
- Final app unit suite: **50 passed**, including 14 prepared-session/entry lifecycle cases. Type checking and production build pass.
- CI workflow scope tests: **8 passed**. `check_startup_bootstrap.mjs` now runs in the existing functional step, before the unchanged strict performance step. The existing performance command remains `enforce required`.
- [Trace browser receipt](startup-pr3-trace-functional-20261104.json): normal startup, actual failed init/retry and cancelled parallel startup/retry pass after the finalizer fix.
- [Bootstrap browser receipt](startup-pr3-bootstrap-functional-20261104.json): three cases PASS on isolated Chrome 154.0.8037.57. A held UI chunk proves the real Worker starts before App arrives; cancellation blocks the late mount and allows a fresh explicit attempt. An actual failed chunk recovers via explicit reload. Actual pointer dragging and a posted evaluation are interrupted by page exit; accepted position/hash and undo history survive explicit Worker recovery.
- Existing [experience regression](startup-pr3-experience-20261104.json): all nine checks PASS. The adopted-UI cancellation selector was narrowed to the findings panel so it cannot accidentally select the newly introduced pre-adoption loader button; the separate bootstrap probe covers that earlier phase.
- Existing [recovery regression](startup-pr3-recovery-20261104.json): all nine checks PASS, including renderer rebuilding, idle Worker failure, accepted-layout/history preservation, challenge reset and scene HTTP503 after parallel Worker startup.

The owner bootstrap receipt completed at `2026-11-04T10:49:11.270Z`; that browser closed. Lifecycle events in this receipt are explicitly injected `PageTransitionEvent` objects with `persisted=true` on the actual Window handlers. This alone does not certify native BFCache behavior. Network faults use page-only CDP; pointer events and Worker evaluation requests are real. None of these functional durations establish a performance benefit.

Independent post-apply review additionally reproduced native BFCache return with trusted persisted events and a stable document identity; the UI-owned listener terminated the Worker, and explicit retry preserved the moved hash and undo history. This is a separate native-navigation receipt, not an upgrade of the injected-event author receipt.

All owner and reviewer browsers closed by `2026-11-04T10:56:11.085Z`. The [freeze receipt](startup-pr3-frozen-fingerprints-20261104.json) records 11 relevant source/test/CI files and all 29 distribution files; manifest SHA-256 is `c7a4096f70b5ef0ff2023575f82214d24d77806ca3e606228657b4d201c30ff9`. Product source/distribution are frozen for the parent's exclusive comparison. Exact pre-PR3 source bytes were retained separately for a possible rejection/rollback and verified against the pre-apply hashes.

The parent must run the predeclared paired experiment against PR-2 and the unchanged full enforce gate before deciding whether to retain this candidate. The 3-second target remains open until an actual qualifying result exists. Private models, public hosting and Edge/Safari are outside this scope.
