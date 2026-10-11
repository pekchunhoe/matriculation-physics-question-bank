# MATRICULATION PHYSICS QUESTION BANK
# MASTER FORMAT FIDELITY — PRODUCTION ROLLOUT

Updated 11 October 2026. Release preparation; deployment gates remain pending until evidence below is updated. No educational-content or asset write is permitted during this rollout.

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

Marking codes: **PASS locally**.
Step-linked hints: **PASS locally**.
Dynamic numbering: **PASS locally**.
Master A4 PDF template: **PASS locally**.
Question/answer shared numbering: **PASS locally**.
Question-only answer isolation: **PASS locally**.

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

Commit: **PENDING**.
Message: **Complete master format fidelity**.
Push: **PENDING**; branch `feat/admin-security`, normal push only.
Staged scope and secret/artifact audit: **PASS — 34 intended permanent files**, no provider-token/JWT/private-key literals. Complete content review and cached diff checks passed; staged contents match reviewed files after Git's configured CRLF/LF normalization. This scoped pattern scan does not claim detection of every possible secret format.
Ignored local evidence is under `data/master-rollout/` and `data/master-fidelity/`; logs, PDFs, images, databases, Playwright output, environment files and credentials are excluded.

## PROTECTED PREVIEW

URL: **PENDING**.
Exact commit: **PENDING**. Protection: **PENDING exact-deployment verification**; current project protection is `all_except_custom_domains`.
Database isolation: **UNVERIFIED; treat as Production-backed**. The same private Blob store is connected to both environments. No hosted question/asset/import write test is permitted.
Importer: **PENDING**. Marking codes: **PENDING**. Step hints: **PENDING**.
Numbering: **PENDING**. A4 PDF: **PENDING**. Security: **PENDING**.
Hosted read-only evidence will be distinguished from disposable synthetic rendering/validation evidence.

## PRODUCTION

Exact commit: **PENDING**. Deployment: **NOT ATTEMPTED**.
Health: **PENDING replacement runtime**. Importer: **PENDING authenticated read-only verification**.
Database migrations: **001/002/003/004/005**.
Questions: **1**. Draft: **1**. Approved: **0**. Assets: **0**.
Existing draft unchanged: **PASS after migration; final audit pending**.
Questions imported during rollout: **0**. Assets uploaded during rollout: **0**. Curriculum mutations: **0**.
Environment variables, Turso/Blob bindings, deployment protection and domains remain unchanged.

## FINAL STATUS

**IN PROGRESS — migration 005 preserved the existing draft; application release gates pending.**

Real import, draft edit/approval and future mapping work remain outside this rollout.
