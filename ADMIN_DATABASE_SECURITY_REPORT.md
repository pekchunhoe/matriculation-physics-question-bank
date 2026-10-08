# MATRICULATION PHYSICS QUESTION BANK

# ADMIN-ONLY DATABASE SECURITY

Verified locally on 2026-10-09. Admin-only authentication and authorization are
implemented with persistent sessions, durable throttling, resource-based public
reads and a minimal login/logout UI. Production was not accessed or changed.
Migration 003 and first-admin creation remain explicit manual steps after review.
Live Vercel/Turso/Blob authentication readiness is not certified by local tests.

## SECURITY AUDIT

The audit preceded implementation. The complete method/route/access/sensitivity
matrix and initial architecture are in [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

Vulnerabilities identified:

- Local authoring had no administrator identity boundary.
- Hosted writes used a blanket block, without a mechanism to authorize admins.
- Anonymous status filters, IDs and historical versions could expose drafts,
  reviewing/retired content, teacher notes and original source references.
- Revision candidates, history, provenance exports and administrative impact
  reads were public.
- Local asset delivery ignored owning question visibility.
- Origin checks accepted absent Origin and compared host without scheme.
- No persistent session, revocation or distributed login throttle existed.
- Private read responses lacked consistent cache protection.
- Hosted upload sizes exceeded the platform's request limit.
- Public visitors saw active authoring controls. The repository had uploaded-PDF
  links but no temporary set or generated-PDF workflow.

Critical: unauthenticated local database authoring.  
High: unrestricted question/history/candidate/export/private-source reads and
unconditional local asset delivery.  
Medium: incomplete CSRF boundary, no session/abuse persistence, cache separation
and hosted size limits.  
Low: misleading active admin navigation and absent intended public selection/
printing workflow.

Existing parameterized SQL, transactions, FTS5, stable IDs, immutable snapshots,
review/retirement rules, server-only credentials, private Blob validation and
native ESM safeguards were retained.

## PUBLIC ACCESS

| Check                         | Result                             |
| ----------------------------- | ---------------------------------- |
| Approved question browsing    | PASS                               |
| Public marking schemes        | PASS                               |
| Public hints/solutions policy | PASS                               |
| Public question customization | PASS                               |
| Public PDF generation         | PASS (browser Print / Save as PDF) |
| Public curriculum browsing    | PASS                               |

Anonymous list/search/counts enforce current approved visibility, including the
active snapshot's status. Direct hidden IDs return 404; version/history/export
access requires admin identity. Public documents retain solutions, working,
marking points and hints, clear teacher notes, remove original sources and omit
authoring metadata. Preview mode cannot grant permission. Active/retired published
curriculum remains public; draft version branches are excluded.

Selections are temporary client state. A bounded public endpoint validates every
selected ID, preserves order and returns sanitized approved resources. It grants
no Question Bank authoring permissions and accepts no arbitrary document body.

## AUTHENTICATION

| Check                      | Result |
| -------------------------- | ------ |
| Server-side admin identity | PASS   |
| Secure password handling   | PASS   |
| Secure sessions            | PASS   |
| Logout/revocation          | PASS   |
| CSRF protection            | PASS   |
| Rate limiting              | PASS   |

The only security role is `admin`, validated from an enabled database identity.
There is no public registration, student account, default admin or frontend role
credential. First-admin bootstrap is a separately invoked CLI with a hidden
interactive password/confirmation; it rejects duplicate bootstrap, plaintext
password arguments, noninteractive input and the original SQLite migration source.

Node's built-in asynchronous scrypt uses random salts and `N=32768, r=8, p=3`,
an OWASP-listed memory/CPU profile. Verification uses constant-time comparison.
Passwords require 15 characters minimum and 1024 UTF-8 bytes maximum, without
truncation or plaintext persistence/logging.
[OWASP password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Random 256-bit session tokens are stored only as SHA-256 digests. Hosted cookies
are `__Host-qb_admin`, HttpOnly, Secure, SameSite=Strict, Path=/, host-only, and
expire after eight hours. Loopback local HTTP remains workable without changing
hosted cookie policy. Logout revokes the record; login rotates the previous
presented token. Expired/revoked/tampered/duplicate cookies and disabled identities
fail authorization. API JSON includes no hashes, session tokens/digests or secrets.

Mutations require exact same-origin Origin plus `X-Question-Bank-Request: 1`,
with cross-site Fetch Metadata rejection, SameSite cookies and no CORS permission.
Login/logout receive the same protection. Origin scheme comes from the server
entry point, not client proxy flags. This uses OWASP's custom-header API pattern
with origin defense; no separate CSRF token is needed.
[OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Atomic database counters enforce account, address and global fixed-window login
budgets across instances before KDF work. Unknown accounts perform the same KDF
and receive the same failure message. A bounded local KDF concurrency ceiling
supplements durable throttles. Public print-resource requests also have durable
budgets. Exact thresholds and proxy assumptions are documented in
[ADMIN_SECURITY.md](docs/ADMIN_SECURITY.md).

## AUTHORIZATION

| Check                              | Result                         |
| ---------------------------------- | ------------------------------ |
| Anonymous database writes blocked  | PASS (Question Bank authoring) |
| Direct API writes blocked          | PASS                           |
| Admin question writes              | PASS                           |
| Admin marking-scheme writes        | PASS                           |
| Admin curriculum writes            | PASS                           |
| Draft/reviewing/retired visibility | PASS                           |

Central server middleware requires admin identity before authoring body/storage
work for all mutating methods, including unknown future write paths. Sensitive
read routes explicitly require admin identity. Missing/invalid identity returns
401; failed CSRF returns 403; existing domain conflicts remain enforced. Server
security/session/throttle state is updated only through defined bounded operations,
without giving anonymous clients direct database access or authoring rights.

Question/solution/hint edits retain the existing version and candidate workflows.
Approval requires the existing human decision and domain validation. No hard
question deletion or historical bypass was introduced. Author/reviewer display
attribution remains domain input, never an authentication credential.

## DATABASE SECURITY

| Check                           | Result             |
| ------------------------------- | ------------------ |
| Turso credentials server-only   | PASS               |
| Browser Turso write capability  | NONE               |
| Production database modified    | NO                 |
| Migration required              | YES                |
| Migration number                | 003-admin-auth.sql |
| Migration applied to production | NO                 |

003 adds only `admins`, `admin_sessions`, `security_rate_limits` and supporting
indexes. No account is seeded. It uses the existing transactional migration runner
and tracking table. Startup checks level 003 and required structures without
applying DDL; a database still at 002 fails safely until manual upgrade. The CLI
audits without applying by default and requires explicit target and `--apply`.
Isolated SQLite/libSQL tests verify additive preservation, repeatability, rollback
and an empty initial auth state. Migrations 001/002 and the Turso adapter are
unchanged. No transfer, schema reset or FTS/curriculum redesign was performed.

Original `data/bank.sqlite` and checkpointed backup remain unchanged, both with
SHA-256 `d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`.
The previous empty-production baseline is inherited; no live record recount was
performed. Current source and built browser bundles contain no database/Blob
credentials or direct provider SDK access.

## ASSET SECURITY

| Check                              | Result |
| ---------------------------------- | ------ |
| Admin uploads authenticated        | PASS   |
| Public approved-question assets    | PASS   |
| Private authoring assets protected | PASS   |
| Private Blob URL leakage           | NONE   |
| Hosted filesystem persistence      | NONE   |

Public delivery requires a current approved non-source asset relationship before
provider retrieval. Original PDFs, staged bytes, drafts/reviewing/retired content,
candidates and history-only files require admin identity. Shared bytes are public
when explicitly linked publicly by an approved question; removing the last public
relationship blocks subsequent anonymous delivery. Private Blob URLs/credentials
remain internal. Local and Blob reads retain signature/digest verification,
sandbox/nosniff and ranges. Namespace/path/filename/MIME/SVG validation and safe
retention/compensation remain intact; authentication cannot bypass them.

Hosted file/delivery limit is 3 MiB, one multipart file/no fields, with declared
request-body rejection above 3.5 MiB; hosted JSON is 3 MiB. Local files remain
20 MiB and JSON 5 MiB. These are conservative relative to Vercel's 4.5 MB request
ceiling. No direct browser-to-Blob validation bypass was added.
[Vercel payload limits](https://vercel.com/docs/errors/function_payload_too_large).

## PDF SECURITY

| Check                            | Result                                      |
| -------------------------------- | ------------------------------------------- |
| Public PDF generation preserved  | PASS (public print/download workflow added) |
| Hidden content inclusion blocked | PASS                                        |
| Abuse limits                     | PASS                                        |

The original application had uploaded-PDF links, not a PDF renderer or selection
feature. The new public print view uses approved resources only, even for admins.
It supports optional public schemes/hints and browser Print / Save as PDF. Tests
generate an actual Chromium PDF and verify the print action. The API returns
authorized resources, not a binary PDF attachment. Browser printing preserves
mathematics without serverless renderer/filesystem costs.

Limits: 20 distinct IDs, 2000 characters of IDs, strict option values, 1 MiB of
sanitized resource JSON, 20 client requests/minute and 500 global requests/minute.
Hidden IDs reject the entire selection. No persistent student-set records or
database authoring privilege are needed.

## FRONTEND

| Check                             | Result |
| --------------------------------- | ------ |
| Admin login UI                    | PASS   |
| Logout UI                         | PASS   |
| Session restoration               | PASS   |
| Preview modes separated from auth | PASS   |

Login provides email/password, loading state and generic failures. Session
restoration controls admin navigation after refresh; logout removes authorization.
Anonymous users see public curriculum and authoring routes show login. UI hiding
is supplementary to server checks. Relative same-origin API calls preserve
protected Preview and Production routing without localhost application URLs.

## QUALITY

| Check            | Result          |
| ---------------- | --------------- |
| Typecheck        | PASS            |
| Lint             | PASS            |
| Unit/integration | PASS            |
| Browser          | PASS            |
| Build            | PASS            |
| DB/schema        | PASS            |
| API              | PASS            |
| ESM              | PASS            |
| Storage          | PASS (26 tests) |
| Auth/security    | PASS (28 tests) |
| Accessibility    | PASS            |
| git diff --check | PASS            |

All requested commands were run. Native ESM auditing covers 20 source files/
50 relative references and 19 emitted files/38 edges, retaining the extensionless
import regression and hosted filesystem/SQLite guards. Tests use only isolated
local SQLite/libSQL, temporary files and mocked Blob. CLI tests remove cloud
credentials before invoking commands on a disposable baseline. Existing authoring
assertions remain and now use real isolated admin sessions/CSRF headers; status
expectations reflect the new 401 and resource-authorized delivery policy.

### PREVIOUS TEST COUNTS

- Unit/integration: 89
- Browser: 17

### CURRENT TEST COUNTS

- Unit/integration: 118 (89 existing + 28 auth/security + 1 Blob authorization)
- Browser: 22 (17 existing + 5 auth/public/PDF/accessibility)
- Zero failures, skips or cancellations in final runs.

## FILES CHANGED

- New server/schema/tooling: `server/auth.ts`, `server/visibility.ts`,
  `server/migrations/003-admin-auth.sql`, `scripts/auth-admin.ts`.
- Runtime integration: `server/app.ts`, `server/database.ts`,
  `server/migrations.ts`, `server/index.ts`, `server/vercel-handler.ts`.
- New frontend: `src/Auth.tsx`, `src/PublicCurriculum.tsx`, `src/QuestionSet.tsx`.
- Existing frontend: `src/main.tsx`, `src/api.ts`, `src/Browser.tsx`,
  `src/Preview.tsx`, `src/styles.css`.
- New tests/fixtures: `tests/auth.test.ts`, `tests/auth-fixture.ts`,
  `tests/browser/admin-fixture.ts`, `tests/browser/auth.spec.ts`.
- Existing checks/tests: `scripts/browser-server.ts`, `scripts/check-db.ts`,
  `scripts/check-turso-runtime.ts`, `scripts/turso-cloud-smoke.ts`,
  `tests/api.test.ts`, `tests/bank.test.ts`, `tests/curriculum.test.ts`,
  `tests/hosting.test.ts`, `tests/storage.test.ts`, `tests/browser/bank.spec.ts`,
  `tests/browser/curriculum.spec.ts`. Cloud verification scripts were updated for
  anonymous 401 expectations but were not executed against production.
- Scripts/config: `package.json` (auth check/migration/bootstrap/revoke commands).
- New documentation: this report, `docs/ADMIN_SECURITY.md`, `docs/SECURITY_AUDIT.md`.
- Updated documentation: `README.md`, `docs/TURSO_RUNTIME.md`,
  `docs/ASSET_STORAGE.md`, `docs/import-format.md`, `docs/production-and-pilot.md`.

## PACKAGES ADDED/REMOVED

None. Node's standard crypto provides scrypt, randomness and constant-time
verification; browser printing reuses the existing renderer. The lockfile and
existing storage dependencies are unchanged.

## ENVIRONMENT VARIABLES REQUIRED — NAMES ONLY

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN` (server write scope now required for auth/security state)
- `BLOB_STORE_ID` (hosted Private Blob)
- `VERCEL_OIDC_TOKEN` (automatically supplied/rotated by Vercel)

No new auth secret, browser credential or `VITE_` security variable is required.
Existing `.env.example` already records these names without values.

## PRODUCTION ACTIONS PERFORMED

Database migration: NO  
Admin account creation: NO  
Content import: NO  
Blob write: NO  
Commit: NO  
Push: NO  
Deployment: NO

## MANUAL STEPS REQUIRED

1. Review the audit, migration and source. Back up each intended target. Prefer
   a disposable Preview database/private store for first verification.
2. Configure server-only scoped expiring Turso write credentials. Run the explicit
   migration audit, then `auth:migrate -- --target <reviewed-database> --apply`.
   Startup/build/request handling will not do this for you.
3. Separately run `auth:bootstrap -- --target <reviewed-database> --email
<your-admin-email> --create-first-admin` interactively; enter/confirm the hidden
   password. There is no public bootstrap endpoint or default account.
4. Configure the private store/project/OIDC connection, preserve Node 24.x,
   same-origin routing and Preview Deployment Protection. Manually deploy a
   protected Preview after review.
5. Run an authenticated disposable authoring/upload/public-assets/PDF/session
   smoke across invocations, verifying anonymous denial and private content
   isolation. Review cleanup/history retention before any real import.

Exact commands, cookie/proxy assumptions, limits and session-revocation tooling
are in [ADMIN_SECURITY.md](docs/ADMIN_SECURITY.md).

## KNOWN LIMITATIONS

- Live deployed authentication, current cloud migration state and Blob readiness
  were not tested. Deploying this checkout before manual 003 causes safe startup/
  health failure. The previous read-only hosted token is insufficient for auth.
- Admin authentication is password/session based, without MFA, public registration,
  password-reset email or an account-management UI. Additional account/password
  maintenance needs a separately reviewed administrative procedure.
- Durable fixed-window limits can temporarily throttle legitimate admins under
  attack; Vercel firewall controls can supplement them. Custom proxy address
  behavior must be reviewed. Cookies are finite eight-hour sessions.
- PDF download uses the browser Save as PDF dialog, without a server binary-PDF
  endpoint. Pagination/settings and external asset availability vary by browser.
- Current two-step uploads retain failed/abandoned staged files for retry and
  reconciliation; no durable staging ledger or automatic physical GC exists.
  Historical/shared retention and internal combined-operation compensation remain.
- Hosted files are capped at 3 MiB; larger hosted authoring requires a separate
  validated architecture. External HTTPS references remain author-managed.
- Publishing a current approved reference makes those bytes public; prior public
  downloads cannot be revoked. Original source PDFs/notes/history stay protected.
- Display attribution is not an authentication/audit identity credential; the
  actual authorization decision always uses the enabled server-side admin.

## RECOMMENDED NEXT STEP

Explicitly apply the new auth migration to Turso after review, manually bootstrap
the first administrator, deploy a protected Preview, and perform an authenticated
disposable authoring + Blob upload + PDF/public-read smoke test. Only after that
passes should authoritative curriculum and real Physics questions be imported.
