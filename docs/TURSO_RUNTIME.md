# Turso runtime and Vercel setup

The Express API now uses one server-side `@libsql/client/web` adapter. Production
requests never open `data/bank.sqlite` or create SQLite WAL/SHM files. The SQLite
adapter remains available explicitly for tests and recovery tooling. Tests never
read Turso credentials or write to the production database.

The current cloud database has repository migrations 001 and 002. Request startup
checks its migration level and required structures; it does **not** run schema
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

The read-only token is appropriate for the currently read-only hosted API. Set a
rotation reminder before expiry. A trusted local teacher authoring session needs a
separate write-capable token; obtain it manually by omitting `--read-only`, retaining
an explicit expiration. That write token must remain server-side and must not be
used to enable anonymous hosted writes.

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

Keep the same repository and deployment. `vercel.json` selects Vite, builds `dist`,
routes `/api/*` to the Node function exported by `api/index.ts`, and sends frontend
routes to `index.html`. The Express function receives the original API path, uses
relative frontend API calls, and never calls `listen()` or initializes local file
storage. API errors remain JSON rather than falling through to the frontend SPA.
`/uploads/*` also reaches the function and reports unavailable durable storage.

In Vercel Project Settings:

1. Select Node.js **24.x**, keep the project root at this repository, and use the
   checked-in Vite configuration/build command.
2. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` under Environment Variables for
   **Preview**. Prefer a separate preview database if future preview work will
   mutate data; the current hosted API is read-only.
3. Add the corresponding values for **Production** before deploying production.
   Use a read-only application token while hosted writes remain disabled.
4. Add them to **Development** only if using Vercel's local-development environment;
   ordinary `npm run dev` reads the local server process variables.
5. Enable deployment protection for the preview. Teacher/student preview modes are
   presentation modes, not authenticated roles. Review results before making any
   real content public.
6. Deploy a preview manually after reviewing the working tree. This task does not
   commit, push or deploy.

Verify the preview with:

```text
GET /api/health                 → 200 {"status":"ok","database":"connected"}
GET /api/taxonomy               → semesters and LEGACY curriculum
GET /api/curriculum-versions    → existing LEGACY version
GET /api/questions              → an empty page, total 0
POST /api/questions             → 403 (hosted writes disabled)
POST /api/uploads               → 503 (durable storage unavailable)
GET /api/unknown                → 404 JSON
```

Health performs a fresh database query. It never exposes the URL, token, region,
environment or stack traces. Connection/schema initialization failures return safe
503 JSON. Client errors are not logged verbatim, because they can contain connection
details. A local build/routing test cannot certify an undeployed Vercel URL: the
actual hosted preview must still be checked after manual deployment.

## Authentication and uploads

All hosted POST/PUT/PATCH/DELETE mutations are disabled in server middleware. No
frontend password is used. There is no teacher login, student login or role-based
read authorization in this stage. Teacher-facing read endpoints and answer exports
retain their existing behavior; use a private preview and add real server-side roles
before exposing sensitive materials or enabling writes.

Local upload signature validation, sandbox CSP, MIME checks and unique names remain
intact. Vercel cannot use `data/uploads` as durable archive storage, so the hosted
function does not create a directory, accept uploaded bytes or serve local files.
Upload/asset requests receive 503 until durable object storage is implemented.
Historical `/uploads/` asset links are not rewritten. No PDFs/images were placed in
Turso, migrated or deleted.

## Transactions and explicit migrations

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
npm run build
npm run test:browser
git diff --check
```

All automatic tests use in-memory or temporary local SQLite/libSQL and mocked HTTP
transport. Browser fixtures remain isolated. The separately invoked
`scripts/turso-cloud-smoke.ts` refuses the production target and requires an explicit
`physics-bank-runtime-smoke-*` scratch URL. Its disposable draft/CRUD/FTS/rollback
test is followed by deletion of only the newly created scratch database. The
production target is re-audited afterward to confirm no smoke fixtures leaked.

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
