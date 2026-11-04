# Independent review: dependency notices and delivery preparation

Reviewer: `review_delivery` (independent of implementation agent `delivery`). Date: 2026-11-04 UTC. Baseline: `57faf384d64e9770407b28086fdfeb5b193a6d6f`, branch `codex/v6.1-browser-3d`; reviewed the uncommitted working-tree changes. No implementation edits, remote writes, deployment, registration, contact, or terms acceptance performed.

Decision: **PASS for notice collection/staging tooling and preparation-only drafts**. No blocking defects found in this scope. This does not complete T04 licensing/public deployment, T09 freeze, T10 final report/video, or T11–T14 execution.

## Scope and independent verification

- Read `AGENTS.md`, continuation requirements and actual implementation. Inspected `scripts/dependency_notices.py`, its staging integration, tests, upstream license sources, `licenses/README.md`, all four `submission/drafts/` files, and `T04_DELIVERY_PREPARATION_20261104.md`.
- Independently ran `/workspace/homesafe-venv/bin/python -m pytest reference/tests/test_dependency_notices.py reference/tests/test_web_staging.py -q`: **11 passed** under Python 3.13.5.
- Fetched both exact pinned upstream source URLs from `licenses/upstream/sources.json` independently. Pyodide LICENSE: 16,725 bytes, SHA-256 `1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5`; CPython LICENSE: 13,804 bytes, SHA-256 `b0e25a78cffb43f4d92de8b61ccfa1f1f98ecbc22330b54b5251e7b6ba010231`. Both matched local stored bytes and declared hashes exactly.
- Recomputed notices from actual installed npm packages and the official vendored WASM wheels. **32 records = 25 conservative npm production-closure records + 5 distributed wheel records + 2 upstream licenses**. Combined notice text: **87,712 bytes**. No substituted native Python wheel was used.
- Independently compared both generated files with `apps/web/dist/THIRD_PARTY_NOTICES.txt` and `dependency-notices.json`: exact equality. Ran `scripts/stage_web_preview.py --verify-dist`: **PASS**, 25 files in that build. Subsequent build changes require the normal final verification again.
- Additional independent temporary-fixture counterexamples: missing wheel notice, whitespace-only npm notice, and symlink npm notice all rejected with explicit errors. Fixtures stayed in a temporary directory; no production source or dependency was modified.
- Ran `scripts/check_submission.py`: correctly **BLOCKED, exit 2** for missing valid source commit, owner/product acceptance, report/video/final scene, actual feature-to-Lux3D mapping, public URL and browser/anonymous evidence. The drafts were not inserted as fabricated final descriptors.

## Documentation and external boundaries

The drafts distinguish historical evidence, current development and final submission. They do not claim a public website, actual frozen release, final video/PDF, user trial, participant results, account/registration receipt or scheduled monitoring. The release runbook includes anonymous/subpath/iframe/Worker/WASM checks, another-network/device checks, explicit rollback, G0–G4 gating and maintenance beyond the unknown results date. T08 is deferred rather than completed.

Independent web reads of [China-site event page](https://www.aholo3d.cn/hackathon) and [international event page](https://www.aholo.ai/hackathon) returned page titles but zero readable body lines. These reads cannot verify present deadlines or account-specific forms. The implementation agent's separate account-page timeout remains its recorded observation, not an independent account verification by this reviewer.

The notice inventory explicitly leaves upstream static WASM/compiler/Rust transitive licensing audit open. Project source licensing and China-site Lux3D GLB redistribution rights remain separate and unresolved. Public assets remain empty. The tooling is a traceable notice inventory, not a complete legal clearance or publication authorization.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `scripts/dependency_notices.py` | `257b5cd4cb440d470652f0d0cd3b84e628781148675a0db8d26c19f4bc96f588` |
| `licenses/README.md` | `f5a71c3101de69b6532f01b7d005b9d1b4c3b5f64a2dfcf54830496a32916dca` |
| `licenses/upstream/sources.json` | `be106d2cf98f4d8a5869049384275cbeb3e11048dc44af9f2886b0491ea06b4e` |
| `submission/drafts/recording-plan.md` | `440a361eb27aa5fedb5e72892dce1c8aebea63d8e4f409049f70727dc0492f1d` |
| `submission/drafts/release-runbook.md` | `9da7f7ebab15c4c03a31f3eabb1f7e44d8557bb197fa778122bdf73c5fdff059` |
| `submission/drafts/report-20261104.md` | `297c2ca84803438411c562ea2f9f5d954c513182ec61cab40fbd5cfb94bd4644` |
| `submission/drafts/social-post.md` | `63926046cecd3eb6f2282325ea4d661a8967c6fcb80347d7b39665cc6f09a2fd` |

Integration edits to `stage_web_preview.py` also include another agent's main-challenge scene staging. That behavior is outside this review and needs the challenge review plus final build checks. No browser rendering or final public deployment was independently executed in this review.

## Incremental review: expanded build dependencies and source export

The same independent reviewer re-reviewed the subsequent expansion on 2026-11-04. **PASS** for the expanded source-correlated notice inventory, fail-closed staging, restricted source-export classification and updated preparation drafts. This section supersedes the initial 32-notice scope and its outstanding build-dependency inventory work; it does not grant public-model rights or claim an exact linked-binary SBOM.

Independent checks performed after expansion:

- Ran `python -m pytest reference/tests/test_dependency_notices.py reference/tests/test_web_staging.py reference/tests/test_release_export.py -q` in the project Python 3.13 environment: **53 passed**.
- Read the pinned Pyodide Makefile environment, CPython build recipe, Setup.local and Emscripten port metadata. The documented Emscripten 5.0.3, Rust 1.93.0, library versions/commits and Cargo.lock correspond to those inputs. Registry coverage is **101 Cargo packages**, including dev/build/other-target entries, rather than a claim that all are linked into the WASM binary.
- Independently fetched **125 grouped public source URLs**, checked archive checksums and exact source-member bytes, and matched **197 stored license/build-evidence records**. This includes all 99 crate archives supplying embedded notices and the raw tagged-source fallbacks. Those requests fetched 8,546,325 bytes in total. The r-efi AUTHORS source includes its MIT grant and copyright attribution; it is not merely a list of names.
- Independently compared the Rust standard-library archive (22,732,144 bytes) with the official `.sha256`, then checked all three stored notice members byte-for-byte. Independently refetched the Rust compiler archive (78,066,200 bytes), compared its official `.sha256`, and checked its `COPYRIGHT-library.html` member exactly. No compiler was installed or executed. Together these checks cover all **201 stored upstream/build records = 195 notices + 6 build inputs**.
- Recomputed actual output: **225 notices = 195 upstream + 25 npm + 5 wheel**, **1,579,147 bytes** of combined text. HTML is parsed into text; no HTML/script is executed or inserted into the app UI. Source hashes continue to identify the retained original notice bytes.
- Independently compared both current dist outputs to regeneration and ran `scripts/stage_web_preview.py --verify-dist`: **PASS**, 25 distribution files. `THIRD_PARTY_NOTICES.txt` SHA-256 is `7a91d4e9eb0a87d78a77ff2e49f45049e746e1d8a108099e1a09216c0f912cc0`; `dependency-notices.json` is `ba73bd356625e169f961a8c3eb3ddeab11bb427471ff97dcf28167b0ff59e06d`.
- Inspected the `vendored_dependency_notice` exporter path separately from generated project source. Independent temporary counterexamples for a symlink registry, duplicate registry entry, unregistered notice, `.py` extension and invalid UTF-8 were all rejected. Existing sensitive-path and destination protections remain in place. The two generated public notice files are now precisely ignored, while reviewed upstream input texts are retained with their accurate provenance classification.

Two documentation clarifications were requested and verified: the recording plan now distinguishes the existing development recording from the absent final competition video, and the report names the exact performance evidence and nearest-rank percentile/sample semantics. The report's runtime claims are attributed to the separate challenge/UX/performance acceptance records; this reviewer did not independently rerun those browser flows. Neither preparation drafts nor source export are represented as final submission readiness.

Final reviewed fingerprints for changed scope:

| File | SHA-256 |
| --- | --- |
| `scripts/dependency_notices.py` | `6d371dbe69bd9799572d4e98e7241a5cd3e6f47d4e056f10670fa69b8b6f2961` |
| `scripts/export_sources.py` | `cafe9cd805743ceb5089303abd9016d9becd6fb7393a0ff03b052dbcad9bd070` |
| `licenses/README.md` | `60ca0ab7dc12ec484fbde2587a3571cdc0534bd995f0de3e2319d1ae0d7c4edf` |
| `licenses/upstream/sources.json` | `b8c105eaadb758e9f6c4c06a1b6a1848bc504023431379c9da83c426fcfc4b86` |
| `reference/tests/test_dependency_notices.py` | `55a5327e6ad8fda6cfe03bc557b866e1af3c2df968890fd37bab848adb9030e8` |
| `reference/tests/test_release_export.py` | `1df7c20ab4fe6cc8ccbd9e0e3c6c600a8d81e97aa40e00425a444860461d659e` |
| `submission/drafts/recording-plan.md` | `bf364e17a25461b9c0e90e4f0928a8febef1a03f0570de685232db6b67e1c24a` |
| `submission/drafts/release-runbook.md` | `3db1852b4903f031f2859280c3c28b5ba55b40802ab4967554c177aed8c82c4a` |
| `submission/drafts/report-20261104.md` | `8390616d0eae6909ab27cadc38976c601b799afc86ebc552ba17cd8ca4cf52c0` |

No unresolved blocking implementation finding remains in the reviewed scope. Final-release build/source variance and project/source/model permissions still require the release process; no public hosting, current account form, final PDF/video, submission receipt or future monitoring was created by this review. The parent must refresh and verify the final source allowlist/checksums after all evidence changes.

Final documentation-only follow-up: the report now cites `CONTINUATION_20261104.md` and matches `continuation-checks-20261104.json` (260 native / 27 app / 18 JS tests, 25-file build, 8 package checks), without adding the 53 scoped checks again. It replaces the earlier development clip description with the actual `development-recording-20261104.json` values (24.44 seconds, 6,894,533 bytes) and keeps the non-final/non-Lux3D/non-public boundaries. This attribution was independently compared to those evidence files; the reviewer did not rerun the parent's entire test suite or video session. Updated report SHA-256: `b5083ea786bcf4d0d78fe320889a3a8bbbc87761f754676ff92db29746dbc5b3`. Scoped review remains **PASS**.
