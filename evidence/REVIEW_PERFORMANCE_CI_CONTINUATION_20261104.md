# Independent review: editable readiness, startup and CI probes

Reviewer: `/root/review_delivery`, independent of the root implementation. Date: 2026-11-04 UTC. Workspace: `HomeSafe-AI-continuation`, branch `codex/continuation-features-20261104`; baseline `f6245e13bc41e36a0efeabeba3ca0fba2174c2f5`. Review concerns the working-tree changes in the performance probe, rule-worker startup, the `initialize` section of `useLivingRoom.ts`, and CI probe wiring. Other observation, snapshot and renderer changes require their separate reviews.

**Decision: PASS for measurement correctness, startup after the lifecycle fix, and CI wiring. The first-editable ≤3,000 ms performance objective is NOT MET and remains open.** No remote GitHub Actions run or public deployment was performed by this reviewer.

## Independent finding and repair

Parallel rule/scene loading initially left a Worker alive when scene loading failed after Worker creation. The reviewer held `scene-before.json` until one real Worker existed, then returned HTTP 503. After 4.5 seconds the terminal error was visible, there was no report, but one Worker remained active (`created=1`, `terminated=0`, `active=1`). The independent assertion failed. This was a lifecycle regression from the serial startup path.

The author changed the active-attempt error handler to dispose and clear evaluation/challenge controllers. The same independent browser counterexample then passed (`created=1`, `terminated=1`, `active=0`), with the honest error and no report/page errors. The committed recovery probe now covers this sequence and explicit fresh-Worker retry. Before/after observations and additional integrity results are preserved in [fault evidence](review-performance-ci-faults-20261104.json).

Two further independent real-browser fault cases used a temporary loopback server over the current build:

- A changed canonical bundle manifest digest was rejected as `Python bundle hash mismatch`.
- A deliberately wrong configured Pydantic version was rejected as `Pydantic version mismatch`.

Each left zero active Workers and no report. Removing the fault and explicitly retrying created one fresh Worker and produced the accepted assessment; neither case had page errors. This verifies that concurrent fetching and package preloading do not bypass digest or version checks. No production files were modified by these fault cases.

## Measurement semantics and actual results

The previous canvas/view-button metric is retained only as a diagnostic. The 3-second target now uses `cold_first_editable`: select the chair through its normal DOM change event, require a current report and idle evaluation, an enabled move button, a rendered canvas and no renderer failure. Every cold/warm trial then clicks move and requires a different accepted hash. Confirmation time is separate because it includes automation scheduling.

The reviewer independently ran enforce mode twice, with the team suspending other browser tests. Each run used five fresh browser contexts, five paired cached reloads, and thirty real Worker evaluations after three warmups. All ten edits were confirmed in each run. Both commands correctly exited **1** because the 3-second budget failed, while still emitting parseable numerical evidence.

| Metric | Earlier enforce run p95 | Final instrumented profile p95 |
| --- | ---: | ---: |
| Cold first editable | 3,867.7 ms | **4,231.2 ms — NOT MET** |
| Cached first editable | 3,908.8 ms | 3,843.9 ms |
| Cold first edit confirmed | 4,045.6 ms | 4,449.0 ms |
| Cold rules ready | 3,867.7 ms | 4,231.1 ms — below 12,000 ms |
| Hot engine evaluation, 30 samples | 12.3 ms | 12.8 ms — below 150 ms |
| First observation only | 444.7 ms | 533.2 ms — not an editing result |

Raw evidence: [earlier enforce run](review-performance-ci-enforce-20261104.json), [final instrumented profile](review-performance-ci-profile-20261104.json). These runs are separate observations, not a controlled causal comparison; their variation does not prove either an optimization benefit or regression. The author's earlier 3,994.3 ms baseline also had uncertain competing workload, so it is not used to quantify speedup.

Environment: Chromium 154.0.8037.57, cloud Linux x64, AMD EPYC 9V74, 5 reported logical CPUs, localhost without throttling, 1280×1000 viewport, requested SwiftShader flags. Fresh contexts isolate browser cache but do not reset operating-system caches or all runtime process state. No claim is made for real Lux3D models, public HTTPS, another network, Edge or Safari.

## Critical-path profile

The added passive Worker wrapper records construction, actual init `postMessage`, and first successful init reply from the application's own Worker. It passes message/transfer arguments through unchanged and never changes product state. The separately created warm engine probe cannot replace that first UI record. All ten samples had ordered construction→request→reply→editable→confirmed timestamps.

Final cold samples show:

- Document→Worker construction: **151.0–204.2 ms**.
- Init request→reply: p95 **3,986.5 ms**; Worker-measured initialization itself **2,904.5–3,615.2 ms**.
- Within that Worker measurement, runtime plus preloaded packages used **2,239.2–2,687.1 ms**, and final package/import validation used **141.1–207.5 ms**.
- The remaining **518.4–720.6 ms** includes any wait for the bundle, unpacking, canonical-core import and dispatch acquisition. It is not a separately measured pure Python-import duration.
- Init reply→first editable: **89.5–109.1 ms**.

Thus the measured critical path is Worker initialization, not a long post-ready UI update. The data does not separately identify network, compilation and CPU contributions within runtime startup. Phase percentiles must not be added as though they were from the same trial.

The pinned vendor source was inspected: `API.config.packages` is passed to its package loader before awaiting `bootstrapFinalizedPromise`. Using `loadPyodide({indexURL, packages:['pydantic']})` is supported by the actual fixed runtime. The code still performs final package loading/version validation and bundle digest validation. Its new `startup_mode`/`timing_note` correctly disclose that `startup_ms` now includes preloaded packages; old phase durations are not directly comparable.

## CI and additional verification

- Independently ran the 14 Worker/client lifecycle tests: **PASS**; Vue/TypeScript typecheck: **PASS**. Node syntax checks passed for the performance probe and rule worker.
- Inspected CI's additional experience, observations, recovery, same-/cross-origin embedding and performance invocations. Separate local parent/app ports establish distinct origins; probes execute sequentially and preserve evidence in the existing artifact.
- Extracted the actual CI shell body and ran `bash -n`: **PASS**. After the user's strict-gate clarification, independently exercised the final performance shell tail under Bash `-e -o pipefail` with a clearly synthetic unmet-budget process. It retained exit code **1**, retained its JSON evidence, and emitted a GitHub **error** annotation plus a **NOT MET** summary row. The artifact step still uses `if: always()`. This was a synthetic failure-propagation test, not another performance measurement.
- Final CI runs performance in explicit **`enforce` mode**, captures the pipeline status to write its summary, and then exits with that failure status. Correctness failures, timeouts and unmet latency targets remain blocking. The unchanged budgets are first-editable 3,000 ms, cold rules 12,000 ms and hot-evaluation p95 150 ms. The currently measured 3-second failure must therefore make the strict CI step fail; it is not softened into a green report-only check. The two actual independent enforce-mode runs also returned nonzero as required.
- Full remote CI execution remains **NOT_RUN** in this review. Final source allowlist/build checks and the other feature reviews are still required before any release.

## Reviewed fingerprints

| File | SHA-256 |
| --- | --- |
| `scripts/check_web_performance.mjs` | `1138ed66db682cea992a88277e77d837db0accd44be6bc1f37b76c5981536c6a` |
| `browser-spike/rule-worker.mjs` | `9a46450d95c43e9d3881466945e58376b36f09920a5c23208ae058f9240a1e5b` |
| `apps/web/src/useLivingRoom.ts` | `59edda282d2c0b77cdba12ae31d0559db229943b20d1e4c8f077fc6a6d27b8eb` |
| `.github/workflows/reference-checks.yml` | `a8af73b12173dd1f69a7b857df3153795319dfe62b478ee7505a5682a91f559f` |
| `scripts/check_web_recovery.mjs` | `76270fe9a8c91faf8f8e6fccbe75b67eaeca3c90fc8cbec29b1e9a046aa74199` |

Further startup experiments, if adopted, need their own regression and performance evidence. This scoped approval does not close the failed first-editable budget or any real-asset/public-hosting task.

## Isolated schema-deferral experiment — discard after paired comparison

The author prepared `/workspace/homesafe-defer-experiment`, adding only `defer_build=True` to the shared Pydantic `Model` configuration. This reviewer independently reran **321 native tests (2.71 seconds): PASS**, and the canonical contract check: **PASS (3 files)**. Direct comparison confirmed byte-identical generated contracts, an unchanged production model source, identical ZIP member sets with only `homesafe_core/models.py` changed, and identical remaining application/runtime distribution files. This is an isolated experiment, not a production change.

The author's first complete browser run recorded cold first-editable p95 **3,634.6 ms**, ten accepted edits, cold-rule p95 **3,634.5 ms**, and hot-evaluation p95 **13.3 ms**. Enforce mode still failed the unchanged 3-second target. Native separate-process diagnostics showed median import plus first evaluation increasing from **106.3 ms to 118.1 ms**; the browser post-Worker interval also increased to **110.6–169.0 ms**. These support a first-use cost shift, but native timings cannot decide browser performance.

The lower browser result was potentially useful despite failing the target; target failure alone is not a reason to reject a safe incremental improvement. No specific correctness or maintenance defect was identified in the one-flag change. Equally, a single non-interleaved run does not establish a reproducible benefit. The reviewer therefore recommended one bounded, predeclared alternating AB/BA comparison of five fresh-context pairs using the unchanged real first-editable criterion, with every edit confirmed and no competing browser work. Before running it, the root specified a benefit gate of at least **4/5 improving pairs and at least 100 ms median paired savings**. The 3-second objective remained a separate unchanged gate.

The reviewer compared the experiment harness with the production probe and confirmed that both the injected measurement callback and the actual move/hash confirmation block were byte-for-byte identical. The experiment additionally checked served distribution/core hashes, the actual UI Worker's core hash, and identical initial/edited input hashes in each pair. It used one Chromium, ten serial fresh contexts, fixed **AB/BA/AB/BA/AB** order, and wrote each sample to a non-overwriting checkpoint file. There were no cached reloads or separate hot-engine probes in this paired comparison.

The initial launch failed before creating a browser, result file, or sample because its Node `fetch` preflight incorrectly called the boolean `Response.ok` as a function. The author corrected the two Node preflight calls; Puppeteer's distinct `response.ok()` calls remained unchanged. The reviewer then ran the sole actual sampling round to completion. No sampled run was discarded or repeated.

| Pair | Order | Baseline editable ms | Deferred editable ms | Saving ms |
| --- | --- | ---: | ---: | ---: |
| 1 | AB | 3,817.6 | 3,659.2 | 158.4 |
| 2 | BA | 3,688.3 | 3,726.1 | -37.8 |
| 3 | AB | 3,853.3 | 3,719.2 | 134.1 |
| 4 | BA | 3,615.7 | 3,772.4 | -156.7 |
| 5 | AB | 3,743.2 | 3,965.1 | -221.9 |

All **10 actual edits** passed, with matching initial/edited hashes for each pair. Only **2/5 pairs improved** and median paired savings were **-37.8 ms**, failing both predeclared benefit requirements. Baseline p95 was **3,853.3 ms**, deferred p95 **3,965.1 ms**. The deferred post-Worker interval was **160.9–183.8 ms** against baseline **69.8–83.3 ms**, again consistent with cost shifting. These are bounded observations, not a statistical population estimate.

**Independent decision: DISCARD the experiment; do not promote `defer_build=True`.** This decision follows the failed reproducibility/benefit gate, not merely failure to reach 3 seconds. Production remains unchanged by this experiment, and the first-editable objective remains open. The paired command's exit 0 means experiment execution completed; it does not mean a latency budget passed. No further tuning/repetition was performed after this decision.

Evidence: [paired raw results](review-performance-defer-paired-20261104.json), [exact experiment harness](review-performance-defer-paired-20261104.mjs), [author's first complete run](review-performance-defer-first-run-20261104.json), [native timing diagnostic](review-performance-defer-native-20261104.json). Harness SHA-256: `ef59e00490461154f5f22b24143f795e079c97da4ac46f1d3c3d214c957117d8`. The harness records original absolute experimental paths; it is preserved as review evidence, not installed as a production/CI probe.

### Archived experiment provenance

The [author's final receipt](PERFORMANCE_DEFER_EXPERIMENT_20261104.md), [source/core/distribution provenance](performance-defer-provenance-20261104.json), and [probe/fragment fingerprints](performance-defer-paired-source-fingerprint-20261104.json) are archived without candidate vendor files or binaries. Production model SHA-256 remained `551b87a607e5319c7dc203cc4ff55a0ed21e3cb1ab062bc319adbd8e51f09cd3` after the experiment; it contains no `defer_build` setting.

For a future separately authorized reproduction, the archived harness expects adjacent basenames `experiment-provenance.json` and `paired-source-fingerprint.json`; these map respectively to `performance-defer-provenance-20261104.json` and `performance-defer-paired-source-fingerprint-20261104.json` here. Its original basename was `paired-performance.mjs`; the raw result basename was `paired-performance-result.json`. The harness also reads the production probe at absolute `/workspace/HomeSafe-AI-continuation/scripts/check_web_performance.mjs` and verifies the exact source fingerprint and served manifest hashes. Reproduction therefore requires reconstructing the corresponding source/distributions in an isolated environment and restoring those paths/basenames, or explicitly documenting an adapted harness. The copied evidence alone is not a self-contained runnable distribution. The temporary 4182 server and measurement browser were stopped. No further measurement is requested by this archive note.
