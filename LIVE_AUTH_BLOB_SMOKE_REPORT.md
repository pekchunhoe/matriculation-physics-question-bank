# MATRICULATION PHYSICS QUESTION BANK
# LIVE AUTHENTICATED TURSO + PRIVATE BLOB SMOKE TEST

Verification date: 2026-10-09 (Asia/Kuala_Lumpur).
Disposition: STOPPED BEFORE LOGIN AND FIXTURE CREATION at the mandatory cleanup gate.

FAIL means the requested certification check was not achieved. Checks labeled
NOT RUN were deliberately stopped by the cleanup precondition; they are not
observed authentication, persistence, or isolation failures. Removal checks are
NOT APPLICABLE because no fixture was created. PASS for domain counts means
unchanged state, not proof of a completed create/delete lifecycle.

## TARGET

Preview URL: https://matriculation-physics-question-bank-khwkajl5r.vercel.app
Environment: Preview
Branch: feat/admin-security
Commit: ab3f598f546c3ac720eaecec1aebaf27008ccef9
Deployment ID: dpl_BsGidYkGdWX1gve8ezi5dpyf3ukZ
Deployment status: Ready
Deployment Protection: PASS
Production domain used for writes: NO

The latest Ready Preview from Vercel CLI matches the repository branch and full
commit SHA. `vercel inspect --json` confirms target `preview`. Project protection
is `all_except_custom_domains`; an ordinary request to this Preview health URL
returned 302, while authenticated `vercel curl` reached the API. No redirects
were followed. Every application request explicitly targeted this deployment.
CLI 63.1.0 help was audited: curl options pass after `--`. No cookie-file flags,
trace capture, protection changes, or custom bypass creation were used.

## PRECONDITIONS

Migration 003 current: PASS
Admin account present: PASS
Health: PASS
Turso connectivity: PASS
Private Blob configuration detected: PASS
Unexpected real content detected: NO

Direct SELECT-only Turso queries confirmed migrations 1, 2, 3; migration 3 was
applied at 2026-10-09T01:10:57.658Z. One admin exists and is enabled with role
admin. No password hash, session digest, or admin identity was selected.
`BLOB_STORE_ID` is configured for Preview; this is configuration evidence only,
not proof of successful private Blob SDK access. The sensitive Preview Turso
values could not be retrieved through the Vercel metadata API. Cloud audits
instead used the existing authenticated WSL Turso CLI v1.0.34.

## ANONYMOUS SECURITY

Anonymous authoring write blocked: PASS
Draft direct read blocked: FAIL (NOT RUN)
Draft search/list leakage: NONE (no draft created; isolation not exercised)
Draft asset read blocked: FAIL (NOT RUN)
Hidden draft rejected by public print resources: FAIL (NOT RUN)

The Vercel-authenticated, Question Bank admin-less POST to `/api/questions`
returned 401 and `Administrator authentication required`. The request supplied
the exact Preview Origin and `X-Question-Bank-Request: 1`. The existing middleware
checks admin authorization before JSON parsing or domain validation; the empty
request body never reached persistence. No valid create document was submitted.

## ADMIN AUTH

Login: FAIL (NOT RUN)
Session persisted across requests: FAIL (NOT RUN)
Session response sanitized: FAIL (authenticated response NOT RUN)
Logout/revocation: FAIL (NOT RUN)
Password exposed/logged: NO
Session token exposed/logged: NO

Admin-less GET `/api/auth/session` returned 200 with only
`{"authenticated":false}`. No admin password was requested, no login attempted,
no session minted, and no cookie jar created. Login failure testing was omitted.
The real CSRF contract was inspected but authenticated behavior was not tested.

## TURSO LIVE WRITE

Disposable draft created: FAIL (NOT RUN)
Separate-request read persistence: FAIL (NOT RUN)
Separate-request edit persistence: FAIL (NOT RUN)
Stable ID preserved: FAIL (NOT RUN)

## PRIVATE BLOB LIVE WRITE

Synthetic PNG generated: FAIL (NOT RUN)
Upload authorization: FAIL (NOT RUN)
Validation path exercised: FAIL (NOT RUN)
Opaque reference returned: FAIL (NOT RUN)
Private Blob URL leaked: NO (no upload or private Blob response received)
Asset linked to draft: FAIL (NOT RUN)
Separate-request Blob read: FAIL (NOT RUN)
Size matches: FAIL (NOT RUN)
SHA-256 matches: FAIL (NOT RUN)

No PNG or upload was needed after the mandatory pre-write stop. No provider Blob
read, write, enumeration, or deletion was performed. No asset reference exists.

## PUBLIC ISOLATION

Public question total unchanged during draft: FAIL (NOT RUN; no draft existed)
Smoke marker absent publicly: PASS (empty baseline/search only)
Private asset bytes inaccessible publicly: FAIL (NOT RUN)
Public taxonomy remained healthy: PASS

GET `/api/health`, `/api/questions`, `/api/taxonomy`, `/api/curriculum-versions`,
and `/api/auth/session` each returned 200 through the protected Preview transport.
Health was exactly `{"status":"ok","database":"connected"}`. Question total
remained 0. Searching the unique unused smoke marker returned zero results.
These read-only checks do not prove isolation of an actual hidden fixture.
Public browser/print usability was not exercised after the cleanup stop.

## CLEANUP

Cleanup path verified before write: FAIL
Draft removed: FAIL (NOT APPLICABLE; none created)
Asset metadata removed: FAIL (NOT APPLICABLE; none created)
Blob object removed: FAIL (NOT APPLICABLE; none created)
Search residue removed: FAIL (NOT APPLICABLE; none created)
Domain counts restored: PASS (unchanged; no content writes occurred)
Residual smoke records/bytes: NONE

The complete domain count audit was repeated in a separate Turso CLI invocation.
Every recorded domain count was identical:

| Domain table | Before | After |
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
| courses | 1 | 1 |
| curriculum_versions | 1 | 1 |
| semesters | 2 | 2 |
| chapters | 0 | 0 |
| topics | 0 | 0 |
| subtopics | 0 | 0 |
| curriculum_events | 0 | 0 |
| difficulty_levels | 3 | 3 |

The sole curriculum is the expected active LEGACY version. There is no official
curriculum hierarchy or unexpected real question/asset content. Security-table
counts were not used as cleanup invariants.

## SAFETY

Production content imported: NO
Official curriculum imported: NO
Real Physics question created: NO
Schema migration performed: NO
Production deployment changed: NO
Credentials rotated: NO
Commit: NO
Push: NO
Deployment: NO

No application source, migration, UI, runtime, tests, environment variables, or
credentials were changed. No direct database mutation, manual session insertion,
foreign-key/trigger change, hard delete, or history override was performed.
The only authoring request was the expected admin-less 401 authorization probe.
No secret was written to evidence. Sensitive environment retrieval checks printed
only availability booleans; values were neither available nor saved.

## OVERALL RESULT

LIVE ADMIN AUTH: FAIL (NOT RUN)
LIVE TURSO WRITE: FAIL (NOT RUN)
LIVE PRIVATE BLOB WRITE: FAIL (NOT RUN)
ANONYMOUS ISOLATION: FAIL (authoring denial PASS; fixture isolation NOT RUN)
CLEANUP: FAIL (mandatory capability gate; no residual fixture)

LIVE STACK CERTIFIED: NO

Exact blocker:
The deployed commit has no supported deterministic lifecycle that can create,
edit, link, and completely remove this draft/Blob fixture while preserving the
existing immutable-history rules. The requested mandatory cleanup precondition
cannot pass, so login-dependent live writes must not begin.

Evidence for the blocker:

1. `server/app.ts` exposes question create/read/update and upload routes, but no
   question-delete or upload-delete route. Its fallback returns 404 for unknown
   API routes. Existing taxonomy deletion is expressly disabled.
2. `Bank.create()` calls `activate()` even for draft status. `activate()` always
   inserts `question_versions` and `question_version_classifications`. A draft
   edit inserts another version. Draft status does not avoid immutable history.
3. `001-foundation.sql` defines `versions_immutable_delete`; `002-curriculum.sql`
   defines `classifications_immutable_delete`. Both abort deletion without a
   draft exception. Question history also references the question by foreign key.
4. `AssetService.discardUnlinkedUpload()` requires a fresh receipt owned by that
   exact service instance. Receipts are not durable across function invocations.
   It refuses deletion when current assets, immutable history, or revision data
   reference the object. The upload API exposes no discard operation.
5. `docs/ASSET_STORAGE.md` explicitly states that no general delete route or
   garbage collector exists and that objects referenced by history are retained.
   Direct provider deletion therefore cannot satisfy complete linked-fixture
   cleanup while respecting those retained references.

Additional blocker:
The cloud has zero chapters and zero topics. `Bank.validate()` requires an
existing topic. No minimal valid question can use the current LEGACY taxonomy.
Creating new taxonomy would exceed this task's restriction to existing taxonomy,
and those taxonomy records themselves have protected deletion rules.

Severity: blocks this live smoke certification. The cleanup behavior is an
existing documented retention design, not an observed auth or Blob runtime
failure. No persistence or authorization defect was discovered through a live
fixture, because fixture creation was correctly withheld.

Recommended next step:
Use a separate task to establish an audited verification environment/lifecycle
with authorized synthetic taxonomy and deterministic disposal of its database
and private Blob resources. A dedicated disposable Preview database and Blob
store can preserve immutable-history protections in the current content database.
Alternatively, separately design and review a supported disposable draft/staging
lifecycle compatible with those protections. Do not weaken current history rules
or change this Preview's infrastructure in this verification task. Resolve both
cleanup and taxonomy preconditions before repeating the full authenticated smoke.
Do not infer certification or readiness for real curriculum import from this run.

## EVIDENCE AND LOCAL VERIFICATION

Sanitized evidence directory:
`data/live-preview-smoke/20261009T021823Z/`

Files: `target.json`, `http-checks.json`, `domain-counts-before.json`,
`domain-counts-after.json`, and `summary.json`. The directory is ignored by Git.
The unique marker is recorded only in the summary and read-only search evidence;
no question ID, asset reference, PNG, cookie, or session artifact was created.

The repository started clean. No reusable harness or implementation documentation
was added; this requested report is the only untracked repository artifact.
Full local regression suites were not repeated because source/runtime/UI/tests
were unchanged. Final verification checks Git status, ignored evidence, unchanged
tracked files, report/evidence secret-field hygiene, and `git diff --check`.

Official transport reference:
[Vercel CLI curl documentation](https://vercel.com/docs/cli/curl).
The installed CLI's own help and observed HTTP results were used for this run.
