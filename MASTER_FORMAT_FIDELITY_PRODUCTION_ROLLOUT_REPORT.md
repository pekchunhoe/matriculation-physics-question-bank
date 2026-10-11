# MATRICULATION PHYSICS QUESTION BANK
# MASTER FORMAT FIDELITY — PRODUCTION ROLLOUT

Updated 11 October 2026. **MASTER FORMAT FIDELITY DEPLOYED — EXISTING DRAFT PRESERVED — READY FOR FIRST MASTER-FORMAT REAL QUESTION JSON.** No question was imported, edited, approved or deleted, and no asset or curriculum content was created or changed.

## PRECHECK

Production baseline: **PASS** — fresh authenticated read-only Turso audit.
Questions: **1**. Draft: **1**. Reviewing/approved/retired: **0/0/0**. Assets: **0**.
Migrations before: **001/002/003/004**.
PHYSICS-2022-2023: **active**; LEGACY: **retired**. Active hierarchy: **2 / 18 / 82 / 0**. There are four semester rows overall because retired LEGACY retains its two historical semester identities.

Existing draft semantic fingerprint: **`3deeba3595cc0f44e26dcbd37c5c14b5a0dbde877bc6c3a72869af57cc03065e`**.
This deterministic typed-row hash includes questions, parts, schemes, steps, hints, immutable versions, classification snapshots, search linkage, assets, tags, revisions, and the empty importer-block/receipt tables. Only the new NULL fields are stripped for post-005 comparison. It uses a broader table set than the previous 004 report, so those two algorithms' fingerprint strings differ.

Internally compared complete educational rows and identifiers; the report contains no full question text, credentials, cookies or private asset URLs. FK and integrity: **PASS**.

## BACKUP

Name: **`phys-pre-m005-20261011t014102z`**.
Created: **PASS** with authenticated `--from-db`, `--group default`, `--wait`.
Verified: **PASS**, independently against both the captured baseline and a fresh Production audit.
Draft fingerprint match: **PASS**. Retained: **YES**.
Schema fingerprint: `eeeba1089ad5cd742eb75a358fdc1a8140789f432d93856c88ff8c31c95390f0`.
Migration fingerprint: `7993746d018dc57fbb34c77c8161533b6f86d5708a4e9ab83bbe0e814d294a2b`.
Sanitized domain fingerprint: `573f3a4d618f4ed010e3b905af4e5556729d76eb676ae572c5fe54e1481bfa64`.
No previous backup was deleted or changed. Supported copy flags were checked against [Turso's official database-copy documentation](https://docs.turso.tech/cli/db/create).
Final independent retention check confirms the new backup plus `phys-pre-m004-20261010t100231z`, `phys-pre-curr-20261009-c453ac`, `phys-pre-act-20261010-c010f5` and `phys-pre-q1-20261010-00baa9` still exist.

## MIGRATION 005

Reviewed: **PASS**, line by line; migrations 001–004 unchanged.
Applied: **YES**. Only migration 005: **PASS**.
FK: **PASS**. Integrity: **PASS**. Existing draft preserved: **PASS**.
Fabricated marking codes: **NO**. Fabricated step hint links: **NO**.

Used the existing repository `applyMigrations` runner with `throughVersion:5` and a `beforeMigration` guard that rejects any version except 005. Immediate independent recheck and transaction-locked complete-row/schema/history checks matched the pre-backup snapshot. A temporary database-scoped one-day credential remained only in process memory. Existing credentials/bindings were unchanged. SDK and independent CLI postmigration audits agree.

Migration SHA-256: `82ea1b94e390f51b390be359f56dcf0525555613b6f2c3268890ef15ef77f5aa`.
All old step IDs, marking codes and hint step links remain NULL. Runtime initialization still performs no migration. The separate auth CLI remains capped at 003.

| Protected domain records | Before | After 005 |
| --- | ---: | ---: |
| Questions / draft | 1 / 1 | 1 / 1 |
| Parts | 4 | 4 |
| Schemes | 4 | 4 |
| Solution steps | 8 | 8 |
| Hints | 4 | 4 |
| Immutable versions | 1 | 1 |
| Classification snapshots | 1 | 1 |
| Search rows | 1 | 1 |
| Pending revisions / tags / question tags | 0 / 0 / 0 | 0 / 0 / 0 |
| Assets | 0 | 0 |
| Curriculum events | 3 | 3 |
| Import blocks / receipts | 0 / 0 | 0 / 0 |

## MASTER FEATURES

Marking codes: **PASS**.
Step-linked hints: **PASS**.
Dynamic numbering: **PASS**.
Master A4 PDF template: **PASS**.
Question/answer shared numbering: **PASS**.
Question-only answer isolation: **PASS**.

Evidence combines the disposable integration/rendered browser/PDF matrix, read-only authenticated Preview validation and identical served Preview/Production bundles. No approved Production question exists, so no invented public question, Production PDF fixture, code or hint was created to demonstrate these features. Authenticated hosted importer verification used the real admin session and route plus served-byte checks; its interactive synthetic rendering was verified in disposable browsers. Anonymous hosted browser rendering was additionally verified directly in both environments. These scopes are distinct.

All four paths were inspected in actual schemas, relational writes, preview/editor, shared selection plan, reusable Master renderer and CSS. Optional fields preserve schemaVersion 1. Normal export uses canonical DB content/assets and browser `window.print()`: OpenAI calls **0**, LLM calls **0**, image-generation calls **0**, server AI tokens **0**. The Master PDF is never an export source. Original supplied asset bytes remain unchanged.

## MASTER EXCLUSIONS

Original question number: **NOT RETAINED**.
Student working space: **NOT RETAINED**.
Source set: **NOT RETAINED**.
Source year/session: **NOT RETAINED**.
SP015/SP025: **NOT PRESENT IN QUESTION/EXPORT**.
Source PDF provenance: **NOT RETAINED**.
Semester identities remain **Semester 1 / Semester 2**.

Both local Master reference files remain untracked, unchanged and excluded from staging. No runtime, build or committed-test hard dependency on either was found. Committed tests use permanent synthetic golden fixtures. The pre-existing compatibility audit is excluded as unrelated historical evidence.

## QUALITY

Unit/integration: **PASS — 205**, zero failures/skips.
Focused importer + Master: **PASS — 78** (57 importer + 21 Master tests).
Populated 004→005 migration: **PASS — 2 adapters**, included in Master tests.
Shared numbering: **PASS — 1 unit case**, included in Master tests.
Browser: **PASS — 65**, zero failures; fresh full run exited 0.
Focused browser export/importer: **PASS — 16**, zero failures; 15 export/numbering/mobile/isolation checks plus one admin preview check.
Typecheck: **PASS**. Lint: **PASS**. DB/schema: **PASS**.
API/ESM: **PASS**; source graph 24 files / 69 relative references, emitted graph 23 files / 51 edges.
Storage: **PASS — 30**. Auth: **PASS — 28**. Build: **PASS**.
`git diff --check`: **PASS**.
Counts overlap; focused commands are subsets of the complete suite.

## SOURCE CONTROL

Commit: **`cab26a23677bf8fb6b8f2c6e042a668b8e761db0`**.
Message: **Complete master format fidelity**.
Push: **PASS**; normal push to `feat/admin-security`. Local HEAD, tracking ref and remote branch SHA match.
Staged scope and secret/artifact audit: **PASS — 34 intended permanent files**, no provider-token/JWT/private-key literals. Complete content review and cached diff checks passed; staged contents match reviewed files after Git's configured CRLF/LF normalization. This scoped pattern scan does not claim detection of every possible secret format.
Ignored local evidence is under `data/master-rollout/` and `data/master-fidelity/`; logs, PDFs, images, databases, Playwright output, environment files and credentials are excluded.
The commit includes this report's release-preparation version. These final factual report updates remain uncommitted; the tested/deployed application SHA is unchanged. No second commit, force push or unrelated historical audit staging occurred.

## PROTECTED PREVIEW

URL: **https://matriculation-physics-question-bank-1egjmwciy.vercel.app**.
Exact commit: **PASS — `cab26a23677bf8fb6b8f2c6e042a668b8e761db0`**. Preview environment / READY: **PASS**. Protection: **PASS — `all_except_custom_domains`**; unauthenticated health redirects with HTTP 302, authenticated provider transport gets HTTP 200.
Database isolation: **UNVERIFIED; treat as Production-backed**. The same private Blob store is connected to both environments. No hosted question/asset/import write test is permitted.
Importer: **PASS** — authenticated admin session and importer route HTTP 200; non-admin interactive browser shows Admin login.
Marking codes / step hints: **PASS**, including authenticated read-only Master validation retaining five keyed marking-code steps and six linked hints.
Numbering / A4 PDF: **PASS in disposable rendered tests and identical hosted build**.
All nine hosted JavaScript/CSS bundles match the tested local build byte-for-byte. The served build contains the reusable Master renderer and importer controls. All 65 local browser tests plus the focused 16 pass. All 13 generated PDFs pass A4/counter/header/exclusion checks. Interactive anonymous hosted browser checks pass through provider-authenticated read-only transport: importer shows Admin login, empty public bank renders, no JavaScript page errors. Screenshots were inspected; provider toolbar integrations were blocked during these checks.
Preview security: **PASS** — zero approved list/count/search results, existing draft detail and print-set 404, protected export 401, missing asset 404, anonymous importer validation 401. Authenticated CSRF check returns 403 without required same-origin headers. Read-only validation of no-part, nested, visual and Master synthetic manifests returned 200; no import commit or upload followed. The draft fingerprint was rechecked and matched afterward. No question/import/asset/curriculum write occurred.

The existing administrator entered the password only at a hidden local terminal prompt. Password and session cookie stayed in process memory, were never printed or saved, and the helper logged out its own session after final Production checks. No secrets were requested in chat.

## PRODUCTION

Exact commit: **`cab26a23677bf8fb6b8f2c6e042a668b8e761db0`**. Deployment: **PASS**.
Deployment ID: **`dpl_B6jEN55NAPgZkEd5gUxqs95pYGXf`**.
Deployment URL: **https://matriculation-physics-question-bank-cilethdkp.vercel.app**.
Canonical application: **https://matriculation-physics-question-bank.vercel.app**.
The exact verified Preview commit was rebuilt with the existing Production environment; deployment target, READY state, Git SHA and canonical alias assignment were independently confirmed. No binding, environment variable, domain or protection configuration changed.

Health: **PASS — HTTP 200**. Importer: **PASS — authenticated session and `/import/question-json` HTTP 200**. Paste/upload/validate controls, marking-code/step-hint support, shared set renderer and Master template are present in the same nine byte-identical served bundles verified against the tested local build. Import as Draft was never submitted. Production validation did not submit a synthetic or real question manifest.

Production security/read-only UI: **PASS** — public approved list/count/search zero; draft detail/answer/hint/print resources 404; protected export and anonymous validation 401; authenticated CSRF denial 403. Empty public bank and non-admin importer blocking also pass direct interactive browser checks. Production has no assets; real-asset and code-bearing draft privacy cases are verified locally.

The previous runtime returned HTTP 503 between migration 005 and its gated replacement because it expected schema 004. Final health is HTTP 200. One local release-precondition attempt stopped before any deployment request because its log reader treated PowerShell UTF-16 logs as UTF-8; the reader was corrected, all quality evidence rechecked, and the guarded release passed.
Database migrations: **001/002/003/004/005**.
Questions: **1**. Draft: **1**. Approved: **0**. Assets: **0**.
Existing draft unchanged: **PASS after migration, Preview checks, immediate predeployment recheck and final postdeployment private audit**; the complete semantic fingerprint matches. Questions/reviewing/approved/retired: **1 / 0 / 0 / 0**, with the one question still draft. Parts/schemes/steps/hints: **4 / 4 / 8 / 4**. Immutable versions/classifications/search rows: **1 / 1 / 1**. Pending revisions/tags/question tags/assets/import blocks/receipts: **all 0**. Curriculum events: **3**. Active PHYSICS-2022-2023, retired LEGACY and active hierarchy **2 / 18 / 82 / 0** remain unchanged. FK/integrity: **PASS**. New nullable fields on the old draft remain NULL. Backup retention: **PASS**.
Questions imported during rollout: **0**. Assets uploaded during rollout: **0**. Curriculum mutations: **0**.
Environment variables, Turso/Blob bindings, deployment protection and domains remain unchanged.

## FINAL STATUS

**MASTER FORMAT FIDELITY DEPLOYED — EXISTING DRAFT PRESERVED — READY FOR FIRST MASTER-FORMAT REAL QUESTION JSON.**

Rollout stops here. Real import, draft edit/approval, Production assets and future mapping work require the next separately authorized task.
