# MATRICULATION PHYSICS QUESTION BANK

# TURSO RUNTIME MIGRATION

Verified on 8 October 2026 (Asia/Kuala_Lumpur).

The existing Turso target `matriculation-physics-question-bank` now has the original
repository migrations 001 and 002. The Express runtime uses asynchronous,
server-side libSQL access. The same-repository Vercel API function, routing and
health endpoint are prepared and verified locally against the cloud database.
No Vercel deployment was performed; verification of an actual hosted preview
remains a manual step.

## DATABASE

| Check                             | Result |
| --------------------------------- | ------ |
| Turso target audited              | PASS   |
| Migration 001 detected            | PASS   |
| Migration 002 applied             | PASS   |
| schema_migrations current         | PASS   |
| Current runtime schema compatible | PASS   |

Before application, the cloud contained migration 001 only. Its complete logical
schema and typed row hashes matched the completed logical migration evidence.
There were no unexpected records. The unchanged
`server/migrations/002-curriculum.sql` was executed in a libSQL write transaction;
tracking was inserted only after successful schema and classification work. No
Turso-specific SQL adaptation, reset or data-model redesign was required.

`schema_migrations` contains exactly:

| Version | applied_at (UTC)                              |
| ------- | --------------------------------------------- |
| 1       | 2026-10-07T11:40:17.807Z (original preserved) |
| 2       | 2026-10-08T12:15:25.239Z                      |

The explicit migration runner rechecks tracking within its transaction. The
administrative tool refuses an already-applied 002, unexpected schema/content,
or an unexpected missing migration. Its final safety gate re-audits baseline
schema/content under the same write transaction before DDL. Failed operations
roll back; isolated tests confirm both repeatability and failure behavior.
Application startup only checks the schema and never applies migrations.

The final cloud schema exactly matches a fresh database created using the current
repository migration files: 20 normal tables plus one FTS5 virtual table, 14
explicit indexes plus 29 constraint indexes, and 15 triggers. FTS internal shadow
tables are excluded from logical counts. Foreign-key check returned no violations;
integrity check returned `ok`.

### Final cloud row counts

| Logical table                    | Rows |
| -------------------------------- | ---: |
| assets                           |    0 |
| chapters                         |    0 |
| courses                          |    1 |
| curriculum_events                |    0 |
| curriculum_versions              |    1 |
| difficulty_levels                |    3 |
| hints                            |    0 |
| question_parts                   |    0 |
| question_search                  |    0 |
| question_tags                    |    0 |
| question_version_classifications |    0 |
| question_versions                |    0 |
| questions                        |    0 |
| revision_candidates              |    0 |
| schema_migrations                |    2 |
| semesters                        |    2 |
| solution_steps                   |    0 |
| solutions                        |    0 |
| subtopics                        |    0 |
| tags                             |    0 |
| topics                           |    0 |

Original IDs and original-column typed row hashes are unchanged, including the
original migration-001 tracking row. The two semesters now reference the active
`legacy-matriculation-physics` curriculum version with code `LEGACY`. This is the
existing migration's reconstruction of unversioned taxonomy, not an imported
authoritative curriculum. Taxonomy status/revision defaults are active/1.

The immutable source backup remains at migration 001 with SHA-256
`d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`.
Backup files, the original SQL dump, original logical migration artifacts,
`data/bank.sqlite`, and uploads were preserved. Fingerprints before/after match.
No credential values were printed or written to files.

## CURRICULUM VERSIONING

| Check                      | Result |
| -------------------------- | ------ |
| curriculum_versions        | PASS   |
| curriculum_events          | PASS   |
| historical classifications | PASS   |
| related indexes/triggers   | PASS   |

Migration 002 adds `curriculum_versions`, `curriculum_events`, and
`question_version_classifications`; semester curriculum membership; and status
and revision columns on semesters, chapters, topics and subtopics. Its four
explicit indexes are `one_active_curriculum`, `semesters_curriculum`,
`curriculum_course`, and `curriculum_events_entity`. All 13 added triggers are
present, including immutable classifications, stable course/membership guards,
retirement rather than deletion, and guarded hierarchy moves.

The migration does not add columns to `question_versions`. Historical provenance
is stored in classification JSON, preserving the original version snapshots.
Production has zero historical question records; populated migration, immutable
history, rename, import/export, clone/activation and unreconstructable-history
rollback behavior passed isolated regression tests. No synthetic historical
records were added to production.

## FTS5

| Check                        | Result |
| ---------------------------- | ------ |
| question_search preserved    | PASS   |
| Search maintenance preserved | PASS   |
| MATCH query                  | PASS   |

The original schema is unchanged:

```sql
CREATE VIRTUAL TABLE question_search
USING fts5(question_id UNINDEXED,search_text,tokenize='unicode61');
```

`Bank.indexQuestion` and `Bank.refreshSearch` remain the search-maintenance
mechanism, now awaited. No search-maintenance triggers were introduced. Isolated
libSQL and disposable cloud tests verified positive MATCH results, draft updates,
search refresh without duplicates, replacement/deletion of indexed entries and
rollback. Production MATCH/filter reads succeed and return zero questions.

## RUNTIME

| Check                                      | Result |
| ------------------------------------------ | ------ |
| Local SQLite production dependency removed | PASS   |
| Turso adapter                              | PASS   |
| Async conversion                           | PASS   |
| Transaction behavior                       | PASS   |
| Environment validation                     | PASS   |

One `TursoAdapter` creates the official `@libsql/client/web` client. `Bank`,
curriculum, revision helpers and Express callers await database operations.
Business logic consumes an injected transport interface. SQLite remains explicitly
available for isolated tests/recovery and is excluded from the production API
import graph; there is no SQLite fallback.

Write transactions preserve deferred foreign-key behavior and isolate concurrent
requests using `AsyncLocalStorage`. Callback and commit failures reject, trigger
rollback and close the transaction. Nested transactions are rejected. Tests cover
concurrent transaction sessions and failure paths.

The actual production cloud was also queried using a read-only token through the
Vercel handler from an empty temporary working directory. Health, taxonomy,
curriculum and question reads passed; no SQLite, upload or persistence files were
created. Neither `bank.sqlite` nor WAL/SHM files are required by the production
runtime.

## VERCEL API

| Check                                    | Result |
| ---------------------------------------- | ------ |
| Express Vercel structure                 | PASS   |
| /api routing prepared                    | PASS   |
| /api/health implemented                  | PASS   |
| Localhost production assumptions removed | PASS   |

`api/index.ts` exports the lazy Express function without calling `listen()`.
`vercel.json` keeps Vite/dist in the same deployment, routes API and unavailable
upload paths to the function, and provides frontend SPA fallback. Unknown API
paths retain JSON 404 responses. Frontend API requests remain relative. Loopback
addresses remain only in local development configuration/startup and endpoint
validation.

Health performs a fresh database query. Successful responses are
`{"status":"ok","database":"connected"}`; unavailable database/schema responses
are safe 503 JSON. No URL, token, environment, region or stack trace is exposed.
Local route tests, an in-memory function bundle check and read-only real-cloud
handler checks passed. A deployed Vercel URL has not been tested in this task.

## SECURITY

| Check                                | Result |
| ------------------------------------ | ------ |
| Turso token server-only              | PASS   |
| Anonymous unsafe writes protected    | PASS   |
| Remaining auth limitation documented | PASS   |

Required credentials are server variables with no `VITE_` prefix. Real `.env*`
files are ignored; `.env.example` contains names with blank values. Automated
tests inject isolated adapters and never consume production credentials.
Connection errors are sanitized before responses/logging.

Hosted mutations are blocked by server middleware with 403 until teacher
authentication is implemented. Hosted upload requests return 503. Local loopback
teacher authoring remains available with an appropriate write-capable server
token. No frontend password or new authentication system was built.

Teacher/student preview modes are presentation modes. Teacher read endpoints and
answer exports retain existing behavior without role-based read authorization.
Use deployment protection for preview and implement real server-side authorization
before exposing sensitive content or enabling hosted writes.

## UPLOADS

| Check                                     | Result |
| ----------------------------------------- | ------ |
| Current local upload behavior preserved   | PASS   |
| Durable hosted upload storage implemented | NO     |
| Storage production gap documented         | PASS   |

Local filesystem uploads retain validation, unique names, MIME/signature checks
and sandbox behavior. Hosted functions neither create upload directories nor
pretend the Vercel filesystem is durable. Hosted uploads and existing local asset
paths report unavailable storage. No PDFs/images were stored in Turso, moved,
imported or deleted. Durable object storage remains a separate task.

## QUALITY

| Check                   | Result | Evidence                                                       |
| ----------------------- | ------ | -------------------------------------------------------------- |
| Typecheck               | PASS   | `npm run typecheck`                                            |
| Lint                    | PASS   | `npm run lint`                                                 |
| Unit/integration tests  | PASS   | `npm test`: 64 passed, zero failures/skips                     |
| Browser tests           | PASS   | `npm run test:browser`: 17 passed                              |
| Production build        | PASS   | `npm run build`                                                |
| Migration/schema checks | PASS   | `npm run db:check`, `npm run schema:check`, cloud audit        |
| Accessibility           | PASS   | Existing browser axe checks, including mobile curriculum flows |
| git diff --check        | PASS   | Final working-tree check                                       |

All original 47 unit/integration and 17 browser tests remain. Existing assertions
were converted to await async behavior; none were deleted or weakened. The 17 new
tests cover configuration, transport failures, parameterized queries/writes,
transaction isolation/rollback, migration gates, FTS/filtering, versions and JSON,
health, hosted protections, safe errors and Vercel routing. Regression coverage
also includes question editing and teacher/student previews.

An initial read-only audit stopped on ambiguous rowid projection naming. Explicit
aliases resolved it before any schema mutation. Final checks have no unresolved
failures.

### PREVIOUS TEST COUNTS

- Unit/integration: 47
- Browser: 17

### CURRENT TEST COUNTS

- Unit/integration: 64
- Browser: 17

## CONTROLLED CLOUD SMOKE TEST

Created a disposable cloud copy named
`physics-bank-runtime-smoke-20261008-c624` from the audited migration-002 database.
Only this scratch target received TEST taxonomy and draft question fixtures. The
smoke tool rejects the production target and requires a matching explicit scratch
URL. Persistent reads across separate connections, create/update, FTS/refresh,
rollback, health and hosted write protection passed.

Persistent deletion was verified with a disposable tag. Question-version history
retains its existing deletion guards; draft fixtures were removed by destroying
the entire scratch database. Scratch destruction succeeded, and the subsequent
database list contained only the production target. Final read-only production
audit confirmed the exact expected counts above and no test fixtures. Production
was never used for smoke-test writes.

## EVIDENCE

New evidence is separate from immutable logical migration artifacts and remains
in ignored `data/turso-runtime/`:

- [Pre-migration audit](data/turso-runtime/schema002-audit-20261008/before.json)
- [Applied migration before/after audit](data/turso-runtime/schema002-applied-20261008/after.json)
- [Final production schema/count/hash audit](data/turso-runtime/schema002-final-audit-20261008/after.json)
- [Protected-file fingerprint verification](data/turso-runtime/schema002-final-audit-20261008/safety.json)
- [Disposable cloud smoke results](data/turso-runtime/cloud-smoke-20261008.json)
- [Read-only production runtime from empty directory](data/turso-runtime/production-runtime-readonly-20261008.json)
- Quality logs: `typecheck.log`, `lint.log`, `unit-integration.log`, `browser.log`,
  `build.log`, `db-check.log`, `schema-check.log`, `api-check.log`

The original [TURSO_MIGRATION_REPORT.md](TURSO_MIGRATION_REPORT.md) describes the
immutable migration-001 source snapshot and remains unchanged.

## CONTENT AND DELIVERY

- REAL PRODUCTION QUESTIONS IMPORTED: NO
- OFFICIAL CURRICULUM IMPORTED: NO
- COMMIT: NO
- PUSH: NO
- DEPLOYMENT: NO

## FILES CHANGED

Files changed or added for this runtime stage:

- Runtime/transport: `server/database.ts`, `server/database-adapter.ts`,
  `server/turso-adapter.ts`, `server/sqlite-adapter.ts`, `server/migrations.ts`,
  `server/runtime.ts`, `server/index.ts`
- Awaited business/API flow: `server/curriculum.ts`, `server/revisions.ts`,
  `server/app.ts`
- Hosting: `server/vercel-handler.ts`, `api/index.ts`, `vercel.json`
- Configuration/packages: `.env.example`, `package.json`, `package-lock.json`,
  `tsconfig.json`
- Checks/admin: `scripts/check-db.ts`, `scripts/browser-server.ts`,
  `scripts/check-vercel-api.ts`, `scripts/check-turso-runtime.ts`,
  `scripts/turso-runtime-admin.ts`, `scripts/turso-cloud-smoke.ts`
- Tests/fixtures: `tests/test-bank.ts`, `tests/turso.test.ts`,
  `tests/hosting.test.ts`, `tests/fixtures.ts`, `tests/api.test.ts`,
  `tests/bank.test.ts`, `tests/curriculum.test.ts`
- Documentation: `README.md`, `docs/TURSO_RUNTIME.md`,
  `TURSO_RUNTIME_MIGRATION_REPORT.md`

The original SQL migration files and frontend source remain unchanged. Earlier
logical migration tools/reports and the existing architecture audit were retained.
All changes remain in the working tree for review.

## PACKAGES ADDED/REMOVED

- Added production dependency `@libsql/client` `^0.18.0` and its lockfile dependencies.
- Removed: none.
- Production uses the official `/web` export for the remote Node-compatible
  transport; native SQLite/libSQL is confined to isolated tooling/tests.

## ENVIRONMENT VARIABLES REQUIRED

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

No actual credential values appear in this report. Local `PORT`, `BANK_DATA_DIR`
and `NODE_ENV` remain optional; `BANK_DATA_DIR` now controls local uploads only.

## MANUAL STEPS REQUIRED BEFORE DEPLOYMENT

1. Review this working tree and [the setup guide](docs/TURSO_RUNTIME.md). Do not
   rerun migration 002 or the original migration-001 import against the cloud.
2. Obtain the URL and a read-only application token manually in your own terminal:

   ```powershell
   wsl /home/pekchunhoe/.turso/turso db show matriculation-physics-question-bank --url
   wsl /home/pekchunhoe/.turso/turso db tokens create matriculation-physics-question-bank --read-only --expiration 30d
   ```

   Treat token output as a secret; put it directly into the relevant secret field.
   Do not paste it into chat/Git or save it in a repository file. Arrange rotation
   before expiry. A trusted local authoring session requires a separate
   write-capable token, obtained manually by omitting `--read-only`.

3. In Vercel, keep this repository root/Vite configuration and select Node 24.x.
   Set both server variables for **Preview**. Set corresponding values for
   **Production** before a production deployment. Set **Development** only if
   using Vercel's development environment; ordinary local development uses server
   process variables. Use read-only hosted tokens while writes are disabled.
4. Enable deployment protection and deploy a preview manually after review.
   Verify `/api/health` 200, taxonomy/curriculum reads, empty question results,
   unknown API JSON 404, hosted mutation 403, and hosted uploads 503. Confirm SPA
   navigation and assets load on that actual preview.
5. For any further positive cloud persistence test, use a separately created
   disposable scratch database and destroy only that database afterward. Do not
   add fixtures to production to demonstrate persistence.
6. Implement durable object storage and real server-side teacher authorization
   before hosted authoring and real content import. Review read authorization
   before publishing sensitive answers or teacher notes.

## KNOWN LIMITATIONS

- Vercel configuration is prepared and locally verified; no hosted preview or
  production deployment was performed in this task.
- Teacher/student authentication and role-based read authorization remain absent.
  Hosted writes are disabled until authentication is implemented.
- Durable hosted upload storage is not implemented; hosted uploads/local asset
  links report unavailable storage. Local uploads remain usable.
- Production contains no chapters, topics or questions. Positive-content checks
  therefore used isolated fixtures and the destroyed scratch cloud database.
- The original backup/local SQLite intentionally remain at their original state;
  current production persistence is Turso, not a synchronized local replica.

RECOMMENDED NEXT STEP: Configure Turso credentials in Vercel Preview, deploy a
preview manually, verify `/api/health` and cloud persistence using isolation, then
implement durable object storage before importing the authoritative curriculum
and first approved Physics question.
