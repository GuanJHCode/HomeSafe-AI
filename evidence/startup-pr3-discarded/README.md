# PR-3 discarded experiment archive

**DISCARDED — this implementation is not active.** The registered fixed five-pair comparison produced only **3/5 improving pairs** and median savings **43.9 ms**, below the required 4/5 and 100 ms. Baseline/candidate editable p95 was **3946.1/4311.6 ms**, both above the unchanged 3000 ms gate. Functional correctness passed; the performance adoption condition did not. The active application was restored to the previously adopted PR-2 implementation.

The original experiment was retained without replacing samples or relaxing a threshold. [Raw measurement](measurement/pr3-optimization-result.json), [registration](measurement/pr3-optimization-registration.json), [frozen harness](measurement/paired-startup.mjs) and its frozen helper directory preserve the experiment. Their localhost paths are historical identifiers: `/candidate/` now serves restored PR-2, so these files are evidence, not a command to rerun the discarded candidate against the present URL.

## Recoverable implementation

- [candidate.patch](candidate.patch) contains the complete **final** seven-file change, including the shared-abort finalizer and explicit document-reload fixes discovered after pre-apply review. It is not the earlier scratch patch.
- `candidate-source/` stores all seven final implementation/test files. `baseline-source/` stores the three original files that the experiment replaced; the other four did not exist in the baseline.
- [archive receipt](archive-receipt.json) binds original/candidate file hashes, the patch, frozen candidate distribution manifest and raw result. Applying the patch to a separate copy of baseline source was verified to reproduce all seven candidate hashes exactly.
- `integration-source/` stores the experimental browser harness and its former CI/experience integration. [integration.patch](integration.patch) records those changes separately, including the experimental probe addition. The active `scripts/` directory and CI no longer run this discarded probe.
- `prior-evidence/` preserves the original review, unit/functional/browser receipts, true failure counterexamples, native BFCache evidence, and frozen source/distribution provenance. Their PASS results concern historical functional correctness; they do not override the discarded performance decision.

This archive does not include runtime/vendor binaries or private assets. Reconstructing the experiment requires the matching adopted PR-2 source/runtime baseline and the verified dependency/vendor setup described by its provenance. Keep any reconstruction isolated from the active application. The archive contains no automatic restore or execution hooks.

## Verified withdrawal

Only the three changed application files were restored; the four new experiment files and active experimental browser probe were removed. The single PR-3 CI command/assertion was removed and the original experience selector restored. PR-1 instrumentation, PR-2 canonical models and all unrelated work were preserved. The rebuilt active distribution's **28 paths and file hashes match the frozen PR-2 distribution exactly**. App 36 tests, workflow 8 tests, type checking and production build pass. See [rollback verification](../startup-pr3-rollback-verification-20261104.json).

The final original enforce run belongs to the restored PR-2 application. The 3-second target remains open; PR-3 is not retained as an active optimization.
