# MATRICULATION PHYSICS QUESTION BANK
# SELF-CONTAINED QUESTION JSON IMPORT SYSTEM

Date: 10 October 2026 (Asia/Kuala_Lumpur)

## ROOT PROBLEM

The existing JSON importer accepted structured database-oriented exports and optional classification envelopes. Authors still needed stable topic/difficulty IDs, separately staged visual files and opaque references, and manual preparation or Codex/API assistance to connect them. Its solution foreign keys required a labelled question part, and its visual layout appended assets rather than representing interleaved source-authentic content. It did not provide a self-contained portable one-file question authoring contract with a signed preview and draft-only commit.

## TARGET WORKFLOW

PDF → prepared JSON outside the website → website → validate → rendered preview → Import as Draft → separate admin review/approval.

Implemented admin route: `/import/question-json`. The existing structured export/revision importer remains at `/import`, linked separately. One independent question per package; bulk import is not implemented.

## AUDIT AND MODEL DECISIONS

Audited `server/database.ts`, foundation/curriculum/auth migrations, shared question/curriculum validators, creation/edit/import/version APIs, visibility/print/question-set routes, KaTeX components, admin editor, storage/asset validation/rollback services, private Vercel Blob/local adapters, hosted handler, schema-generation scripts, unit/integration/browser fixtures, body and Multer limits, and production/runtime initialization boundaries.

Reused the existing questions, flat parent-linked parts, per-part schemes and marking steps, hints, asset kinds, taxonomy, immutable versions and classification snapshots. No parallel question model, storage provider, OCR/PDF parsing workflow, approval path or AI runtime was introduced.

Two existing limitations were reported before implementation: no-part answers could not satisfy the solution→part foreign key, and exact interleaved visual placement had no representation. Migration 004 extends those existing solution/step tables for nullable whole-question scope and adds relational ordered blocks, asset metadata and durable import receipts. Old rows, references and immutable historical snapshots are preserved; populated upgrade and libSQL checks pass.

Question-level and per-asset source provenance are excluded from the final unreleased schema. Original PDF filename/hash, question number, page/region, source set and source course code are not retained. The source-provenance warning has been removed. Role, caption, digest, byte length, MIME, accessibility text, ordered placement and opaque references are preserved. After successful import, the original PDF and prepared JSON may be discarded; canonical educational content resides in structured database records and private visual assets.

## RUNTIME AI

ChatGPT/OpenAI/LLM calls: **0**

Server AI tokens: **0**

External OCR, embeddings, image-generation or image-understanding calls: **0**

## IMPORT UI

| Check | Result |
|---|---|
| Paste JSON | PASS |
| Upload one .json | PASS |
| Shared validation/preparation pipeline | PASS |
| Rendered review before commit | PASS |
| Explicit Import as Draft action | PASS |
| Input changes invalidate reviewed plan | PASS |
| Mobile 390×844 | PASS |
| Desktop 1280×1000 | PASS |
| Labels, focusable controls, error association, alt metadata | PASS |
| Automated accessibility checks on full visual previews | PASS — no violations |

The in-app browser connection reported no browser available after its documented bootstrap/troubleshooting checks. The repository's Chromium Playwright suite supplied the required browser execution and screenshots using disposable local databases/storage. Both preview screenshots were inspected. The final Windows test run needed its exact owned temporary server processes stopped after all cases completed; the test command then completed successfully with **49 passed** and exit code 0. No unrelated process was stopped.

## QUESTION FORMAT

schemaVersion: **1**

kind: **matriculation-physics-question**

| Check | Result |
|---|---|
| One question per package | PASS |
| Strict unknown-field rejection | PASS |
| No-part question without invented (a) | PASS |
| Nested parts / subparts | PASS — native flat parent IDs plus recursive display |
| Integer marks and exact totals | PASS |
| Parent aggregates counted once | PASS |
| LaTeX string preservation and KaTeX validation | PASS |
| Malformed delimiters/braces/render failures blocked | PASS |
| Structured solutions and marking steps | PASS |
| Ordered whole-question/part hints | PASS |
| Generated machine-readable schema | PASS — same Zod implementation |

Official guide: `docs/question-json-import-format.md`.

Examples: `examples/question-import/dimensional-analysis.json` (2 marks, four progressive hints, no assets), and `examples/question-import/synthetic-visual.json` (question PNG plus answer FBD PNG, locally drawn harmless fixture). Neither example was imported into production.

## CLASSIFICATION

| Check | Result |
|---|---|
| Curriculum-version aware | PASS |
| Permanent Semester 1 / Semester 2 rule | PASS |
| SP015/SP025 permanent hard-coding | NO |
| Exact unambiguous taxonomy resolution | PASS |
| Normalized/fuzzy/slugs-as-names matching | NO |
| Automatic taxonomy creation | NO |
| Hierarchy, retirement, revision and difficulty checks | PASS |
| Future PHYSICS-2028-2029 with unchanged semester identities | PASS — isolated fixture |

Ambiguous version codes across courses are deliberately rejected rather than guessed.

## STATUS

Imported state forced to draft: **PASS**.

JSON direct approval possible: **NO**. Status properties are not part of this strict portable schema. Existing separate review/publication behavior is preserved.

## ASSETS

| Check | Result |
|---|---|
| Self-contained embedded assets | PASS |
| Question diagram | PASS |
| Answer diagram | PASS |
| Free-body diagram | PASS |
| Graph | PASS |
| Circuit | PASS |
| Table image | PASS |
| Other visual | PASS |
| Source page/region | PASS — per-asset metadata persisted |
| Exact question/part/answer/step placement | PASS — ordered content block owner |
| SHA-256 verification | PASS — client and independent server checks |
| MIME/signature/byte-length verification | PASS |
| Private Blob | PASS — existing adapter, isolated mocked transport checks; no real upload |
| Opaque application references | PASS |
| Raw Blob URL public exposure | NO |
| Database image blobs | NO |

Raster formats: PNG/JPEG/WebP. Existing safe SVG validation is retained; importer accepts no raw PDFs. Every visual must have an explicit placement. Answer-diagram/FBD roles cannot be placed in question text. Answer-owned graph/circuit/table/other assets are also kept out of student/question-only print views through actual block ownership.

## BASE64

Accepted inside portable JSON: **PASS**.

Separated client-side before upload: **PASS**.

Stored in DB: **NO**.

Retained after successful import: **NO**. The textarea/file selection, prepared binary maps and preview/object URLs are released. The original JSON package is not the live render source.

## VISUAL FIDELITY

Raster assets recompressed unnecessarily: **NO**.

PNG byte-preservation test: **PASS** — a synthetic FBD travels through the actual isolated HTTP importer and local storage, is retrieved through authenticated `/uploads/...`, and matches both expected bytes and SHA-256 exactly. Anonymous retrieval is denied.

FBD regeneration: **NO**.

Image generation at runtime / AI image generation: **NO**. Only procedural local drawing was used to make the synthetic test fixture.

OCR reconstruction: **NO**.

Documentation requires unmodified original-PDF visuals: prefer direct extraction, otherwise lossless high-resolution rasterization and exact source-region crop. Only unrelated blank space/header/footer/page numbering/adjacent-question material may be cropped. PNG is required for line art; do not reduce it using lossy JPEG. Redraw, regeneration, beautification, OCR reconstruction, relabelling or meaningful visual alteration requires an explicit user request. No visual transformation occurs in the importer. Supplied byte identity is verified; original-PDF origin cannot be established automatically from bytes alone.

## PREVIEW

| Check | Result |
|---|---|
| Same saved-question rendering components | PASS |
| Accurate rendered math | PASS |
| Question diagrams | PASS |
| Answer diagrams | PASS |
| FBD at marking step | PASS |
| Hints in separate review section | PASS |
| Classification/difficulty/version | PASS |
| Question, allocated part and marking totals | PASS |
| Role, placement, dimensions, size and local hash state | PASS |
| Errors vs warnings | PASS |

The preview accurately labels hash verification as local; the server verifies file signatures/hashes at commit. Unknown fields, security checks, schema/mark/taxonomy/math problems remain blocking errors. Duplicate content, missing alt and >2 MiB images are review warnings.

## IMPORT SAFETY

| Check | Result |
|---|---|
| Validation before writes | PASS — validation endpoint does not even write security counters |
| Signed reviewed-state binding | PASS — exact canonical manifest digest and taxonomy/difficulty state |
| Expired/stale/tampered plans rejected | PASS |
| Durable cross-process signed plan | PASS — admin-specific domain-separated HMAC signing; no process-local plan registry |
| Idempotent commit | PASS — stable signed plan/question ID and unique relational receipt |
| Double-click duplicate | BLOCKED |
| Concurrent upload/commit retry | PASS — one question; loser-owned unlinked uploads cleaned |
| Relational transaction | PASS — complete normalized content/version/classification/search/receipt together |
| Failed Blob import cleanup | PASS — exact owned new unreferenced objects only |
| Cleanup failure and upload uncertainty | PASS — contained error plus opaque reconciliation diagnostics |

Failures were injected at question, part, solution, solution-step, hint, classification, version, asset metadata, block, receipt, search inserts and final transaction commit. All relational rows rolled back; unrelated stored objects were never removed. Partial upload failure also cleans previous known successful uploads. Provider write uncertainty is reported explicitly rather than guessing that cleanup succeeded. Existing linkage checks preserve an object if an uncertain DB result already referenced it.

## SECURITY

Admin-only: **PASS**.

CSRF: **PASS** — existing server middleware authenticates/authorizes and enforces origin/custom header before parsing import bodies.

Draft question leakage: **NONE in isolated checks**.

Draft asset leakage: **NONE in isolated checks**.

Draft solution/marking scheme/hint leakage: **NONE in isolated checks**.

Public counts/facets/search changes from draft: **NONE**.

Public print/export/question-set draft protection: **PASS**.

Existing security tests were preserved. Migration-related assertions were advanced to the new current schema; the auth CLI test additionally proves its explicit 003 migration does not create import tables or implicitly apply 004.

## EFFICIENCY AND LIMITS

No-asset import Blob calls: **0** uploads/reads.

AI calls: **0**. LLM calls: **0**. External OCR: **0**.

Normal operations are JSON parsing, Zod/KaTeX validation, deterministic hashing, exact lookup, SQL and private storage only. There are no external educational-content calls and no server image transformations.

| Import-specific bound | Limit |
|---|---|
| Portable JSON UTF-8 | 5 MiB |
| Structured manifest | 384 KiB |
| Embedded image count | 8 |
| Each image | 3 MiB |
| Combined decoded images | 3 MiB |
| Binary commit | Combined images + manifest + 64 KiB multipart allowance (<4 MiB for valid requests) |
| Preview lifetime | 15 minutes |

Chosen bounded design: browser decodes one JSON, sends a Base64-free manifest for validation, previews local image objects, then sends images as binary multipart only at confirmed commit. Combined images are capped at 3 MiB so one request is sufficient. There are no staged objects if a preview is abandoned and no additional import state/job service. Global hosted JSON (3 MiB), normal hosted file (3 MiB), and generic adapter (20 MiB) limits were not increased. Invalid local multipart requests without declared Content-Length are still bounded by eight 3 MiB per-file limits before aggregate rejection; accepted data remains ≤3 MiB. This is a deliberately conservative v1 capacity, not bulk or unbounded importing.

## DATABASE / PRODUCTION BOUNDARY

Production writes: **NO**.

Production questions changed by this task: **NO**.

Production assets changed by this task: **NO**.

Production curriculum changed: **NO**.

Migration applied to production: **NO**.

Production environment/configuration changes: **NO**. Read-only public Production and Vercel project metadata audits: **YES**. Private database read-only connection: restored through existing authenticated WSL CLI.

Migration 004 is present as a reviewable source file. It is required to represent actual whole-question solutions without fabricated parts, preserve ordered visual/text blocks as relational data, persist safe visual metadata, and provide atomic durable import receipts. It was exercised only by automatically created disposable test databases. It was not applied to the application's persistent local bank or any production database. Runtime schema checks require 004 before eventual rollout and never apply DDL; a separate reviewed rollout/backup procedure is still required. No migration solely for question provenance was added.

## QUALITY

| Required command | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS — 180 tests (baseline 126, +54) |
| npm run db:check | PASS |
| npm run schema:check | PASS |
| npm run api:check | PASS |
| npm run api:esm:check | PASS |
| npm run storage:check | PASS — 30 tests |
| npm run auth:check | PASS — 28 tests |
| npm run build | PASS |
| npm run test:browser | PASS — 49 tests (baseline 31, +18) |
| git diff --check | PASS |

Build retained existing dependency annotation warnings from Zod/Rollup; the build succeeds. Tests use explicit local SQLite/libSQL memory or scratch files, local/disposable image storage or existing mocked private Blob tests. No real Blob store was used.

Browser screenshots remain in ignored `test-results` under the two `complete visual preview...` cases, named `import-390.png` and `import-1280.png`. The HTML report is in ignored `playwright-report`.

## FILES CHANGED

Existing source/validation/runtime:

- `shared/schema.ts`
- `shared/model.ts`
- `server/app.ts`
- `server/database.ts`
- `server/migrations.ts`
- `server/visibility.ts`
- `scripts/auth-admin.ts`
- `scripts/check-db.ts`
- `scripts/export-schema.ts`
- `src/Editor.tsx`
- `src/Preview.tsx`
- `src/main.tsx`
- `src/styles.css`

New source/migration:

- `shared/content.ts`
- `shared/question-import.ts`
- `server/question-json-import.ts`
- `server/migrations/004-question-json-import.sql`
- `src/QuestionJsonImporter.tsx`
- `src/question-import-preparation.ts`

Tests:

- `tests/auth.test.ts`
- `tests/bank.test.ts`
- `tests/curriculum.test.ts`
- `tests/question-import.test.ts`
- `tests/question-import-fixture.ts`
- `tests/question-import-upgrade.test.ts`
- `tests/syllabus-reuse-audit.test.ts`
- `tests/browser/question-import-browser-fixture.ts`
- `tests/browser/z-question-json-import.spec.ts`

Documentation/schema/examples:

- `README.md`
- `docs/question-v1.schema.json`
- `docs/question-v2.schema.json`
- `docs/question-json-import.schema.json`
- `docs/question-json-import-format.md`
- `examples/question-import/dimensional-analysis.json`
- `examples/question-import/synthetic-visual.json`
- `QUESTION_JSON_IMPORT_SYSTEM_REPORT.md`

The pre-existing untracked `FIRST_PRODUCTION_QUESTION_PILOT_REPORT.md` was left untouched and is not part of this task.

## SOURCE CONTROL

Commit: **pending release gate**.

Push: **pending release gate**.

Deployment: **pending exact-commit hosted verification**.

Production Vercel/environment changes: **NO**.

## FINAL STATUS

**PRODUCTION MIGRATION VERIFIED — APPLICATION RELEASE PENDING**.

The revised authorized baseline contains one legitimate Production draft. A fresh cloud copy was independently verified and retained, migration 004 alone was applied, and every existing domain row and the draft fingerprint were preserved. Application release proceeds only after final quality, source-control and protected Preview/security gates. Question imports and review of the existing draft remain outside this rollout.


## Final provenance and rollout review

Question-level source fields: **NO**. Per-asset PDF page/region provenance retained: **NO**. Unpersisted-source warning: **NO**. Original question numbering retained: **NO**. Hidden provenance in tags/notes/captions: **NO** in official packages. Visual role/placement/MIME/size/hash/alt/caption/opaque references retained: **YES**. Canonical relational records plus private assets: **YES**. Original PDF/prepared package required after successful import: **NO**. Redraw/regeneration/OCR reconstruction/visual transformation: **NO**. Automatic original-PDF origin certification: **NO**.

The two populated schema-003 upgrade tests execute final migration 004 using SQLite and libSQL adapters, preserve nested parts, schemes, steps, hints, existing asset references, two immutable revisions/classifications, a pending review, tags/search and hierarchy IDs, and successfully import a new no-part draft afterward. Foreign-key and integrity checks pass. Migrations 001/002/003 remain unchanged; no migration 005 was created.

Future syllabus compatibility gate: **PASS ? no new material coupling introduced by importer/migration 004**. Existing single-topic limitations and the ordered implementation plan are documented in `SYLLABUS_VERSION_REUSE_AUDIT.md`. No future-syllabus implementation was performed.

Production migration status: **PASS — existing draft preserved**. Revised baseline: questions 1, draft 1, approved 0, assets 0, hierarchy 2/18/82/0, events 3. Migrations now 001/002/003/004; FK/integrity pass. Complete educational content fingerprint and all original rows are unchanged. Fresh verified backup retained. Postmigration release checks passed 184 unit/integration tests; all 49 browser tests also passed (exit 0). No question/import/Blob/curriculum write was performed. See `QUESTION_JSON_IMPORT_PRODUCTION_ROLLOUT_REPORT.md` for current release gates and sanitized preservation evidence.
