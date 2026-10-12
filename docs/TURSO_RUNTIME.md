> Current checkout requires additive migration 006. Production remains unchanged on its existing schema. Earlier migration commands below do not apply 006; see [the controlled Preview sequence](production-and-pilot.md).

# Turso runtime and Vercel setup

The Express API now uses one server-side `@libsql/client/web` adapter. Production
requests never open `data/bank.sqlite` or create SQLite WAL/SHM files. The SQLite
adapter remains available explicitly for tests and recovery tooling. Tests never
read Turso credentials or write to the production database.

The previously verified cloud database has migrations 001 and 002. This checkout
requires auth migration 003, which has not been applied to production. Follow
[explicit migration and first-admin setup](ADMIN_SECURITY.md) before deployment.
Startup checks migration level and structures; it does **not** run schema
migrations. The original backup, SQL dump and migration verification artifacts
remain immutable. Migration 002 reconstructs the existing taxonomy as LEGACY; it
does not import an official syllabus or questions.

## Server-side environment

Required variables:

```text
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

Never prefix a credential with `VITE_`. Vite exposes prefixed variables to browser
code. `.env.example` contains names only; real `.env*` files are ignored. This task
did not create a credential file. Configure local variables in your terminal or
secret manager. The application consumes them from the server process environment.

Run these commands **manually in your own terminal** to obtain the application
credentials. Token output is secret: put it directly into the appropriate secret
manager/Vercel field, and never paste it into chat, reports, Git or application code.

```powershell
wsl /home/pekchunhoe/.turso/turso db show matriculation-physics-question-bank --url
wsl /home/pekchunhoe/.turso/turso db tokens create matriculation-physics-question-bank --read-only --expiration 30d
```

The read-only token served the previous hosted-read-only stage. After review,
authentication requires a scoped expiring server write token for session/throttle
state and authorized authoring. Obtain it manually by omitting `--read-only` while
retaining an explicit expiration. Never print/paste its value. Public visitors
receive no token or database authoring privileges. Set a rotation reminder.

For local setup, assign the two variables in your terminal without storing them in
source. With those variables available to the process:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. The local loopback server preserves teacher editing and
uploads, using Turso for relational persistence and `data/uploads` for local files.
`BANK_DATA_DIR` changes **local upload storage only**; it no longer selects a
database. `PORT` is optional. For the local production-mode frontend:

```powershell
npm run build
npm start
```

The server fails safely if credentials/connectivity/current schema are missing.
It never falls back to SQLite. Use the isolated test commands to work without cloud
credentials; they do not launch the production bank.

## Vercel configuration

Keep Node 24.x, the same Vite project root, `vercel.json` routing, and protected
Preview. The function receives relative `/api/*` and `/uploads/*` requests without
`listen()` or local storage initialization. Configure server-only Turso write
credentials separately for Preview and Production. Use a disposable Preview
database/private store for initial authenticated testing. Review and explicitly
apply migration 003, then manually bootstrap its first admin before deployment.
See [current security and manual setup](ADMIN_SECURITY.md) and
[Private Blob setup](ASSET_STORAGE.md). No deployment was performed by this task.

After manual deployment and migration:

```text
GET /api/health             -> 200 safe database status
GET /api/taxonomy           -> published active/retired curriculum
GET /api/questions          -> current approved questions only
POST /api/questions        -> 401 without admin identity
POST /api/uploads          -> 401 without admin identity
GET /uploads/<key>         -> approved public assets or admin private assets;
                              404 for private anonymous reads, 503 if unconfigured
GET /api/unknown           -> 404 JSON
```

Login/logout/session use persistent digest-only sessions, finite Secure hosted
cookies, exact Origin plus custom-header CSRF checks and durable rate limits.
Students need no login to view approved schemes/hints or print a question set.
History, candidates, teacher notes, original sources and authoring are admin-only.
Admin status does not bypass domain or upload validation. Hosted files are limited
to 3 MiB; local files retain 20 MiB. Managed Blob URLs/credentials remain internal.

Health performs a fresh database query without Blob I/O. It exposes no URL,
token, environment or stack trace. Missing credentials/current schema produce safe
503 initialization/health responses. Local checks do not certify live deployment:
perform the disposable protected Preview smoke documented in the security guide.

## Transactions and explicit migrations

For the current auth upgrade use only `auth:migrate` and `auth:bootstrap` as
documented in [admin setup](ADMIN_SECURITY.md). The old migration-002 tool and
commands below describe historical migration evidence. They are not the 003
procedure; do not rerun SQLite-to-Turso transfer or the old application command.

`Bank`, curriculum operations, routes and revision helpers await all database work.
`TursoAdapter` opens a libSQL write transaction and uses `AsyncLocalStorage` to route
every read/write in its callback to that transaction. Parallel HTTP requests cannot
share its transaction accidentally. Commit failures and callback failures reject;
rollback is attempted and the stream is closed. Writes are never retried silently.
SQLite tests serialize access so outside requests cannot join an in-memory
transaction. Nested transactions are rejected explicitly.

Migrations use the original SQL files and existing `schema_migrations` table. The
runner rechecks tracking under its write transaction, applies each missing migration
once, validates historical-classification reconstruction, and only then records it.
No schema reset, FTS redesign or search-maintenance triggers were introduced.

`scripts/turso-runtime-admin.ts` is an explicit administrative tool for this audited
target. Its default mode is read-only. It requires `--target
matriculation-physics-question-bank` and a new `--output-dir`, audits original schema
and typed row hashes from the completed logical migration evidence, and refuses
unexpected records/schema. `--apply` is only allowed before migration 002; an
already current database should use read-only audit mode. Its evidence is separate
from the original migration artifacts under ignored `data/turso-runtime/`.
Before DDL, the administrative safety gate repeats the schema/content audit inside
the same write transaction. A failed gate rolls back and leaves migration 002 absent.

`scripts/check-turso-runtime.ts` is a separately invoked, explicitly targeted
read-only check. It starts the Vercel handler from an empty temporary working
directory, verifies cloud reads/health and hosted protections, and confirms that
the runtime creates no local persistence files. Use a read-only token for it.

For future populated databases, plan a new migration/audit procedure using fresh
evidence rather than bypassing this tool's baseline safety checks. Do not run the
original logical-import tool against the now upgraded cloud target: its source
snapshot intentionally has migration 001 only.

## Verification

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
npm run test:browser
git diff --check
```

All automatic tests use in-memory or temporary local SQLite/libSQL and mocked Blob transport. Browser fixtures remain isolated. The obsolete structured-question cloud smoke writer has been removed. Follow [the controlled Preview sequence](production-and-pilot.md) for the image architecture; migration 006 must only target independently verified isolated resources during Preview verification.

The API also has a native ESM regression check. `tsconfig.api.json` uses NodeNext
for the complete API dependency graph while the frontend keeps Bundler resolution.
`api:esm:check` compiles unbundled JavaScript into an isolated temporary directory,
audits import/re-export/dynamic-import targets, and imports the real emitted API
with ordinary Node. It removes Turso credentials and Node loader options from the
child environment and verifies a safe credential-free health response. A negative
check reproduces the extensionless-import crash using temporary emitted output.
`api:check` includes this verification; no database connection or migration runs.

Sources: [official libSQL client reference](https://docs.turso.tech/sdk/ts/reference),
[transaction semantics](https://tursodatabase.github.io/libsql-client-ts/interfaces/Transaction.html),
[Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js),
[Vite routing](https://vercel.com/docs/frameworks/frontend/vite), and
[database copy creation](https://docs.turso.tech/cli/db/create).
