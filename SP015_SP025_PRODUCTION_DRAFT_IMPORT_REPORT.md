# MATRICULATION PHYSICS QUESTION BANK
# SP015 + SP025 PRODUCTION CURRICULUM DRAFT IMPORT

**FINAL STATUS: PRODUCTION DRAFT CURRICULUM IMPORT VERIFIED**

Recorded: 9 October 2026 at 6:59:30 pm MYT. All provider evidence timestamps retain UTC.

## APPROVED ARTIFACT

Path: [data/curriculum-import/physics-sp015-sp025-dry-run/matriculation-physics-curriculum.proposed.json](data/curriculum-import/physics-sp015-sp025-dry-run/matriculation-physics-curriculum.proposed.json).
Expected SHA-256: `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`.
Actual SHA-256: `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`.
Hash match: **PASS**. The artifact was never regenerated or modified during this task.

## SOURCE HASHES

- Curriculum Specifications (CS) Physics SP015.pdf: **PASS**, SHA-256 `e20f256f685e57f1267096a1b51ff79faf164fadd929975d38c95ddf074fea74`.
- Curriculum Specifications (CS) Physics SP025.pdf: **PASS**, SHA-256 `fba864aa52c1d5f20bcc6c950b6e277c2c50d29e38688e717f7be23454947f3e`.

SP025 7.4 remains `7.4 Huygens' Principle`, an explicitly user-approved normalization. Local authoritative metadata continues to preserve outline `Huygen’s Principle` and detailed heading `Huygens’s Principle`; the chosen display punctuation is not claimed as verbatim PDF text.

## PRE-IMPORT

Production target verified: **PASS**.
Database: `matriculation-physics-question-bank`.
URL host: `matriculation-physics-question-bank-pekchunhoe.aws-ap-northeast-1.turso.io`. Turso group: `default`.
Baseline: 1 course, 1 curriculum version, 2 LEGACY semesters, 0 chapters, 0 topics, 0 subtopics, 0 events, 3 difficulty levels. All question/content/search/asset/tag tables: 0.
Migrations: **001 / 002 / 003**. LEGACY active: **PASS**. Unexpected baseline content: **NO**.
Admin writes were quiesced by the user before backup/import/post-audit. Production was re-audited during and after backup, before login and immediately before import.

## BACKUP

Created: **PASS**.
Name: `phys-pre-curr-20261009-c453ac`. Source: current production database; group `default`.
Created: 9 October 2026 at 6:45:49 pm MYT (`2026-10-09T10:45:49.258Z`).
Workflow: installed Turso CLI `db create phys-pre-curr-20261009-c453ac --from-db matriculation-physics-question-bank --group default --wait`. No old SQLite file was used.
Independent verification: **PASS**. Course, LEGACY version, semester rows, all curriculum/question/content counts, migrations, domain fingerprint, schema fingerprint and migration fingerprint match production. Production remained stable across backup creation.
Retained: **YES**. No backup deletion or recovery was attempted.

## IMPORT

Validation preview: **PASS**; exact approved version/document and counts 2 / 18 / 82 / 0.
Stale-state protection: **PASS (fresh identical preview and unchanged state; normal importer revalidates token inside transaction)**. Validation tokens remained only in memory; no historical token was reused.
Transactional import: **PASS**; HTTP 201.
Import event: **PASS**. Exactly one `/api/curriculum/import` request was allowed. No blind write retries or direct SQL taxonomy inserts.
Audit note: Reviewed authoritative SP015 + SP025 session 2022/2023; combined Semester 1 and Semester 2 curriculum; human review complete; draft import only.

Transport: Existing unchanged createApp and real remote Turso adapter; no database fixture.
The unchanged application ran on loopback `http://127.0.0.1:58099`, with an explicitly verified remote production Turso connection. Actual administrator login, CSRF headers, strict validation, preview token, collisions, transaction and curriculum event were enforced. No test identity or in-memory database was used. The wrapper blocked activation PATCH routes, authoring outside import, uploads, and more than one import attempt.
Project-level environment metadata has no Production-targeted Turso binding. Provider reads returned the sensitive Preview URL as blank, so the hosted Preview was not used for import. This does not claim inspection of its deployment-only secret values. No Vercel binding/configuration/deployment was changed.
The browser-control connection timed out. Production API/tree data was verified through the real local application API; local browser regressions are recorded separately below. No claim of a hosted visual review is made.

## NEW CURRICULUM

ID: `curriculum-physics-2022-2023`.
Code: `PHYSICS-2022-2023`.
Name: Matriculation Physics - Session 2022/2023.
Status: **draft**. Active: **NO**. Exact effectiveFrom/effectiveTo: **null / null**. Initial version/node revision: **1**.

## SEMESTER 1 / SP015

9 chapters / 36 topics / 0 subtopics. Exact artifact match: **PASS (9/36/0)**.

## SEMESTER 2 / SP025

9 chapters / 46 topics / 0 subtopics. Exact artifact match: **PASS (9/46/0)**.
`7.4 Huygens' Principle`: **PASS**.

## COMBINED

2 semesters / 18 chapters / 82 topics / 0 subtopics.
Node-by-node comparison: **PASS**. Export equals the pinned artifact in full; independent raw rows verify every supplied ID/name/slug/parent/order/status/test flag, revision 1, shared version and correct semester membership. Normalized sibling names/slugs are unique, and no partial hierarchy or orphan node remains.
Classification compatibility: **PASS (82 topics)**.

## LEGACY

Preserved / still active: **PASS**.
Current status: `active`. Retired: **NO**. One active version total. Exact prior LEGACY export and semester rows remain unchanged.

## ANONYMOUS

Draft version and both semester branches/chapters/topics hidden: **PASS**. Anonymous taxonomy exactly equals its pre-import response; LEGACY remains the public active version.
Anonymous draft export returns 401. Unexpected exposure: **NONE** when verification passed.
Admin curriculum versions/taxonomy/tree: **PASS**. Health: **PASS**. Authenticated draft export: **PASS**.

## QUESTIONS / ASSETS

Questions: 0. Assets: 0. Question versions: 0. FTS records: 0. All parts/solutions/steps/hints/tags/revisions/classifications remain zero.
Blob reads/writes/uploads: **NO**. No storage adapter was configured, and neither syllabus PDF was uploaded.

## DATABASE

Foreign keys: **PASS**. Integrity: **PASS**.
Schema/migrations unchanged: **PASS**.
Unchanged course, LEGACY hierarchy, difficulty levels, all question/content domains and auth architecture: **PASS**.
Only intentional domain differences: +1 curriculum version, +2 semester rows, +18 chapters, +82 topics, +1 curriculum import event.
Normal required login/logout creates/revokes this task's real administrator session and updates bounded auth throttling state. No bootstrap, password change, auth bypass, session-revocation sweep or auth/schema modification occurred. Own-session logout: **PASS**. No password, raw cookie, bearer token or auth hash was logged or saved.

| Table | Before | After |
| --- | ---: | ---: |
| courses | 1 | 1 |
| curriculum_versions | 1 | 2 |
| semesters | 2 | 4 |
| difficulty_levels | 3 | 3 |
| chapters | 0 | 18 |
| topics | 0 | 82 |
| subtopics | 0 | 0 |
| questions | 0 | 0 |
| question_parts | 0 | 0 |
| solutions | 0 | 0 |
| solution_steps | 0 | 0 |
| hints | 0 | 0 |
| assets | 0 | 0 |
| tags | 0 | 0 |
| question_tags | 0 | 0 |
| question_versions | 0 | 0 |
| revision_candidates | 0 | 0 |
| question_version_classifications | 0 | 0 |
| question_search | 0 | 0 |
| curriculum_events | 0 | 1 |

## POST-IMPORT FINGERPRINTS

Algorithm: SHA-256 of deterministic JSON domain rows ordered by table insertion order and columns/rows in the existing schema order / `ORDER BY 1,2`; schema sorted by type/name; migrations sorted by version. All domain tables include FTS rows. Auth/session credential values are excluded. These JSON fingerprints use a different canonical serialization from the earlier CLI-text dry-run fingerprints.

| Fingerprint | Before | After |
| --- | --- | --- |
| Domain | `cc13b411c69104d856a3944a4bff7cb408ff4b83f16bf10809854d8dae75b604` | `793c3d0b43fdca3f5e54a939c16736a26bc5dc09b8985db63265e36affdf0e85` |
| Schema | `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae` | `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae` |
| Migrations | `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` | `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` |

## QUALITY

All cloud Turso/Blob/OIDC credentials are removed from local quality-check environments. Suites use isolated SQLite/libSQL, temporary browser fixtures and mocked Blob; they do not access production.

| Check | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS (122 passed) |
| npm run db:check | PASS |
| npm run schema:check | PASS |
| npm run api:check | PASS |
| npm run api:esm:check | PASS |
| npm run storage:check | PASS |
| npm run auth:check | PASS |
| npm run build | PASS |
| npm run test:browser | PASS (22 passed) |
| git diff --check | PASS |

Preservation manifest: **PASS**, 190 files including application source, migrations, all reviewed reports and the full combined dry-run package. Changed tracked files: NONE. Approved artifact/source metadata remain unchanged.

## PRODUCTION ACTIONS

Combined curriculum imported: **YES**.
Imported as draft only: **YES**.
Activation performed: **NO**. LEGACY retired: **NO**. Questions imported: **NO**. Blob write: **NO**. Schema migration: **NO**. Commit: **NO**. Push: **NO**. Deployment: **NO**.

**FINAL STATUS: PRODUCTION DRAFT CURRICULUM IMPORT VERIFIED**

Recommended next step: fix public curriculum/version presentation and the chapter-grouped Topic filter in a separate source/UI task, then deploy and test that change. Only after that review should PHYSICS-2022-2023 activation be separately authorized. The pre-import backup remains retained.

Evidence: `data/curriculum-import/physics-sp015-sp025-production-draft-import/` contains sanitized file verification, target, quiescence, before/backup/after audits, backup identity, validation preview, exact draft export, admin/anonymous taxonomy, HTTP statuses, import results and quality logs.
