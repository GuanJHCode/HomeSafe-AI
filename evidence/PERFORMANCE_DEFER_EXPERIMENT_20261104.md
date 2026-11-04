# Isolated Pydantic defer_build experiment

Archive note: this is the author's final `/workspace/homesafe-defer-experiment/RESULT.md` receipt. Original basenames below refer to that experiment directory. Repository copies and reconstruction limits are mapped in the [independent review](REVIEW_PERFORMANCE_CI_CONTINUATION_20261104.md#archived-experiment-provenance).

Final independent decision: **discard this experiment; do not promote**. The fixed five-pair AB/BA comparison failed the predeclared benefit gate (at least four improving pairs and median saving at least 100 ms): only two pairs improved and the paired median saving was −37.8 ms. This is the decision basis; the separate 3,000 ms first-editable target also remains unmet. Production source and production distribution were not changed.

The sole source difference is `defer_build=True` added to the shared canonical `Model` ConfigDict. All 321 native tests passed; canonical contract generation check passed and the three generated files remained byte-identical. The experimental distribution changes only the Python core ZIP and its manifest, plus regenerated distribution hashes. All 23 other distribution files, including the official runtime and application JavaScript, were byte-identical to the production distribution. Inside the ZIP only `homesafe_core/models.py` differs.

One instrumented Chromium 154 localhost run used the current production performance harness in enforce mode: five fresh contexts, five paired reloads, ten real accepted moves, and thirty hot Worker evaluations following three warmups. The browser closed successfully; enforce mode returned exit code 1 because the first-editable target failed. No other browser task ran concurrently by coordination with the root agent.

| Measurement | nearest-rank p95 |
| --- | ---: |
| Cold first editable | 3,634.6 ms — FAIL |
| Cached first editable | 3,571.3 ms |
| Cold rules ready | 3,634.5 ms — PASS ≤12,000 |
| Hot evaluation, n=30 | 13.3 ms — PASS ≤150 |
| Actual UI Worker initialization | 3,037.1 ms |
| Worker initialization received → editable | 169.0 ms |

A separate native Python diagnostic alternated five baseline and five experimental fresh processes. Median import decreased from 104.2 to 89.5 ms, but first evaluation increased from 2.1 to 27.2 ms; median combined import plus first evaluation increased from 106.3 to 118.1 ms. These native results are diagnostic and cannot substitute for browser timings. They are consistent with moving schema construction onto first evaluation instead of removing the work.

The initial browser experiment below was diagnostic and did not itself establish improvement or a final adoption decision. The root baseline reported a shorter post-init UI interval (~90–110 ms), while this run observed 110.6–169 ms. The first-editable target remains unmet. Deferring schemas also leaves later first-use costs outside this small performance sample, so native correctness alone is insufficient reason to adopt it.

Evidence: `native-tests.log`, `contract-check.log`, `native-import-experiment.json`, `browser-performance.json` (stderr empty), and `experiment-provenance.json` with source/bundle/probe/receipt digests. The temporary loopback server on 4182 was stopped after measurement. No public hosting, actual Lux3D assets, other network, Edge, or Safari was tested. Independent reviewer conclusion is recorded separately by review_delivery.


## Final fixed paired comparison — independently executed

The independent reviewer inspected and executed `paired-performance.mjs` once, using the exact production `evaluateOnNewDocument` instrumentation and exact actual-move/hash validation block. Five pairs were fixed in advance as AB/BA/AB/BA/AB (A=baseline, B=deferred). A single Chromium ran ten sequential fresh contexts without warm reloads or a second hot-evaluation Worker. All ten real moves completed; initial and accepted-edit hashes matched within every pair, and each UI Worker reported the expected core bundle hash. No concurrent browser or CPU-heavy work was performed by the coordinating agents.

| Pair | Order | Baseline editable ms | Deferred editable ms | Saving ms |
| --- | --- | ---: | ---: | ---: |
| 1 | AB | 3817.6 | 3659.2 | +158.4 |
| 2 | BA | 3688.3 | 3726.1 | −37.8 |
| 3 | AB | 3853.3 | 3719.2 | +134.1 |
| 4 | BA | 3615.7 | 3772.4 | −156.7 |
| 5 | AB | 3743.2 | 3965.1 | −221.9 |

Baseline nearest-rank first-editable p50/p95: 3743.2/3853.3 ms. Deferred p50/p95: 3726.1/3965.1 ms. Paired median saving: −37.8 ms. The small difference between unpaired marginal medians does not override the fixed paired decision. Worker-received → editable median increased from 75.1 to 171.1 ms. No production adoption is warranted under the agreed rule; no 3-second success is claimed.

Before any browser launch or result-file creation, a Node-fetch `.ok()` preflight API error was corrected to the boolean `.ok` property at two sites. That failed preflight produced zero performance samples. The subsequent measurement is the single final run; no samples were discarded or rerun. The harness refuses to overwrite an existing output file.

Final evidence: `paired-performance-result.json` (all ten raw samples, core metadata, hashes, created/init/editable/confirmed times, planned sequence and paired differences), `paired-performance.mjs`, and `paired-source-fingerprint.json`. Independent review confirmed native 321 tests, unchanged contracts and identical non-core distribution files separately. Chromium closed and the temporary 4182 server was stopped after the final comparison. Localhost/software-renderer/cache limits remain as recorded in the raw receipt.
