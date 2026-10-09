# VERCEL PRIVATE BLOB HOSTNAME FIX REPORT

Date: 2026-10-09 (Asia/Kuala_Lumpur)
Result: minimal local fix and full regression PASS. No live smoke was performed.

## ROOT CAUSE

The previous comparison in server/vercel-blob-storage.ts verifyMetadata() was:

```ts
url.hostname !== `${this.storeId.replace(/^store_/, '')}.private.blob.vercel-storage.com`
```

A mixed-case BLOB_STORE_ID produced a mixed-case expected hostname. URL parsing
canonicalizes HTTPS DNS hostnames to lowercase, so valid private metadata failed
this exact comparison. The put() operation could already have stored the object
when metadata verification failed. Its catch block then raised AssetWriteFailure
with code upload_uncertain and status 503, mapped by the API to a sanitized error.
This was an application comparison defect, not a Turso/Vercel configuration error.

The prior disposable smoke report was read before editing. Installed Blob SDK
code was inspected: it strips the optional store_ prefix and derives the URL using
<store-id>.<access>.blob.vercel-storage.com. Store-scoped SDK options remain intact.

## FIX

Files changed:

- server/vercel-blob-storage.ts: canonicalize the derived expected hostname with
  toLowerCase(), then compare it exactly against url.hostname.toLowerCase().
- tests/storage.test.ts: parameterize the existing synthetic transport fixture's
  store ID, allow deliberate URL faults, and add four focused regression tests.
- VERCEL_BLOB_HOSTNAME_FIX_REPORT.md: this report.

Only hostname comparison operands are normalized. The original store ID continues
to be passed unchanged to the SDK for put/head/get/del. No wildcard, substring,
prefix, or suffix acceptance was introduced. No shared helper was needed for this
single comparison.

The existing HTTPS, exact private store host, namespace/path, query/fragment and
userinfo rejection, object size, MIME, signature, SHA-256, opaque reference, and
read-integrity checks remain unchanged. AssetService receipt ownership,
compensation/reconciliation rules, immutable history, migrations, and hosted error
mapping are unchanged.

## REGRESSION

Mixed-case store ID accepted: PASS
Lowercase store ID accepted: PASS
Wrong store rejected: PASS
Wrong host rejected: PASS
Host confusion attacks rejected: PASS

Synthetic IDs store_TeSt123AbC and store_test123abc both upload successfully through
the existing adapter, return only opaque /uploads references, pass separate head
metadata verification, and return the original bytes through get(). The tests also
assert URL hostname canonicalization and unchanged SDK storeId options.

Before changing production source, the mixed-case regression failed with
AssetWriteFailure/upload_uncertain/503 while the lowercase control passed. After
the fix, both passed. This demonstrates the regression catches the original bug.

Fourteen negative URL cases are rejected through both metadata() and get():
different private store, public instead of private host, attacker subdomain,
expected-host suffix trick, store-prefix/store-suffix tricks, HTTP, malformed URL,
unrelated domain, misleading userinfo, userinfo on the expected host, wrong path,
query, and fragment. Existing MIME/signature, byte length/digest, size, transport
sanitization, authorization, and immutable-history retention tests are preserved.

A new genuine post-put verification-failure test uses public metadata from the
synthetic transport. It still raises AssetWriteFailure with upload_uncertain/503
and a valid opaque reconciliation reference. The already-written mock object is
retained, and no deletion/compensation operation is guessed. Existing receipt and
reconciliation tests continue to pass.

## SECURITY

Private Blob URL exposed: NO (no real provider requests, URLs, or credentials used)
Hostname verification weakened: NO
Store identity verification preserved: PASS

All Blob responses in these tests are synthetic in-memory transport metadata.
The application continues to expose opaque references and sanitized error messages.
No credential or actual private URL was obtained, printed, or stored for this task.

## QUALITY

| Requested check | Result | Evidence |
| --- | --- | --- |
| npm run typecheck | PASS | tsc --noEmit |
| npm run lint | PASS | ESLint |
| npm test | PASS | 122 passed, 0 failed/skipped |
| npm run db:check | PASS | isolated local migration, FK/integrity/index checks |
| npm run schema:check | PASS | versioned schemas unchanged/current |
| npm run api:check | PASS | hosted bundle/runtime graph and native ESM checks |
| npm run api:esm:check | PASS | credential-free native Node import/health and import regression |
| npm run storage:check | PASS | 30 passed, 0 failed/skipped |
| npm run auth:check | PASS | 28 passed, 0 failed/skipped |
| npm run build | PASS | TypeScript and Vite build |
| npm run test:browser | PASS | 22 passed, 0 failed; Chromium/local test server |
| git diff --check | PASS | no whitespace errors |

Typecheck: PASS
Lint: PASS
Unit/integration: PASS (122; baseline 118 plus four new tests)
Browser: PASS (22; baseline preserved)
Build: PASS
DB/schema: PASS
API: PASS
ESM: PASS
Storage: PASS (30)
Auth: PASS (28)
git diff --check: PASS

The focused storage run preceded the full suite. The auth/storage counts are
subsets of the 122 unit/integration tests, not additional unique tests. Prettier
also passed for both modified TypeScript files. Full-suite local logs and check
results are ignored under data/hostname-fix/20261009/. DB checks use explicit
local test adapters; browser checks use the temporary local test bank. ESM checks
explicitly remove cloud credential variables from their child runtime.

## SCOPE AND REPOSITORY

PRODUCTION DATA CHANGED: NO
PRODUCTION BLOB CHANGED: NO
MIGRATIONS CHANGED: NO
COMMIT: NO
PUSH: NO
DEPLOYMENT: NO

No cloud account operation, environment-variable change, live authentication,
resource creation/deletion, or live smoke was performed. No changes were made to
migrations 001/002/003, AssetService, authentication, immutable-history triggers,
question_versions, or question_version_classifications.

Branch remains feat/admin-security; HEAD remains
ab3f598f546c3ac720eaecec1aebaf27008ccef9. The two prior untracked smoke reports are
preserved. This new report is untracked; only the adapter and storage tests have
tracked modifications. Generated build/test outputs and local evidence are ignored.

## RECOMMENDED NEXT STEP

After manual deletion of the old disconnected scratch Blob store, commit/review
this fix, deploy it to a new protected Preview, recreate a fresh disposable
Turso + Private Blob smoke environment, and rerun the full live certification.
The old store's current cleanup status was not rechecked in this local fix task.
Local regression success does not constitute live Blob certification.
