# Independent review: startup comparison harness and PR-1 overhead evidence

Reviewer: `/root/review_delivery`, independent of the harness author and experiment operator. Date: 2026-11-04 UTC. Product base: `64e166540495126f618dd65aa8dc88760ed70604`; review workspace `/workspace/HomeSafe-AI-startup`.

**Decision: PASS for the fixed experiment harness, PR-1 instrumentation-overhead disclosure, and PR-2's paired optimization signal; DISCARD the PR-3 light-entry candidate after its failed predeclared benefit gate.** The overhead experiment does not establish a startup optimization or zero instrumentation cost. PR-2 independently meets the engineering benefit rule relative to the traced baseline; PR-3 does not meet that rule relative to adopted PR-2. The first-editable 3-second target remains **OPEN_NOT_MET**. The experiments were operated by the parent; this reviewer performed offline verification only.

## Harness and frozen registration

The author prepared an experiment-only harness in `/workspace/scratch/startup-benchmark`. Before any timing run, the reviewer inspected the complete implementation, independently ran **9 pure tests: PASS**, and ran `--validate overhead-registration.json`: **PASS, no network/browser/result created**. The measured DOM readiness callback and real move/hash validation block are byte-for-byte copies of the frozen production probe. Required readiness remains a rendered canvas, accepted report, idle evaluation and enabled chair movement; each trial must actually move and obtain a different accepted input hash. Trace `edit_eligible` does not replace that metric.

Chronology clarification: the reviewer communicated permission to proceed to the parent via `collaboration.send_message` before serializing the pre-run audit file: “运行前独立结论：无阻断，可执行已冻结 overhead-registration.json 的唯一正式轮。” The receipt's `reviewed_at=2026-11-04T10:29:26.760975+00:00` is its later write/finalization timestamp, after the operator's recorded 10:29:12 start; it must not be read as the approval-message time. That historical field is preserved unchanged. The conversation contains the approval and the subsequent file write, but no independently exported machine timestamp for the approval message is asserted here.

The registration fixes five pairs in **AB/BA/AB/BA/AB** order, ten sequential fresh contexts in one exact-version Chromium, one viewport, runtime versions, source/lock inventories, distribution/core hashes and frozen helper/harness digests. The source inventory has explicit scope: A is the complete git tree of source 64e1665; B is the traced browser-runtime inputs and frozen Python ZIP, not the entire active tool/PR-2 tree. Actual served manifests, core identity and UI Worker runtime versions are checked during execution. The reviewer also checked registered cgroup settings against the local environment before the run.

Exclusive registration claim/result creation prevents accidental same-registration replay or overwrite in the original experiment directory. All fixed attempts, including failures, are retained without replacement; failed comparisons cannot emit success-only percentiles or adoption eligibility. Raw measurement/trace data is checkpointed before trace analysis. Browser-cleanup failure invalidates eligibility. The two review suggestions—explicit actual runtime-version assertions and cleanup-failure decision invalidation—were implemented and covered before freezing.

`instrumentation_overhead` reports B−A only, with optimization gate **NOT_APPLICABLE**. The separate `optimization` purpose requires at least 4/5 improving pairs and median A−B saving >=100 ms, and yields only eligibility for independent adoption review. It does not override the 3000/12000/150 ms budgets. This paired harness does not run the hot budget; final full enforce remains required.

## Actual PR-1 overhead round and independent recalculation

The parent ran the predeclared overhead round once, 2026-11-04 **10:29:12–10:29:55 UTC**. A is bare source64e1665; B is source64e1665 plus PR-1 instrumentation with the **same canonical core hash**. Both receive the same frozen external measurement instrumentation. Chrome **154.0.8037.57**, cloud Linux AMD EPYC 9V74, localhost/no throttling, requested SwiftShader, viewport 1280×1000; cgroup CPU `400000 100000`, memory `17179869184`. Fresh contexts isolate browser cache, not OS cache or all shared process state.

The reviewer independently recalculated all raw sample counts, fixed order, pair hash identity, accepted edits, runtime/core identity, phase analysis and nearest-rank summaries. All **10 attempts PASS** and all five pairs share identical initial/edited canonical input hashes. Each B trace has the required phase/lifecycle events and matching Window/Worker generation, runtime/core/input identity. Re-running the frozen analyzer reproduces every stored analysis exactly; explicit `timeOrigin + now` epochs, interval unions for overlap, and monotonic UI construction→init→editable→confirmed times pass. Phase residuals are not relabeled as compile/import/network costs.

| Pair | Order | A first editable ms | B first editable ms | B−A ms |
| --- | --- | ---: | ---: | ---: |
| 1 | AB | 3840.3 | 3713.9 | -126.4 |
| 2 | BA | 4338.9 | 3488.0 | -850.9 |
| 3 | AB | 4246.3 | 3848.6 | -397.7 |
| 4 | BA | 3667.2 | 3884.7 | +217.5 |
| 5 | AB | 4178.9 | 3900.0 | -278.9 |

Observed paired B−A median is **-278.9 ms**, range **-850.9 to +217.5 ms**. These five pairs show substantial variation. A negative median is **not evidence that tracing accelerates startup and not proof of zero overhead**; the experiment reports the bounded observations without a population-significance or causal speedup claim. It does not use the optimization adoption gate.

A first-editable p95 is **4338.9 ms**, B **3900.0 ms**: both fail 3000 ms. Cold-rule p95 values **4338.9 / 3899.9 ms** pass 12000 ms. Hot evaluation is **NOT_RUN** in this paired experiment. The command's completed status means all planned measurements finished, not that the latency target passed.

## Distribution and source provenance audit

The result embeds the exact preregistration and frozen helper fingerprints. The reviewer verified their hashes and all source-inventory digests, then independently checked every listed file's size and SHA-256 in the retained A (25 listed files) and B (26 listed files) distributions, both core ZIPs and core manifests. The retained B distribution receipt matches its recorded digest. A's source inventory exactly matches `git ls-tree -r --full-tree 64e1665`; B's canonical module hashes match members of its frozen ZIP. The registered app lock matches the fixed-source lock. Both actual UI Workers used Pyodide 314.0.6 and Pydantic 2.12.5.

Key fingerprints:

- Overhead registration: `3882ed851fe46796ae806bf4f2ab8b94cc6653cab024c664b2f989aaf0008f02`.
- Harness: `dd4992e09ad258c1f5a0f5f373656e6146c3c94d5a516355aef7831756bf1353`.
- Raw overhead receipt: `6709bc9fca868265853a0b1dd4a623034a738833ec8cda1293ae737beb1888da`.
- Frozen trace analyzer: `3601bc320f999f433c871e9e5cfe27d9350eee6b5ff716b89b443ce65183952b`.

## PR-2 preregistration review — completed before its separate run

[Optimization registration](startup-benchmark/optimization-registration.json), SHA-256 `d8cdd8ed45153fa85e0bb435d48f01dc45f40594936021c6114332b3866f3fb8`, explicitly compares **traced64e1665 + PR-1** against the same instrumented application with the canonical model split. Its A is not bare64e1665; the document does not conflate this comparison with the separate overhead experiment. Both treatments require complete traces and use the same frozen harness, runtime, browser version, app lock and fixed five-pair decision rule.

Independent offline distribution comparison found identical file sets (28 files including generated manifests/checksums); only core ZIP, core manifest and their two derived distribution checksum/manifest files differ. All other 24 files are byte-identical. Both distributions' listed bytes/digests match the registered manifests and core hashes. Scoped source inventories differ only in `frozen_core_zip/homesafe_core/models.py`; frozen ZIP module hashes match those inventories. `--validate optimization-registration.json` independently passed without network/browser activity or creating a run claim.

The preregistration review decision was **PASS for design and frozen-input comparability only**, with separate independent Python/Pyodide/browser correctness acceptance and an exclusive timing window required before execution. That review alone asserted no model-split benefit. The parent subsequently confirmed those preconditions and executed the registered round below. Any changed candidate or registration requires explicit new provenance review before measurement.

## PR-2 actual fixed comparison — independent offline result review

The parent executed the fixed optimization round at **10:34:57–10:35:41 UTC**, using the unchanged reviewed registration/harness. The reviewer started no browser, tests or concurrent measurement. The [complete raw result](startup-benchmark/optimization-result.json) and [independent numerical/trace audit](startup-benchmark/independent-optimization-result-review.json) retain all ten attempts. No attempt was replaced or omitted; every actual edit and pair initial/edited input hash matched.

| Pair | Order | Traced baseline A ms | Split candidate B ms | A−B saving ms |
| --- | --- | ---: | ---: | ---: |
| 1 | AB | 4163.5 | 3660.3 | 503.2 |
| 2 | BA | 4125.8 | 3667.5 | 458.3 |
| 3 | AB | 3983.9 | 3649.5 | 334.4 |
| 4 | BA | 4144.9 | 3877.9 | 267.0 |
| 5 | AB | 3952.4 | 3690.6 | 261.8 |

Independent recomputation confirms **5/5 improving pairs** and median paired savings **334.4 ms**, satisfying the predeclared minimum 4/5 and >=100 ms rule. This is an engineering adoption signal relative to the **traced** baseline, not a claim of population significance or a direct comparison with bare64e1665. The final code-adoption decision belongs with the assigned independent PR-2 correctness review.

The reviewer independently checked the unchanged registration, helper and harness hashes; exact ten-sample schedule; actual UI core/runtime/environment identities; all raw p50/p95 and pair differences; accepted initial/edited hashes; required trace phases, lifecycle events and generation; each thread's epochs and stage durations; UI timestamp ordering; and parallel-span interval unions and residuals. All checks passed. The original archived overhead inputs/results were not changed.

The paired candidate first-editable p95 is **3877.9 ms**, still **FAIL >3000 ms**; baseline p95 is 4163.5 ms. Cold-rule p95 values are 4163.5 / 3877.8 ms, both below 12000 ms. This paired harness still does not run the hot gate. Separately, the parent's [PR-2 adoption-stage full enforce receipt](startup-pr2-enforce-performance-20261104.json), reviewed within the assigned PR-2 acceptance work, reports first-editable **3858.5 ms (FAIL)** and hot-evaluation **12.5 ms (PASS)**, with ten cold/cached UI samples and thirty hot evaluations. This is historical stage evidence, not the final post-rollback enforce recorded below. Its targets remain first-editable false, cold-rules true and hot-evaluation true; no threshold was relaxed.

Raw optimization-result SHA-256: `a8604f03a5a1070407575cf08dbe5c7b4f801bfbf43385d8a7212eba79205364`. Registration SHA remains `d8cdd8ed45153fa85e0bb435d48f01dc45f40594936021c6114332b3866f3fb8`; the same frozen harness/helper fingerprints apply.

## PR-3 final preregistration — pre-run review record

After the parent confirmed separate independent correctness acceptance and final distribution freeze, the reviewer checked [PR-3 registration](startup-benchmark/pr3-optimization-registration.json), SHA-256 `5e9cef303ea32e5dcf21095bdd02486a571455183950b41cab3580e2a2df3c96`, and [candidate source inventory](startup-benchmark/PR3-candidate-source-runtime-inventory.json), SHA-256 `4b0d88cd4d3e43ef5f329bdd24ccbc050e89be2f3b6feece0b5375900d6e29a7`.

A is the preserved adopted PR-2 distribution at `/pr2-baseline/`, manifest `3ee69e5e576a0f9a54efdb1fb050c88354b814a4a212f0a1df4dc000f2fdb9f4`; B is the frozen light-entry candidate at `/candidate/`, manifest `c7a4096f70b5ef0ff2023575f82214d24d77806ca3e606228657b4d201c30ff9`. Both have canonical core `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8`. A was not reconstructed from the active PR-3 frontend.

Independent offline verification matched all 11 source files and 29 distribution files in [the freeze receipt](startup-pr3-frozen-fingerprints-20261104.json), all actual manifest-entry bytes, source inventory digests and frozen ZIP modules. Exactly six declared frontend paths differ from the preserved PR-2 source inventory; the seventh explicitly inventoried implementation/test path is its focused test. Distribution changes are the HTML entry, replacement of one monolithic app chunk with light-entry/mountApp chunks, and derived checksum/manifest files. Canonical ZIP/manifest, runtime/vendor, worker/controller/trace, configuration and lock bytes remain unchanged.

The same frozen harness/helper hashes, real DOM plus accepted move/hash measurement, two required traces, ten fresh attempts in AB/BA/AB/BA/AB order, 4/5 +100 ms benefit signal and independent 3000 ms target all remain unchanged. `--validate pr3-optimization-registration.json` independently passed without network/browser activity. The [pre-run receipt](startup-benchmark/independent-pr3-prereg-review.json) was written at **10:58:56 UTC before communicating permission to run**; no registration claim existed then. **PASS to execute this frozen comparison once in the parent's exclusive window** is the scope of this decision. No PR-3 timing benefit or adoption is implied; actual result review and final full enforce remain separate.

## PR-3 actual comparison — DISCARD, no repeat-to-green

The parent completed the sole registered PR-3 round at **10:59:36–11:00:17 UTC**. The [complete raw result](startup-benchmark/pr3-optimization-result.json) and [independent offline audit](startup-benchmark/independent-pr3-result-review.json) retain all ten fixed attempts. The reviewer checked their ordinal/pair/order/trace mode, ten accepted edits, initial and edited pair hashes, actual core/runtime/browser/environment, registration/helper/source digests and embedded frozen distribution fingerprints. Re-running the same frozen trace analyzer reproduced all ten stored results exactly, including required lifecycle events, identity and thread epochs; UI timestamps and all summary/pair statistics also matched.

| Pair | Order | Adopted PR-2 baseline A ms | PR-3 candidate B ms | A−B saving ms |
| --- | --- | ---: | ---: | ---: |
| 1 | AB | 3929.7 | 4311.6 | -381.9 |
| 2 | BA | 3822.1 | 3696.8 | 125.3 |
| 3 | AB | 3498.6 | 3569.1 | -70.5 |
| 4 | BA | 3510.7 | 3466.8 | 43.9 |
| 5 | AB | 3946.1 | 3666.3 | 279.8 |

Only **3/5 pairs improve** and paired median savings are **43.9 ms**. Both predeclared requirements—at least four improving pairs and median savings >=100 ms—fail. **Independent decision: DISCARD this PR-3 optimization.** Functional correctness acceptance does not establish a measurable startup benefit. No failed or slow sample is excluded and no extra paired round is requested to obtain a favorable result.

Baseline first-editable p95 is **3946.1 ms**, candidate **4311.6 ms**: both still fail 3000 ms. The paired cold-rule budgets pass, but **PR-3 hot evaluation is NOT_RUN** and the discarded candidate's extra full enforce is **NOT_RUN_DISCARDED**. PR-2's previous 12.5 ms hot result must not be attributed to this candidate. A final enforce after restoring frozen PR-2 belongs to that restored version and requires its own receipt; restoration correctness is separately checked by the owner/reviewer.

Raw PR-3-result SHA-256: `20479c43d8430cafb4e81dd45fec35216379b0410e187699725d0fcbc94e8904`; registration remains `5e9cef303ea32e5dcf21095bdd02486a571455183950b41cab3580e2a2df3c96`. Earlier registrations/results/code archives remain unchanged. The reviewer performed only lightweight offline checks, with no browser, test suite or new measurement.

## Final retained version after PR-3 rollback

The owner and assigned independent reviewer confirmed restoration of all **28 distribution files** to the adopted frozen PR-2 version. The [final enforce registration](startup-benchmark/final-retained-enforce-registration.json), [complete result](startup-benchmark/final-retained-enforce-performance.json) and [independent receipt audit](startup-benchmark/independent-final-retained-enforce-review.json) are archived separately from the discarded candidate and earlier PR-2 stage.

The one predeclared final retained-version enforce completed at **11:05:54 UTC** and failed its unchanged 3-second gate: cold samples **3913.5, 4086.1, 3784.6, 3843.3, 4049.8 ms**, p50 **3913.5 ms**, p95 **4086.1 ms**. Cold-rule p95 **4086.1 ms** passes 12000 ms; hot-evaluation p95 **12.6 ms** passes 150 ms (30 samples after three warmups). Ten actual edits and required traces passed the assigned independent audit. This is the final retained-version result; the earlier 3858.5/12.5 values remain historical and must not replace it. Neither local run is a new remote CI result or a measurement of the discarded PR-3 candidate.

The final result SHA-256 is `305dc1a7b4d0b01b75782b022465edfc212bda630a60d28406013bc50abafa63`; retained manifest `3ee69e5e576a0f9a54efdb1fb050c88354b814a4a212f0a1df4dc000f2fdb9f4` and core `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8` match the adopted PR-2 evidence. PR-2's bounded benefit remains supported only by its fixed five-pair comparison; no cross-run absolute-time subtraction is used to claim another gain.

## Evidence and closure boundary

Selected synthetic/local evidence is archived under [startup-benchmark](startup-benchmark/README.md): [raw overhead result](startup-benchmark/overhead-result.json), [registration](startup-benchmark/overhead-registration.json), [independent offline audit](startup-benchmark/independent-overhead-review.json), [harness](startup-benchmark/paired-startup.mjs), [pre-run audit](startup-benchmark/independent-pre-run-review.json), frozen measurement helpers/inventories, and the [PR-2 preregistration audit](startup-benchmark/independent-optimization-prereg-review.json). The archive excludes runtime binaries, private models, account material and unrelated scratch files.

This evidence supports closing PR-1's instrumentation-overhead **measurement/disclosure** subtask alongside its separate product/trace correctness review, and supports the PR-2 benefit/adoption decision alongside its separate correctness review. It does not close the 3-second target, full PR-4 stability acceptance, real-asset/public-hosting checks or final delivery. The reviewer performed offline validation and earlier pure registration/tests; no new browser run, commit, push or deployment.
