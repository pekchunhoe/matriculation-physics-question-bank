# QUESTION JSON IMPORT SYSTEM â€” PRODUCTION ROLLOUT

Updated: 2026-10-10. Release preparation record; source-control, hosted Preview and Production gates remain pending. This supersedes the prior zero-question assumption with the user's revised authorized baseline.

## REVISED PRODUCTION BASELINE

Questions before migration: **1**. Draft: **1**. Reviewing/approved/retired: **0/0/0**. Assets: **0**.
Existing draft preserved: **PASS**. Educational-content fingerprint preserved: **PASS**.

| Existing records | Before | After 004 |
| --- | ---: | ---: |
| Questions / draft | 1 / 1 | 1 / 1 |
| Parts | 4 | 4 |
| Schemes | 4 | 4 |
| Solution steps | 8 | 8 |
| Hints | 4 | 4 |
| Immutable versions | 1 | 1 |
| Classification snapshots | 1 | 1 |
| Search rows | 1 | 1 |
| Pending revisions | 0 | 0 |
| Tags / question tags | 0 / 0 | 0 / 0 |
| Assets | 0 | 0 |
| Curriculum events | 3 | 3 |

Stable identifiers, relationships, ordering, marks and complete content were compared internally. Raw educational content, credentials and private connection values are omitted from this report.

Complete draft educational-domain SHA-256, before and after:
`1382b932bf6cb45b5dd04d5c338874ec8aade86e03319d7269f71d9cb34596f8`.

Immutable document SHA-256: `1e0337ceb4d0a9d0180f38b6171ffe7a63dd820e6250f8503286eedddb4d2128`.
Classification snapshot SHA-256: `b86f46764899ff2646d187da6de696a9e2c9c00d0ddb182cb28cdb090a00da84`.
Whole existing domain SHA-256: `b60f62693218a1eae03e08988322a21b23e0c40137e12b3d4da6fb5dd4053d12`.

## TURSO ACCESS

Authenticated access: **PASS**. Database: `matriculation-physics-question-bank`; group: `default`; identity verified using the existing authenticated Ubuntu WSL CLI in the actual Windows user context. No login, account, credential rotation or environment change was performed. The migration used a one-day database-scoped credential held only in process memory; no token or connection URL was persisted.

## PRE-MIGRATION

Fresh private read-only audit: **PASS**, matching the previous private audit exactly. PHYSICS-2022-2023: **active**; LEGACY: **retired**. Active hierarchy: **2 semesters / 18 chapters / 82 topics / 0 subtopics**. Total semesters include two retired legacy records. Questions/draft/assets: **1/1/0**. Events: **3**. Migrations: **001/002/003**. Foreign keys: **PASS**. Integrity: **PASS**.

Pre-004 schema SHA-256: `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae`.
Pre-004 migration-history SHA-256: `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2`.

## BACKUP

Name: **`phys-pre-m004-20261010t100231z`**. Created: **PASS** using `db create --from-db matriculation-physics-question-bank --group default --wait`. Independently verified exact copy: **PASS**. Existing draft present: **PASS**. Draft fingerprint match: **PASS**. Complete domain/schema/migration hashes, row contents, curriculum, statuses, hierarchy, events, FK and integrity all match fresh Production. Verified at `2026-10-10T10:02:49.169Z`. Retained: **YES**, independently confirmed after migration. Prior important backups were not deleted or modified.

## MIGRATION 004

Applied: **YES**. Only new migration 004: **PASS**. Applied through the repository administrative migration runner with a guard inside the same write transaction. Immediately before DDL, the locked complete domain, schema/history fingerprints, exact rows, revised counts and draft semantic snapshot matched the pre-backup state.

Reviewed file SHA-256: `f77b74df8e9fa3aa3638aabf0849c4e77cc1c0fe186fd574e971ac3e5c0fed9d`. Reviewed file bytes remain unchanged. The hosted SQL parser rejected the file's UTF-8 byte-order mark; failed transactions rolled back and fresh independent audits confirmed the original baseline after failures. The successful administrative invocation omitted only that encoding marker from submitted SQL, preserving the file and SQL statements. No migration 005 exists; migrations 001/002/003 are unchanged.

Existing draft content, question ID, active version, classification, part IDs/parents/order/marks, schemes, steps, marking points, hints, search linkage, tags and asset links: **PASS â€” identical**. Repository SDK audit and independent CLI audit agree. New questions, versions, classifications, hints, assets and import receipts created by rollout: **0**. Both new importer tables are empty. Post-004 migrations: **001/002/003/004**. FK/integrity: **PASS**.

Expected differences are limited to schema structures, nullable asset import metadata, new empty content-block/import-receipt tables and the version-004 history row. No educational, curriculum, event or search row changed.

Post-004 schema SHA-256: `eeeba1089ad5cd742eb75a358fdc1a8140789f432d93856c88ff8c31c95390f0`.
Post-004 migration-history SHA-256: `7993746d018dc57fbb34c77c8161533b6f86d5708a4e9ab83bbe0e814d294a2b`.

## QUALITY

All release checks run after successful Production migration verification. Results:

| Command | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS â€” 184 unit/integration tests |
| npm run db:check | PASS |
| npm run schema:check | PASS |
| npm run api:check | PASS |
| npm run api:esm:check | PASS |
| npm run storage:check | PASS â€” 30 tests |
| npm run auth:check | PASS â€” 28 tests |
| npm run build | PASS |
| npm run test:browser | PENDING completion â€” 49 required |
| git diff --check | PASS |

The existing future-syllabus audit remains PASS for importer compatibility; no repeat audit or future feature implementation was performed. Browser tests use disposable local databases/storage. All 49 cases completed; only that run's exact two temporary server processes were stopped for Windows harness cleanup, then the runner exited 0. Mobile and desktop importer screenshots were inspected. Hosted write tests are prohibited unless both database and storage isolation are independently proved.

## SOURCE CONTROL

Intended scope: 38 importer source/schema/UI/documentation/example/test/report files. Exclude the pre-existing untracked `FIRST_PRODUCTION_QUESTION_PILOT_REPORT.md`, ignored data/evidence scripts, databases, screenshots, test results, Playwright output, environment files, credentials and private configuration. Full diff review and scoped secret scan: **PASS**; all 35 implementation/audit files retain previously reviewed bytes, with three rollout-status documents updated. Staged review is required before commit. Commit: pending. Required message: **Add self-contained question JSON importer**. Normal push to **feat/admin-security**: pending. No force push.

## PROTECTED PREVIEW

New exact-commit Preview URL: pending. Exact commit/protection/configuration/isolation: pending. No hosted write/import test is authorized while isolation is unverified or Production-backed. The in-app browser is unavailable after documented connection/troubleshooting checks. Hosted authenticated read-only HTTP and exact static-bundle verification will be combined with the passing disposable browser tests; no hosted interactive-render claim is made without evidence.

Required importer controls, math, no-part/nested rendering, marks, schemes, hints, ordered question/answer/FBD visuals and draft/idempotency/asset privacy are covered by the disposable browser/integration suite. Hosted authenticated route, served bundle, unauthenticated rejection, CSRF, draft visibility, counts/search and print/export protection remain to be verified. Public approved questions must remain zero.

## ORIGINAL PDF VISUAL POLICY

Real question/answer diagrams, FBDs, graphs, circuits, ray/apparatus diagrams and other educational visuals must come from the original PDF, by direct original extraction where possible, otherwise lossless high-resolution rasterization and exact crop. No redraw, regeneration, beautification, OCR reconstruction, relabeling, reinterpretation, changed arrows/axes/curves/symbols/meaningful colours or educational-pixel modifications. Synthetic visuals are allowed only in tests. Supplied-byte identity is verified; automatic proof of original-PDF provenance is not claimed.

## PRODUCTION

Application deployment: **PENDING** exact-commit Preview/security gates. The existing application deployment has not been promoted or replaced during this preparation. Turso/Blob bindings, environment values, deployment protection and domain configuration remain unchanged.

Current private database: questions **1**, draft **1**, approved **0**, assets **0**, migrations **001/002/003/004**. Existing draft unchanged: **PASS**. Question imports **0**; Blob writes **0**; curriculum mutations **0**. Final postdeployment health/admin importer controls/private audit and backup-retention checks remain pending. Import as Draft must never be used during this rollout.

FINAL STATUS: **RELEASE PREPARED â€” HOSTED VERIFICATION AND DEPLOYMENT PENDING**.
