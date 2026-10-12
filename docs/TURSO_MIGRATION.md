> Historical baseline for the earlier structured-question release. Current image architecture and release requirements are documented in [architecture.md](architecture.md) and [the refactor report](../IMAGE_BANK_REFACTOR_REPORT.md).

# Logical SQLite → Turso migration tooling

`scripts/migrate-sqlite-to-turso.py` runs under WSL using Python's standard library
and `/home/pekchunhoe/.turso/turso`. No dependencies or runtime changes are needed.
It uses the existing authenticated CLI to capture a one-day database token in
process memory. Credentials are never printed or saved in migration artifacts.

Use explicit source and target paths. Dry-run is the default:

```bash
python3 scripts/migrate-sqlite-to-turso.py \
  --source '/mnt/d/Physics Apps/Database Backups/QuestionBank-checkpointed-for-Turso/matriculation-physics-question-bank.sqlite' \
  --target matriculation-physics-question-bank \
  --output-dir '/mnt/d/Physics Apps/Matriculation Physics Question Bank/data/turso-migration/new-dry-run' \
  --dry-run
```

From PowerShell, invoke `wsl python3` with the script's absolute `/mnt/d/...` path
and the same arguments. The artifact directory must be new and outside the
original backup folder. Artifacts live under ignored `data/` because exports can
contain authored material. Existing artifacts and the original dump are never
overwritten. The generated SQL is `turso-clean-import.sql`.

To execute an audited migration, replace `--dry-run` with `--apply`, select a new
artifact directory, and pass `--report '/mnt/d/Physics Apps/Matriculation Physics Question Bank/TURSO_MIGRATION_REPORT.md'`.
The tool refuses any nonempty target; it never cleans or destroys a database.
To compare an already migrated target without changing it, use `--verify-only`
with a new artifact directory. Omit `--report` when preserving the original
completed migration report. Dry-run and verify-only do not run scratch probes.

The checkpointed source is opened with `mode=ro&immutable=1` and `query_only=ON`.
A nonempty source WAL/journal causes the tool to stop. Do not use this tool on a
live source: immutable mode deliberately ignores SQLite journal recovery.

Schema inspection uses `sqlite_master`, `PRAGMA table_list` and `table_xinfo`.
Objects classified as `shadow` are excluded semantically, including their
associated indexes/triggers. A similarly named ordinary application table is
retained. All virtual tables must be ordinary internal-content FTS5; unsupported
virtual tables, external-content/contentless FTS and unaccounted shadow objects
cause a stop for a custom migration plan.

The export creates exact application tables and FTS definitions, inserts logical
rows with their rowids, then restores indexes, views and triggers. Generated
columns are recomputed and included in verification. PRIMARY KEY/UNIQUE indexes
are recreated by their original constraints. AUTOINCREMENT counters are retained.
The export does not write `sqlite_master`/`sqlite_schema`, use `writable_schema`,
or manually create/write FTS shadow tables. It is replayed in memory and compared
with the complete source schema and typed row hashes before any cloud writes.

The cloud schema is audited first. Scratch transactions verify FTS5 MATCH and
forced-failure rollback behavior, including skipped batch statements. Scratch
objects never commit. Import uses one stateful HTTP v2 stream and one transaction,
with foreign keys enabled and deferred. Every batch step depends on its previous
step succeeding. All tables, indexes, triggers, views, typed full-row hashes,
application queries, FTS results and foreign keys are checked before COMMIT and
again afterward. Writes are never automatically retried after a network failure.
Connection closure rolls back an open transaction. A failure after COMMIT cannot
be rolled back: the report records the committed state and requires re-audit.

The source backup folder (including the original dump), local runtime SQLite and
uploads are fingerprinted before and after execution. Nothing imports the
application's `Bank` class or runs its startup migrations. Migration 002 is not
added to a migration 001 snapshot. Database header settings such as journal mode
are not transported; application schema-migration records are preserved exactly.

Evidence files include source/cloud audits, an internal pre-execution migration
plan, SQL export, precommit/final verification, protected-file fingerprints and
run status. They contain no credentials. Table hashes distinguish SQLite storage
types and retain duplicates. Empty-table/hash equality does not prove populated
content or positive searches; the report explicitly describes such limits.

Run isolated exporter checks with:

```bash
python3 scripts/test-migrate-sqlite-to-turso.py
```

These use only in-memory synthetic databases and never access production data
or Turso. They cover Unicode/NUL text, blobs, generated columns, WITHOUT ROWID,
AUTOINCREMENT high-water marks, FTS rowids/search, normal tables with FTS-like
names, immutable triggers and conservative rejection of external-content FTS.

Protocol references: [official HTTP v2 specification](https://github.com/tursodatabase/libsql/blob/main/docs/HTTP_V2_SPEC.md)
and [conditional batches and typed values](https://github.com/tursodatabase/libsql/blob/main/docs/HRANA_3_SPEC.md).
