# Matriculation Physics Question Bank

A teacher workspace with relational Turso/libSQL persistence, server-side search and filters, structured authoring, and reviewed revisions. No authored Physics questions or invented official curriculum are seeded. SQLite remains available for isolated tests and recovery tooling.

## Run

Requires Node.js 24 or newer.

Set server-side `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your terminal or secret manager first. See [Turso/Vercel setup](docs/TURSO_RUNTIME.md) for safe credential commands and environment configuration. The database must already have migrations 001 and 002; request startup verifies the schema and never runs migrations automatically.

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

The server binds to loopback. This is a trusted local teacher application: Student View is a preview mode, not an authenticated student account. Student responses exclude solutions, teacher notes, answer diagrams, answer PDFs, and original master PDFs. Add server-enforced roles before providing separate student access or hosting on a network.

## Use

1. Prepare a draft curriculum version in **Curriculum**, import your authoritative hierarchy or add its records, verify it and activate it. Existing unversioned taxonomy is labelled LEGACY. See [curriculum administration](docs/curriculum.md).
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
npm run build
npx playwright install chromium
npm run test:browser
git diff --check
```

Unit and HTTP tests use isolated databases. Browser tests use an in-memory bank with clearly labelled TEST ONLY content on port 3100; they do not modify the real bank on port 3000. Browser results and screenshots are saved under ignored `test-results/` and `playwright-report/`.

## Boundaries

- PDF extraction is deliberately unimplemented. `PdfRevisionImportService` defines the validated candidate/diff/review boundary for a later parser adapter. There is no automatic PDF overwrite route.
- No exam generator, random questions, numerical variants or AI Physics authoring are included.
- Curriculum edits preserve stable IDs. Referenced subtrees cannot move in place; clone/import a new version for major changes. Retirement preserves questions/history. See [editing and migration policy](docs/curriculum.md).
- Revision diffs compare every structured field. Collections such as parts, solutions, hints and assets appear as complete before/after JSON blocks; a finer per-field collection diff can be added later without changing canonical records.
- Availability flags are author-controlled and are not inferred from content.

See [architecture](docs/architecture.md) for the schema and revision design.

The earlier Vercel audit found frontend HTTP 200 and API HTTP 404. This checkout now includes a same-deployment Express function, API routing and `/api/health`; no deployment was performed. Hosted mutation routes are disabled until teacher authentication exists, and hosted uploads report unavailable durable storage. See [Turso runtime setup](docs/TURSO_RUNTIME.md) and [the runtime migration report](TURSO_RUNTIME_MIGRATION_REPORT.md). The original production findings remain historical evidence.

See [the production audit report](PRODUCTION_AUDIT_REPORT.md) for explicit PASS/FAIL results, data-preservation evidence and final test counts. The earlier FINAL_REPORT.md is retained as baseline evidence.
