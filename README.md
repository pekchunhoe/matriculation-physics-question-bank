# Matriculation Physics Question Bank

A local teacher workspace with a relational SQLite database, server-side search and filters, structured authoring, and reviewed revisions. No authored Physics questions or invented official curriculum are seeded.

## Run

Requires Node.js 24 or newer.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. The first start applies migrations and seeds Matriculation Physics, Semester 1, Semester 2, and Easy / Medium / Hard. Chapters and topics await your authoritative curriculum.

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

SQLite lives in `data/bank.sqlite`, and uploaded files in `data/uploads/`. These directories are excluded from Git. `BANK_DATA_DIR` changes the data directory; `PORT` changes the local port. These environment values are optional; there are no credentials to configure.

Stop the application before copying the entire `data/` directory for a consistent backup. Keep uploaded files with the database because historical snapshots reference them. JSON export preserves the structured question, solutions, hints, asset links, tags and stable code; files themselves are not embedded in JSON. Individual exports are not a full-database backup.

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

The supplied Vercel frontend returned HTTP 200 during the audit; taxonomy/question APIs returned HTTP 404. This checkout has no hosted backend/authentication/storage configuration. See [production findings and the pilot](docs/production-and-pilot.md). No deployment or real-data migration occurred. Back up data before the first updated start, which applies migration 002.

See [the production audit report](PRODUCTION_AUDIT_REPORT.md) for explicit PASS/FAIL results, data-preservation evidence and final test counts. The earlier FINAL_REPORT.md is retained as baseline evidence.
