# Image question bank - final local verification

Date: 12 October 2026 (Asia/Kuala_Lumpur). **READY FOR PROTECTED PREVIEW using independently verified disposable resources.** Production release readiness is not established. No commit, push, deployment, production migration, production data write or environment change was performed.

Baseline HEAD remains `83285a50814e357267c61c485f52438f39ded4e7`. The refactor is uncommitted and unstaged. Three pre-existing untracked historical reports are preserved separately: `FLEXIBLE_JSON_IMPORTER_PRODUCTION_DEPLOYMENT_REPORT.md`, `PHISHING_FALSE_POSITIVE_SECURITY_AUDIT.md`, and `USER_EXPORT_PDF_WORD_PRODUCTION_ROLLOUT_REPORT.md`. Ignored evidence and original sources are not release inputs.

## A. Architecture completion

Implemented and verified:

- Administrator form with exactly two image inputs (question and answer), six dependent dropdowns (syllabus version, semester, chapter, topic, subtopic, difficulty), positive integer marks and Save Question. Both previews appear before saving. Success follows awaited durable persistence.
- One stable Question ID associates the entire pair, metadata and immutable revision history. Saves create drafts. Publication, review status and archive are explicit confirmed operations; published replacements require confirmation. Optimistic revision checks reject stale and concurrent updates.
- Original PNG/JPEG/WebP bytes and SHA-256 are retained. A separate thumbnail serves browsing. Missing/invalid files cannot create partial questions. Failed-save cleanup checks references and only considers fresh receipts; uncertain commits retain referenced files for reconciliation. Historical image versions are retained.
- Student filtering, paginated browsing, selection/removal, total marks and explicit answer display. Students cannot mutate questions or curricula through direct API calls.
- Browser-only PDF export, ordered by numeric curriculum hierarchy, then stable ID. One syllabus/semester, up to 50 questions, matched answer numbers, original aspect ratios, tall-image continuation and whole-page fitting.
- Administrator-created subtopics under the existing hierarchy, with version/semester/chapter/topic ancestry checked at save. No academic subtopics are fabricated. Existing curriculum lifecycle, impact tokens, revision checks and history remain.
- Read-only administrator legacy archive with bounded pages. Explicit conversion requires actual images and complete mapping, keeps the legacy Question ID, creates a draft and leaves original legacy rows/history intact.

Removed runtime question JSON import, LaTeX/KaTeX academic processing, FBD processing, old structured-content screens, Word/DOCX generation, their exclusive fixtures/tests and obsolete format documentation. Normal API JSON and curriculum JSON administration remain. Removed exclusive dependencies: `katex`, `@types/katex`, `saxes`, `fflate`; added `sharp` for strict raster validation and `pdf-lib` for browser PDF. All remaining runtime dependencies have active uses.

No requested local feature remains unfinished. Authoritative subtopics and real question image conversion/publication remain administrator content tasks. Hosted verification is still pending.

## B. Database integrity

Migration `006-image-questions.sql` is additive: `image_assets`, `image_questions`, `image_question_versions`, supporting indexes, immutable-history triggers and referenced-hierarchy move guards. Existing `subtopics` already supplied the necessary parent relationships; a composite foreign key now makes a matching topic/subtopic mandatory for image questions. Migrations 001-005 are unchanged. Legacy content tables are neither dropped nor rewritten.

Isolated tests verify migration preservation, idempotence, failure rollback, foreign keys, real libSQL SDK transactions, file-database reopen persistence and explicit stable-ID legacy conversion. Runtime asserts schema 6 and never migrates automatically.

The repeated **SELECT-only** production audit matched the baseline logical rows, schema, migration history and integrity results. Production remains on migrations 1-5, with one legitimate draft, zero approved questions, zero assets and zero subtopics. Schema SHA-256: `31cfb2db1953ac9145a3d901c5b91a8a701ddd465c63ec7c9e19a835e9ef66a9`. No test images or questions were written there.

The original `data/bank.sqlite` remains byte-identical: SHA-256 `d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`. All 15 pre-existing local database/recovery SQL files remain present with their original lengths. No production or local recovery database was erased, reset or migrated by validation.

## C. Security and latest CSP correction

The blocked browser `eval` probe came from Zod being imported by a shared image module. Runtime validation moved unchanged to `server/image-question-input.ts`; shared client types/ordering no longer load Zod. Invalid hierarchy, missing images, unsupported fields, invalid marks and stale revisions still fail server validation. The form retains required fields and input constraints.

`server/auth.ts`, `server/security-headers.ts` and `vercel.json` are unchanged from HEAD. No `unsafe-eval`, relaxed `script-src`/`connect-src`, authentication exception or CSRF bypass was introduced. The pre-existing CSP/font security correction stays in its existing history.

Reproducible CSP evidence in `data/architecture-refactor/csp-accessibility.json` records **zero application violations** before instrumentation. After the separately loaded `/__test__/axe.js` accessibility tool runs, its attempt to fetch the Google Fonts stylesheet triggers a blocked `connect-src` event attributed to that test script. This is recorded separately; CSP remains enforced. Axe returned **zero accessibility violations**. The actual-image administrator and student PDF scenario separately records **zero CSP violations and zero page errors**, without accessibility instrumentation.

All seven production JavaScript chunks passed a scan for direct eval/Function-constructor calls and Zod runtime symbols; the scan complements, rather than replaces, browser enforcement. Main JavaScript is 238,139 bytes, down from approximately 324.45 kB before the server-only validation correction (about 86 kB saved). npm advisory audit reports **0 known vulnerabilities**.

Upload security includes complete raster decoding, matching MIME/extension/signature, static upright images, 1.5 MiB/file, 3 MiB/pair, dimension/pixel limits, immutable storage keys, sanitized transport errors, authenticated/CSRF-protected mutations and resource-authorized private images. Draft/history endpoints and images remain administrator-only. Session, hosted-cookie, login-throttling, CSRF and direct unauthorized-write tests pass.

## D. PDF verification

| Final browser export | Questions / answers | Pages | Result |
| --- | ---: | ---: | --- |
| 1-question tall-image fixture | 1 / 1 | 9 | PASS |
| 5-question fixture | 5 / 5 | 17 | PASS |
| 20-question fixture | 20 / 20 | 47 | PASS |
| 50-question fixture | 50 / 50 | 107 | PASS |
| Actual thermodynamics reference image pair | 1 / 1 | 2 | PASS |

All selected records are included in the shared ordered plan, starting at Question 1 and Answer 1; marks, A4 dimensions, page numbers and image proportions were checked. Tall images retain readable width with overlapping slices. A visual QA defect producing footer-only pages for page-sized originals was corrected with modest aspect-preserving fitting; long images retain pagination.

The actual retained reference PNG pair was uploaded through the final administrator form into an **isolated in-memory SQLite database**, saved as a draft, explicitly published only there, viewed as an unauthenticated student and exported in Chromium. Local metadata used a clearly labelled TEST ONLY hierarchy; this is not a claim to have supplied official missing curriculum metadata.

Both stored-original SHA-256 values and decoded PDF-image pixel hashes match the sources. Visual inspection confirmed the SP015 question, MEDIUM difficulty, 3 marks, 1.5 kJ, 20 L, 35 L, 30 kPa, cubic-metre conversion, the three marking steps/hints and equations ending in 1050 J. No mathematical image region was lost. Representative tall continuation pages and the final 50-question answer page were rendered and inspected. PyMuPDF from retained local verification tools performed rendering and pixel inspection; Poppler was unavailable in the local execution environment.

PNG/JPEG originals are embedded; WebP is decoded to PNG in the browser. The test set exercises all three formats. Exports have a 64 MiB compressed image budget and a 400-page ceiling. Word/DOCX and question JSON import remain removed. Verification PDFs/images are ignored local evidence, not release payloads.

## E. Storage optimization

Measurement snapshot: `2026-10-11T22:06:00.309257+00:00`. All figures are regular-file byte lengths, not NTFS allocated clusters; links/junctions are excluded. Inventory records: `data/architecture-refactor/storage-before.json` and `storage-after.json`. Final report/inventory writes may add a small amount after a snapshot.

- Initial project: **2,543,148,863 bytes**, 32,031 files.
- Current measured project: **505,946,013 bytes**, 13,382 files.
- Exact measured net reduction: **2,037,202,850 bytes** (80.11%).
- Previously approved tool deletion independently reconciled: **2,091,298,631 bytes / 20,271 files**, with one SHA-256 per deleted file retained in `approved-tool-cleanup-manifest.csv`. All four approved paths remain absent. Databases removed: **0**.
- Remaining existing Git-tracked files: **3,052,490 bytes**. New untracked refactor files: **98,051 bytes** (reported separately because nothing has been staged/committed).

| Directory | Before bytes | Current bytes |
| --- | ---: | ---: |
| data | 2,387,553,098 | 317,017,663 |
| node_modules | 143,200,868 | 180,605,368 |
| dist | 1,886,441 | 709,454 |
| playwright-report | 894,191 | 540,003 |
| test-results | 1,887,108 | 45 |
| src | 220,687 | 94,881 |
| server | 167,023 | 128,232 |
| shared | 88,292 | 8,162 |
| tests | 469,726 | 130,778 |
| docs | 236,604 | 69,771 |
| .git | 3,644,444 | 3,845,935 |

The large growth came from LibreOffice extraction, installer, extraction log and temporary Python verification packages, not production question images. Net reduction is smaller than deleted-tool bytes because image-validation/PDF dependencies and retained new verification evidence add storage. The final build is **709,454 bytes**; installed dependencies occupy **180,605,368 bytes**.

Substantial retained areas include `data/curriculum-import` (116,760,500 bytes), `data/real-source-verification` (74,147,522), and `data/master-fidelity-tools` (55,719,785). The latter is used for final PDF QA. The duplicate audit still identifies **107,098,530 bytes** of repeated files >=64 KiB across old tools/evidence. These are candidates for a separately scoped consolidation; identical hashes alone are not authority to erase backups, originals or historical evidence. No additional large cleanup was performed.

Current ignored refactor evidence occupies **17,110,196 bytes**; the fixed disposable browser-image directory occupies **3,653,000 bytes**. Final Playwright report/results sizes are shown above. Test PDFs/logs use fixed names and overwrite prior runs. Browser uploads use a fixed ownership-marked directory, reject unidentified contents/links and clear their own previous images on restart, including after interrupted Windows runs. `npm run clean:generated` is a tested dry-run by default; `-- --apply` only removes fixed build/test output paths and refuses credentials, databases and links. It never enumerates persistent `data` for deletion.

## F. Final test results

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Unit/integration suite, including migration, image API/persistence, curriculum, PDF, concurrency, auth, storage and security | 72 | 0 | 0 |
| Browser suite against final production build | 13 | 0 | 0 |
| Authentication check, subset of the unit suite | 11 | 0 | 0 |
| Private storage provider check, subset of the unit suite | 9 | 0 | 0 |

The 11 and 9 subset counts are not additional to 72. One additional actual-source end-to-end verification scenario passed as described above. The old structured-content/JSON/DOCX test counts do not apply after removal of those workflows.

Also PASS: TypeScript production build, ESLint, database integrity/empty-seed check, metadata schema check, native NodeNext/ESM API import graph and its deliberately broken-import negative check, Vercel API graph isolation, `git diff --check`, dependency advisory audit, source-pixel/PDF checks and repeated read-only production comparison. No unresolved local test failures or identified critical defects remain. Browser validation ran in Chromium on Windows; other browsers and low-memory devices remain future compatibility work.

Primary final evidence: `unit-final.log`, `browser-final.log`, `check-auth-check.log`, `check-storage-check.log`, `check-api-check.log`, `check-build.log`, `csp-accessibility.json`, `bundle-security-scan.json`, `actual-image-verification.json`, `pdf-checks.json`, `npm-audit-final.json`, `production-before.json`, `production-after.json`, and `persistent-file-preservation.json` under `data/architecture-refactor/`.

## G. Readiness and remaining risks

**READY FOR PROTECTED PREVIEW** at the application-code level, using a separately verified disposable database and private image store. The existing Preview database binding has not been proven isolated and is not authorized for write testing. No hosted tests are claimed passed. Production remains pending a separately authorized hosted validation and migration/release decision.

Recommended sequence:

1. Review and approve the exact feature diff and release files. Preserve existing security history; exclude `data`, credentials, original sources, generated outputs and unrelated historical reports. Commit/push only after release approval through the normal feature workflow.
2. Provision and independently verify a disposable Turso database and separate private image store/approved isolated namespace. Approve any Preview-only environment changes separately. Do not reuse an unverified production-backed Preview binding.
3. Back up any copied data and record hashes. Apply migrations through 006 only on that verified disposable target, then verify legacy preservation, migrations, integrity and foreign keys. Bootstrap a disposable test administrator.
4. Deploy the reviewed exact SHA to protected Preview; verify SHA and deployment protection. Validate native Sharp on Vercel/Linux, private-image delivery, authentication, authorization, CSRF/CSP, uploads, revisions/publication and 1/5/20/50-question exports. Hosted write tests remain blocked until isolation is proven.
5. Stop and report Preview findings. Obtain separate explicit approval before production migration, environment changes, rollout or real publication.

Remaining operational risks: authoritative subtopics are still absent in production; legacy structured records need manual image conversion before appearing in the new student bank; source image readability/embedded numbering depends on supplied pictures; raster-only academic content has no accessible text transcript/OCR; large 50-question exports may exceed small-device memory despite byte/page limits; historical images intentionally remain for audit/recovery and need a separately approved retention policy. No automatic diagram generation, semantic academic rewriting or orphan-asset deletion is introduced.

## Release file inventory

New implementation, tests and tools (all currently untracked):

- `docs/image-question-metadata.schema.json`
- `scripts/clean-generated.ts`
- `server/image-question-input.ts`
- `server/image-questions.ts`
- `server/migrations/006-image-questions.sql`
- `shared/image-question.ts`
- `src/CurriculumFields.tsx`
- `src/LegacyArchive.tsx`
- `src/image-pdf.ts`
- `tests/browser/image-admin.spec.ts`
- `tests/browser/image-bank.spec.ts`
- `tests/cleanup.test.ts`
- `tests/image-api.test.ts`
- `tests/image-fixture.ts`
- `tests/image-migration.test.ts`
- `tests/image-pdf.test.ts`
- `tests/image-questions.test.ts`

Modified files are listed in `data/architecture-refactor/final-working-tree.txt`. Runtime/authoring systems and obsolete fixtures/docs removed from the working tree (historical versions remain in Git):

- `docs/CHATGPT_QUESTION_JSON_CONVERSION_CHECKLIST.md`
- `docs/QUESTION_JSON_AUTHORING_STANDARD.md`
- `docs/USER_PDF_WORD_EXPORT.md`
- `docs/flexible-json-importer-audit.md`
- `docs/flexible-json-importer.md`
- `docs/import-format.md`
- `docs/question-json-import-format.md`
- `docs/question-json-import.schema.json`
- `docs/question-v1.schema.json`
- `docs/question-v2.schema.json`
- `examples/question-import/First_Law_of_Thermodynamics_MEDIUM_PORTABLE.json`
- `examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json`
- `examples/question-import/dimensional-analysis.json`
- `examples/question-import/portable-first-law-synthetic.json`
- `examples/question-import/synthetic-visual.json`
- `scripts/turso-cloud-smoke.ts`
- `server/asset-service.ts`
- `server/question-json-import.ts`
- `server/revisions.ts`
- `shared/content.ts`
- `shared/export-content.ts`
- `shared/export-plan.ts`
- `shared/import-compatibility.ts`
- `shared/model.ts`
- `shared/question-import.ts`
- `shared/question-numbering.ts`
- `src/ImportCompatibilityReview.tsx`
- `src/Importer.tsx`
- `src/MasterPrint.tsx`
- `src/MathText.tsx`
- `src/QuestionJsonImporter.tsx`
- `src/question-import-preparation.ts`
- `src/word-export.ts`
- `src/word-math.ts`
- `tests/admin-difficulty.test.ts`
- `tests/api.test.ts`
- `tests/bank.test.ts`
- `tests/browser/admin-difficulty.spec.ts`
- `tests/browser/auth.spec.ts`
- `tests/browser/bank.spec.ts`
- `tests/browser/curriculum-presentation-fixture.ts`
- `tests/browser/curriculum-presentation.spec.ts`
- `tests/browser/curriculum.spec.ts`
- `tests/browser/flexible-json-import.spec.ts`
- `tests/browser/master-fidelity-fixture.ts`
- `tests/browser/master-fidelity.spec.ts`
- `tests/browser/public-counts.spec.ts`
- `tests/browser/question-import-browser-fixture.ts`
- `tests/browser/real-portable-import.spec.ts`
- `tests/browser/security.spec.ts`
- `tests/browser/user-export.spec.ts`
- `tests/browser/z-question-json-import.spec.ts`
- `tests/export-fixture.ts`
- `tests/import-compatibility.test.ts`
- `tests/master-fidelity.test.ts`
- `tests/public-counts.test.ts`
- `tests/question-import-fixture.ts`
- `tests/question-import-upgrade.test.ts`
- `tests/question-import.test.ts`
- `tests/real-portable-fixture.ts`
- `tests/real-portable-import.test.ts`
- `tests/syllabus-reuse-audit.test.ts`
- `tests/user-export.test.ts`
