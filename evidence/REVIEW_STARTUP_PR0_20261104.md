# Independent review: PR-0 fixed-source CI and handoff synchronization

Reviewer: `/root/review_delivery`, independent of the PR-0 author. Date: 2026-11-04 UTC. Workspace: `/workspace/HomeSafe-AI-startup`, branch `codex/startup-profile-20261104`, HEAD/base `64e166540495126f618dd65aa8dc88760ed70604`.

**Decision: PASS for PR-0 documentation and evidence synchronization.** This approval closes only the state-synchronization subtask after the owner records it. It does not approve PR-1/PR-2/PR-3/PR-4 implementation, establish a new remote CI result, close the first-editable performance objective, or approve asset publication/deployment.

## Scope and findings

Reviewed the changes to `START_HERE.md`, `evidence/HANDOFF.md`, `evidence/task-status.json`, plus the new `CI_PUSH_64e1665_20261104.md`, `ci-push-64e1665.json`, `ci-performance-64e1665.json` and `startup-adjustment-attachment-receipt-20261104.json`. Read the full user-supplied adjustment plan and execution prompt, the repository instructions and current architecture/delivery references. PR-4 workflow changes being authored concurrently are excluded.

No blocking findings remain. The new HANDOFF opening gives the current fixed-source state, while an exact comparison against HEAD confirms the preceding historical HANDOFF body is unchanged. Machine state retains historical provenance and identifies both the verified remote source and this phase's `NOT_RUN` remote status. T07 remains `IN_PROGRESS`; `T07-first-editable-budget` remains `OPEN_NOT_MET`. The START_HERE command explicitly uses `enforce` and correctly distinguishes the actual editable metric from first observation.

## Fixed-source CI evidence

The reviewed source is exactly `64e166540495126f618dd65aa8dc88760ed70604`, branch `codex/v6.1-browser-3d`, push run [41807603537](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41807603537), job `126498424922`, attempt 1. The reviewer previously independently queried the GitHub run, job-step and artifact metadata, checked the raw checkout SHA, re-extracted all 13 JSON objects from the raw job log, and recomputed percentiles. For this PR-0 review, the archived complete performance JSON is **byte-identical** to `/workspace/scratch/ci-64e1665-performance.json`; checks/performance/artifact fields match the earlier independent review, and all three recorded raw-evidence SHA-256 values match the retained files.

| Scope | Verified result for source 64e1665 |
| --- | --- |
| Native Python / app / JavaScript | PASS: 321 / 34 / 16 + 3 |
| Contracts / package / type / build | PASS: 3 contracts, 8 package checks, strict TS/Vue typecheck, 25 verified distribution files |
| Node WASM, procedural intake, local transport, browser spike/preview, experience, observations, recovery, controlled same-/cross-origin embedding | PASS in their recorded synthetic/local scopes |
| Cold first-editable p95 | **FAIL: 3386 ms > 3000 ms** |
| Cold rule-ready p95 | PASS: 3386 ms <= 12000 ms |
| Hot evaluation p95 | PASS: approximately 9.9 ms <= 150 ms |
| Overall run | **failure**; strict performance step returned 1 |
| Current startup-phase code remote CI | **NOT_RUN** |
| Real Lux3D browser / public hosting / other network / Edge / Safari | **NOT_RUN or explicitly blocked**, not established by this run |

Five cold samples, five cached samples and 30 hot samples after three warmups are correctly distinguished. All ten UI trials recorded accepted edits. The reported 4/5 cold samples above 3000 ms, median 3034.3 ms and nearest-rank p95 3386 ms agree with the complete object. The docs do not use cached readiness or canvas visibility to claim the failed cold gate passed, sum marginal phase percentiles, or infer a causal speedup across differing browser/environment versions.

Artifact `13310537586` was uploaded successfully, 9,414,266 bytes, with reported digest `b429004a7c3307a55776aa94536fbf9665be49a70fec6693bb3c6bce23162ee1` and expiry `2026-11-18T09:30:03Z`. The docs correctly state that the ZIP itself was not downloaded or independently inspected. This is upload/metadata verification, not a claim that the complete artifact has already been archived locally.

## Attachment evidence and external blockers

Independently inspected the complete Library `files/read` response retained at `/workspace/scratch/adjustment-library-read-response.json`: all four records have `has_more=false`, no continuation and no warnings. Reconstructed each content body as UTF-8 with exactly one final LF; the byte sizes match provider metadata and the receipt (18,825 / 3,952 / 266 / 1,772 bytes). All three file hashes listed in the supplied `CHECKSUMS.sha256` match exactly. The checksum-list file's own separately recorded hash also matches. No attachment body was truncated or replaced with a summary for this review.

The initial materialization failure and one bounded retry returning generic `download failed`, with no HTTP status reported, are **parent-session evidence**; no persisted raw transfer-failure receipt was independently inspected or replayed by this reviewer. The complete read bodies, size and digest checks are independently reproducible evidence. These levels must remain distinct.

The historical Lux3D download-proxy **403** concerns different binary attachments. The new text-attachment receipt correctly does not assign that status to its generic materialization failure. Existing GLB delivery/earlier Node geometry evidence is acknowledged; unavailable bytes in this environment do not imply the assets never existed. Actual GLB browser acceptance, publication rights and approved public hosting remain separate blockers. PR-0 uploads no private asset, account screenshot, full attachment package or full raw CI log.

## Verification and limits

- Exact archived performance bytes and raw-evidence digests: **PASS**.
- Checks, performance and artifact fields versus the prior independent CI audit: **PASS**.
- Full attachment bodies, provider sizes and supplied checksum list: **PASS**.
- Historical HANDOFF-body preservation and current machine-state assertions: **PASS**.
- `python scripts/validate_package.py` with the existing validation environment: **8 checks PASS**, including active Markdown links and generated contracts.
- `git diff --check`: **PASS** at review time.

No application implementation changes or new browser/performance runs were made by this review. The reviewer wrote only this evidence document in the new worktree; original and continuation worktrees were not edited. No commit, push, merge, archive upload or deployment was performed. Owner may mark PR-0 synchronization reviewed using this receipt; later feature and workflow modifications require their own independent reviews.

## Addendum: subsequent artifact materialization report

Reviewed the later author update to `CI_PUSH_64e1665_20261104.md` and `ci-push-64e1665.json`: the parent reports that the official GitHub connector returned a reusable artifact file ID, followed by Library materialization failing with generic `download failed`, exit 1 and no reported HTTP status. No bypass or additional retry is claimed. This transfer history is explicitly attributed to the parent session; the reviewer did not inspect a persisted raw transfer-failure receipt or replay the attempt.

The updated state correctly says local ZIP bytes **NOT_OBTAINED**, ZIP digest/content verification **NOT_RUN**, and full local artifact archive incomplete. The known uploaded-artifact ID, size and server-reported digest retain their earlier verified provenance. This update does not equate obtaining a file ID with obtaining bytes, infer a 403, or alter the source-64e1665 CI result. PR-0 scoped approval remains valid. The attachment receipt also now explicitly identifies its transfer-attempt history as parent-session evidence; independently verified text-body/checksum results are unchanged.
