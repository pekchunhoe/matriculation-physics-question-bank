# MATRICULATION PHYSICS QUESTION BANK
## SQLITE → TURSO DATABASE MIGRATION

Date: 2026-10-08T19:42:30.265265+08:00

```text
SOURCE
Checkpointed source located: PASS
Source integrity previously verified: PASS (user-provided; read-only integrity recheck also passed)
Source modified: NO

TURSO
CLI authentication available: PASS
Target database found: PASS
Existing cloud state audited: PASS
Unexpected production data found: NO

SCHEMA
Normal tables migrated: PASS
Indexes migrated: PASS
Triggers migrated: PASS
Views migrated: N/A
Foreign-key relationships preserved: PASS

FTS5
question_search detected: PASS
SQLite FTS shadow tables excluded: PASS
writable_schema dependency removed: PASS
question_search recreated cleanly: PASS
Logical FTS rows migrated: PASS
FTS query verified: PASS

DATA VERIFICATION
All application table counts match: PASS
Stable IDs preserved: PASS
Question content verified: PASS (0 rows in this snapshot)
Curriculum data verified: PASS (actual source taxonomy; see schema-version limit below)
Question version history verified: PASS (0 rows in this snapshot)
Search row counts match: PASS

SOURCE BACKUPS
Original SQLite retained: PASS
Original SQL dump retained: PASS
Uploads untouched: PASS

APPLICATION CODE
Runtime switched to Turso: NO
Vercel changed: NO
Uploads migrated: NO

SECRETS
Secrets printed: NO
Secrets committed: NO

GIT
Commit performed: NO
Push performed: NO

DATABASE RESULT
Migration successful: YES
```

Source: `/mnt/d/Physics Apps/Database Backups/QuestionBank-checkpointed-for-Turso/matriculation-physics-question-bank.sqlite`
Target: `matriculation-physics-question-bank`
Source SHA-256: `d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`
Generated artifacts: `/mnt/d/Physics Apps/Matriculation Physics Question Bank/data/turso-migration/applied-20261008`

| Table | Local | Turso | Match |
|---|---:|---:|---|
| assets | 0 | 0 | PASS |
| chapters | 0 | 0 | PASS |
| courses | 1 | 1 | PASS |
| difficulty_levels | 3 | 3 | PASS |
| hints | 0 | 0 | PASS |
| question_parts | 0 | 0 | PASS |
| question_tags | 0 | 0 | PASS |
| question_versions | 0 | 0 | PASS |
| questions | 0 | 0 | PASS |
| revision_candidates | 0 | 0 | PASS |
| schema_migrations | 1 | 1 | PASS |
| semesters | 2 | 2 | PASS |
| solution_steps | 0 | 0 | PASS |
| solutions | 0 | 0 | PASS |
| subtopics | 0 | 0 | PASS |
| tags | 0 | 0 | PASS |
| topics | 0 | 0 | PASS |
| question_search | 0 | 0 | PASS |

Preserved 17 normal tables, 10 explicit indexes, 25 implicit constraint indexes, 2 triggers, 0 views and 1 logical FTS5 table(s).

Excluded shadow tables: `question_search_config`, `question_search_content`, `question_search_data`, `question_search_docsize`, `question_search_idx`.

Search maintenance remains in `Bank.indexQuestion` / `refreshSearch` in `server/database.ts`. There are no source search-maintenance triggers; none were invented. The two original immutable-history triggers were restored after loading data.

Every table hash covers every column, SQLite storage types, stable IDs, timestamps, relationships and rowids. Hashes retain duplicate rows. Full SQL and per-table hashes are in `verification.json`. No FTS implementation bytes are compared.

### Verification coverage and schema-version limit

The immutable source contains **zero questions, question parts, solutions, hints, revisions and FTS search rows**. Empty-table hashes and counts match; they cannot demonstrate preservation of populated Physics content or positive production searches. No sample production content was added.

The source has **migration 001 only**. `curriculum_versions`, `curriculum_events`, `question_version_classifications`, and migration 002 columns/triggers are absent from the source and therefore were not added. The repository currently contains migration 002; its curriculum-aware question listing requires that migration. This report verifies the supplied snapshot, not readiness of the current runtime. Resolve that schema-version gap in the separately authorized runtime follow-up.

| Query | Result rows | Match |
|---|---:|---|
| semester listing | 2 | PASS |
| chapter listing | 0 | PASS |
| topic listing | 0 | PASS |
| difficulty filtering | 0 | PASS |
| question lookup | 0 | PASS |
| revision/history lookup | 0 | PASS |
| answer scheme lookup | 0 | PASS |
| hint lookup | 0 | PASS |
| question taxonomy join | 0 | PASS |
| FTS __migration_empty_index_probe__ | 0 | PASS |

FTS5 capability: a uniquely named scratch FTS5 table inserted and matched `physics momentum collision`, then was dropped and the entire transaction rolled back. No scratch row committed. A separate forced duplicate-key error confirmed subsequent batch steps were skipped and scratch DDL rolled back.

Transaction safety: one `BEGIN IMMEDIATE` covered table creation, logical inserts, indexes, views and triggers. Foreign keys were enabled and deferred until commit. Complete schema/hash/query/FK verification ran before COMMIT; a second verification ran against the committed cloud database. Any pre-commit failure rolls back. Target emptiness is checked again under the write transaction; no cleanup or destruction is implemented. The tool refuses any nonempty target.

Cloud integrity result: `[['ok']]`.

Source/database backups, runtime SQLite and upload fingerprints were compared before and after the run (including file size and last-write time). Evidence is in `safety.json`. No application migrations or runtime imports were executed.

Tooling uses only Python standard library and the already authenticated WSL Turso CLI. A one-day database token is captured in memory and never logged, saved, placed in environment variables or passed as a command-line argument.

Protocol reference: [official libSQL HTTP v2 specification](https://github.com/tursodatabase/libsql/blob/main/docs/HTTP_V2_SPEC.md) and [conditional batch specification](https://github.com/tursodatabase/libsql/blob/main/docs/HRANA_3_SPEC.md).

Recommended next step: migrate the Express runtime from local SQLite to Turso/libSQL, resolve migration 002, configure Vercel environment variables, deploy a preview, and verify `/api/health` and persistent cloud access. Upload storage remains separate.
