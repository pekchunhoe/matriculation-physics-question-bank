# Private asset storage

Turso stores relational metadata and references. File bytes use local filesystem
storage for ordinary local authoring and Vercel Private Blob in hosted functions.
Admin-only upload and resource-authorized public/private delivery are implemented.
See [authentication and access policy](ADMIN_SECURITY.md); migration 003 and manual
first-admin setup are required before deployment. No live store was
created, connected or written by this task.

## Audit of the previous flow

Before this change, `server/app.ts` owned multer memory uploads, signature/SVG
checks, UUID filenames, synchronous file writes and `express.static` delivery.
Local startup supplied `data/uploads`, or `<BANK_DATA_DIR>/uploads`. The hosted
handler supplied no directory, so upload/delivery returned 503. General hosted
mutations were already blocked with 403.

The `assets` table has exactly `question_id`, `id`, `part_id`, `kind`, `url`, `alt`,
`mime`, and `display_order`, with question/part foreign keys. There is no separate
unattached-upload table, size/hash column or physical deletion endpoint. Uploading
a file happens before the editor saves question metadata. Current rows are
replaced transactionally on content edits; immutable `question_versions.snapshot`
and revision candidate JSON retain original asset references. Revised PDF sources
also use `revision_candidates.source_pdf_url`. Removing an asset link never
deleted the underlying file.

Student preview filters answer/original assets; teacher preview and JSON exports
use existing references. Neither preview mode authenticates a user. SVG delivery
already used sandbox CSP and nosniff; external HTTPS assets were author-managed.

## Current flow and references

`AssetService` centralizes validation, document reference checks and failed-link
compensation. `AssetStorage` supplies `put`, `get`, `metadata`, `exists` and an
internal deletion primitive. Routes do not call Blob SDK methods or filesystem
write functions.

| Runtime                           | Provider                                       | Selection                                                |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `npm run dev` / local `npm start` | `LocalAssetStorage`                            | Local entry point; `BANK_DATA_DIR` controls uploads only |
| Vercel API                        | `VercelBlobAssetStorage`                       | Vercel environment with a valid `BLOB_STORE_ID`          |
| Automated tests                   | Temporary local files or mocked Blob transport | Explicit injected fixtures; never real store credentials |

New files receive a UUID plus SHA-256 filename derived from validated content,
not the browser filename. The original filename is a separate display value in
the upload response. Storage creation forbids overwrites. Files are not
deduplicated: the existing model has no deduplication/ownership ledger. Reusing
an existing reference across question versions does not duplicate file bytes.

The relational/JSON reference remains `/uploads/<UUID>-<SHA256>.<extension>` for
both providers. Local legacy UUID filenames remain readable. Blob maps that
reference internally to `question-bank/assets/<filename>`. Raw Blob URLs, store
IDs, tokens and download URLs never appear in upload responses or question JSON.
Raw Blob URLs are rejected as authored asset references; other valid external
HTTPS assets remain supported and are the author's responsibility.

The existing `url` column safely holds this opaque reference, so migration 003
is unnecessary. Size and digest appear in the upload response; digest is also
durably encoded in the object key. New-object reads check size, MIME/signature
and digest. Metadata-only checks do not download or prove the content hash.
Legacy files have no historical digest baseline; their reads validate type and
calculate a digest without rewriting the file or question metadata.

## Security and route behavior

| Request                            | Local                                             | Hosted                           |
| ---------------------------------- | ------------------------------------------------- | -------------------------------- |
| Authoring mutations/upload         | Admin session + CSRF required                     | Admin session + CSRF required    |
| Anonymous authoring                | 401 before multipart/storage I/O                  | 401 before multipart/storage I/O |
| GET/HEAD uploads                   | Approved current non-source relationship or admin | Same, through Private Blob       |
| Private/staged bytes without admin | 404                                               | 404                              |
| Unconfigured storage delivery      | 503                                               | 503                              |
| Health                             | Existing database status; no Blob I/O             | Same                             |

The server checks owning current approved question/snapshot and asset kind before
provider retrieval. Teacher notes/source PDFs/history/candidates stay private.
An admin's public approved reference explicitly publishes shared bytes. No raw
private URL, redirect, signed delivery URL, browser token or credential is exposed.
Query flags cannot authorize. Responses retain private/no-store cache policy,
SVG sandbox CSP, nosniff, inline content type and bounded single byte ranges.

Local upload limit remains 20 MiB. Hosted files/delivery are capped at 3 MiB;
admin multipart allows one file/no fields and declared requests over 3.5 MiB are
rejected. This fits below Vercel's 4.5 MB function payload limit; large hosted-file
architecture remains a separate task. No direct browser-to-Blob bypass exists.
[Vercel payload limit](https://vercel.com/docs/errors/function_payload_too_large).

Validation rejects empty files, unsafe/encoded names, traversal, control/format
characters, unsupported signatures, extension mismatches and declared MIME
mismatches. Octet-stream falls back to content detection. SVG requires well-formed
UTF-8 XML, restricted static elements/namespaces and fragment-only references,
without scripts, events, animation, DOCTYPE/entities, processing instructions,
foreign content or external resources. Unsupported SVG features must be flattened;
rejected files are not rewritten. Digest/integrity checks remain unchanged.

## Consistency and retention

The existing editor keeps its two-step workflow. Upload returns `state: "staged"`;
it does not create a question asset row. A safe opaque staging reference is logged
without filename, store details or credentials. An abandoned editor, lost response
or rejected later save may leave a staged object. It is retained for retry and
must be reconciled separately; it is not silently treated as a linked record.
No automatic garbage collector or general delete route was added.

`AssetService.uploadAndLink` is the internal helper for a combined
operation. Its persistence callback must use the existing transactional
question/revision writes and must not publish the new reference before success.
On failure, it audits current assets, all immutable version snapshots, all revision
candidate snapshots (including rejected candidates), and PDF source references.
Only a fresh frozen receipt owned by that service instance is eligible for cleanup.
The audit runs under a database write transaction before physical deletion.

If a link committed despite a subsequent error, the file is retained. If reference
auditing or cleanup fails, deletion stops and a safe consistency error contains an
opaque reconciliation reference; a structured safe log records that reference and
error code. A Blob upload timeout may have stored bytes: its planned reference is
reported for reconciliation rather than guessing at deletion. Partial local-write
cleanup failures also surface a reconciliation reference. Missing objects and
corrupt reads have controlled errors instead of invented replacements.

Turso and Blob have no distributed transaction. A process crash between upload and
metadata persistence still requires reconciliation. Service receipts are local to
an invocation; they are not a durable ownership ledger. Retain objects referenced
by any current/history/revision record. For a future orphan cleanup, stop authoring,
audit every reference source and storage namespace, then explicitly review only
unreferenced staged objects. Do not bulk-delete by filename or age while authors
may still attach staged references. A combined upload/link endpoint and durable
staging lifecycle remain future work; authentication preserves the existing
two-step editor workflow and its retry/retention rules.

## Manual Vercel setup

1. In the existing Vercel project, open **Storage > Create Storage > Blob**.
   Choose **Continue**, set access to **Private**, name the store, select a suitable
   region and create it. Do not choose public storage. Access mode is fixed when
   the store is created. [Private-store setup](https://vercel.com/docs/vercel-blob/private-storage).
2. In that store's **Projects** tab, choose **Connect to Project** and connect the
   existing question-bank project to **Preview**. Use a separate private store
   for Production; connect it to **Production** when ready. Separate stores prevent
   preview work from sharing production objects.
3. Confirm the connection supplies `BLOB_STORE_ID` for the chosen environment.
   Vercel provides and rotates `VERCEL_OIDC_TOKEN` at runtime; the SDK obtains and
   refreshes it automatically. Do not copy/pin an OIDC token or put one in source.
   The adapter passes only the store identifier and lets the SDK handle OIDC.
   Do not manually create a long-lived Blob token for deployed functions.
   `.env.example` records names only; no actual token was written by this task.
   [SDK project authentication](https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication).
4. Keep the existing Turso server variables, Node 24.x, Vercel routing and Preview
   Deployment Protection. Review changes before any manual Preview deployment.
5. Review and manually apply auth migration 003 and first-admin bootstrap in
   the intended database before deploying. Authentication needs server-only
   Turso write credentials. See [explicit security setup](ADMIN_SECURITY.md).
6. After a manual protected Preview deployment, verify health, anonymous write
   rejection, login/session/logout, public approved diagrams/schemes, private
   source denial and disposable authenticated uploads across invocations. Use a
   separate scratch database/private store before any real content import.

Ordinary local authoring requires no Blob environment or credentials and continues
using `data/uploads`. There is no live Blob tooling/smoke command in this change.
If you later add explicit cloud tooling outside Vercel, configure it separately
using the official SDK's supported authentication and a scratch store; never use
production credentials in ordinary tests. Storage variables must never have a
`VITE_` prefix. No `vercel env pull` or token-writing command was run here.

## Verification

```powershell
npm run storage:check
npm run auth:check
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

The API graph check forbids local storage and filesystem mutation imports in
hosted application modules. Native emitted ESM checks remain in place. Storage
tests use only mocked SDK transports, temporary directories and isolated databases;
they cover no-write hosted requests, traversal, integrity, sanitization, failed
links, owned cleanup, uncertain completion and immutable/shared reference retention.
