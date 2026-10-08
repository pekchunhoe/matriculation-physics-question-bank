# MATRICULATION PHYSICS QUESTION BANK

# DURABLE ASSET STORAGE

Verified locally on 2026-10-08. The private-storage foundation is implemented and
tested. No live Blob store was created, connected or accessed; deployment-level
Blob readiness remains unverified. Changes remain in the working tree.

## BASELINE

| Check                       | Result |
| --------------------------- | ------ |
| Turso runtime preserved     | PASS   |
| Migration 001/002 preserved | PASS   |
| Native ESM fix preserved    | PASS   |

The Turso adapter, migration SQL, curriculum structure, FTS5, question history,
database credentials and production records were not changed. No cloud migration
or production data command was run. The original local SQLite file and checkpointed
backup retain SHA-256
`d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`.
The production-empty baseline is inherited from the previous verified migration;
this task did not reconnect to production to recertify its record counts.

## STORAGE

| Check                                 | Result |
| ------------------------------------- | ------ |
| Storage abstraction                   | PASS   |
| Local filesystem adapter              | PASS   |
| Vercel Private Blob adapter           | PASS   |
| Hosted filesystem persistence removed | PASS   |
| Private-by-default behavior           | PASS   |

`AssetStorage` provides asynchronous put/get/delete/exists/metadata operations.
`AssetService` owns validation, reference checks and compensation. Local startup
explicitly constructs `LocalAssetStorage`; `BANK_DATA_DIR` controls its upload
directory without changing Turso selection. Legacy local `/uploads/<filename>`
references remain supported.

The hosted handler selects `VercelBlobAssetStorage` only for a Vercel environment
with valid `BLOB_STORE_ID`; invalid/unavailable configuration fails closed. It
rejects injected local storage. The hosted dependency graph excludes the local
adapter and filesystem mutation imports; tests also verify an empty working
directory remains empty across hosted health/read/write requests.

The official SDK receives `access: 'private'` for upload/retrieval, disables
overwrites, and obtains project OIDC authentication automatically. Application
code passes the store identifier, without copying or pinning an OIDC token.
Private URLs stay inside the adapter; APIs/JSON use opaque
`/uploads/<UUID>-<SHA256>.<extension>` references. Internal retrieval checks the
private host, namespace, MIME, bounded length, signature and digest.
[Official SDK authentication](https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication).

## SECURITY

| Check                             | Result |
| --------------------------------- | ------ |
| Hosted anonymous uploads enabled  | NO     |
| Hosted write protection preserved | PASS   |
| Blob credentials browser-exposed  | NO     |
| Traversal protection              | PASS   |
| MIME/signature validation         | PASS   |
| SVG protection                    | PASS   |

Hosted API mutations, including uploads, return 403 before storage operations.
Configured private delivery returns 403; unavailable storage returns 503 on
delivery. Database health keeps its existing lightweight contract and does no
Blob I/O. No signed/public delivery, browser upload token, query admin key or
frontend authentication bypass was added.

Secure UUID keys use validated bytes and SHA-256 rather than browser paths.
Unsafe filenames, encoded traversal, absolute/backslash paths, controls,
unsupported signatures and MIME/extension mismatches are rejected. The local
20 MiB upload limit remains. SVG now requires well-formed UTF-8 XML and a restricted
static SVG subset with namespace checks and fragment-only references; scripting,
events, animation, foreign content, external resources and DOCTYPE/entities are
rejected. Local delivery preserves sandbox CSP, nosniff and byte ranges.

## CONSISTENCY

| Check                        | Result                                        |
| ---------------------------- | --------------------------------------------- |
| DB/blob failure compensation | PASS (internal combined-operation foundation) |
| Safe deletion                | PASS                                          |
| Orphan handling documented   | PASS                                          |

`uploadAndLink` compensates a failed transactional metadata callback by auditing
references and deleting only its own fresh, frozen upload receipt. The audit
runs under a database write transaction and includes current assets, every
immutable question-version snapshot, revision candidate snapshots in every
status, and candidate source PDFs. Shared/historical objects are retained.
Committed links despite a later callback error are also retained. Cleanup/audit
failures surface safe errors and opaque reconciliation references instead of
being swallowed. A timed-out Blob put reports its planned reference because
the remote write may have succeeded. Missing objects and corrupt reads are
detectable controlled states.

The existing editor still uploads and saves metadata in separate requests.
Uploads explicitly return `state: "staged"` and log their opaque reference.
A rejected later save retains staged bytes for retry; it does not invoke the
combined helper automatically. Abandoned uploads, lost responses and process
crashes require later reconciliation. There is no durable staging ledger or
automatic garbage collector. Those limits and the review procedure are detailed
in [asset storage documentation](docs/ASSET_STORAGE.md#consistency-and-retention).
There is no public physical-delete endpoint or distributed transaction.

## DATABASE

| Check                     | Result |
| ------------------------- | ------ |
| Schema migration required | NO     |
| Production data modified  | NO     |
| Real assets uploaded      | NO     |

The existing asset columns are `question_id`, `id`, `part_id`, `kind`, `url`,
`alt`, `mime`, and `display_order`. The existing URL field holds opaque references;
SHA-256 is encoded durably in new object keys and returned with size on upload.
No size/hash columns, byte columns or migration 003 were added. Question/revision
relationships, immutable snapshots and JSON provenance remain intact.

## QUALITY

| Check                          | Result          |
| ------------------------------ | --------------- |
| Typecheck                      | PASS            |
| Lint                           | PASS            |
| Unit/integration               | PASS            |
| Browser                        | PASS            |
| Build                          | PASS            |
| API checks                     | PASS            |
| Native ESM check               | PASS            |
| git diff --check               | PASS            |
| Database check                 | PASS            |
| Versioned JSON schema check    | PASS            |
| Storage-focused check          | PASS (25 tests) |
| Automated accessibility checks | PASS            |

All requested commands completed successfully: `typecheck`, `lint`, `test`,
`db:check`, `schema:check`, `api:check`, `api:esm:check`, `build`, `test:browser`,
`storage:check`, and `git diff --check`. Native NodeNext auditing covers 18 source
files/45 relative references and 17 emitted files/34 edges, including the negative
extensionless-import regression. The Blob SDK is mocked at its transport boundary;
tests use only isolated databases and temporary local storage. No live smoke was
run because no authorized disposable store was supplied. Ordinary tests never
require cloud credentials.

### PREVIOUS TEST COUNTS

- Unit/integration: 64
- Browser: 17

### CURRENT TEST COUNTS

- Unit/integration: 89 (64 existing + 25 storage tests; zero failures/skips)
- Browser: 17 (zero failures)

Existing test assertions remain, with the hosted upload expectation strengthened
from unavailable 503 to forbidden 403. Tests cover provider selection, no hosted
filesystem writes, private operations, malformed configuration, traversal,
collisions, MIME/signatures, SVG, digest corruption, bounded reads, missing bytes,
sanitized errors, failed links, compensation failures, staged retries and
current/shared/historical/revision/PDF retention.

## FILES CHANGED

- Storage foundation: `server/asset-storage.ts`, `server/asset-validation.ts`,
  `server/local-asset-storage.ts`, `server/vercel-blob-storage.ts`,
  `server/asset-service.ts`, `shared/asset-reference.ts` (new).
- Runtime/reference integration: `server/app.ts`, `server/index.ts`,
  `server/vercel-handler.ts`, `shared/schema.ts`.
- Checks/fixtures: `scripts/check-api-esm.ts`, `scripts/check-vercel-api.ts`,
  `scripts/check-turso-runtime.ts`, `scripts/browser-server.ts`,
  `tests/api.test.ts`, `tests/curriculum.test.ts`, `tests/hosting.test.ts`,
  `tests/storage.test.ts` (new). The Turso runtime script only changes the expected
  forbidden upload response; it was not run against production.
- Configuration/dependencies: `.env.example`, `package.json`, `package-lock.json`.
- Documentation: `README.md`, `docs/TURSO_RUNTIME.md`, `docs/import-format.md`,
  `docs/ASSET_STORAGE.md` (new), this report (new).

## PACKAGES ADDED/REMOVED

- Added `@vercel/blob` ^2.8.1: official private Blob SDK with project OIDC support.
- Added `saxes` ^6.0.0: strict XML parsing for SVG validation.
- Removed: none. Dependency install audit reported zero vulnerabilities.
- Added `npm run storage:check`; no live smoke command or browser credential flow.

## MANUAL VERCEL STEPS

1. Open the existing project in Vercel Dashboard, then **Storage > Create Storage
   > Blob > Continue**. Choose **Private**, set name/region and create the store.
   > Store access mode is chosen at creation and cannot later be changed.
   > [Private store setup](https://vercel.com/docs/vercel-blob/private-storage).
2. Open the store's **Projects** tab and **Connect to Project**. Connect the
   question-bank project for **Preview**. Keep a separate private Production
   store and connect it to **Production** when ready.
3. Confirm `BLOB_STORE_ID` is supplied for the selected environment. Vercel
   supplies and rotates `VERCEL_OIDC_TOKEN`; let the SDK retrieve it automatically.
   Do not manually copy OIDC tokens or introduce long-lived deployed-function
   tokens. Only blank variable names were added to `.env.example`; no credential
   values or `VITE_` storage variables were written.
4. Preserve existing Turso variables, Node 24.x, routing and protected Preview
   settings. Review this working tree before any later manual deployment.
5. After that deployment, verify health is unchanged, mutations/uploads return
   403 and configured private delivery returns 403. These checks prove route
   protection, not live Blob read/write readiness.
6. Implement server-side teacher authentication and resource authorization,
   then enable authorized operations and separately run a disposable protected
   Preview persistence/cleanup smoke test before importing real content.

These are manual instructions; no Vercel account/store/environment changes,
credential downloads, production uploads or deployments were performed here.
Ordinary local authoring needs no Blob connection. Outside-Vercel tooling, if
added later, must configure supported SDK authentication separately in a scratch
environment. See [complete setup and route policy](docs/ASSET_STORAGE.md).

## KNOWN LIMITATIONS

- Teacher/student preview remains presentation only. Hosted uploads and private
  HTTP delivery stay disabled until server-side authentication/authorization.
- Live store connectivity, permissions and deployed persistence were not tested.
- Two-step staging and process crashes need reconciliation; no durable upload
  lifecycle ledger, automatic orphan collection or general physical deletion.
- Metadata checks verify existence/type/size, not bytes; internal reads verify
  new-object SHA-256. Legacy local files have no historical digest baseline.
- Vercel function bodies are limited to 4.5 MB including multipart overhead,
  despite the application's local 20 MiB limit. Authenticated hosted authoring
  needs a smaller limit or a separately authorized large-file workflow with
  server validation. [Vercel server-upload limits](https://vercel.com/docs/vercel-blob/server-upload).
- Unsupported SVG features must be flattened before upload. External HTTPS
  assets remain author-managed and are not migrated into private storage.
- The model has no deduplication ledger. New uploads use unique keys; existing
  references can be shared safely and retained by immutable history.

COMMIT: NO  
PUSH: NO  
DEPLOYMENT: NO

## RECOMMENDED NEXT STEP

Implement real server-side teacher authentication/authorization, then enable
authenticated hosted authoring/upload operations and perform a protected Preview
smoke test before importing authoritative curriculum or real Physics questions.
