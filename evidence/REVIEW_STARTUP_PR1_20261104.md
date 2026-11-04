# Independent PR-1 startup tracing review

Reviewer: `/root/review_ux`. Base: `64e166540495126f618dd65aa8dc88760ed70604`. Date: 2026-11-04.

**Final PR-1 startup-tracing subtask review: PASS**, including correctness, functional tracing, final analyzer, minimal CI delta, dedicated profile and controlled overhead disclosure. **The 3-second first-editable objective remains OPEN_NOT_MET.** This scoped result does not close real-asset/public-hosting gates or approve a performance optimization.

## Reviewed scope

Read both user-provided adjustment documents in full, repository instructions and the changes to the shared trace recorder/facade, Worker controller/initializer, optional BrowserRuleClient metadata, EvaluationController, useLivingRoom, performance collector/analysis and web staging. PR-0 state corrections and PR-4 workflow structure are separately reviewed. No implementation edits, commits or pushes were made by this reviewer.

Exact reviewed sources are recorded in [source fingerprints](review-startup-pr1-source-fingerprints-20261104.json). Canonical Python models and authority remain unchanged in this PR-1 scope.

The final diagnostic-only delta explicitly records `scene_reused` and, when a healthy renderer remains, `renderer_reused` on retained-scene retries. The required analyzer accepts these alternatives to fetching/creating. This avoids fabricating repeated work and does not alter existing retry control flow. The new `check_startup_trace.mjs` functional harness was also inspected; its author execution results are separate from the independent run below.

## Defects independently reproduced and retested

The [initial counterexamples](review-startup-pr1-counterexamples-before-20261104.json) captured three issues during implementation:

1. A span `end_ms` containing 100,000 numeric characters passed coercive subtraction and expanded into a 200,302-byte sanitized snapshot. The final sanitizer requires finite numeric starts/ends; malformed resource start times are also rejected before epoch construction.
2. A second successful init requested generation 12 but returned generation 11's trace. The fixed reply reports the current request generation, explicitly marks cached initialization and links the original runtime generation without presenting its old initialization intervals as a fresh attempt.
3. An injected recorder `snapshot()` error prevented an otherwise successful init reply, including its error handler. The new guarded facade isolates recorder failures while preserving real initializer/dispatch errors.

An additional code-review finding concerned failed first-evaluation metadata being dropped: EvaluationController now observes matching-generation diagnostic metadata on rejection while rethrowing the original business error.

Independent [post-fix counterexamples](review-startup-pr1-counterexamples-after-20261104.json) compare eight protocol fixture responses against the original `64e1665` controller, removing only optional diagnostic envelopes. Business replies match exactly, including failure, retry, dispatch errors, repeated init and oversized-input rejection. Injected throws in each recorder method (`mark`, `identify`, `snapshot`, `start`, `interval`, `finish`) preserve those same business replies. Numeric-string and resource-field counterexamples are rejected; repeated-init generation linkage is correct.

## Executed verification

`node --test browser-spike/*.test.mjs scripts/*.test.mjs apps/web/tests/evaluation.test.ts` completed with **36 passed, 0 failed, 0 skipped**. This is the targeted review set, not the aggregate project count. It covers optional observer errors, wrong generations, failed first evaluation, queue recovery, runtime reuse, request errors, sanitization and interval union.

Independently extracted and compared three code blocks against `64e1665`: the actual DOM/rAF editable predicate, the actual move/changed accepted-hash validation, and the full 3000/12000/150 ms target expression are **byte-identical**. Adding trace diagnostics neither supplies an editable time nor replaces the real-edit check. Optional baseline tracing remains permitted; required candidate tracing fails when the necessary evidence is absent.

Ran a separate isolated Chromium 154.0.8037.57 browser harness against `http://127.0.0.1:4200/candidate/`; it completed **PASS at 2026-11-04T10:18:30.519Z**, and the browser closed. [Raw receipt](review-startup-pr1-browser-20261104.json), [exact harness](review-startup-pr1-browser-20261104.mjs).

- Normal startup: required Window/Worker phases, matching identities, explicit epoch alignment and interval-union bounds pass. Exactly one Worker is active; an actual movement produces a new accepted input hash.
- Actual initialization failure/retry: only the first configuration response is changed to require Pyodide `0.0.0`; the installed runtime is unchanged. Both generation-1 traces report failure, no report is accepted and the Worker is terminated. Explicit retry produces generation 2, leaves the prior failed trace unchanged, has two Workers created/one active, and successfully accepts a real edit.
- Diagnostic publication fault: `window.dispatchEvent` throws only for `homesafe-startup-trace`. Startup and an actual accepted edit still succeed, with one Worker and no page errors. The missing diagnostic output does not block the application.

The preserved harness uses absolute local import paths and a fixed local candidate URL; it is evidence of this isolated review, not a portable deployment. These functional runs may overlap other functional browsers and must **not** be used to claim performance improvement or budget compliance.

## Timing, privacy and lifecycle assessment

Each thread records its own `performance.timeOrigin` and `performance.now`; cross-thread gaps use their sum. Initialization spans are clipped to the same measured wall interval and combined as an interval union. Parallel runtime/bundle durations are not added, and phase percentiles are not summed. The first real evaluation remains separate.

`init_send_to_enqueue` still includes module/bootstrap, message delivery and scheduling; it is not a pure network or compilation measurement. `load_pyodide` includes runtime bootstrap and preloaded packages. `canonical_import` measures the full canonical import, not schema construction alone. The remaining wall gap is explicitly unattributed. Window long tasks have no URL/task attribution and cannot independently identify rendering or compilation costs.

Trace events use fixed phase labels, bounded counts, finite numeric timestamps and whitelisted version/hash identities. Resource output contains allowlisted owned-resource labels and numeric fields; it omits raw URLs, queries, model names, inputs and credentials. Current-request checks and generation validation prevent stale diagnostics from being attached to accepted state. Cancelled/failed recorders ignore late marks; the independent failed-version retry proves generation isolation in a real Worker lifecycle.

The product does not await diagnostic publication, observers or the added `nextTick` completion before enabling existing interactions. Async span wrappers do add promise/clock bookkeeping, and snapshots/resource collection add work and transferred bytes. These costs are not assumed to be zero: the normal functional receipt contains approximately 2.1 KB of Window trace and 3.4 KB of Worker trace, and a dedicated controlled overhead comparison remains required.

## Remaining evidence and limits

The fixed instrumentation-overhead comparison is now archived and independently audited, as recorded below. PR-1 has established a versioned diagnostic baseline with its overhead limits disclosed. No additional browser sampling was performed by this reviewer after the coordinated functional window.

Full project regression/build results, final source packaging and current remote CI are outside this targeted execution set. Real Lux3D, public HTTPS, another network and Edge/Safari are NOT_RUN here. The original 3000/12000/150 ms gates and T07's unresolved first-editable target remain unchanged.

## Final analyzer and CI delta

A final independent [counterexample](review-startup-pr1-required-queue-counterexample-20261104.json) removed all four Worker lifecycle marks from a real successful receipt. The original required analyzer incorrectly still returned `AVAILABLE` with null queue/delivery gaps and null initialization wall time. Same-name marks could also stand in for required duration spans. The author strengthened the analyzer to require the lifecycle marks and successful, finite completed spans of the expected kinds. This changes only Node analysis/tests, not product code or the frozen distribution.

Independently revalidated **all ten original profile traces plus three author functional traces** under the final analyzer, with no resampling or rewriting of the raw receipt. Four missing-lifecycle variants and all eleven Worker span-to-mark variants are now rejected. The analyzer's three tests and the eight CI workflow scope tests pass. [Independent offline verification](review-startup-pr1-profile-offline-20261104.json) records the raw-profile and final-analyzer hashes.

The minimal CI addition runs `check_startup_trace.mjs` within the existing functional step and uses `enforce required` for performance. Commands still operate sequentially on the same staged distribution. Missing required traces and unmet original budgets remain failures; no `continue-on-error` or threshold change was added. The prior [PR-4 separation review](REVIEW_STARTUP_PR4_20261104.md) remains the evidence for step separation, cleanup and always-preserved summaries/artifacts; this review covers the small tracing delta and focused tests. Remote execution of this changed workflow is NOT_RUN here.

After that review, the shared workflow gained a separate PR-2 runtime-only ZIP closure step. The source fingerprint record preserves the workflow hash actually reviewed here and identifies that subsequent addition. PR-1's trace invocation and `enforce required` argument are unchanged; approval of the PR-2 closure step belongs to its separate review.

## Dedicated profile: one sample, one timeline

The parent ran the frozen traced distribution without competing browser work. The [exact raw profile](startup-pr1-traced-baseline-performance-20261104.json), measured at **2026-11-04T10:23:36.018Z**, is preserved byte-for-byte (SHA-256 `cf8d768669da71bea03695a7916518f86cac944fff5ab48dc3c81dbb937cc1b4`). This reviewer checked the receipt offline rather than claiming execution of that run.

Cold editable samples are **4084.0, 3728.6, 4128.5, 3582.2 and 3464.4 ms**. Independent nearest-rank recomputation gives cold first-editable p95 **4128.5 ms — FAIL**, cold rules p95 **4128.4 ms — PASS ≤12000**, and hot evaluation p95 **16.6 ms — PASS ≤150** from thirty samples after three warmups. All ten cold/warm samples confirm a changed accepted input hash. These measurements are local Chromium 154 and must not be compared as a code-speed effect against the older CI Chromium 156 result.

The following non-overlapping chain uses **only cold trial 3**, the 4128.5 ms sample:

| Segment | ms |
| --- | ---: |
| Document origin → Window trace init sent | 468.8 |
| Init sent → Worker enqueued | 22.3 |
| Worker queue → handler starts | 0.3 |
| Handler starts → reply ready | 3524.8 |
| Reply ready → Window receipt | 4.6 |
| Window receipt → actual DOM editable | 107.7 |
| Total | 4128.5 |

Within this same sample, `load_pyodide` is 2722.9 ms, canonical import 620.1 ms, Pydantic import 159.7 ms, ensure-package 3.9 ms and first evaluation 89.5 ms. The initialization wall interval through dispatcher binding is 3522.3 ms; its measured span union is 3521.6 ms, leaving 0.7 ms unattributed. Runtime and bundle fetch/hash overlap; these phase values are not additive components of a new total.

This sample also exposes a scheduling lead: the configuration resource finishes at 131.2 ms (11.7 ms Resource Timing duration), but the async config span completes at 467.1 ms and Worker creation follows at 468.8 ms. Renderer creation spans 177.5–282.0 ms; an unattributed Window long task spans approximately 283.5–466.5 ms. Other cold trials create the Worker at 137.6–257.7 ms, largely before renderer creation. This justifies investigating entry/scheduling contention, but does not identify the 183 ms task as shader compilation or prove that a proposed optimization will help.

## Fixed instrumentation-overhead comparison

The parent executed the registered **AB/BA/AB/BA/AB** comparison once: A is immutable `64e1665`, B adds only PR-1 product instrumentation to the same canonical core. Both use the same frozen external measurement/real-edit logic; A has optional absent tracing and B requires complete tracing. [Exact raw results](startup-benchmark/overhead-result.json) and the separate reviewer's [independent offline audit](startup-benchmark/independent-overhead-review.json) preserve the schedule, source/distribution fingerprints, sample results and checks. This reviewer read those records and independently recomputed the paired differences; the separate reviewer audited the harness, all raw traces, frozen distributions and provenance.

| Pair | Order | B−A editable ms |
| --- | --- | ---: |
| 1 | AB | -126.4 |
| 2 | BA | -850.9 |
| 3 | AB | -397.7 |
| 4 | BA | +217.5 |
| 5 | AB | -278.9 |

Observed B−A median is **-278.9 ms**, range **-850.9 to +217.5 ms**. A/B first-editable p95 values are **4338.9/3900.0 ms**; both fail the unchanged 3000 ms target. All ten real edits passed, with matching initial/edited hashes within each pair and the same core/runtime identities. This paired experiment does not run the hot-evaluation gate; the separate full profile above does.

The broad variation and negative observed median do **not** establish that tracing accelerates startup, that its true cost is zero, or that +217.5 ms bounds future overhead. This is a bounded disclosure of measured differences, not an optimization-adoption decision or a population estimate. The successful experiment exit denotes completed sampling, not budget compliance. The original full-profile failure remains preserved; no additional runs were used to replace it.
