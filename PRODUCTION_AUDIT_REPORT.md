# MATRICULATION PHYSICS QUESTION BANK

# PRODUCTION AUDIT + EDITABLE CURRICULUM

Audit date: 7 October 2026. Baseline commit: `fb06375`; the working tree was clean before this task. The original `FINAL_REPORT.md` is retained as baseline evidence. The audit/classification performed before implementation is in [docs/audit-baseline.md](docs/audit-baseline.md).

**Scope of PASS:** functional results below refer to the existing local React/Vite + Express + SQLite teacher workspace and isolated test environments. The supplied [Vercel frontend](https://matriculation-physics-question-bank.vercel.app/) returned HTTP 200, but read-only requests to `/api/taxonomy` and `/api/questions` returned HTTP 404. This checkout has no hosted backend/storage/authentication configuration. Hosted availability and authorization remain failures; a passing Vite build does not establish a working Vercel application.

```text
BASELINE
Existing repository audited: PASS
Existing architecture preserved: PASS
Unnecessary rebuild avoided: PASS
Existing stored data preserved: PASS

CURRICULUM ARCHITECTURE
Course support: PASS
Curriculum version support: PASS
Semester hierarchy: PASS
Chapter hierarchy: PASS
Topic hierarchy: PASS
Subtopic support: PASS
Stable taxonomy IDs: PASS
Display ordering: PASS
Retirement/archive support: PASS
Unsafe deletion prevention: PASS
Relational validation: PASS

CURRICULUM EDITING
Rename semester: PASS
Rename chapter: PASS
Rename topic: PASS
Rename subtopic: PASS
Reorder hierarchy: PASS
Move hierarchy items safely: PASS
Retire hierarchy items: PASS
Linked questions preserved: PASS
Impact warnings: PASS

CURRICULUM IMPORT / EXPORT
Import format: PASS
Schema validation: PASS
Duplicate detection: PASS
Transactional import: PASS
Import preview: PASS
Export support: PASS
Authoritative curriculum ready for import: PASS (local architecture; none imported)

QUESTION BANK
Semester browsing: PASS
Topic browsing: PASS
Difficulty filtering: PASS
Combined filtering: PASS
Keyword search: PASS
Marks filtering: PASS
Question cards: PASS
URL filter state: PASS

CONTENT
Structured question parts: PASS
Nested parts: PASS
Mark validation: PASS (warnings preserve authored allocations)
LaTeX mathematics: PASS
Visual assets: PASS
Structured answer scheme: PASS
Solution steps: PASS
Student hints: PASS
Approved PDF support: PASS

QUESTION IMPORT / EXPORT
JSON export: PASS
JSON import: PASS
Schema versioning: PASS
Import validation: PASS
Transaction safety: PASS
Import preview: PASS
Ready for first real approved question: PASS (local pilot; hosted pilot blocked)

VERSIONING
Question history: PASS
Historical versions viewable: PASS
Approved-question protection: PASS
Meaningful revision events: PASS
Future revised-PDF boundary: PASS (adapter boundary; extraction intentionally absent)
Automatic PDF overwrite prevented: PASS

SECURITY
RLS/policies: N/A (no Supabase or hosted policy integration)
Unauthorized writes protected: FAIL (no authenticated teacher/admin authorization)
Service secrets protected: PASS (none configured; server-only variables; env files ignored)
Storage security: FAIL (local archives are not role-protected; no durable hosted storage)
Unsafe rendering prevented: PASS (existing escaping, KaTeX and upload restrictions)

PRODUCTION
Vercel build compatibility: FAIL (frontend build PASS; API/runtime integration unavailable)
Environment configuration: PASS (local variables and deployment gaps documented)
Migrations reproducible: PASS (fresh, repeated, populated upgrade and rollback checks)
Production data mutated: NO

QUALITY
Responsive UI: PASS
Accessibility: PASS (automated baseline plus new curriculum controls)
Typecheck: PASS
Lint: PASS
Unit/integration tests: PASS
Browser tests: PASS
Production build: PASS (local Vite production build)
Migration/schema checks: PASS
git diff --check: PASS

PREVIOUS TEST COUNTS
Unit/integration: 30
Browser: 12

CURRENT TEST COUNTS
Unit/integration: 47
Browser: 17

COMMIT PERFORMED: NO
PUSH PERFORMED: NO
DEPLOYMENT PERFORMED: NO
```

Functional changes actually made:

1. Added curriculum versions with draft/active/retired lifecycle, optional effective dates, ordering, one active version per course and taxonomy-only cloning. Existing taxonomy receives an honest LEGACY label without invented official dates or syllabus.
2. Extended the existing Curriculum workspace with rename/reorder/move/retire/restore controls and explicit notes. IDs/slugs are stable. Deletion is blocked. Moves are restricted to unreferenced subtrees within one version; current/history/pending references prevent in-place moves. Retired ancestry blocks new child records and question assignments.
3. Added impact previews showing current/historical question counts, pending revisions, descendants and the previous active curriculum's question count. Revision/token checks prevent applying stale previews; referenced changes require confirmation.
4. Added strict curriculum JSON v1, read-only preview, duplicate/course/relationship/date checks, transactional imports and stable hierarchy exports. Imports create new drafts, never silently overwrite existing taxonomy.
5. Added immutable companion classification snapshots. New saves capture names/IDs; old history is labelled reconstructed from migration-time taxonomy. Rename refreshes existing FTS search labels while saved question snapshots remain unchanged. Missing historical taxonomy stops and rolls back migration.
6. Added curriculum selection to the existing editor and a secondary version/retired-items browser control. Semester/Topic/Difficulty stay primary; URL state remains. Existing API callers and old semester bookmarks retain access to older versions.
7. Added taxonomy/difficulty/content-count summaries to teacher/import preview, saved names in historical preview and optional provenance JSON v2. Original canonical v1 exports/imports and authored content remain supported.
8. Added lazy image loading, complete env-file exclusions, a names-only example and a clear unavailable-backend error for non-JSON API responses. No dependencies, backend replacement, authentication imitation or hosting adapter were introduced.
9. Added curriculum/production/pilot documentation and generated JSON schemas. Added 17 unit/HTTP/upgrade tests and five browser tests, including validated-ID stability across a rename between preview/save and provenance import preservation.

Requirements already satisfied and left unchanged:

- React/Vite frontend, Express routing, SQLite persistence, shared Zod validation and existing normalized question tables.
- Server-side FTS search, parameterized combined filtering, pagination, card metadata, existing secondary filters and counts.
- Stable question codes, controlled/extensible difficulty, nested parts, marks warnings, structured solutions/steps/marking points/notes, hints and archival PDF/image/SVG assets.
- Existing KaTeX syntax/rendering, progressive student hints and teacher-only content exclusion in student preview.
- Existing meaningful-save version history, revision notes, immutable original snapshots, candidate comparisons, mandatory named human approval and stale-candidate protection.
- Existing upload validation, unique filenames, historical asset links, future PDF adapter boundary and generator-ready approved-question query model.
- All original 30 unit/HTTP tests and 12 browser tests. Only the migration-count assertion changed from one to two; the shared fixture's topic-ID parameter gained a string annotation so versioned IDs typecheck. No assertions or scenarios were removed or weakened.

Database migrations added:

- `server/migrations/002-curriculum.sql`: additive version/event/classification tables; status/revision/version columns; indexes; backfill; membership/deletion/move/immutability guards. Migration 001 is untouched. No original question/content/version/asset rows are rewritten or deleted. Each migration runs in a transaction and once per database.
- The populated v1 upgrade test compares every original column/row in 16 content/taxonomy/history tables, including approved PDF relationships, before and after upgrade. Reopening does not reapply migration. An unreconstructable historical classification fails safely and preserves the old schema/history.
- The real local database was opened read-only for counts/SHA-256 row fingerprints. Every table's count/hash matched the pre-edit audit. It still has one course, two semesters, three difficulties, no chapters/topics/subtopics/questions/versions/assets and only migration 001. Migration 002 was not applied there or to production during testing.
- Before first updated runtime start, stop the old server, back up database/uploads consistently and rehearse on a copy. Backfill/index creation needs a write lock, disk space and time on larger banks. There is no destructive down-migration.

Major files changed:

- Backend: `server/database.ts`, `server/app.ts`, new `server/curriculum.ts` and migration 002.
- Contracts: `shared/curriculum.ts`, taxonomy type extensions in `shared/schema.ts`, schema generation/check script and new curriculum-v1/question-v2 JSON schemas. Existing question-v1 schema content is unchanged.
- UI: the existing Curriculum/Browser/Editor/Importer/Preview/components/API files, new `src/CurriculumTools.tsx` and a small responsive grid extension in the existing stylesheet.
- Validation: `tests/curriculum.test.ts`, `tests/browser/curriculum.spec.ts`, migration count checks and read-only `scripts/audit-data.ts`.
- Documentation/configuration: README, architecture/import notes, curriculum/production/pilot guides, audit evidence, `.gitignore`, `.env.example`, this report. The previous `FINAL_REPORT.md` remains untouched.

Verification evidence:

- `npm run typecheck`, `npm run lint`, `npm test` (47), `npm run db:check`, `npm run schema:check`, `npm run build`, `npm run test:browser` (17), `git diff --check`.
- New coverage includes all four rename levels with linked questions, topic ordering/retirement/restore/deletion, valid moves, current/history/pending move guards, stale edit/import tokens, version creation/clone/activation/retirement, preserved old-version queries, import rollback, ancestry errors, retired ancestors and populated migration/backfill/rollback.
- Notation checks preserve fractions, vectors, Greek letters, subscripts/superscripts, degrees, units, aligned equations and matrices. Malformed LaTeX still rejects imports.
- Browser tests retain desktop/tablet/mobile and baseline axe checks, and add mobile curriculum editing/import/version controls. Chromium automation used an isolated in-memory bank on port 3100 and temporary uploads. The in-app Browser skill had no connected browser, so the repository's existing headless Playwright suite supplied verification. Screenshots are under ignored `test-results/`.
- A formatting-induced lint issue and a new invalid test fixture were corrected during verification. Final applicable checks pass; hosted API/authentication/storage failures above remain unresolved and are not hidden.

Known limitations:

- Vercel serves the frontend but the audited API paths return 404. No backend repository/service, persistent production database/storage configuration or server authorization was available to audit. Full hosted operation is not verified or ready.
- This is a trusted loopback teacher workspace. Cross-origin write protection is not authentication; direct callers and teacher endpoints lack authenticated roles. Student view is a preview, not a public student security boundary. Local archives lack role-based access control.
- Older taxonomy names already changed before migration cannot be recovered; reconstructed provenance is explicit. Referenced subtree moves and physical deletion are intentionally disallowed. Splits/merges/reorganization use a new version; existing questions are not automatically reassigned.
- Curriculum import creates a new draft and does not merge two files into an existing version. Provide one complete reviewed hierarchy or add remaining records through the existing form. Full recovery uses database/uploads backups.
- v2 exports preserve names/IDs and authored content but not file bytes. New v2 question imports retain supplied provenance; existing-question revisions capture local classification when approved. External HTTPS asset availability requires manual verification.
- No authoritative syllabus or real questions were provided/imported. No basket, generator, AI authoring/variants/search, OCR, PDF extraction, student accounts, public portal or analytics was built. The existing extraction boundary continues to return 501 without an adapter.
- Automated accessibility tests do not substitute for human keyboard/screen-reader review of real pilot content. No thousands-of-questions load benchmark or hosted end-to-end test was performed.

Manual configuration required:

- Local: Node 24+, install the existing dependencies, back up/rehearse migration, then restart the updated runtime. Optional `PORT` and `BANK_DATA_DIR` are documented; `NODE_ENV`/`--production` select production mode. The scripts read shell environment and do not automatically load .env.
- Hosted: identify/provision the actual API runtime, persistent database and uploads, then implement/verify server-enforced teacher/admin authorization and file access before public use. No service URL or secret was guessed and nothing was deployed.
- Supply your authoritative curriculum and master-question assets/JSON. Follow [the curriculum guide](docs/curriculum.md) and [the one-question pilot](docs/production-and-pilot.md).

Recommended next step: import and verify the authoritative Semester 1 / Semester 2 hierarchy in a draft, then import one real approved Physics question as the pilot. Use the verified local workspace first, or resolve and verify the hosted backend before a production pilot.
