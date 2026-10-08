# Admin security and public access

The application has one server-validated role, `admin`. Students have no accounts,
registration or login requirement. Teacher/student previews control presentation;
they never authorize requests. See [the pre-implementation audit](SECURITY_AUDIT.md)
and [the verification report](../ADMIN_DATABASE_SECURITY_REPORT.md).

## Access policy

| Feature                                               | Public visitor                                             | Authenticated admin                    |
| ----------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| Health                                                | Safe database status                                       | Same                                   |
| Questions/search/counts                               | Current approved questions only                            | All authoring statuses                 |
| Schemes, steps, marking points, hints                 | Current approved content                                   | Current/historical content             |
| Teacher notes and original source PDFs                | Excluded                                                   | Available                              |
| Question JSON/provenance exports, history, candidates | 401                                                        | Existing authoring behavior            |
| Curriculum browsing                                   | Published active/retired versions; draft branches excluded | All versions                           |
| Curriculum impact/export                              | 401                                                        | Available                              |
| Persistent authoring/import/approval/upload           | 401                                                        | Existing domain safeguards plus CSRF   |
| Managed asset delivery                                | Current approved non-source relationship required          | Staged/private/history bytes available |
| Temporary selections and PDF printing                 | Available, approved content only                           | Same public-content limits             |

Non-public question and asset IDs return 404. Historical version reads and
administrative endpoints require authentication, including when an approved
question has an older approved snapshot. Query strings, browser storage and
client role fields cannot elevate access. Shared bytes become public only when
an admin explicitly links them as a public asset of a current approved question;
an additional private relationship cannot make already-published bytes secret.
Retiring/removing the last public relationship prevents subsequent public reads.
Previously downloaded public content cannot be recalled.

Public responses clear `solutions[].teacherNotes`, remove `original_pdf` assets
and omit authoring metadata/classification snapshots. Schemes, marking points and
hints remain public. Student preview can hide answers visually while the solution
view makes them available. The existing authenticated Student Preview projection
is retained for authoring review. Public visibility requires both the question
row and its active immutable snapshot to be approved. FTS contains question text,
classification names and tags, without private notes.

## Sessions and request protection

Admin passwords use Node's built-in asynchronous scrypt with random 16-byte salts,
64-byte derived keys and `N=32768, r=8, p=3`. This is an OWASP-listed equivalent
memory/CPU profile, with a 64 MiB allocation ceiling. Verification uses
`timingSafeEqual`. Bootstrap requires at least 15 characters and at most 1024
UTF-8 bytes; passwords are not truncated, printed or saved in plaintext.
[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Login creates a random 256-bit session token, persists only its SHA-256 digest,
and sets an eight-hour cookie. Hosted cookies use `__Host-qb_admin`, `HttpOnly`,
`Secure`, `SameSite=Strict`, `Path=/`, finite expiry and no Domain. Loopback local
development uses `qb_admin` without Secure for HTTP. Hosted mode is selected by
the Vercel entry point, never by a browser header or frontend setting. Normal local
startup binds to `127.0.0.1`; local authentication rejects non-loopback Host values.

Each request validates the server-side session, expiry, revocation and enabled
admin identity. Logout revokes the record before clearing the cookie. Login
rotates/revokes the previous presented session. Expired rows are removed on
successful login. Passwords, hashes, raw tokens and session digests are absent
from JSON responses. Session inspection returns only authentication state and
safe admin ID/email/role. Sensitive/API responses use `private, no-store`.

Cookie-authenticated mutations require both the exact same-origin Origin header
(including scheme/port) and `X-Question-Bank-Request: 1`. Hosted expected scheme
is HTTPS; local loopback is HTTP. Cross-site Fetch Metadata is rejected. No CORS
permission is granted. The relative API client supplies the custom header for
mutations; browsers supply Origin automatically. Login/logout use the same
checks, including login CSRF protection. This follows OWASP's custom-header API
pattern plus exact-origin and SameSite defenses; no separate CSRF token is
required. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Missing/invalid admin identity returns 401 before authoring/body/storage work.
An authenticated request failing CSRF returns 403. All authoring HTTP methods
are guarded centrally, including unknown future write routes; sensitive GET
routes also explicitly use the admin guard. Persistent business rules still
require revision notes, confirmation, impact review and immutable history.
Author/reviewer display attribution remains the existing domain input; it is
never an authentication credential.

## Durable abuse controls

`security_rate_limits` uses atomic database UPSERT/RETURNING counters. Login
consumes account (5 attempts/15 minutes), client address (20/15 minutes) and global
(60/minute) fixed-window budgets before password verification. Existing and
nonexistent accounts receive the same generic invalid-credentials response and
perform the same password KDF. Successful attempts also consume budgets; counters
are not cleared by success. Throttling returns generic 429. A two-KDF process
ceiling supplements durable limits to bound local memory, without replacing them.

Vercel's overwritten edge address headers are trusted only in the explicit hosted
entry; local mode uses the socket address. Enterprise/custom reverse proxies need
a review of their address behavior. Account/global budgets remain effective if
addresses are unavailable or a proxy combines visitors.
[Vercel request headers](https://vercel.com/docs/headers/request-headers).

Buckets contain digests instead of raw email/address values. Expired buckets are
removed by global-limit operations and successful login. A targeted attacker can
temporarily throttle admin login; use the Vercel firewall for additional defense.
No process-memory-only login limiter or account-existence message was added.

## Public selections and PDFs

The previous repository linked uploaded PDFs but had no set customization or
generated-PDF feature. The public browser now collects up to 20 approved questions
in selection order. It stores no persistent authoring records. The print view
uses `GET /api/public/question-set?ids=...&answers=true&hints=true`, which validates
every ID server-side, regardless of the caller's session. Hidden IDs reject the
whole selection; clients cannot submit arbitrary document bodies for rendering.

Limits are 20 distinct IDs, 2000 characters of IDs, validated boolean options and
1 MiB of sanitized resource JSON. Durable limits allow 20 print-resource requests
per client per minute and 500 globally per minute. Counters are security state,
not Question Bank authoring mutations. Order and optional schemes/hints are
supported; randomization, exam generation and persistent student sets are absent.

**Print / Save as PDF** opens the browser print dialog. Choose Save as PDF to
generate and download the PDF locally, preserving KaTeX mathematics and diagrams.
The API does not produce a binary PDF attachment. This avoids serverless renderer
cost, filesystem persistence and font/TeX reimplementation. Chromium tests generate
an actual PDF from this authorized print view. Browser print settings, pagination
and externally hosted asset availability can differ by platform.

## Storage integration

Private Blob objects remain private. Server-mediated `/uploads/<key>` delivery
checks current database relationships before calling the provider. Anonymous
access requires a current approved question's non-`original_pdf` asset. Source
archives, drafts, reviewing/retired content, candidates, history-only references
and unlinked staged uploads require admin identity. No redirect, raw private URL,
browser Blob credential or client upload-token endpoint is introduced.

Admin uploads still require filename/signature/MIME/SVG validation, unique names
and SHA-256. Local files retain their 20 MiB limit. Hosted files are limited to
3 MiB, multipart has one file/no fields, and declared request bodies above 3.5 MiB
are rejected; hosted JSON authoring bodies are limited to 3 MiB. Local JSON retains
5 MiB. Hosted buffered delivery also rejects files over 3 MiB. The Vercel platform
may reject requests first; these limits fit below its 4.5 MB ceiling. Larger hosted
files require a separately reviewed architecture, never a validation bypass.
[Vercel payload limit](https://vercel.com/docs/errors/function_payload_too_large).

Staged-upload retry/compensation/reference-retention rules remain unchanged.
There is no general delete/GC route. See [storage details](ASSET_STORAGE.md).
External HTTPS references are author-managed: hiding a URL here does not change
the external host's permissions. Use managed private storage for source documents.

## Explicit migration and first-admin setup

The new migration is `server/migrations/003-admin-auth.sql`. It adds only `admins`,
`admin_sessions`, `security_rate_limits` and their indexes, without seeded accounts.
Migrations 001/002 are unchanged. Runtime requires migration level 003 and verifies
the required structures. It never applies schema changes. Deploying before the
manual migration will fail safe with unavailable database health/startup.

After reviewing the SQL and backing up the intended database, set its existing
server-only `TURSO_DATABASE_URL` and write-capable `TURSO_AUTH_TOKEN` in your terminal
or secret manager. The command checks that the credential endpoint matches the
explicit target name. Never print/paste values or use `VITE_` variables. The current
read-only hosted token must be replaced manually with a suitably scoped expiring
server write token for login/session/rate state and authenticated authoring.

```powershell
# Audit the pending migration; does not apply it.
npm run auth:migrate -- --target matriculation-physics-question-bank

# Only after SQL/backup review, explicitly apply and verify 003.
npm run auth:migrate -- --target matriculation-physics-question-bank --apply

# Separate manual operation in an interactive terminal; passwords are hidden.
npm run auth:bootstrap -- --target matriculation-physics-question-bank --email YOUR_ADMIN_EMAIL --create-first-admin

# Optional incident response: revoke every session for that admin.
npm run auth:revoke -- --target matriculation-physics-question-bank --email YOUR_ADMIN_EMAIL --revoke-all-sessions
```

Bootstrap is available only as a CLI command. It prompts for a hidden password and
confirmation, refuses noninteractive/password-argument/environment input, checks
the schema, and transactionally refuses any second first-admin bootstrap. It does
not run during startup, build, deployment or through HTTP. There are no defaults,
registration, password-reset email service or student accounts.

For a reviewed existing recovery/test database, substitute `--local <path>` for
`--target`. This path must exist with migrations 001/002; the original
`data/bank.sqlite` migration source is explicitly protected. Ordinary local
authoring still uses the configured Turso runtime and local uploads, not this
administrative SQLite option.

No new auth environment variable or long-lived app secret is needed. Existing
names are `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`; hosted storage also requires
`BLOB_STORE_ID` and Vercel's automatically supplied `VERCEL_OIDC_TOKEN`. Keep
Preview and Production credentials/databases/private stores separate.

## Review and protected Preview verification

No production migration, admin account, Blob write, content import, commit, push
or deployment was performed by this task. The existing protected Preview remains
as deployed. Use a disposable Preview database/store for the first end-to-end
smoke; repeat target arguments with that Preview database name.

1. Review the audit, migration, source and full local checks. Back up each target.
2. Manually apply 003 and bootstrap the first admin in the intended environment.
3. Configure server write credentials and Private Blob project/OIDC connection.
4. Manually deploy a protected Preview after review. Verify health, HTTPS cookie
   flags, login/restoration/logout, and anonymous authoring rejection.
5. In disposable Preview resources, author a small question/diagram/scheme,
   approve through existing review, verify public reads/assets/PDF printing,
   private source/history denial and file persistence across invocations.
6. Review/clean disposable resources with history safeguards. Only after the smoke
   passes should authoritative curriculum or real questions be imported.

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

Tests use isolated SQLite/libSQL, mocked Blob and a temporary browser bank.
The browser server creates a clearly labelled test admin only in that isolated
bank; those fixture credentials are never used by normal runtime or cloud tools.
