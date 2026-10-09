# MATRICULATION PHYSICS QUESTION BANK
# DISPOSABLE LIVE STACK CERTIFICATION — RETEST AFTER BLOB HOST FIX

Updated: 2026-10-09T06:39:22.972Z
Status: COMPLETE: all live checks, infrastructure disposal, and final production audit passed.
FAIL (NOT COMPLETED) means a requirement remains uncompleted; it is not an
observed failure of an unexercised operation. Certification requires all live
checks AND whole-infrastructure disposal AND the final production audit.

## TARGET

Preview: https://matriculation-physics-question-bank-or1amyyra.vercel.app
Deployment ID: dpl_ZqYQQgrAyAJYrstNc9sWWvq1rBLS
Environment: Preview
Branch: authsmoke-20261009-defbc9 (dedicated local branch; never pushed)
Commit: 4ede3d10f786880bb6db2b7bebe9a5370225a3f4
Hostname fix present: PASS
Ready Preview: PASS
Protected Preview: PASS

The original latest fixed Preview was independently verified Ready/Preview,
branch feat/admin-security, commit 4ede3d10f786880bb6db2b7bebe9a5370225a3f4, and health 200:
https://matriculation-physics-question-bank-kod3rbsf6.vercel.app. Its committed Blob adapter contains both lowercase
hostname operands and exact equality. The new smoke deployment uses that exact
committed tree, a unique local branch, and scratch deployment-specific bindings.
The original fixed Preview is preserved. No failing old deployment was reused.

## OLD SCRATCH CLEANUP

PASS: the old physics-bank-auth-smoke-ac7ef8 DB, old smoke Preview, unused old
project, old store store_kSYyQNvtQG5BfQlg, and old prefixed bindings were all
verified absent before any new infrastructure was created. Its historical
report was preserved as prior-smoke-report.md in the new ignored evidence folder.

## PRODUCTION SAFETY

Production DB writes: NO
Production Blob writes: NO
Production environment-variable changes: NO
Production before/after fingerprint: MATCH (final post-disposal audit)
Original real project configuration restored: PASS

Only SELECT/read-only audits accessed matriculation-physics-question-bank.
No content, taxonomy, intentional admin session, migration, or destructive SQL
was written there. The real Blob store was identified by control-plane identity
metadata only; its objects were never enumerated, read, uploaded, or deleted.
Baseline/final comparisons include domain counts, deterministic logical-row,
schema, and migration hashes. Security tables are excluded from domain invariants.
The final audit also checks marker absence and restoration of the original
environment-metadata/SSO fingerprint.

## SCRATCH

Scratch Turso: PASS — physics-bank-auth-smoke-defbc9
Migration 003: PASS
Synthetic taxonomy: PASS
Scratch Blob store: PASS — store_FGvdZHIFOS00AlBM, private
Preview bindings: PASS
Mixed-case supplied store identity: PASS

The supported Turso clone operation copied the current schema and exactly one
enabled admin. Copied sessions were revoked through existing scratch-targeted
auth tooling. FTS5 and migrations 001/002/003 were independently checked. Minimum
TEST chapter/topic taxonomy was created through Bank.addTaxon validation. No
real syllabus, new curriculum, subtopic, or real Physics content was added.

Live health and the exact unique topic ID/name positively identified the scratch
DB before login. SDK storage uses the exact new private store ID and managed
Preview OIDC. The static Blob fallback is blank. Supported --env KEY deployment
overrides read values from child process memory, with no values in CLI arguments
or local env files. The unique AUTHSMOKE_DEFBC9 connection creates only
temporary Preview configuration variables and an OIDC Preview grant. It does
not overwrite original credentials or create Production bindings. The grant is
project Preview scoped; the app's scratch store selection is deployment specific.
Deployment Protection remains enabled; ordinary health access redirected 302.
Protected API transport is authenticated vercel curl, without following redirects.

## AUTH

Login: PASS
Session persistence: PASS
Response sanitization: PASS
Logout: PASS
Old-cookie replay rejected: PASS

Password input uses hidden local interactive TTY only. Login is the actual
deployed POST /api/auth/login with exact Origin and custom CSRF header. Password
and cookie stay in memory; no cookie jar, raw headers, or secret-bearing logs.
Separate session requests verify authenticated admin and safe fields only.
Cookie security attributes are checked in memory. Logout is followed by separate
requests deliberately carrying the OLD cookie: session must be unauthenticated
and authoring must return 401. The cookie is never printed or saved.

## TURSO

Draft create: PASS
Separate read: PASS
Edit persistence: PASS
Immutable history: PASS
FTS: PASS
Independent scratch DB verification: PASS
Synthetic question ID: f712b1b5-2f4d-45c8-a13d-d800829f0a34
Marker: __AUTH_BLOB_SMOKE_authsmoke-20261009-defbc9__

The normal admin API creates one draft at version 1, reads it separately, edits
it at version 2, and reads again. History [2,1] and unique edited FTS search are
checked. Normal asset linking creates version 3. A new scratch DB connection
verifies the final document, one question, one asset, and three versions. The
question stays draft throughout. No immutable-history rule is changed; cleanup
destroys the entire scratch DB instead of deleting historical records.

## PRIVATE BLOB

PNG generated: PASS
Authenticated upload: PASS
Mixed-case host verification: PASS
Application multipart/MIME/signature validation: PASS
Opaque reference only: PASS
Linked to draft: PASS
Separate authenticated retrieval: PASS
MIME: PASS
Size: PASS
SHA-256: PASS
PNG size: 74 bytes
PNG SHA-256: 799ce7605da9138d3b63b3a3b228107ac92b847fa6487e58465093b705713ae7
Opaque asset reference: /uploads/148d0ab2-6090-4cc4-8daf-b42555e0b9cd-799ce7605da9138d3b63b3a3b228107ac92b847fa6487e58465093b705713ae7.png

The new 2x2 RGBA PNG is generated locally with synthetic pixels unique to this
run and checked below 50 KiB. Upload goes only through POST /api/uploads, not
directly to Blob. It exercises admin/CSRF/multipart/file validation, AssetService,
VercelBlobAssetStorage, managed OIDC, and live metadata verification. The upload
receipt must be staged, image/png, exact size/hash, and an opaque /uploads path.
Normal authoring links it, then a new application request must return image/png,
the exact byte length, and the same SHA-256. No raw private URL or redirect is
allowed. An upload 503 stops the run without repeated upload attempts.

## ANONYMOUS SECURITY

Write blocked: PASS
Draft list/search leakage: NONE
Draft direct access: BLOCKED
Draft asset access: BLOCKED
Hidden draft print inclusion: BLOCKED
Public health/resources after live writes: PASS

These requests use Vercel-authenticated transport without the Question Bank admin
cookie. List/search must have total 0 while the actual draft exists. Direct draft
and public question-set inclusion must return 404. Draft asset delivery must be a
sanitized JSON 404 with no PNG bytes, provider redirect, or private URL. Public
health/questions/taxonomy/curriculum endpoints are checked again after linking.

## CLEANUP

Scratch Blob object removed: PASS
Scratch Blob store removed: PASS
Scratch Turso destroyed: PASS
Scratch Preview removed: PASS
Bindings removed: PASS
Cleanup helper project removed: PASS
Local scratch branch/worktree removed: PASS
Production residue: NONE

Disposal removes only the exact new Preview and its scratch connection, checks
the unique store/name/private status and the sole synthetic object's opaque
path/hash/size, deletes that object, then deletes the empty store, scratch DB,
cleanup helper, and disposable local worktree/branch. The final provider listings
must show all scratch resources absent and the real resources intact.

Cleanup helper: physics-bank-auth-smoke-defbc9-cleanup (prj_N8EyV9e6nmLmgu04D0lNpqGRgceH). It is never
deployed. Only during teardown it receives a temporary development OIDC grant
to the scratch store. The official project token command supplies a short-lived
development token for that isolated helper, captured solely in process memory.
Owner/project/environment/expiry are checked. The SDK uses that managed identity
for scratch-only listing/deletion; these management calls do not substitute for
application upload/retrieval certification. No static Blob credential or token
file is introduced. The helper grant disappears with the store/helper. No real
Development or Production variables are altered. If this supported cleanup path
cannot pass its guards, stop with exact manual object/store deletion steps.

## SECRETS

Password exposed: NO
Session token exposed: NO
Turso token exposed: NO
Blob/OIDC credential exposed: NO
Private Blob URL exposed: NO

Evidence includes only safe IDs, HTTP status/content type/field names, opaque
references, synthetic content, counts, hashes, and guarded harness code. Tokens
are not CLI argument values and are not written to local/evidence files. Raw
provider errors, response headers, credential API responses, and private URLs
are never printed or retained.

## OVERALL

ADMIN AUTH: PASS
TURSO PERSISTENCE: PASS
PRIVATE BLOB: PASS
PUBLIC ISOLATION: PASS
CLEANUP: PASS

LIVE STACK CERTIFIED: YES

Recommended next step: Prepare the authoritative SP015 curriculum import using an audited dry-run first. 

## PRODUCTION COUNTS / FINGERPRINTS

| Domain | Before | Latest after audit |
| --- | ---: | ---: |
| questions | 0 | 0 |
| question_parts | 0 | 0 |
| solutions | 0 | 0 |
| solution_steps | 0 | 0 |
| hints | 0 | 0 |
| assets | 0 | 0 |
| question_versions | 0 | 0 |
| revision_candidates | 0 | 0 |
| question_tags | 0 | 0 |
| tags | 0 | 0 |
| question_version_classifications | 0 | 0 |
| question_search | 0 | 0 |
| chapters | 0 | 0 |
| topics | 0 | 0 |
| subtopics | 0 | 0 |
| curriculum_events | 0 | 0 |
| courses | 1 | 1 |
| curriculum_versions | 1 | 1 |
| semesters | 2 | 2 |
| difficulty_levels | 3 | 3 |

Migration versions: [1,2,3].
Logical rows SHA-256: 786659795e4e7005655e79186302ef281c3f96d5199d4b1184e72bc77dfe18bf
Schema SHA-256: d800f97ee713207bde80559633b571e0960fb589e26196b916f737fd3f09e434
Migrations SHA-256: f6fb46c62c17e5b0026e2693825afe424dfd2d09f1bc66d29c988302153189b3
Security/session credential values are excluded from these fingerprints.

## EVIDENCE / REPOSITORY

Ignored evidence: data/disposable-live-smoke/20261009T061812Z/.
Key artifacts: initial-audit.json, plan.json, production-before/after.json,
scratch-schema.json, scratch-store.json, scratch-deployment.json, preflight.json,
http-checks.json, smoke-result.json, cleanup-oidc-readiness.json,
blob-cleanup-preconditions.json, blob-object-removal.json, turso-destroy.json,
final-audit.json, real-project-before/after.json (latter artifacts appear on cleanup).

No application source, migration, history trigger, auth rule, or committed test
was changed in this retest. No commit/push or Production deployment/promotion
occurred. Original branch feat/admin-security and HEAD 4ede3d10f786880bb6db2b7bebe9a5370225a3f4 are
preserved. Only this untracked report is updated; the earlier untracked original
smoke report remains intact. Harnesses/fixtures are ignored. Local suites were
not repeated because source was unchanged; actual deployed separate-request
results are required for this certification.

Final hygiene check pending.

Supported OIDC/environment behavior was checked against installed CLI/SDK code
and [Vercel OIDC documentation](https://vercel.com/docs/oidc). The hidden-password
gate is a required security constraint from the user's request, not a permission
request for already-authorized scratch setup or disposal.
