"""Isolated exporter regression tests; never access source backups or Turso."""
import importlib.util
import pathlib
import sqlite3
import sys
import unittest

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location(
    'migration', pathlib.Path(__file__).with_name('migrate-sqlite-to-turso.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class LogicalExportTests(unittest.TestCase):
    def fixture(self):
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.executescript('''
            CREATE TABLE documents(id INTEGER PRIMARY KEY AUTOINCREMENT,
                text_value TEXT, blob_value BLOB, real_value REAL,
                generated_size INTEGER GENERATED ALWAYS AS (length(blob_value)) STORED);
            CREATE TABLE links(a TEXT,b TEXT,PRIMARY KEY(a,b)) WITHOUT ROWID;
            CREATE TABLE question_search_notes(id TEXT PRIMARY KEY,note TEXT);
            CREATE VIRTUAL TABLE question_search USING fts5(question_id UNINDEXED,search_text,tokenize='unicode61');
            CREATE INDEX document_text ON documents(text_value) WHERE text_value IS NOT NULL;
            CREATE VIEW document_names AS SELECT id,text_value FROM documents;
            CREATE TRIGGER immutable_doc BEFORE UPDATE ON documents
                BEGIN SELECT RAISE(ABORT,'immutable'); END;
        ''')
        db.execute('INSERT INTO documents(id,text_value,blob_value,real_value) VALUES(?,?,?,?)',
                   (7, "Unicode Ω café\nquotes ' and NUL\0end", b'\0\xff\x80', 1.25))
        db.execute('INSERT INTO documents(id) VALUES(99)')
        db.execute('DELETE FROM documents WHERE id=99')
        db.execute('INSERT INTO links VALUES(?,?)', ('α', 'β'))
        db.execute('INSERT INTO question_search_notes VALUES(?,?)', ('id', 'ordinary table'))
        db.execute('INSERT INTO question_search(rowid,question_id,search_text) VALUES(?,?,?)',
                   (42, 'existing-id', 'momentum collision café'))
        db.execute('INSERT INTO question_search(rowid,question_id,search_text) VALUES(?,?,?)',
                   (100, 'existing-id', 'momentum duplicate logical ID'))
        db.commit()
        return db

    def test_full_typed_data_fts_rowids_generated_columns_and_constraints(self):
        db = self.fixture()
        source = migration.inspect_source(db)
        sql = migration.export_sql(migration.migration_statements(source))
        migration.verify_local_replay(source, sql)
        replay = sqlite3.connect(':memory:')
        self.addCleanup(replay.close)
        replay.executescript(sql)
        self.assertEqual(replay.execute('SELECT rowid FROM question_search WHERE question_search MATCH ? ORDER BY rowid',
                                        ('momentum',)).fetchall(), [(42,), (100,)])
        self.assertEqual(replay.execute('SELECT seq FROM sqlite_sequence WHERE name=?',
                                        ('documents',)).fetchone(), (99,))
        self.assertEqual(replay.execute('SELECT generated_size FROM documents').fetchone(), (3,))
        with self.assertRaisesRegex(sqlite3.IntegrityError, 'immutable'):
            replay.execute('UPDATE documents SET text_value=? WHERE id=7', ('changed',))

    def test_only_semantically_identified_shadow_tables_are_excluded(self):
        source = migration.inspect_source(self.fixture())
        sql = migration.export_sql(migration.migration_statements(source))
        self.assertIn('question_search_notes', source['normal_tables'])
        self.assertNotIn('question_search_notes', source['shadow_tables'])
        self.assertEqual(len(source['shadow_tables']), 5)
        for name in source['shadow_tables']:
            self.assertNotIn('CREATE TABLE ' + migration.quote(name), sql)
            self.assertNotIn('INSERT INTO ' + migration.quote(name), sql)
        self.assertNotIn('writable_schema', sql)
        self.assertNotIn('INSERT INTO sqlite_schema', sql)
        self.assertNotIn('INSERT INTO sqlite_master', sql)

    def test_external_content_fts_is_rejected_before_export(self):
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.executescript("CREATE TABLE docs(text); CREATE VIRTUAL TABLE question_search USING fts5(text,content='docs');")
        with self.assertRaisesRegex(migration.MigrationError, 'External-content/contentless'):
            migration.inspect_source(db)

    def test_hashes_preserve_types_duplicates_and_exact_text(self):
        self.assertNotEqual(migration.rows_hash([[1]]), migration.rows_hash([['1']]))
        self.assertNotEqual(migration.rows_hash([[1]]), migration.rows_hash([[1], [1]]))
        self.assertNotEqual(migration.rows_hash([['a\0b']]), migration.rows_hash([['a']]))
        self.assertEqual(migration.rows_hash([[1], [2]]), migration.rows_hash([[2], [1]]))
        with self.assertRaises(migration.MigrationError):
            migration.literal(float('inf'))


if __name__ == '__main__':
    unittest.main()
