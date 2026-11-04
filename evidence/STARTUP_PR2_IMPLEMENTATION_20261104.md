# PR-2 canonical runtime model split

Base: `64e166540495126f618dd65aa8dc88760ed70604`. Worktree: `/workspace/HomeSafe-AI-startup`. Implementation owner: `/root/challenge`. Date: 2026-11-04.

The model split passes functional validation and independent correctness review. Retention of this optimization depends on the parent's separate fixed paired performance experiment. This report does not close the three-second first-editable objective. No commits, pushes, deployments or private-model publication were performed in this scope.

## Implementation and compatibility

`reference/homesafe_core/models.py` now owns the 26 canonical classes required by browser evaluation, comparison, challenge and observation commands. The 20 offline classes moved without changing their class ASTs: six asset/publication types to `asset_models.py`, thirteen HTTP/API types to `api_models.py`, and the original aggregate to `contract_bundle.py`. The shared `Model` remains single-owned. Asset publication and contract generation import the explicit offline modules; the package initializer remains a docstring, without an eager or lazy compatibility barrel. No rules, strictness, provenance, defaults, fields, validators or TypeScript authority were changed. All runtime schemas are complete immediately after import; this is not deferred schema construction.

The browser archive retains its exact eleven-module allowlist. Offline module files are absent from the ZIP, and offline class definitions are absent from runtime `models.py`. `TransformInput` remains runtime-owned. Although named for challenges, `ChallengeGoal` is only needed by the offline aggregate; browser challenge logic uses existing dictionary goals, unchanged.

[Frozen source/AST/contract fingerprints](model-split-baseline-64e1665.json) record the original 46 classes and three generated contracts. New tests verify every class AST and helper/alias against those fingerprints, preserve shared class identity, and require byte-identical generated contracts. The independent reviewer separately compared against `git show 64e1665`, rather than relying on the supplied baseline metadata. Native tests' import sites were migrated without dropping their original assertions.

Preparation was isolated under `/workspace/scratch/startup-model-split-plan` until the traced baseline was frozen. The reviewer found the preparation generator initially omitted the new test file on regeneration. The generator now requires its test template, includes it in the eleven-path patch/migration list, and reproduces all eleven files byte-for-byte from the original input. Its source hash guard refuses to split an already-modified source. Independent regeneration passed before closure.

## Executed correctness checks

- Full native suite: **334 passed**. This includes five new model-split tests and existing asset publication, validation, challenge, observation and staging coverage.
- App suite: **36 passed**. JavaScript suites: **30 passed**. Frontend typecheck and strict standalone generated-contract TypeScript compilation: PASS.
- `scripts/generate_contracts.py --check`: PASS, all three contracts byte-identical. Package validation: 8/8 PASS. Full frontend build/staging and `git diff --check`: PASS.
- Native isolated ZIP-only subprocess: exact runtime class/module closure and all ten RPC operations PASS.
- Real Pyodide baseline and candidate: PASS, pinned Pyodide `314.0.6` and Pydantic `2.12.5`. Each starts with a fresh Python filesystem, unpacks only the supplied ZIP, checks archive/source hashes, and asserts every loaded package file originates inside that extraction directory before and after all commands. Baseline loads 46 eager classes; candidate loads 26 eager classes. No optional module loads at either boundary.
- Isolated Chromium `154.0.8037.57`: controller/Worker bridge, browser probe, full preview, observations, experience, recovery, startup trace, same/cross-origin embedding and local transport checks all PASS. Checks include legal and illegal challenge edits, simulated unknown/true/false observations, preserved observation baselines on undo/reset, report/snapshot provenance, actual WebGL context loss and explicit reconstruction, injected terminal Worker error, cancellation and retry, failed scene HTTP503 after Worker startup, and a procedural model download retry.

Raw implementation receipts are in [startup-pr2](startup-pr2/receipt-index.json), whose index preserves original scratch locations and SHA-256 hashes. Browser screenshots/PDFs remain under `/workspace/scratch/pr2-functionality/`. Browser checks ran sequentially and all processes, including the temporary iframe parent server, were closed before the parent's performance window.

## Repeatable real runtime closure

`scripts/check_runtime_bundle.mjs` runs the shared `scripts/runtime_bundle_commands.py` assertions inside actual Pyodide. The canonical source tree is never mounted into the interpreter. All three fixture assessments must match their checked-in expected JSON. Coverage includes all ten operations, tutorial and main challenges, challenge/observation isolation, true/false/unknown observation transitions, structured illegal placement, strict provenance rejection, deep JSON rejection and unknown commands.

CI now runs the runtime-only closure immediately after its existing controller check and official runtime vendoring/build, saving `ci-evidence/runtime-bundle-closure.json`. Other functional and strict performance gates remain in place.

```sh
node scripts/check_runtime_bundle.mjs browser-spike/vendor/pyodide \
  browser-spike/python/homesafe_core.zip browser-spike/python/manifest.json \
  runtime-only ci-evidence/runtime-bundle-closure.json
```

The explicit `baseline` mode checks all 46 original classes against an immutable pre-split ZIP. The owner runs used these archive hashes:

- A, traced baseline: `ee006f87a81fff99e3447ed7e1aa8438d125332beed617d2694a5f711dfcaa2d`.
- B, runtime-only candidate: `9292ae7a2ec4a2e91cf90640dbf318ecafa0a25bc2698875c311e5d6a1540be8`.

## First-use diagnostics and limits

The closure harness times first calls before exercising repeated fixture/test operations. One initial `evaluate` precedes the first challenge; explicit `challenge_end` precedes observation commands. Each receipt records the full prior-call sequence. Measurements cover Python dispatch plus JSON, not browser rendering, transport or user-perceived latency.

| Single diagnostic call, ms | Baseline A | Candidate B |
| --- | ---: | ---: |
| Canonical import | 552.04 | 487.25 |
| Initial evaluate | 24.34 | 28.80 |
| First challenge start | 19.36 | 28.58 |
| First challenge move | 7.70 | 8.87 |
| First observation options | 3.91 | 4.10 |
| First observation edit | 19.05 | 18.27 |

These are one sample per condition, not adoption evidence. In particular the candidate's first challenge was slower in this sample; no claim of unchanged first-use latency is justified. Immediate eager schema completion demonstrates that model construction was not shifted onto first use, but cannot by itself establish latency non-regression. The parent owns the fixed AB/BA/AB/BA/AB comparison, its minimum four-of-five and 100 ms median requirements, and the separate unchanged strict 3000/12000/150 ms gate.

The dedicated two-asset private procedural intake harness was **NOT_RUN again for PR-2**; native asset/publication tests and staging passed, and the experience harness's procedural download/retry case passed. Real Lux3D browser behavior, public HTTPS, another network, Edge and Safari remain **NOT_RUN**. Local transport verification does not establish public-host availability. Source-only CI wiring is not a claim of a fresh remote CI run.

## Independent review

`/root/review_challenge` independently verified class AST preservation, all three exact contracts, preparation reproducibility and the closure harness. After the implementation browser window closed, it independently reran the five native split tests and both baseline/candidate actual Pyodide closures: PASS, with all 46/26 eager classes and all ten RPCs verified. No correctness blocker remained. Its own receipts are `/workspace/scratch/review-pr2-baseline-runtime-closure.json` and `/workspace/scratch/review-pr2-candidate-runtime-closure.json`; its scoped review document records the final finding. Performance adoption remains a separate decision.
