# Matriculation Physics Question Bank

A public approved-question bank with authenticated administrator authoring, relational Turso/libSQL persistence, server-side search and reviewed revisions. Students need no accounts. No authored Physics questions or invented official curriculum are seeded. SQLite remains available for isolated tests and recovery tooling.

## Run

Requires Node.js 24 or newer.

Set server-side `TURSO_DATABASE_URL` and write-capable `TURSO_AUTH_TOKEN` in your terminal or secret manager first. See [admin setup](docs/ADMIN_SECURITY.md) and [Turso/Vercel setup](docs/TURSO_RUNTIME.md). The database must have migrations 001, 002 and 003; startup verifies the schema and never runs migrations. Migration 003 and first-admin bootstrap require separate manual invocation after review; neither was performed in production by this task.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. The migrated cloud database contains Matriculation Physics, Semester 1, Semester 2, Easy / Medium / Hard, and its reconstructed LEGACY curriculum version. Chapters and topics await your authoritative curriculum.

For the production build:

```powershell
npm run build
npm start
```

The local server binds to loopback. Public users can browse current approved questions, marking schemes and hints, select questions, and use **Print / Save as PDF**. Teacher notes, source PDFs, drafts/reviewing/retired records, revision history and authoring operations require server-side admin authentication. Preview modes remain presentation controls. Use **Admin login** for authoring; there is no registration or default account.

## Use

1. Sign in as an explicitly bootstrapped administrator. Prepare a draft curriculum version in **Curriculum**, import your authoritative hierarchy or add its records, verify it and activate it. Existing unversioned taxonomy is labelled LEGACY. See [curriculum administration](docs/curriculum.md).
2. Choose **Add question** or **Import JSON**. Enter the original authored content, difficulty and marks. The app never infers difficulty or repairs marks.
3. Review Student Preview and Teacher View. Student hints reveal one at a time for the whole question or each part.
4. Save with a revision note. Initial approval requires explicit confirmation and an answer scheme for each leaf part.
5. Editing an approved question creates a candidate. Compare current and candidate content, enter a reviewing teacher's name, confirm the decision and approve the replacement. The existing approved version remains active until that decision.
6. Browse by semester, topic and difficulty. Active curriculum and Approved are defaults. Secondary version/visibility controls show old curricula/retired items; More filters controls question statuses.

## Data and backup

Runtime relational data lives in Turso. The original `data/bank.sqlite` and checkpointed backups are retained as recovery evidence and are no longer opened by runtime entry points. Local uploaded files remain in `data/uploads/`. These directories are excluded from Git. `BANK_DATA_DIR` changes local upload storage only; `PORT` changes the loopback port. Turso server credentials are required.

Keep a Turso backup/export and a separate backup of local uploads because historical snapshots reference their files. The retained SQLite snapshot is the original recovery source, not a current cloud backup. JSON export preserves the structured question, solutions, hints, asset links, tags and stable code; files themselves are not embedded in JSON. Individual exports are not a full-database backup.

Question codes are immutable after creation. Retire questions through a reviewed status change rather than deleting them. Removing an asset link preserves its uploaded file for historical versions. Uploaded files have unique names and cannot overwrite previous files.

## Import contract

See [the import guide](docs/import-format.md) and [the JSON schema](docs/question-v1.schema.json). Foreign keys, nested-part integrity, approval completeness and valid LaTeX receive additional server validation. Existing taxonomy is resolved rather than automatically created. An approved question is revised by explicitly selecting the existing-code revision action; a duplicate new import fails.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run db:check
npm run schema:check
npm run api:check
npm run api:esm:check
npm run storage:check
npm run auth:check
npm run build
npx playwright install chromium
npm run test:browser
git diff --check
```

Unit and HTTP tests use isolated databases. Browser tests use an in-memory bank with clearly labelled TEST ONLY content on port 3100; they do not modify the real bank on port 3000. Browser results and screenshots are saved under ignored `test-results/` and `playwright-report/`.

`api:check` includes `api:esm:check`: it typechecks the complete API graph with NodeNext, audits unbundled emitted imports, and imports the compiled function with ordinary Node and no Turso credentials. Shared modules use explicit `.js` relative specifiers, which TypeScript and Vite resolve to their `.ts` sources. This catches native ESM resolution errors that bundling and `tsx` can hide.

## Boundaries

- PDF extraction is deliberately unimplemented. `PdfRevisionImportService` defines the validated candidate/diff/review boundary for a later parser adapter. There is no automatic PDF overwrite route.
- No exam generator, random questions, numerical variants or AI Physics authoring are included.
- Curriculum edits preserve stable IDs. Referenced subtrees cannot move in place; clone/import a new version for major changes. Retirement preserves questions/history. See [editing and migration policy](docs/curriculum.md).
- Revision diffs compare every structured field. Collections such as parts, solutions, hints and assets appear as complete before/after JSON blocks; a finer per-field collection diff can be added later without changing canonical records.
- Availability flags are author-controlled and are not inferred from content.

See [architecture](docs/architecture.md) for the schema and revision design.

This checkout includes the same-deployment Express API, native ESM checks, persistent admin sessions, durable abuse controls and resource-authorized Private Blob delivery. Anonymous authoring returns 401; administrators can upload validated files after login. Current approved diagrams/schemes are served publicly through the application; private authoring assets require admin identity. Hosted files are capped at 3 MiB; local uploads remain filesystem-based. See [security setup](docs/ADMIN_SECURITY.md), [security verification](ADMIN_DATABASE_SECURITY_REPORT.md), [asset storage](docs/ASSET_STORAGE.md) and [Turso runtime setup](docs/TURSO_RUNTIME.md). No deployment or production change was performed; earlier audit/storage/migration reports remain historical evidence.

See [the production audit report](PRODUCTION_AUDIT_REPORT.md) for explicit PASS/FAIL results, data-preservation evidence and final test counts. The earlier FINAL_REPORT.md is retained as baseline evidence.

## Self-contained Question JSON import

Admins can use `/import/question-json` to paste or upload one JSON package, validate and review rendered content, and **Import as Draft**. Embedded diagrams/FBDs are supplied in that same file; no runtime AI/API token is needed. See [the complete format guide](docs/question-json-import-format.md), [generated schema](docs/question-json-import.schema.json), and [examples](examples/question-import).

Migration 004 has been applied to Production after a verified cloud backup and complete preservation checks for its existing draft. Application release remains subject to exact-commit protected Preview and security verification; runtime requests never migrate the database. See [rollout status](QUESTION_JSON_IMPORT_PRODUCTION_ROLLOUT_REPORT.md) and [future syllabus audit](SYLLABUS_VERSION_REUSE_AUDIT.md). Existing structured exports/revisions remain available at `/import`.

Portable Question JSON excludes original PDF/question-number/page/region provenance. Preserve real PDF visuals through original extraction or lossless high-resolution rasterization/crop without redrawing or educational alterations. After successful import, source files may be discarded; canonical content is stored in database records and private visuals.
