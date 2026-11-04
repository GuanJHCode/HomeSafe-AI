# Independent PR-3 lifecycle pre-apply review

Reviewer: `/root/review_ux`. Date: 2026-11-04. Candidate: `/workspace/scratch/pr3-candidate`.

Decision: **PASS to apply the reviewed seven-file candidate for build and real-browser validation. PR-3 functionality and performance are not yet approved or closed.** No active implementation changes, build, browser launch, commit or push were performed by this reviewer in this pre-review.

Reviewed the [read-only design](STARTUP_PR3_READONLY_DESIGN_20261104.md), current PR-1/PR-2 application interfaces and the scratch implementation. Exact candidate fingerprints and test results are in [the pre-apply receipt](review-startup-pr3-preapply-20261104.json).

## Ownership and behavior

The lightweight entry begins configuration/Worker startup synchronously and schedules the dynamic UI import without awaiting readiness. It uses the existing EvaluationController. A single explicit handle owns the abort signal, trace generation, handled readiness outcome and eventual controller; UI adoption during pending configuration does not trigger a second fetch or Worker. Initial UI initialization uses that same handle/trace, while later retries use the existing UI recovery path.

Entry generations reject late imports after cancellation/retry. Original rule/config errors remain available, and a current UI observer receives the diagnostic relay. The guarded mount adapter detects synchronous Vue-reported setup/render failures as well as thrown mount errors, disposes an already-claimed handle, restores the previous error handler and retains the original error despite cleanup failure.

## Counterexample and corrections

The initial candidate removed the bootstrap `pagehide` listener on mount but only installed Vue `onUnmounted` cleanup in the UI. Page hiding does not itself call that hook. Both the root and this reviewer identified the gap independently. The [saved counterexample](review-startup-pr3-pagehide-before-20261104.json) uses the actual startup/controller APIs with an EventTarget modeling the main listener handover: one active Worker remains after `pagehide`; explicit unmount-equivalent disposal is needed to reach zero. This was a controlled lifecycle model, not an actual-browser BFCache result.

The candidate now transfers the event responsibility explicitly. Before adoption, `pagehide` cancels the entry while keeping an explicit retry available on a persisted return; it does not silently restart. After adoption, the UI installs its own listener before the bootstrap listener is removed. Its suspension path cancels an active drag, aborts startup, disposes the current evaluation owner, clears busy/loading state and marks the UI unavailable until explicit retry. Accepted scene/history remain available to that retry; an interrupted proposal is not replayed. UI unmount removes its listener.

The first independent test run also caught a new mount-regression test's local `config` variable shadowing its fixture before initialization (11 passed/1 failed). The author corrected that test and completed the additional handover cases.

## Independent verification

Executed in the scratch candidate:

```text
node --test apps/web/tests/*.test.ts
npm --prefix apps/web run typecheck
```

Results: **50 application tests passed, zero failed/skipped; Vue/TypeScript check passed.** This includes fourteen new lifecycle cases: pending-config adoption, cancellation/late configuration, failure before/after claim, observer handover, controller replacement cleanup, stale UI imports, import failure, partial mount failure, framework-reported failure, and pre-/post-adoption page-exit ownership. The page-exit tests explicitly inject EventTarget events; they do not claim a browser selected BFCache for navigation.

## Required after application

- Build and inspect the actual entry dependency graph: Vue/App/Three must be outside its static closure. Nominal dynamic-import syntax alone is insufficient evidence.
- Run real-browser startup, accepted editing and existing recovery/experience checks on the same staged subpath. Exercise page hiding before and after adoption, pending proposal/drag cleanup, preserved layout/history and explicit retry.
- Exercise an actual UI chunk request failure and retry. Browser module-map failure caching can differ from the unit fake; if same-import retry cannot recover, an explicit pre-mount document reload is a possible remedy while no accepted state exists. No remedy or browser behavior is assumed proven here.
- Keep the exact actual-DOM editable predicate, accepted-move validation and 3000/12000/150 ms gates. Measure the single scheduling change against the frozen PR-2 baseline under the fixed paired plan. Earlier Worker creation alone does not establish end-to-end benefit.

Real assets, public hosting, other networks and other browsers remain outside this pre-review. The 3-second target stays open.
