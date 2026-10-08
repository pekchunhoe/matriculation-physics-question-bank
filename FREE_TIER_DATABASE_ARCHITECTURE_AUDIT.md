# Matriculation Physics Question Bank — Free-Tier Database Architecture Audit

**Audit and official-source verification date:** 8 October 2026, Asia/Kuala_Lumpur.  
**Scope:** this checkout, its accessible local database and files, public production HTTP status, and official provider documentation. No production database connection was made.  
**Permitted change:** this report only. No application startup, migration, dependency installation, resource creation, data upload, deployment, commit or push was performed.

## 1. Executive summary

**Best overall free database: Turso Cloud using its libSQL engine, conditionally on the compatibility and transaction tests described below.** Its SQLite semantics fit this application's actual FTS5 search, JSON functions, composite/deferred foreign keys, immutability triggers and relational revision design. The recommendation is specifically for libSQL; do not silently substitute the newer Turso rewrite based on the shared brand name. Official documentation distinguishes the engines and their SDKs. [Turso engine documentation](https://docs.turso.tech/libsql).

**Best alternative and best long-term expansion option: Neon PostgreSQL.** Its current offer includes managed authentication and object storage, so it is no longer accurate to describe Neon as a database-only service. It requires a larger SQL and transaction rewrite, but provides a strong expansion path with a Singapore region. [Neon October 2026 announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Neon regions](https://neon.com/docs/introduction/regions).

**Best option for minimum migration effort: Turso/libSQL, MEDIUM overall complexity.** Schema compatibility does not make this a connection-string change: the entire synchronous database/service call chain must become asynchronous, transactions must retain their connection/context, uploads need durable object storage, and APIs/authentication require application work. A separate persistent-disk backend would preserve more code, but is not a verified free cloud database solution and would retain operational responsibilities.

Current findings supersede historical assumptions:

| Finding | Verified current state |
|---|---|
| Actual engine | SQLite through Node's built-in `node:sqlite` `DatabaseSync`; no ORM |
| Logical database size | **249,856 bytes / 244 KiB**, including committed WAL-visible pages |
| Local filesystem footprint | **296,456 bytes**, main file + WAL + shared-memory file |
| Questions / versions / candidates | **0 / 0 / 0** in the inspected database |
| Curriculum | 1 course, 2 semesters; 0 chapters/topics/subtopics; curriculum-version tables **absent** |
| Migration status | **001 applied; 002 not applied** to this local file |
| Uploaded images / PDFs | **0 files / 0 bytes** locally; external file inventory unavailable |
| Public frontend | HTTP 200 |
| Public APIs tested | Taxonomy, questions and curriculum versions: HTTP 404 |
| Authentication | No server-enforced user identity or roles in this checkout |
| Persistence | Local disk only; database and uploads excluded from Git |

**Do not mistake this empty accessible bank for proof that all of the user's historical data is empty.** Other machines, directories, backups or production services were not supplied or accessed. Finding and validating the authoritative dataset is a prerequisite to any migration approval.

RM0 is realistic for a modest teacher/pilot workload within all selected services' allowances. It is not a promise of indefinite free production operation. Under the explicit baseline model below, 100,000 questions need about 6 GB of database storage and 30 GB of retained files: none of these candidates keeps that single application's entire baseline footprint free.

## 2. Evidence, methods and safety

Inspection covered `server/`, both SQL migrations, `shared/`, frontend API/browser/editor/import/curriculum flows, scripts, tests, package/configuration files and earlier audit documentation. No applicable `AGENTS.md` was found in the project or its inspected ancestor directories. Initial Git status was clean.

SQLite was opened directly with Python `sqlite3` using `file:data/bank.sqlite?mode=ro`, `uri=True`, then `PRAGMA query_only=ON`. Node's `DatabaseSync` was independently opened with `{ readOnly: true }` and query-only mode for `dbstat`. Queries examined schema, row counts, logical sizes, migration status, integrity and foreign-key violations. Python's SQLite library reports 3.50.4; the application's available Node 24.18.0 runtime reports SQLite 3.53.1. These are reader-library versions, not evidence of two database engines.

The application was **not instantiated**: `server/database.ts:41–70` creates migration metadata and automatically executes unapplied migrations. Starting `server/index.ts`, constructing `Bank`, or using an audit helper that instantiates it would violate this task. `scripts/check-db.ts:3` tests an in-memory migrated seed, not the live file. Historical passing checks therefore do not establish the current file's migration status.

Read-only results: `PRAGMA integrity_check = ok`; `PRAGMA foreign_key_check` returned no violations. This verifies stored relationship integrity, not that a deployed runtime enables enforcement or that an empty bank exercises revision workflows.

| Original local file | Bytes | SHA-256, identical before and after inspection |
|---|---:|---|
| `data/bank.sqlite` | 4,096 | `0ab48b25cba617ed3a4acca0161813b314c095ef63544bb4af60769eb1012977` |
| `data/bank.sqlite-wal` | 259,592 | `0c9fa44c80ec14efe8e6854e4a3f481dea24ab8b9d96735fd91093b887195a1e` |
| `data/bank.sqlite-shm` | 32,768 | `8a0db300d3472f21ecaf89f6a421c02a75d1261c36abc8cac2245d899cb61c93` |

Public HTTP verification used GET only, printed status/content type, and did not enumerate or download question records. Provider research sent no application data. Some Neon pages could not be parsed by the web tool; their visible official HTML text was retrieved read-only and corroborated with the current official announcement. No account dashboard settings were inspected.

## 3. Current database architecture and persistence

### Engine, connection and deployment boundaries

`server/database.ts:1` imports `DatabaseSync` from `node:sqlite`; `server/database.ts:77–95` uses raw prepared SQL and synchronous transactions. `package.json:22?28` lists Express, Multer, React, KaTeX and Zod, with no Prisma, Drizzle, PostgreSQL, Firebase or libSQL driver. Math is stored as text/LaTeX, validated with KaTeX (`shared/schema.ts:6–23`), and does not need a specialized database datatype.

`server/index.ts:8–11` resolves `BANK_DATA_DIR` or `data`, opens `bank.sqlite` and assigns `uploads/`. This audit process had no `BANK_DATA_DIR` set. The accessible default path is `D:\Physics Apps\Matriculation Physics Question Bank\data\bank.sqlite`. Environment settings of already-running processes and remote deployments are unknown. No local `.env` configuration was present in the root inventory; secret contents were not sought.

All persistent operations run in Express on the backend. The browser calls same-origin `/api` (`src/api.ts:1–17`); URL/history state and temporary download blobs are not persistent databases. No IndexedDB, localStorage database, remote SQL connection or production database selector was found. `Bank` defaults to `:memory:` for callers such as isolated tests, while the normal server supplies the disk path.

`.gitignore:1–5` excludes `data/` and environment files. `git ls-files data` returned nothing. Thus Git/Vercel deployments do not contain the live database or uploads. Redeploying static frontend files does not directly erase this local PC's database, but cannot transport or preserve its data in a cloud runtime. A redeploy/restart of a backend using ephemeral local disk can lose its writes; multiple instances can each see independent files.

The constructor enables `foreign_keys=ON`, WAL and a 5,000 ms busy timeout (`server/database.ts:43`). These are sensible local-process controls, not a remote persistence solution. Vercel function disk cannot be the durable shared writable database or uploads location. A cloud database resolves database durability; object storage separately resolves file durability. [Vercel function limitations](https://vercel.com/docs/functions/limitations).

### Actual inventory and size

The database has **17 ordinary application/metadata tables**, **1 FTS5 virtual table**, and **5 FTS5 shadow tables**: 23 `sqlite_master` table objects. It has 35 index objects: 10 explicitly authored indexes and 25 SQLite-generated indexes, including FTS internals. There are 2 current triggers and no stored views. Shadow/configuration rows are not questions or curriculum records.

| Live ordinary table | Rows | Table B-tree bytes, excluding its indexes |
|---|---:|---:|
| `courses` | 1 | 4,096 |
| `semesters` | 2 | 4,096 |
| `chapters` | 0 | 4,096 |
| `topics` | 0 | 4,096 |
| `subtopics` | 0 | 4,096 |
| `difficulty_levels` | 3 | 4,096 |
| `questions` | 0 | 4,096 |
| `question_parts` | 0 | 4,096 |
| `solutions` | 0 | 4,096 |
| `solution_steps` | 0 | 4,096 |
| `hints` | 0 | 4,096 |
| `assets` | 0 | 4,096 |
| `tags` | 0 | 4,096 |
| `question_tags` | 0 | 4,096 |
| `question_versions` | 0 | 4,096 |
| `revision_candidates` | 0 | 4,096 |
| `schema_migrations` | 1 | 4,096 |

`schema_migrations` contains version 1 with applied timestamp `2026-10-07T11:40:17.807Z`. `curriculum_versions`, `curriculum_events`, `question_version_classifications` and the migration-002 columns/indexes/triggers do **not** exist in the inspected database. Their counts are **unavailable because absent**, not measured zero rows in existing tables. Source implements these features; this file has not adopted them. Starting the current application would attempt migration 002.

FTS inventory: `question_search` has 0 logical rows; `_content`, `_docsize`, `_idx` have 0 rows; `_config` has 1 configuration row and `_data` has 2 internal rows. Each shadow-table B-tree occupies 4,096 bytes; the virtual table has no separate root B-tree.

| Storage category | Bytes | Interpretation |
|---|---:|---|
| All ordinary and shadow-table B-trees | 90,112 | 22 pages, including 20,480 bytes of FTS shadow-table B-trees |
| All indexes | 143,360 | 35 pages; each current index has one 4 KiB page |
| SQLite schema B-tree | 16,384 | 4 pages |
| Logical database total | **249,856** | 61 pages × 4,096 bytes; freelist 0 |
| Main file only | 4,096 | Incomplete representation of this WAL database |
| WAL | 259,592 | Includes page frames and WAL overhead; do not add it to logical size as unique data |
| Shared-memory sidecar | 32,768 | Coordination structure, not authored content |
| Total local database-related disk footprint | **296,456** | Main + WAL + SHM |
| Live uploaded images / PDFs / other uploads | **0 / 0 / 0 bytes** | No files under local uploads; 0 asset-reference rows |

Node's `dbstat` supplied the allocation figures; Python's reader did not expose that extension. Low utilization reflects allocated empty schema/index pages: live table payload is 296 bytes, index payload 245 bytes and schema payload 8,728 bytes. Per-question averages cannot be measured from an empty bank. Dependencies, build output, screenshots, generated reports and `public/favicon.svg` were excluded from the live asset count. No additional bank/database/PDF files were found in the inspected project outside excluded generated/dependency directories. Externally hosted URLs, other directories and remote object stores remain unmeasured.

**Backup risk:** much of the committed state is currently WAL-visible. Copying only the 4 KiB main file would omit it. A future authorized backup must use a consistent SQLite backup operation or stop writers and preserve the complete coherent data directory. No checkpoint, vacuum, backup creation or restore was run during this audit.

### Tables, columns, keys and relationships

The following is the full ordinary-table column inventory. `TEXT` is used unless a field is marked `INT`. SQL source supplies exact nullability/defaults/checks. Foundation rows below are live; migration-002 objects are separately labelled.

| Table | Columns | Principal keys/relationships | Source |
|---|---|---|---|
| `courses` | id, name, slug, sort_order INT, is_test INT | PK id; UNIQUE slug | `server/migrations/001-foundation.sql:1` |
| `semesters` | id, course_id, name, slug, sort_order INT, is_test INT | PK id; FK course_id; UNIQUE(course_id,slug) | `001-foundation.sql:2` |
| `chapters` | id, semester_id, name, slug, sort_order INT, is_test INT | PK id; FK semester_id; UNIQUE(semester_id,slug) | `001-foundation.sql:3` |
| `topics` | id, chapter_id, name, slug, sort_order INT, is_test INT | PK id; FK chapter_id; UNIQUE(chapter_id,slug) | `001-foundation.sql:4` |
| `subtopics` | id, topic_id, name, slug, sort_order INT, is_test INT | PK id; FK topic_id; UNIQUE(topic_id,slug), UNIQUE(id,topic_id) | `001-foundation.sql:5` |
| `difficulty_levels` | id, name, slug, sort_order INT | PK id; UNIQUE slug | `001-foundation.sql:6` |
| `questions` | id, question_code, topic_id, subtopic_id, title, scenario, difficulty_id, question_type, total_marks INT, estimated_minutes INT, status, contains_diagram INT, contains_graph INT, contains_fbd INT, active_version INT, created_at, updated_at, approved_at | PK id; UNIQUE code; FKs topic/difficulty; composite FK(subtopic_id,topic_id) | `001-foundation.sql:7` |
| `question_parts` | question_id, id, label, prompt, marks INT, display_order INT, parent_id | PK(question_id,id); question FK; deferred self-FK(question_id,parent_id) | `001-foundation.sql:8` |
| `solutions` | question_id, part_id, solution, equation_latex, teacher_notes | PK(question_id,part_id); composite FK to parts | `001-foundation.sql:9` |
| `solution_steps` | question_id, part_id, step_number INT, explanation, equation_latex, working, marking_point, marks INT, display_order INT | PK(question_id,part_id,step_number); composite FK to solutions | `001-foundation.sql:10` |
| `hints` | question_id, id, part_id, hint_text, display_order INT | PK(question_id,id); question FK; optional composite part FK | `001-foundation.sql:11` |
| `assets` | question_id, id, part_id, kind, url, alt, mime, display_order INT | PK(question_id,id); question FK; optional composite part FK; file bytes external | `001-foundation.sql:12` |
| `tags` | id, name, normalized | PK id; UNIQUE normalized | `001-foundation.sql:13` |
| `question_tags` | question_id, tag_id | Composite PK; FKs question/tag | `001-foundation.sql:14` |
| `question_versions` | question_id, version_number INT, snapshot, change_note, author, created_at | Composite PK; question FK; valid JSON; immutable update/delete triggers | `001-foundation.sql:15,28–29` |
| `revision_candidates` | id, question_id, base_version INT, source, source_pdf_url, snapshot, change_note, author, status, created_at, reviewed_at, reviewer | PK id; question FK; valid JSON; checked source and review status | `001-foundation.sql:16` |
| `schema_migrations` | version INT, applied_at | INTEGER PK version; created by constructor | `server/database.ts:44–46` |

Question type/status, positive marks/minutes and nonnegative part/step marks use CHECK constraints. Flags are stored as integers. IDs are text: UUIDs for many entities but seed IDs such as `semester-1` are not UUIDs. PostgreSQL migration must preserve IDs as text or explicitly introduce a reversible mapping; blindly converting every PK to a UUID type is unsafe. SQLite TEXT PK nullability semantics also merit validation before adopting PostgreSQL's stricter PK enforcement.

Migration 002, **implemented in source but unapplied locally**, adds:

| Object | Columns/change | Constraints and preservation purpose |
|---|---|---|
| `curriculum_versions` | id, course_id, code, name, effective_from, effective_to, status, sort_order INT, revision INT, created_at, updated_at | PK id; course FK; UNIQUE(course_id,code); valid date order; one active version/course via partial unique index |
| `semesters` | curriculum_version_id, status, revision INT | New curriculum FK and stable course/version membership guards |
| `chapters`, `topics`, `subtopics` | status, revision INT | Retirement and optimistic editing metadata |
| `curriculum_events` | id, kind, entity_id, before_json, after_json, note, author, created_at | PK id; valid JSON; entity reference is polymorphic text, not a declared FK |
| `question_version_classifications` | question_id, version_number INT, snapshot | Composite PK/FK to question_versions; valid JSON; immutable classification snapshots |

Evidence: `server/migrations/002-curriculum.sql:2–40`. Classification backfill uses `json_object`/`json_extract`, retains IDs and labels reconstructed names with `provenance='reconstructed'` (`:42–55`). It cannot recover historical names that were never stored. The constructor compares version and classification counts and rolls back migration 002 if reconstruction is incomplete (`server/database.ts:56–64`). Do not turn reconstruction into an assertion of original historical truth.

Indexes in the live schema: `semesters_course(course_id)`, `chapters_semester(semester_id)`, `topics_chapter(chapter_id)`, `subtopics_topic(topic_id)`, `questions_browse(topic_id,difficulty_id,status,total_marks)`, `questions_status_difficulty(status,difficulty_id,total_marks)`, `questions_subtopic(subtopic_id)`, `questions_marks(total_marks)`, `question_tags_tag(tag_id,question_id)`, `revisions_question(question_id,status)` (`001-foundation.sql:17–26`). Migration 002 adds `one_active_curriculum(course_id) WHERE status='active'`, `semesters_curriculum(curriculum_version_id,status,sort_order)`, `curriculum_course(course_id,status,sort_order)` and `curriculum_events_entity(kind,entity_id,created_at)` (`002-curriculum.sql:17,31–34`).

Current triggers reject historical-version UPDATE/DELETE. Intended migration-002 triggers also reject classification changes, permanent curriculum deletion, course/version membership changes and referenced or cross-version subtree moves (`002-curriculum.sql:18,56–82`). `curriculum_events` itself has no immutable trigger in these migrations. No explicit learning-outcome entity, learner account, enrollment, tenant membership or exam-generation table was found; these are future requirements.

## 4. Read/write flows and actual feature requirements

| Flow | Current code behavior | Preservation/hosting consequence |
|---|---|---|
| Create question | Validate document, code uniqueness, approval and assignment; write normalized content, version snapshot, classification and FTS entry in one transaction | Requires atomic multi-table writes, not independent REST inserts (`server/database.ts:429–520`) |
| Edit draft/reviewing question | Check baseVersion under write transaction; replace current child rows and append version | Preserve optimistic concurrency and deferred parent-part FK (`:545–584`) |
| Edit approved/retired question | Create a pending candidate; retain active approved content | Candidates and their base versions are required migration data, even if no candidate is active |
| Review candidate | Check reviewer text, candidate state and active version; activate or reject transactionally | A typed reviewer name is an audit annotation, not authenticated identity (`:586–618`) |
| Curriculum edit/activation | Impact/state hash and revision checks; retirement rather than deletion; events; activation retires prior active version | Preserve partial uniqueness and concurrency guards (`server/curriculum.ts:225–329,399–451`) |
| Curriculum import | Validate hierarchy/counts, stale-plan token, new draft; insert hierarchy atomically | Maximum 10,000 hierarchy records; no overwrite import (`:494–650`) |
| Question JSON import | One document per request, existing taxonomy resolution, explicit create/revise action | No general bulk question migration endpoint; importer is not an ID-preserving database transfer (`server/app.ts:154–188`) |
| Export/history | Question snapshots optionally with saved classification; curriculum JSON hierarchy; versions/candidates | JSON export excludes binary files and is not a full database/history backup (`server/app.ts:95–102,221–250`) |
| Search/filter | FTS5 unicode61, quoted prefix terms joined with AND, hierarchy joins, tags, numeric/flag/status filters | Search semantics are SQLite-specific, not plain LIKE (`server/database.ts:635–736`; `001-foundation.sql:27`) |
| Files | UUID filenames, local write, asset metadata and historical URL retention | File/object bytes need separate persistence and private access (`server/app.ts:268–311`) |
| PDF extraction | Interface exists; route responds 501 without extractor | PDF generation/extraction is anticipated, not a currently working parser (`server/revisions.ts:30–51`) |

`writeContent` deletes current content links/rows in dependency order and recreates them (`server/database.ts:302–370`), while immutable history retains full snapshots. Historical asset files are retained even when links are removed. An upload happens separately from the question transaction: failed authoring can leave an orphan file. Database ACID does not encompass an object-store upload; future cleanup must inspect both current and historical references before deletion.

**Required today by code:** relational joins, foreign-key enforcement, composite keys, unique/CHECK constraints, deferred self-references, atomic interactive transactions, JSON validation/extraction/construction, FTS5 prefix search and triggers. `BEGIN IMMEDIATE` is important because reads and conditional writes occur within one SQLite write lock (`server/database.ts:86–95`).

**Not currently used:** PostgreSQL-specific functions, high-frequency telemetry/attempt writes, realtime subscriptions, vector search, row-level security or browser database SDKs. RLS is a useful future control for PostgreSQL client access; it is not needed solely because the database is cloud-hosted. Authenticated server roles and protected files are required before public multi-user teacher/student access.

**Concurrency/scaling limitations:** the local synchronous driver blocks the Node event loop during queries, and SQLite permits one active writer. Question base-version checks and curriculum revision/state hashes help reject stale writes; after moving to PostgreSQL, `BEGIN` alone does not reproduce `BEGIN IMMEDIATE`. Use row locks/conditional version updates and appropriate isolation/retries for curriculum state. The curriculum state hash reads all questions, classification keys and pending candidates (`server/curriculum.ts:70–81`); `refreshSearch` loops over every question, reading documents and rewriting the index during curriculum edits (`server/database.ts:392–394`; `server/curriculum.ts:329`). These operations may be expensive well before storage fills.

## 5. Vercel deployment and security audit

### Public endpoint recheck

On 8 October 2026, GET requests returned:

| URL on `https://matriculation-physics-question-bank.vercel.app` | Status | Content type |
|---|---:|---|
| `/` | 200 | text/html |
| `/api/taxonomy` | 404 | text/plain |
| `/api/questions` | 404 | text/plain |
| `/api/curriculum-versions` | 404 | text/plain |

These routes are implemented in `server/app.ts:59,78,139`. The checkout's `build` script is TypeScript checking plus `vite build` (`package.json:11`); the output is `dist` (`vite.config.ts:4`). The Vite proxy (`vite.config.ts:3`) is a development proxy, not production routing. The normal entrypoint binds an Express server to `127.0.0.1` (`server/index.ts:19`). There is no root `/api` function directory, Vercel output-function configuration, backend rewrite or supplied external backend deployment configuration in tracked files.

**Supported diagnosis:** the public result is consistent with a deployed static Vite frontend without the Express API routed behind it. It returns plain-text 404, whereas Express's explicit unknown-API fallback returns JSON (`server/app.ts:313`). Dashboard framework settings, build logs and deployment artifacts were not available, so the exact deployed commit/configuration cannot be established solely from this checkout. Choosing any database will not automatically register these routes.

Vercel supports Express when the deployment follows its documented entrypoint/framework conventions; a separate persistent server is not inherently required after the API and storage are adapted. This nested `server/index.ts` should not be assumed automatically detected under the project's Vite deployment. A future change can expose an appropriate Express function entrypoint or separate handlers and keep the React frontend. [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express), [Vercel Node function routing](https://vercel.com/docs/functions/runtimes/node-js).

### Access control findings

`server/app.ts:16–30` rejects cross-origin writes when an Origin header exists; it does not authenticate callers. Missing Origin passes this check, and non-browser clients can send requests. There are no server session/JWT verification or teacher/admin role checks protecting create, edit, import, review or upload routes.

Student view is selected by `?view=student`; omitting it returns teacher content, including solutions and metadata (`server/app.ts:190–213`). `/uploads` is served statically without access checks (`:32–43`). Thus teacher PDFs/diagrams can be retrieved by known URL independently of student-response filtering. Browser-list metadata includes `original_pdf` (`server/database.ts:728`). Zod validation, parameterized query values, upload signatures, SVG restrictions, nosniff and impact confirmation provide useful integrity defenses, but not user authorization.

Future server credentials must remain in backend-only environment settings, never in `VITE_*` variables, generated browser bundles or Git. Use least-privilege database/object credentials, verified user identity, server-owned author/reviewer attribution, roles, protected downloads and upload quotas. The cloud provider cannot infer these policies from this schema. No credentials were exposed by this audit.

Direct client database access is inappropriate for the current model: unrestricted SQL tokens would expose answers and allow editing; PostgreSQL browser APIs require carefully designed RLS, and Firebase needs verified Security Rules. Retain the existing server validation/review boundary. Firebase server libraries bypass Security Rules and use IAM, so an Admin SDK does not remove the need for API authorization. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres), [Firebase Security Rules and server clients](https://firebase.google.com/docs/firestore/security/rules-query).

### Upload and runtime limits

The app permits 20 MiB multipart uploads and 5 MB JSON (`server/app.ts:30,270`), while ordinary Vercel Functions have a **4.5 MB request/response payload limit**. A database migration does not fix large-upload failures. Future authorized changes should use server-authorized direct-to-object-store uploads and enforce MIME/content/size/private-access rules; do not stream large PDFs through ordinary function bodies. [Vercel payload limits](https://vercel.com/docs/functions/limitations).

Turso/libSQL can be accessed remotely from Vercel with its asynchronous client; do not use ephemeral embedded replicas as the authoritative write store. PostgreSQL requires a small application pool and a provider pooler or serverless driver. Neon HTTP transactions are non-interactive; use its WebSocket Client/Pool or a suitable pooled TCP driver for this app's conditional transaction flows. Supabase recommends transaction pooling for serverless functions. [Turso SDK](https://docs.turso.tech/sdk/ts/reference), [Neon driver](https://neon.com/docs/serverless/serverless-driver), [Supabase pooling](https://supabase.com/docs/guides/database/connecting-to-postgres).

| Solved by appropriate provider integration | Requires separate application/deployment work |
|---|---|
| Durable shared database, managed infrastructure, documented recovery features | Missing API routing/entrypoint, authentication/authorization, synchronous-to-async rewrite |
| Durable files if object storage is also integrated | Local file access assumptions, private teacher assets, historical URL continuity, large uploads |
| Connection pooling/serverless transport availability | Correct transaction isolation, bounded import/search work, quota monitoring and restore drills |

Vercel plan allowance, deployment region and commercial-use eligibility were not account-verified. Database RM0 does not establish whole-stack RM0; future expansion must separately check frontend/function/transfer limits and the plan's usage terms. [Vercel Hobby documentation](https://vercel.com/docs/plans/hobby).

## 6. Official free-tier comparison

All figures below were checked against official public pages on **8 October 2026**. Storage limits are persistent capacities, not monthly fresh allocations. GB/GiB use the providers' labels. Quotas are not performance guarantees or service-level agreements. Account-specific eligibility/provisioning was not tested.

### Quotas and included products

| Provider | Free SQL/document storage | Free object/file storage | Reads/writes and compute | Projects/databases and connections | Official sources |
|---|---|---|---|---|---|
| **Turso Cloud** | **5 GB total** | No separate object-storage allowance in the database plan; BLOB bytes would consume database capacity | **500 million row reads/month; 10 million row writes/month; 3 GB sync/month**; no CU-hour allowance published | **100 databases**; no global connection cap established from inspected docs; libSQL client default 20 concurrent requests is a client setting | [Pricing](https://turso.tech/pricing), [SDK](https://docs.turso.tech/sdk/ts/reference) |
| **Neon** | **1 GB/project**, **20 GB total account PostgreSQL cap** | **5 GB/project** S3-compatible Object Storage | **100 CU-hours/project/month**, up to 2 CU; no per-row allowance; built-in Functions are a separate included product, not needed for Vercel | **100 projects; 10 branches/project**; pooler accepts up to **10,000 clients**, not 10,000 active SQL transactions | [Current plans](https://neon.com/docs/introduction/plans), [Pooling](https://neon.com/docs/connect/connection-pooling) |
| **Supabase** | **500 MB/project** | **1 GB**; Free upload ceiling 50 MB | Unlimited API requests, shared CPU/500 MB RAM; **50,000 Auth MAU**; no monthly CU-hour quota advertised | **2 active free projects**; Nano Free **60 direct / 200 pooled clients** | [Pricing](https://supabase.com/pricing), [Compute](https://supabase.com/docs/guides/platform/compute-and-disk), [File limits](https://supabase.com/docs/guides/storage/uploads/file-limits) |
| **Cloudflare D1** | **500 MB/database; 5 GB/account** | None in D1; R2 is separate | **5 million rows read/day; 100,000 rows written/day**; no separate D1 compute charge | **10 free databases**; single-threaded per database; 6 simultaneous D1 connections/Worker invocation, not a global SQL pool | [Pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Limits](https://developers.cloudflare.com/d1/platform/limits/) |
| **Firestore Standard/Spark** | **1 GiB**, one free database/project | Cloud Storage for Firebase requires **Blaze billing**, including access to existing buckets since February 2026 | **50,000 document reads/day; 20,000 writes/day; 20,000 deletes/day**; managed serverless service, no CU-hour meter in this offer | One free DB/project; Firebase/GCP project-count quota is account-dependent; no SQL connection pool | [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [Storage billing changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) |

The Neon figures reflect its **2 October 2026 update**; old 0.5 GB/50-CU-hour summaries are obsolete. The 100-project offer is not 100 GB of aggregate free PostgreSQL capacity: the current plans page separately caps that at 20 GB. New Neon object storage/authentication materially improves its ranking, but does not remove SQLite migration work. [Current announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Plans](https://neon.com/docs/introduction/plans).

**Meaningful additional service: Cloudflare R2 for files**, paired with Turso or any database. Standard storage includes **10 GB-month/month**, 1 million Class A and 10 million Class B operations/month, with zero R2 egress fees. It requires an R2 subscription/checkout and bills excess usage: this is an included allowance on a metered service, not a guaranteed hard spending cap. At baseline Medium, this provides more file headroom than Supabase; at baseline Large, retained files exceed it. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 subscription requirements](https://developers.cloudflare.com/r2/get-started/).

D1 typically uses a Worker backend. Workers Free has **100,000 requests/day, 10 ms CPU/request**, 128 MB memory and 50 D1 queries per invocation. The server's KaTeX/Zod validation and large curriculum work need benchmarking or redesign against these limits. Worker quotas are separate from D1 row/storage quotas. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

No other database was added to the shortlist: another generic PostgreSQL/MySQL/document service would need a demonstrated advantage over the verified offers, whereas R2 addresses a concrete missing file-storage requirement without replacing the relational model.

### Inactivity, recovery, export, egress and overages

| Provider | Inactivity / quota behavior | Recovery and export | Network limits / billing distinction |
|---|---|---|---|
| Turso | No inactivity-pause promise or precise policy verified. Documented quota exhaustion returns BLOCKED; pricing says overages bill once enabled. Keep paid overages disabled for database RM0 | **24-hour PITR**, automatic commit backups; CLI SQLite/SQL export; keep independent backups | **3 GB sync** is replication/sync allowance, not a verified general API-egress ceiling; separate query-response egress cap not established |
| Neon | Mandatory scale-to-zero after **5 idle minutes**; transparent wake-up differs from long-term project suspension. Compute/egress exhaustion suspends compute until reset/upgrade; storage-increasing operations fail at caps | **6-hour restore window**, capped at 1 GB change history; **1 manual snapshot**; no free scheduled snapshots; standard PostgreSQL exports | **5 GB/project/month public transfer shared across products**, including Object Storage; Free caps suspend rather than auto-charge; paid plans meter usage |
| Supabase | Free project pause after **1 week inactivity**. Free database size/other allowances require attention; do not assume the Pro spend-cap model describes Free | Free users should make external CLI/pg_dump backups; Pro daily backups and paid PITR are not Free entitlements. DB backup does not back up Storage binaries | **5 GB uncached + 5 GB cached egress** are separate allowance buckets, not an unrestricted interchangeable 10 GB pool; paid overages/add-ons separate |
| D1 | Free daily row/storage caps block queries or growth; no inactivity auto-pause stated in inspected D1 pricing/limits docs | **7-day Time Travel** on Free; SQL export/import; verify FTS virtual-table export limitations | No D1 egress charges; Worker and R2 allowances separate; Workers Paid removes free hard row caps and bills excess |
| Firestore | Spark daily quotas can stop operations; no inactivity suspension entitlement verified | PITR, backup, restore/clone have **no free usage**. Managed export/import requires billing/Blaze and a bucket; custom SDK export consumes reads and needs its own restore design | **10 GiB/month outbound** in the stated free quota; Blaze is pay-as-you-go. Storage billing and budget alerts are not hard cost guarantees |

Sources for this table: [Turso usage](https://docs.turso.tech/help/usage-and-billing), [Turso recovery](https://docs.turso.tech/features/point-in-time-recovery), [Turso export](https://docs.turso.tech/cli/db/export), [Neon current plans](https://neon.com/docs/introduction/plans), [Supabase pricing](https://supabase.com/pricing), [Supabase backups](https://supabase.com/docs/guides/platform/backups), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 export](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [Firestore managed export](https://firebase.google.com/docs/firestore/manage-data/export-import).

### Authentication, security, regions and lock-in

| Provider | Available security/user facilities | Regional fit for Malaysia | Lock-in implications |
|---|---|---|---|
| Turso/libSQL | Service tokens, scoped permissions; verify end-user authorization in API. No integrated user-account service included in inspected database pricing | AWS Tokyo/Mumbai historically supported; **Singapore availability not verified**. Recent expansion post describes Singapore as a future target; do not claim local residency | SQLite schema/data relatively portable; remote SDK, tokens, PITR and newer engine features are provider-specific |
| Neon | Managed Better Auth, up to **60,000 MAU** on Free; PostgreSQL roles/RLS and TLS; policies/application integration still required | **Singapore** PostgreSQL and Object Storage documented | PostgreSQL exports portable; Auth, branching and Storage workflows add platform coupling |
| Supabase | Integrated Auth, PostgreSQL RLS and private Storage policies; service-role secrets must stay server-side | **Singapore** explicitly available | Core PostgreSQL portable; Auth/Data API/Storage policies and SDK integration add platform coupling |
| D1 | Worker bindings and scoped Cloudflare credentials; user login/roles require application or separate identity service | **APAC location hint**, not an exact-country residency guarantee | SQLite SQL portable with limits; Worker bindings, batching and location/recovery controls are Cloudflare-specific |
| Firebase | Firebase Auth + client Security Rules; server access via IAM and application checks | Regional location selection documented; exact Singapore project availability was not established by retrieved page | Document model, rules, SDK queries and export format imply the greatest rewrite/lock-in for this app |

Regional/auth sources: [Turso AWS migration mapping](https://turso.tech/blog/turso-aws-out-of-beta), [Turso recent regional expansion](https://turso.tech/blog/turso-cloud-new-regions), [Neon regions](https://neon.com/docs/introduction/regions), [Neon announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase connection/RLS guidance](https://supabase.com/docs/guides/database/connecting-to-postgres), [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/), [Firestore locations](https://firebase.google.com/docs/firestore/locations), [Firestore security](https://firebase.google.com/docs/firestore/security/rules-query).

Storage/auth quotas count capacity or MAU, not concurrent users. A pooler client limit is not a throughput promise. Numerical service concurrency limits for Turso and Firestore and account-specific idle retention remain unresolved rather than filled in from memory.

## 7. Migration compatibility and data risks

| Actual dependency | Turso **libSQL** | Neon / Supabase PostgreSQL | Cloudflare D1 | Firestore Standard |
|---|---|---|---|---|
| `node:sqlite` synchronous API | Replace with async `@libsql/client`; propagate awaits through services/API | Replace driver and SQL; async throughout | Replace with async binding/REST, usually Worker bridge | Rewrite data access into document SDK |
| TEXT seed/UUID IDs, composite keys | Preserve SQLite representations | Keep text IDs; validate nullability/flags/timestamps; explicitly preserve composite keys | Preserve IDs/keys within supported schema | Encode IDs and composite relationships into docs; no relational FK enforcement |
| Deferred self-FK for nested parts | SQLite semantics supported by libSQL foundation; hosted behavior must be proved in staging | PostgreSQL supports deferred FK; preserve declaration and statement ordering | FK support and deferral documented; batching/transaction boundaries need tests | Enforce graph consistency in application/transactions |
| `BEGIN IMMEDIATE`, conditional read/write | Use transaction-scoped client; five-second interactive transaction timeout | Use same checked-out connection, locks/CAS/isolation; plain BEGIN changes concurrency semantics | Atomic `batch` supported, but no equivalent interactive JS callback across calls; redesign conditional writes | Document transactions exist; not a drop-in relational transaction |
| `json_valid`, `json_extract`, `json_object`, `strftime` | JSON/SQLite functions fit; remote PRAGMAs need removal/adaptation | Translate JSON to operators/functions and timestamps; JSON/JSONB choice explicit | JSON supported; date/trigger/import behavior proof needed | Native maps/arrays; raw historical JSON text should still be preserved |
| FTS5 unicode61 `MATCH`, AND/prefix tokens | Official FTS5 extension available | Rebuild search with tsvector/tsquery and suitable index/configuration; prefix/token tests required | FTS5 officially supported | Standard is not FTS5-compatible; native text search documentation requires Enterprise edition |
| `RAISE(ABORT)` immutability/move triggers | Closest preservation path on libSQL | Rewrite as PostgreSQL trigger functions and permissions | Verify triggers and export behavior in staging | Reimplement via rules/service checks; SDK/admin paths differ |
| Partial unique active-curriculum index | SQLite feature retained | PostgreSQL partial unique index preserves invariant | Validate SQLite partial index in target | Transactionally enforce one active version/course |
| Positional `?`, `INSERT OR IGNORE` | Mostly retained | Replace binds with driver placeholders; ON CONFLICT equivalent | Bind syntax close; replace transport | Not SQL |
| Local uploads / filesystem existence checks | All providers need durable file adapter, historical URLs and protected access | Same | Same; R2 is separate | Same; Firebase Storage requires Blaze |

Sources: [libSQL compatibility](https://docs.turso.tech/libsql), [Turso extensions](https://docs.turso.tech/features/sqlite-extensions), [Turso remote PRAGMA differences](https://docs.turso.tech/cloud/limitations), [Turso interactive transactions](https://docs.turso.tech/sdk/ts/reference), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [PostgreSQL JSON](https://www.postgresql.org/docs/current/functions-json.html), [PostgreSQL text search](https://www.postgresql.org/docs/current/textsearch.html), [D1 extensions](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/), [Firestore Enterprise text search requirement](https://firebase.google.com/docs/firestore/enterprise/text-search).

**Turso's five-second interactive transaction limit is a material compatibility gate.** This app's many per-row writes, 10,000-record curriculum import and full-bank search refresh can exceed it after a remote async conversion. Precompute content outside the critical section where safe, use bounded/set-based statements and atomic batches where possible, and test worst-case transactions. Do not commit chunks that silently break all-or-nothing import. If an acceptable transaction-preserving implementation cannot fit, prefer Neon despite its larger dialect rewrite. The 20-request SDK concurrency setting is not a solution to a single transaction's write lock. [Turso transaction documentation](https://docs.turso.tech/sdk/ts/reference).

| Candidate | Overall migration complexity | Why |
|---|---|---|
| Turso/libSQL | **MEDIUM** | Least SQL/schema translation; substantial async and bounded-transaction/API/file/auth work remains |
| Neon | **HIGH** | Same async/API/file work plus FTS/JSON/triggers/placeholder and concurrency translation |
| Supabase | **HIGH** | PostgreSQL translation plus Auth/Storage policy integration if used; integrated platform can reduce separate-service work |
| D1 | **HIGH** | Close SQL dialect but conditional transactions, Worker/API deployment and execution limits change the service layer |
| Firestore | **VERY HIGH** | Full relational/history/search/security model rewrite; greatest preservation burden |

There is no existing ORM abstraction to make any migration automatic. No hosted compatibility test was run; ratings distinguish documented feature fit from proof that these exact migration files execute unchanged.

**Do not migrate through ordinary question-create/import endpoints.** `Bank.create` generates a new UUID and initial version; regular imports are intended for reviewed content workflows, not a complete physical/history transfer (`server/database.ts:502–518`; `server/app.ts:167–188`). Direct, controlled table transfer after approval must preserve question IDs/codes, taxonomy IDs, active/base versions, candidates and statuses, reviewer/author/timestamps, JSON snapshot bytes, classification provenance, tags/child ordering, asset URLs and revision source PDFs.

Changing JSON storage to JSONB can reserialize object key order/whitespace. Preserve raw historical text or record/validate an explicit canonicalization policy; compare both raw hashes and semantic JSON separately. Rebuild search indexes from current documents, not by treating internal FTS rows as authored records. Preserve FTS search behavior with representative physics notation/code/prefix cases.

Moving old `/uploads/...` URLs requires stable resolution. Prefer a protected compatibility resolver to immutable object keys so existing historical snapshots can remain unchanged. Never delete historical file objects solely because the live `assets` table no longer references them. Backup and restoration must include database and file manifest/binaries together.

## 8. Future capacity: assumptions, estimates and sustainability

### Model and limitations

The live bank is empty, so no observed authored-document/image average exists. These are transparent planning estimates, not measurements. Test fixtures were inspected only as code and were neither seeded nor counted as live content. No load test was run.

Assume Q questions with average 10 KB structured content, **3 retained full versions/question**, 1 KB classification/version, 0.2 retained candidates/question and normalized current content around 10 KB/question. Add 5 KB/question for search/index work and 10 KB/question for row/index/page overhead. Baseline total is **60 KB/question** plus **2.25 MB fixed schema/taxonomy allowance**. Sensitivity range is **30–100 KB/question**. PostgreSQL platform/auth/catalog overhead is additional and must be measured after staging; this SQLite planning formula is not a pg_relation_size measurement.

Binary model: 40% of questions have one 250 KB image, 10% one 1 MB PDF; average current files **200 KB/question**. Retained replacements/orphans add an assumed factor **1.5**, giving **300 KB/question**. Shared source PDFs, compressed diagrams, multiple diagrams and larger master PDFs materially change this result.

Treat the user's active-user figures as **daily active users D on 20 days/month**, not registered or monthly active accounts. Assume 10 browse/filter requests and 10 detail views per active user/day, one taxonomy and one counts request per session. Database work is about **88 SELECT statements/user/day**: browse 2 × 10, teacher detail roughly 6 × 10, taxonomy 7 and counts 1. Evidence: `server/database.ts:97–118,535–543,718–744`; `server/app.ts:190–213`. Student/historical views can use fewer reads. The 250 ms browser debounce reduces typing bursts (`src/Browser.tsx:63–82`) but does not eliminate queries.

Assume browse returns 20 KB/page and detail 10 KB: about **6 MB API result data per daily active user/month**, excluding TLS/metadata/duplicate DB reads. Assume image fetch on 40% and PDF download on 10% of detail views: **40 MB/user/month file egress** before caching. Baseline total application payload is about **46 MB × D/month**; database-to-API wire traffic may be 1–2 times result payload because the current code rereads metadata. File delivery directly from storage is separate from SQL traffic. Initial imports/backfills are additional, not steady-state usage.

| Metric | Small: 1,000 Q / 10 D | Medium: 10,000 Q / 100 D | Large: 100,000 Q / 1,000 D |
|---|---:|---:|---:|
| Baseline DB | ~62 MB | ~602 MB | ~6.00 GB |
| DB sensitivity range | ~32–102 MB | ~302 MB–1.00 GB | ~3.00–10.00 GB |
| Expected version / candidate rows | 3,000 / 200 | 30,000 / 2,000 | 300,000 / 20,000 |
| Expected image / PDF objects, current | 400 / 100 | 4,000 / 1,000 | 40,000 / 10,000 |
| Current binary bytes | 0.20 GB | 2.0 GB | 20 GB |
| Retained binary bytes, ×1.5 | **0.30 GB** | **3.0 GB** | **30 GB** |
| Monthly SQL read statements | ~17,600 | ~176,000 | ~1,760,000 |
| Monthly API calls incl. session taxonomy/counts | ~4,400 | ~44,000 | ~440,000 |
| Monthly API result payload | ~0.06 GB | ~0.60 GB | ~6 GB |
| DB-to-API wire planning range | ~0.06–0.12 GB | ~0.6–1.2 GB | ~6–12 GB |
| File egress before cache | ~0.4 GB | ~4 GB | ~40 GB |
| Combined result/file payload | ~0.46 GB | ~4.6 GB | ~46 GB |
| Illustrative peak simultaneous users, **assumed** | 2 | 10 | 50 |

At 1–10 ms execution CPU per SQL statement, monthly SQL execution is roughly 18–176 seconds, 176–1,760 seconds and 1,760–17,600 seconds respectively. These are assumed CPU/work estimates, not measured provider compute usage. Joins, full counts, sorting and curriculum-wide work can cost much more.

**Rows scanned, not returned rows, determine Turso/D1 read consumption.** Monthly browse count calls number **200D**. If each count scans all Q matching questions, just those counts consume **2 million / 200 million / 20 billion rows/month** across the three scenarios. Other joins/list/detail/state queries add scans. Large would far exceed Turso's 500 million/month and D1's 5 million/day without selective filters, cached counts or other authorized query improvements. Medium may fit Turso but can exceed D1 daily allowance on active days (10 million count rows/day in this deliberately broad-scan case). This is a stress bound, not a measured query plan on an empty database. [Turso scan accounting](https://docs.turso.tech/help/usage-and-billing), [D1 usage accounting](https://developers.cloudflare.com/d1/platform/pricing/).

For writes, assume 1% of questions edited monthly and 40–100 affected content/history/index rows per edit. Approximate steady-state writes: **400–1,000**, **4,000–10,000**, **40,000–100,000 rows/month**, before FTS/index/provider accounting and import bursts. Initial content import is on the order of 30–60 base rows/question, plus search/index work: 30,000–60,000; 300,000–600,000; 3–6 million. Provider-specific index/failed-transaction billing can increase this. Bulk loads cannot be assumed to fit a daily quota simply because normal monthly edits do.

**Neon compute is time at provisioned CU while awake, not summed query CPU.** At 0.25 CU, assumed active windows of 2 h/day × 20 days, 8 h/day × 20 days and 16 h/day × 30 days give **10 / 40 / 120 CU-hours/month**. Scale-up increases these totals; widely spaced requests incur repeated awake/idle windows. The Large illustration exceeds Free's 100 CU-hours; continuous 0.25 CU operation consumes around 180 CU-hours over 30 days. Supabase's shared free instance, Turso row quotas and D1/Worker limits use different meters and must not be equated to these CU-hours. [Neon plans](https://neon.com/docs/introduction/plans).

### Can each scenario remain free?

| Candidate | Small | Medium baseline | Large baseline |
|---|---|---|---|
| Turso/libSQL + R2 | **Plausible RM0**, after API/auth/file work; database hard quota vs R2 metered allowance | **Plausible but conditional:** 0.6 GB DB and 3 GB objects fit; broad scans, transaction duration and API runtime must be monitored | **No:** ~6 GB DB exceeds 5 GB; 30 GB files exceed R2 free allowance; broad scan model also fails |
| Neon with native Object Storage | **Plausible RM0** with low compute/transfer | **Borderline but plausible:** DB + overhead must stay below 1 GB, files below 5 GB; shared 5 GB egress is tight at ~4.6 GB result/files plus extra SQL wire/overhead | **No:** single-project DB/file/egress and likely compute caps exceeded |
| Supabase | **Plausible RM0**, with pause/manual backup caveats | **No for baseline:** 602 MB DB exceeds 500 MB before platform overhead; 3 GB files exceed 1 GB. Lean content/external storage could alter this | **No** |
| D1 + R2 | **Plausible after transaction/Worker rewrite** | **No for baseline single database:** 602 MB exceeds 500 MB; broad daily scan stress can also fail | **No:** per-database limit/files/workload; unnecessary sharding would complicate curriculum/history joins |
| Firestore Spark | Database alone could fit; no Spark-native file-storage solution | Database might fit with careful indexes/doc sizes, but preservation rewrite and files/recovery are unsuitable for strict free-only architecture | **No under baseline**; storage/network/operations and file costs |

The largest cost sensitivities are full-history count and document size, diagram/PDF sizes and retention, browse count scans, session/traffic time distribution, cache hit rate and file egress. 100 MAU who visit once/month is a very different workload from 100 DAU visiting 20 days; 1,000 simultaneous users is far more demanding than the Large scenario's assumed 50 simultaneous users. None of the projections asserts such concurrency was measured.

## 9. Weighted scoring and ranking

Scores are **architectural judgments**, not provider benchmarks. Each cell is points awarded out of the stated weight, using documented features and the actual code dependencies. Free sustainability includes the Medium scenario and separate file-service needs. Common unresolved deployment/auth work prevents any candidate from being called production-ready.

| Candidate | Compatibility /25 | Free sustainability /20 | Migration/data safety /15 | Vercel /15 | Auth/security /10 | Recovery /10 | Expansion /5 | **Total /100** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Turso/libSQL** | 24 | 16 | 12 | 14 | 6 | 7 | 3 | **82** |
| **Neon** | 17 | 15 | 9 | 15 | 9 | 6 | 5 | **76** |
| **Supabase** | 17 | 12 | 9 | 14 | 10 | 5 | 5 | **72** |
| **Cloudflare D1** | 20 | 13 | 7 | 9 | 6 | 8 | 3 | **66** |
| **Firestore Standard** | 5 | 10 | 3 | 13 | 9 | 3 | 4 | **47** |

Cell justifications, in criterion order:

- **Turso:** 24 preserves verified SQLite/FTS/JSON design, with hosted constraints untested; 16 gives the Medium bank good SQL headroom but separate objects/auth and scan limits; 12 avoids most schema transformations but async/transaction changes are substantial; 14 has a documented remote Vercel client but no plug-in use of DatabaseSync; 6 provides service-token security but user/role integration remains external/application work; 7 provides 24-hour PITR plus export, yet short retention and independent file backup remain; 3 retains a single-writer libSQL architecture and five-second transaction constraint.
- **Neon:** 17 preserves relational constraints but rewrites FTS/JSON/triggers and lock semantics; 15 current native objects/auth improve free viability, counterbalanced by 1 GB/project, 100 CU-hours and shared egress; 9 requires disciplined PostgreSQL conversion and historical text preservation; 15 offers Vercel-friendly pooled/serverless transport; 9 has managed Auth and PostgreSQL access controls but policy/app work is needed; 6 has six-hour recovery and one manual snapshot with no free scheduled backups; 5 offers a strong general PostgreSQL expansion path.
- **Supabase:** 17 and 9 share the PostgreSQL migration requirements; 12 reflects the 500 MB/1 GB allowances and inactivity pause against Medium; 14 has a documented transaction pooler but needs the current APIs adapted; 10 reflects integrated Auth/RLS/private-object policy tooling, not an assertion that it is configured; 5 reflects manual Free export requirements and paid managed backup/PITR entitlements; 5 reflects PostgreSQL ecosystem and integrated platform growth.
- **D1:** 20 preserves many SQLite SQL/FTS/JSON features but not the callback transaction model; 13 gives good scan/file ecosystem allowances but 500 MB/database and daily/Worker caps; 7 reflects redesign risk for conditional transactions and imports; 9 reflects a natural Worker binding rather than a native Vercel binding, with secure REST/Worker integration adding a boundary; 6 has scoped service credentials but no included application login/roles; 8 rewards seven-day recovery and export, with FTS export/restore checks still needed; 3 reflects per-database execution and capacity constraints.
- **Firestore:** 5 reflects absent relational SQL/FK/FTS5 compatibility; 10 allows modest document use but files/backups and read billing reduce free suitability; 3 reflects wholesale history/consistency/query redesign; 13 reflects a serverless SDK usable from Vercel after the rewrite; 9 reflects Auth/Rules/IAM capabilities with server enforcement caveats; 3 reflects paid backup/restore/managed export requirements; 4 reflects managed scale but loses the portable relational model and requires cost management.

**Uncertainty can change the result.** Turso's 82 is conditional on libSQL engine provisioning for this account, exact constraint/trigger behavior, transaction duration and acceptable Malaysia latency. No account was created to verify them. If free libSQL provisioning or transaction-preserving implementation fails, Turso should be removed from the eligible set, making Neon first. Illustratively subtracting 4 compatibility, 4 migration and 2 Vercel points puts it at 72, below Neon; these are sensitivity penalties, not measured failures. If integrated identity and files become the dominant near-term requirement, Neon/Supabase deserve higher product-fit weight, but the requested weights were retained here.

Unverified inactivity retention, numerical Turso/Firestore service concurrency and actual query performance receive no speculative quota bonus. All rankings should be revisited against staging results before approval.

## 10. Recommendation by objective

| Objective | Choice | Reason and limitation |
|---|---|---|
| **Best overall free database** | **Turso Cloud/libSQL** | Closest fit to actual schema/search/history; 5 GB SQL capacity; requires bounded async transactions, separate identity policy and durable file service |
| **Best alternative** | **Neon PostgreSQL** | Current integrated auth/objects and regional/serverless fit; greater migration work and compute/egress caps |
| **Minimum migration effort** | **Turso/libSQL** | Preserves most SQL and IDs; still MEDIUM overall effort, not a drop-in URL |
| **Long-term expansion** | **Neon PostgreSQL** | Portable relational core, many isolated projects and Singapore plus auth/objects; costs should be expected at sustained growth |

Supabase is a sound engineering alternative when mature integrated Auth/Storage/RLS and a paid production tier are acceptable. It loses this RM0-focused ranking because this bank is SQLite-specific and the baseline Medium footprint outgrows both of its free storage buckets. D1's seven-day recovery and Cloudflare files are attractive, but its batch transaction interface and Worker boundary complicate this code. Firestore is least suitable because it would replace the application's relational integrity/search/history design rather than host it.

The provider with the largest aggregate free allowance is not necessarily the best engineering choice. Neon currently advertises more aggregate PostgreSQL capacity across projects than Turso's SQL total, but one project remains capped at 1 GB. D1's 5 GB account total is ten separate 500 MB databases, not one 5 GB bank. Turso's SQL capacity cannot be used as a free file bucket without consuming SQL quota. Artificially sharding one question bank across free projects/databases to collect allowances would complicate transactions, curriculum relationships and restore consistency.

For this checkout, preserve one authoritative relational bank and keep file objects separate. Start with remote libSQL plus a protected object adapter such as R2, retain server-side validation/review, and introduce verified teacher/admin/student identity. This proposes future work only. If the libSQL gates fail, or near-term integrated accounts/files outweigh migration effort, use Neon and perform the full PostgreSQL translation explicitly.

## 11. Safe future migration plan — approval required before execution

**Nothing in this section was executed. Migration, cloud setup and application changes must wait for explicit user approval.** The stages below distinguish local preparation from cloud/production operations.

### Local preparation and verification

1. **Locate the authoritative dataset.** Confirm the real running `BANK_DATA_DIR`, other machines/files/backups and any remote bank. Reconcile why the supplied local file is empty and at migration 001. Freeze assumptions until the dataset owner confirms the source of truth.
2. **Create coherent backups after approval.** Quiesce writers or use SQLite's supported backup operation. Include every current/historical upload, WAL-aware database backup, schema/migration state and file/hash manifest. Keep an untouched version-001 backup; never rely on copying only `bank.sqlite` while WAL contains changes.
3. **Prove recoverability locally.** Restore into a new isolated directory, run integrity/FK checks and inventory hashes, and verify representative questions, LaTeX, solutions/steps/hints, nested parts, candidates, historical classifications and binaries. Empty local data is insufficient for representative migration validation; use the confirmed source dataset or explicitly labelled test cases in an isolated environment.
4. **Reconcile migration state on a restored copy.** Review migration 002's reconstruction semantics. Apply it only to an authorized isolated copy first, compare old record/ID/snapshot hashes, verify reconstruction counts and provenance. Preserve both pre-002 and post-002 baselines. Never silently start the existing app on the sole source database during preparation.
5. **Prepare application changes in an isolated branch/workspace.** Introduce the remote async driver and transaction-scoped access; remove remote journal/busy PRAGMAs; preserve constraints/triggers and optimistic checks. Keep one schema representation/compatible local test path to avoid development/production drift. Precompute/batch expensive work while preserving atomic semantics.
6. **Prove exact libSQL compatibility.** On an authorized isolated target/test dataset, exercise FTS unicode/prefix behavior, JSON guards/extraction, invalid FKs, child-before-parent deferred inserts, failed-write rollback, immutability/move/delete guards, one active curriculum and stale concurrent edits. Benchmark worst-case imports and refreshSearch against the five-second transaction limit. Stop and select Neon if safe bounded libSQL operations cannot meet requirements; do not remove integrity guarantees to make tests pass.

### Cloud staging and production configuration

7. **Prepare hosted staging after approval.** Verify Free entitlement, libSQL engine selection, location/latency, quotas, disabled paid database overages and recovery/export support. Create objects/identity components only with authorization. For R2, explicitly accept the billing-enabled overage model and configure application upload/storage limits; database Free alone cannot cap the file bill.
8. **Reuse/translate schema intentionally.** Preserve text IDs, compound keys and version numbers. For libSQL, retain compatible SQL but test migration scripts under the remote transport; separate provisioning from request startup. For a Neon fallback, translate FTS/JSON/date functions/triggers/binds and add proper transaction locking/isolation without converting seed IDs to UUIDs.
9. **Transfer from a consistent snapshot.** Load in FK/deferred-safe order using an explicit migration process, preserving all IDs/links/current history/candidates/metadata. Do not invoke ordinary create/import APIs that regenerate IDs. Record baseline counts and per-table hashes before transfer; treat search indexes as derived objects that can be rebuilt and checked separately.
10. **Transfer/verify binaries and historical URLs.** Copy approved-source files to immutable keys; compare SHA-256 and MIME/size manifests. Maintain a protected resolver for old `/uploads/...` URLs referenced by snapshots and revision PDFs. Verify historical/removed-link files remain accessible to authorized users. Do not rewrite immutable histories merely to change hostnames.
11. **Configure server-side credentials and identity.** Add backend-only Vercel database/object settings; segregate staging/production. Verify JWT/session identity and roles on every teacher write/read/review/import route; derive reviewer/author from identity. Restrict teacher assets, disable uncontrolled direct DB access and use least-privilege credentials. Check secrets are absent from browser/build output and logs.
12. **Expose and test Vercel production APIs.** Add an appropriate entrypoint/handlers and production routes; verify `/api/*` returns intended JSON, not SPA/plain-text fallback. Keep database/object calls server-side; configure transport/pools. Use authorized direct-to-object upload for larger files. An external backend is optional for the selected remote database path, not automatically necessary.

### Acceptance, rollback and controlled cutover

13. **Validate record equivalence.** Compare every ordinary table's counts and stable IDs, normalized row hashes and raw snapshot hashes; separately compare semantic JSON if storage serialization differs. Verify active_version/base_version links, classification reconstruction labels, event metadata, uniqueness/FKs and binary manifests. New additive curriculum rows/search internals must be accounted for explicitly, not hidden in a blanket hash mismatch exception.
14. **Test representative UI and concurrency.** Browse/search, create/edit/review/reject, JSON export/import, curriculum activation/retirement and revision history; inspect diagrams, master/answer PDFs, marking schemes and hints. Exercise invalid inputs, two simultaneous editors, a stale curriculum preview, student privacy and denied unauthorized calls. Include oldest/latest history and retired curricula.
15. **Exercise backup, restore and rollback.** Export the hosted database and files, restore into an isolated target and repeat checks. Test provider PITR and independent restore; 24-hour database PITR does not restore deleted file objects. Verify how writes made after cutover would be preserved if reverting; reconnecting an old source backup alone would lose those new writes.
16. **Controlled production cutover only after separate approval.** Freeze source writes, take final coherent backup/hash manifest, transfer final delta or repeat consistent load, validate, then switch the authorized API/database settings. Allow one writer authority, monitor errors/quotas/latency and confirm normal access. Keep the original database/backups unchanged through the acceptance period and rehearse a rollback that preserves post-cutover writes.

## 12. Unresolved issues and release gates

1. **Authoritative data location:** the accessible bank contains no authored questions/assets and lacks migration 002. Historical claims of preserved data cannot be independently confirmed against an unidentified source bank.
2. **Deployment configuration:** public API failure is verified; exact Vercel project settings/build artifacts/deployed commit and any separate backend are unavailable.
3. **Security:** no authenticated roles, verified reviewer identity or private file access exists in this checkout. No provider choice fixes this automatically.
4. **Transaction scale:** libSQL's five-second transaction limit vs curriculum imports/search refresh requires staging proof. D1 conditional transactions also need redesign proof; PostgreSQL needs locking/isolation semantics beyond plain BEGIN.
5. **Storage/workload averages:** empty source prevents empirical question/file averages and query-performance estimates. Capacity tables are explicit models, not a claim about existing authored content.
6. **Provider account availability:** Free/libSQL provisioning, exact Turso primary location, idle retention policies and unlisted concurrency limits were not account-tested. Neon Singapore is documented; Turso Singapore was not verified.
7. **Whole-stack RM0:** frontend/API allowance and usage eligibility, file retention/backups, R2 overages, auth email delivery and future generator compute/API costs remain separate cost factors.
8. **Restore completeness:** local file hashes and integrity passed, but no backup restore was authorized. Recovery quality is documented capability, not an executed restore result.

### Final console summary

```text
MATRICULATION PHYSICS QUESTION BANK — FREE DATABASE AUDIT

CURRENT DATABASE ENGINE: SQLite (Node built-in node:sqlite DatabaseSync; raw SQL)
CURRENT DATABASE SIZE: 249,856 bytes logical (244 KiB); 296,456 bytes main/WAL/SHM footprint
TOTAL QUESTION RECORDS: 0 in inspected local bank; other source datasets unverified
TOTAL REVISION RECORDS: 0 question_versions + 0 revision_candidates; curriculum tables absent
TOTAL IMAGE/FILE STORAGE: 0 local uploaded files / 0 bytes; remote files unmeasured

CURRENT VERCEL API STATUS: frontend 200; taxonomy/questions/curriculum APIs 404
CURRENT AUTHENTICATION STATUS: no server-enforced authentication/roles in checkout
CURRENT DATABASE PERSISTENCE RISK: HIGH for cloud use; local disk, ignored data, WAL-dependent state

BEST FREE DATABASE: Turso Cloud using libSQL, subject to transaction/compatibility gates
SECOND BEST DATABASE: Neon PostgreSQL
EASIEST MIGRATION OPTION: Turso/libSQL

RECOMMENDED PROVIDER FREE STORAGE: 5 GB SQL total; files separate (R2 allowance 10 GB-month)
ESTIMATED MIGRATION COMPLEXITY: MEDIUM overall; async/API/auth/file changes required
VERCEL COMPATIBILITY: supported remote client; current APIs/storage must be adapted
EXPECTED MONTHLY COST: RM0 plausible for Small and conditional Medium; Large baseline is not free

DATA SAFETY: PASS (audit preservation; not production security/readiness)
DATABASE MODIFICATIONS: NONE
APPLICATION CODE MODIFICATIONS: NONE
MIGRATION EXECUTED: NO
DEPLOYMENT EXECUTED: NO
COMMIT/PUSH EXECUTED: NO

FINAL RECOMMENDATION:
Prefer Turso/libSQL for this SQLite-specific relational, FTS5, JSON and immutable-history design.
Neon is the strongest alternative and expansion choice with current integrated auth/objects.
Supabase requires the same PostgreSQL translation and has less free database/file headroom.
D1 adds conditional-transaction and Worker-boundary changes; Firestore needs a model rewrite.
Confirm the real source dataset, exact libSQL compatibility and transaction limits before approval.
Stop after this audit; no migration or deployment has begun.
```
