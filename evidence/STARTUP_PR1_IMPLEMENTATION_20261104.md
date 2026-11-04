# PR-1 startup profiling implementation

Base: `64e166540495126f618dd65aa8dc88760ed70604`. Worktree: `/workspace/HomeSafe-AI-startup`. Implementation owner: `/root/ux_report`. Date: 2026-11-04.

Implementation, functional checks and the parent-owned controlled profiling/overhead disclosure pass their independent review scopes. The 3-second objective remains open. No commits, pushes, deployments, private-model publication or model splitting were performed in this PR-1 scope.

## Delivered observation

The shared `startup-v1` recorder and guarded facade record bounded, allowlisted Window and Worker metadata. Every event carries relative time plus its thread's `performance.timeOrigin` epoch. Traces correlate generation, core/input hashes and runtime/ruleset versions without scene contents, raw URLs, model locations, error strings or credentials. Resource output includes only allowlisted owned-resource labels and numeric timing/size fields. Long-task collection is optional and excludes task attribution.

Recorded stages cover Worker creation/module evaluation, init send/enqueue/queue handling/reply, runtime module import, `loadPyodide`, package preparation, Pydantic import, core fetch/hash, parallel bundle join, unpack, canonical import, dispatcher binding, first evaluation, scene/config load, renderer creation, accepted result and diagnostic edit eligibility. Retained scene/renderer retries explicitly record reuse. Cached initialization creates a current-request trace with an original runtime-generation reference; it does not relabel prior runtime spans as newly executed work.

Window/Worker comparisons use epoch times. Initialization coverage uses the union of clipped intervals, preserving overlap; unmeasured residuals remain unattributed. Stage durations and long tasks cannot by themselves separate network transfer, WebAssembly compilation or Python schema construction. The edit-eligibility mark is diagnostic only. Its `nextTick` callback is scheduled without awaiting it in the business path.

The performance CLI accepts a fifth `optional|required` argument. The immutable uninstrumented baseline uses `optional`; candidates use `required`. Missing or mismatched candidate traces fail validation. The original DOM/rAF actual-editable predicate, each sample's actual successful move with changed accepted hash, and 3000/12000/150 ms targets remain unchanged; the independent reviewer verified these blocks byte-for-byte against the base.

## Counterexamples and failure isolation

The independent review first reproduced malformed numeric-string spans escaping the sanitizer, cached initialization returning stale-generation trace data, and a diagnostic snapshot exception suppressing a business reply. A further review found failed first-evaluation metadata was dropped. These were fixed before freezing. See the retained [before receipt](review-startup-pr1-counterexamples-before-20261104.json) and [after receipt](review-startup-pr1-counterexamples-after-20261104.json).

Finite numeric validation now precedes time arithmetic/copying. The guarded facade permits missing diagnostics while preserving successful business calls and original business exceptions. Unit and independent checks inject recorder/clock/observer failures, invalid resource fields, failed/retried generations and healthy cached runtime reuse. Canonical response fields and source-hash verification remain unchanged; trace metadata is optional outside the result payload.

## Executed checks

- `npm --prefix apps/web run typecheck`: PASS.
- `node --test browser-spike/*.test.mjs scripts/*.test.mjs`: 29 passed.
- `npm --prefix apps/web test`: 36 passed.
- `PATH=/workspace/homesafe-venv/bin:$PATH npm --prefix apps/web run build`: PASS, staged trace module included and preview verified. Python core hash remains `ee006f87a81fff99e3447ed7e1aa8438d125332beed617d2694a5f711dfcaa2d`.
- New portable `scripts/check_startup_trace.mjs`: PASS, three isolated browser cases. Normal startup validates required stages/identity and accepts a real edit. An actual missing-runtime initialization failure produces failed generation 1 with no active Worker, then successful generation 2; the previous trace stays unchanged. Cancellation with the scene request held while the Worker exists terminates the old Worker and yields a separate successful retry generation. Both retries require the full candidate trace analysis and real accepted edit. [Receipt](startup-pr1-trace-functional-20261104.json).
- Existing experience harness: PASS, nine checks including cancel/late response, dual-role summaries, narrow-screen movement, unique report downloads, print and procedural-model download retry. [Receipt](startup-pr1-experience-20261104.json).
- Existing recovery harness: PASS, nine checks including actual WebGL context loss/rebuild, injected Worker terminal event, accepted-layout preservation, explicit challenge reset, initial renderer failure and scene HTTP503 after Worker creation. [Receipt](startup-pr1-recovery-20261104.json).

Browser: isolated Chrome `154.0.8037.57`, candidate at localhost port 4200. All owner-run browser sessions closed by `2026-11-04T10:22:29.406Z`. Functional runs overlapped and their durations must not be used as performance evidence. Fault types and NOT_RUN limits are explicit in the raw receipts.

## Freeze and independent review

[Frozen fingerprints](startup-pr1-frozen-fingerprints-20261104.json) identify the owned source/test/staging files and all 28 distribution files. Distribution manifest SHA-256: `8c59b3663eb691c38e00f7f25d3eb4ade3ebf76b3ad42d3e2dff2f27f738a6d1`. The working tree was intentionally uncommitted when frozen. No product/build changes are permitted during the parent's controlled comparison.

After product freeze, independent review found required analysis accepted traces with missing queue/lifecycle marks or wrong event kinds. The [counterexample](review-startup-pr1-required-queue-counterexample-20261104.json) is preserved. Only the Node analyzer/tests and CI wiring changed: required traces now demand lifecycle marks, successful completed numeric spans and explicit scene/renderer load or reuse. Three analyzer tests pass; all ten already-collected profile samples and three functional cases pass [offline revalidation](startup-pr1-final-analyzer-revalidation-20261104.json), without resampling. CI now executes the startup trace functional harness and passes `enforce required` to the unchanged performance gate. Eight workflow tests pass, including exact CLI arguments and failed-budget exit propagation. The fingerprint receipt explicitly records this post-freeze analysis/CI amendment; product distribution hashes remain unchanged.

[Independent PR-1 review](REVIEW_STARTUP_PR1_20261104.md) reports tracing-scope PASS, including a separate real browser run with diagnostic publication failure and an unchanged successful edit. The parent's five-cold/five-warm profile remains first-editable p95 4128.5 ms (FAIL), with hot evaluation 16.6 ms (PASS). The registered five-pair overhead experiment and [independent benchmark review](REVIEW_STARTUP_BENCHMARK_20261104.md) report observed B−A median −278.9 ms, range −850.9 to +217.5 ms. This discloses bounded observed differences; it does not establish a tracing speedup, zero overhead, or a future overhead bound. No additional samples replaced the original failed full profile. Real Lux3D behavior, public HTTPS, another network and Edge/Safari were not exercised here.
