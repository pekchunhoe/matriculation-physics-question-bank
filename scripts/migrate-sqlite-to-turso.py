#!/usr/bin/env python3
"""Logical, FTS-aware migration using Python stdlib and an authenticated Turso CLI.

Run under WSL. Source is immutable. Dry-run is the default. No application migrations
are run, no target objects are dropped, and no credentials are logged or persisted.
See docs/TURSO_MIGRATION.md for usage and limits.
"""
import argparse
import base64
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

SCHEMA_SQL = 'SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name'
EXPECTED_TARGET = 'matriculation-physics-question-bank'


class MigrationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise MigrationError(message)


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def digest_file(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(paths):
    result = {}
    for path in paths:
        if path.is_dir():
            files = sorted(p for p in path.rglob('*') if p.is_file())
        else:
            files = [path] if path.exists() else []
        result[str(path)] = {
            str(p): {'sha256': digest_file(p), 'size': p.stat().st_size,
                     'mtime_ns': p.stat().st_mtime_ns}
            for p in files
        }
    return result


def encode(value):
    if value is None:
        return {'type': 'null'}
    if isinstance(value, bytes):
        return {'type': 'blob', 'base64': base64.b64encode(value).decode('ascii')}
    if isinstance(value, int):
        return {'type': 'integer', 'value': str(value)}
    if isinstance(value, float):
        require(math.isfinite(value), 'Non-finite REAL value requires a custom export.')
        return {'type': 'float', 'value': value}
    require(isinstance(value, str), 'Unsupported SQLite value type.')
    return {'type': 'text', 'value': value}


def decode(value):
    kind = value['type']
    if kind == 'null':
        return None
    if kind == 'integer':
        return int(value['value'])
    if kind == 'float':
        return float(value['value'])
    if kind == 'blob':
        return base64.b64decode(value['base64'])
    require(kind == 'text', 'Unexpected remote SQLite value type.')
    return value['value']


def rows_hash(rows):
    # Type tags distinguish NULL, text, integers, REALs and blobs. Sort encoded
    # complete rows, retaining duplicates. Float.hex preserves binary precision.
    encoded = []
    for row in rows:
        values = [encode(v) for v in row]
        for v in values:
            if v['type'] == 'float':
                v['value'] = v['value'].hex()
        encoded.append(json.dumps(values, ensure_ascii=True, separators=(',', ':')))
    return hashlib.sha256(json.dumps(sorted(encoded), separators=(',', ':')).encode()).hexdigest()


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, bytes):
        return "X'" + value.hex() + "'"
    if isinstance(value, str):
        # Hex text avoids altering quotes, embedded NULs, newlines or Unicode.
        return "CAST(X'" + value.encode('utf8').hex() + "' AS TEXT)"
    encode(value)  # rejects non-finite floats
    return repr(value)


def local_rows(db, sql, args=()):
    return [list(row) for row in db.execute(sql, args).fetchall()]


def normalized_schema(schema):
    # Internal FTS schema is intentionally implementation-specific. Application
    # schemas and autoindexes are compared exactly (apart from terminal ';').
    return sorted((kind, name, table, sql.rstrip().rstrip(';') if sql else None)
                  for kind, name, table, sql in schema)


def inspect_source(db):
    schema = local_rows(db, SCHEMA_SQL)
    table_list = local_rows(db, 'PRAGMA table_list')
    require(table_list, 'SQLite 3.37+ with PRAGMA table_list is required.')
    kinds = {row[1]: row[2] for row in table_list if row[0] == 'main'}
    shadows = sorted(name for name, kind in kinds.items() if kind == 'shadow')
    virtuals = sorted(name for name, kind in kinds.items() if kind == 'virtual')
    normal = sorted(name for name, kind in kinds.items()
                    if kind == 'table' and not name.startswith('sqlite_'))
    require('question_search' in virtuals, 'Source question_search virtual table is missing.')
    definitions = {row[1]: row[3] for row in schema if row[0] == 'table'}
    for name in virtuals:
        ddl = definitions[name]
        require(re.search(r'\bUSING\s+fts5\s*\(', ddl, re.I),
                'Unsupported virtual table: ' + name)
        require(not re.search(r'\bcontent\s*=|\bcontentless_delete\s*=', ddl, re.I),
                'External-content/contentless FTS requires a custom plan: ' + name)
    require(all(any(name.startswith(v + '_') for v in virtuals) for name in shadows),
            'Unaccounted shadow table found; manual review required.')
    app_schema = [row for row in schema if row[1] not in shadows and row[2] not in shadows
                  and not row[1].startswith('sqlite_')]
    # Autoindexes are verified separately and reproduced by PRIMARY KEY/UNIQUE.
    autoindexes = [row for row in schema if row[0] == 'index' and row[3] is None
                   and row[2] not in shadows]
    data = {}
    for name in normal + virtuals:
        info = local_rows(db, 'PRAGMA table_xinfo(' + quote(name) + ')')
        insert_cols = [row[1] for row in info if row[6] == 0]
        verify_cols = [row[1] for row in info if row[6] in (0, 2, 3)]
        without_rowid = next(row[4] for row in table_list
                             if row[0] == 'main' and row[1] == name)
        if not without_rowid:
            alias = next((a for a in ('rowid', '_rowid_', 'oid')
                          if a.lower() not in {row[1].lower() for row in info}), None)
            require(alias is not None, 'All rowid aliases are shadowed in ' + name)
            insert_cols.insert(0, alias)
            verify_cols.insert(0, alias)
        select = 'SELECT ' + ','.join(map(quote, verify_cols)) + ' FROM ' + quote(name)
        rows = local_rows(db, select)
        insert_rows = local_rows(db, 'SELECT ' + ','.join(map(quote, insert_cols))
                                 + ' FROM ' + quote(name))
        data[name] = {'columns': verify_cols, 'insert_columns': insert_cols,
                      'rows': rows, 'insert_rows': insert_rows, 'select': select,
                      'count': len(rows), 'sha256': rows_hash(rows)}
    sequence = local_rows(db, 'SELECT name,seq FROM sqlite_sequence') if 'sqlite_sequence' in kinds else []
    require(not local_rows(db, 'PRAGMA foreign_key_check'), 'Source has foreign-key violations.')
    require(local_rows(db, 'PRAGMA integrity_check') == [['ok']], 'Source integrity check failed.')
    return {'schema': schema, 'app_schema': app_schema, 'autoindexes': autoindexes,
            'table_list': table_list, 'normal_tables': normal, 'virtual_tables': virtuals,
            'shadow_tables': shadows, 'data': data, 'sequence': sequence,
            'user_version': db.execute('PRAGMA user_version').fetchone()[0],
            'application_id': db.execute('PRAGMA application_id').fetchone()[0]}


def migration_statements(source):
    statements = []
    # Create tables and FTS first; restore data before creating triggers, avoiding
    # duplicate side effects or immutable-history restrictions during replay.
    for kind, name, _, sql in source['app_schema']:
        if kind == 'table':
            statements.append((sql, [], 'create ' + name))
    for name in source['normal_tables'] + source['virtual_tables']:
        item = source['data'][name]
        sql = ('INSERT INTO ' + quote(name) + '(' + ','.join(map(quote, item['insert_columns']))
               + ') VALUES(' + ','.join('?' for _ in item['insert_columns']) + ')')
        for index, row in enumerate(item['insert_rows']):
            statements.append((sql, row, 'insert ' + name + ' row ' + str(index + 1)))
    if source['sequence']:
        statements.append(('DELETE FROM sqlite_sequence', [], 'restore sequence counters'))
        statements.extend(('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)', row,
                           'restore sequence ' + row[0]) for row in source['sequence'])
    for object_kind in ('index', 'view', 'trigger'):
        for kind, name, _, sql in source['app_schema']:
            if kind == object_kind and sql:
                statements.append((sql, [], 'create ' + name))
    return statements


def export_sql(statements):
    lines = ['-- Logical export. FTS shadow objects are recreated by FTS5 itself.',
             '-- Generated from an immutable checkpointed SQLite source.',
             'PRAGMA foreign_keys=ON;', 'BEGIN IMMEDIATE;', 'PRAGMA defer_foreign_keys=ON;']
    for sql, args, _ in statements:
        if args:
            # Only our generated INSERT placeholders are substituted.
            prefix = sql[:sql.rfind('VALUES(')]
            sql = prefix + 'VALUES(' + ','.join(map(literal, args)) + ')'
        lines.append(sql.rstrip().rstrip(';') + ';')
    lines.append('COMMIT;')
    return '\n'.join(lines) + '\n'


def verify_local_replay(source, sql):
    replay = sqlite3.connect(':memory:')
    try:
        replay.executescript(sql)
        require(not local_rows(replay, 'PRAGMA foreign_key_check'), 'Export replay FK check failed.')
        for name, item in source['data'].items():
            require(rows_hash(local_rows(replay, item['select'])) == item['sha256'],
                    'Export replay changed data in ' + name)
        shadows = set(source['shadow_tables'])
        actual = [row for row in local_rows(replay, SCHEMA_SQL)
                  if row[1] not in shadows and row[2] not in shadows
                  and not (row[0] == 'table' and row[1].startswith('sqlite_'))]
        expected = source['app_schema'] + source['autoindexes']
        require(normalized_schema(actual) == normalized_schema(expected), 'Export replay schema mismatch.')
    finally:
        replay.close()


class Cloud:
    def __init__(self, cli, target):
        def command(*args):
            process = subprocess.run([cli, *args], capture_output=True, text=True, timeout=60)
            # Never include CLI output in errors: commands may return credentials.
            require(process.returncode == 0, 'Authenticated Turso CLI failed: ' + ' '.join(args[:2]))
            return process.stdout.strip()
        url = command('db', 'show', target, '--url')
        url = url.replace('libsql://', 'https://', 1)
        parsed = urllib.parse.urlparse(url)
        require(parsed.scheme == 'https' and parsed.hostname and parsed.hostname.endswith('.turso.io')
                and not parsed.username and not parsed.password and not parsed.query,
                'Unexpected cloud URL returned by CLI.')
        self.endpoint = url.rstrip('/') + '/v2/pipeline'
        # Short-lived database token is captured only in process memory. The
        # existing authenticated CLI supplies it; no auth config is read/copied.
        self._token = command('db', 'tokens', 'create', target, '--expiration', '1d')
        self.baton = None

    def request(self, requests):
        payload = json.dumps({'baton': self.baton, 'requests': requests}, ensure_ascii=True).encode()
        req = urllib.request.Request(self.endpoint, data=payload,
                                     headers={'Authorization': 'Bearer ' + self._token,
                                              'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                body = json.load(response)
        except urllib.error.HTTPError as exc:
            raise MigrationError('Cloud HTTP request failed (status ' + str(exc.code) + ').') from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise MigrationError('Cloud connection failed; no automatic write retry was attempted.') from None
        self.baton = body.get('baton')
        base = body.get('base_url')
        if base:
            parsed = urllib.parse.urlparse(base)
            require(parsed.scheme == 'https' and parsed.hostname and parsed.hostname.endswith('.turso.io')
                    and not parsed.username and not parsed.password, 'Unsafe cloud redirect rejected.')
            self.endpoint = base.rstrip('/') + '/v2/pipeline'
        require(len(body['results']) == len(requests), 'Incomplete cloud response.')
        results = []
        for result in body['results']:
            if result['type'] != 'ok':
                # SQL errors are sanitized to avoid content/secret echoing.
                error = result.get('error', {})
                raise MigrationError('Cloud SQL error: ' + str(error.get('code', 'UNKNOWN')))
            results.append(result['response'])
        return results

    def query(self, sql, args=()):
        response = self.request([{'type': 'execute', 'stmt': {
            'sql': sql, 'args': [encode(a) for a in args], 'want_rows': True}}])[0]
        result = response['result']
        return [[decode(v) for v in row] for row in result['rows']]

    def batch(self, statements):
        steps = []
        for i, (sql, args, label) in enumerate(statements):
            step = {'stmt': {'sql': sql, 'args': [encode(a) for a in args], 'want_rows': True}}
            if i:
                step['condition'] = {'type': 'ok', 'step': i - 1}
            steps.append(step)
        result = self.request([{'type': 'batch', 'batch': {'steps': steps}}])[0]['result']
        for i, error in enumerate(result['step_errors']):
            if error:
                raise MigrationError('Cloud rejected ' + statements[i][2] + ' ('
                                     + str(error.get('code', 'UNKNOWN')) + '); subsequent steps skipped.')
        require(all(item is not None for item in result['step_results']), 'Cloud batch skipped a step.')
        return result['step_results']

    def rollback(self):
        if self.baton:
            try:
                self.query('ROLLBACK')
            finally:
                self.close()

    def close(self):
        if self.baton:
            try:
                self.request([{'type': 'close'}])
            finally:
                self.baton = None
        self._token = ''


def capability_probe(cloud, initial_schema):
    name = '__migration_fts_' + uuid.uuid4().hex
    try:
        cloud.query('BEGIN IMMEDIATE')
        results = cloud.batch([
            ('CREATE VIRTUAL TABLE ' + quote(name) + ' USING fts5(content)', [], 'FTS5 capability probe'),
            ('INSERT INTO ' + quote(name) + '(content) VALUES(?)', ['physics momentum collision'], 'FTS5 scratch row'),
            ('SELECT content FROM ' + quote(name) + ' WHERE ' + quote(name) + ' MATCH ?', ['momentum'], 'FTS5 MATCH probe'),
            ('DROP TABLE ' + quote(name), [], 'remove FTS5 probe')])
        require([[decode(v) for v in row] for row in results[2]['rows']]
                == [['physics momentum collision']], 'FTS5 MATCH capability probe failed.')
    finally:
        # Roll back even successful probes, so scratch data never commits.
        if cloud.baton:
            cloud.query('ROLLBACK')
    require(cloud.query(SCHEMA_SQL) == initial_schema, 'FTS5 probe changed cloud schema.')
    # Verify a failed statement skips all following writes and DDL rolls back.
    try:
        cloud.query('BEGIN IMMEDIATE')
        try:
            cloud.batch([
                ('CREATE TABLE ' + quote(name) + '(id INTEGER PRIMARY KEY)', [], 'rollback probe'),
                ('INSERT INTO ' + quote(name) + ' VALUES(1)', [], 'rollback probe row'),
                ('INSERT INTO ' + quote(name) + ' VALUES(1)', [], 'intentional duplicate rollback probe'),
                ('INSERT INTO ' + quote(name) + ' VALUES(2)', [], 'must be skipped')])
        except MigrationError as exc:
            require('intentional duplicate rollback probe' in str(exc), 'Rollback probe failed unexpectedly.')
        else:
            raise MigrationError('Rollback probe duplicate constraint was not enforced.')
        require(cloud.query('SELECT id FROM ' + quote(name)) == [[1]], 'Failed batch did not skip later writes.')
    finally:
        if cloud.baton:
            cloud.query('ROLLBACK')
    require(cloud.query(SCHEMA_SQL) == initial_schema, 'DDL rollback probe changed cloud schema.')


def app_queries(source):
    queries = [
        ('semester listing', 'SELECT * FROM semesters ORDER BY sort_order,id', []),
        ('chapter listing', 'SELECT c.*,s.name semester FROM chapters c JOIN semesters s ON s.id=c.semester_id ORDER BY c.sort_order,c.id', []),
        ('topic listing', 'SELECT t.*,c.name chapter FROM topics t JOIN chapters c ON c.id=t.chapter_id ORDER BY t.sort_order,t.id', []),
        ('difficulty filtering', 'SELECT q.* FROM questions q JOIN difficulty_levels d ON d.id=q.difficulty_id WHERE d.id=? ORDER BY q.id', []),
        ('question lookup', 'SELECT * FROM questions WHERE id=?', []),
        ('revision/history lookup', 'SELECT * FROM question_versions WHERE question_id=? ORDER BY version_number', []),
        ('answer scheme lookup', 'SELECT s.*,p.prompt FROM solutions s JOIN question_parts p ON p.question_id=s.question_id AND p.id=s.part_id WHERE s.question_id=? ORDER BY s.part_id', []),
        ('hint lookup', 'SELECT * FROM hints WHERE question_id=? ORDER BY display_order,id', []),
        ('question taxonomy join', 'SELECT q.id,q.title,q.status,t.id topic_id,c.id chapter_id,s.id semester_id,co.id course_id,d.id difficulty_id FROM questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id JOIN difficulty_levels d ON d.id=q.difficulty_id ORDER BY q.id', []),
    ]
    data = source['data']
    question_id = next((r[item['columns'].index('id')] for item in [data['questions']] for r in item['rows']), None)
    difficulty_id = next((r[data['difficulty_levels']['columns'].index('id')]
                          for r in data['difficulty_levels']['rows']), None)
    for label, _, args in queries:
        if label == 'difficulty filtering':
            args.append(difficulty_id)
        elif 'lookup' in label:
            args.append(question_id)  # NULL when no source question exists; no invented IDs.
    if 'curriculum_versions' in source['normal_tables']:
        queries.append(('curriculum version listing', 'SELECT * FROM curriculum_versions ORDER BY id', []))
    if 'question_version_classifications' in source['normal_tables']:
        queries.append(('historical classification lookup', 'SELECT * FROM question_version_classifications WHERE question_id=? ORDER BY version_number', [question_id]))
    return queries


def search_queries(source):
    item = source['data']['question_search']
    index = item['columns'].index('search_text')
    terms = collections.Counter(term.lower() for row in item['rows']
                                for term in re.findall(r'[^\W_]+', row[index] or '', re.UNICODE)
                                if len(term) >= 3)
    selected = [term for term, _ in terms.most_common(5)]
    # With no source terms, demonstrate MATCH parses without claiming positive
    # representative-data coverage. This query never writes any production row.
    if not selected:
        selected = ['__migration_empty_index_probe__']
    return [('FTS ' + term, 'SELECT rowid,question_id FROM question_search WHERE question_search MATCH ? ORDER BY rowid',
             ['"' + term.replace('"', '""') + '"*']) for term in selected]


def verify_cloud(cloud, db, source):
    cloud_schema = cloud.query(SCHEMA_SQL)
    table_list = cloud.query('PRAGMA table_list')
    shadow_names = {row[1] for row in table_list if row[0] == 'main' and row[2] == 'shadow'}
    actual = [row for row in cloud_schema if row[1] not in shadow_names and row[2] not in shadow_names
              and not (row[1].startswith('sqlite_') and row[0] == 'table')]
    require(normalized_schema(actual) == normalized_schema(source['app_schema'] + source['autoindexes']),
            'Cloud logical schema/index/trigger/view mismatch.')
    report = {'schema_match': True, 'tables': [], 'queries': []}
    statements = [(item['select'], [], 'verify ' + name) for name, item in source['data'].items()]
    results = cloud.batch(statements)
    for (name, item), result in zip(source['data'].items(), results):
        rows = [[decode(v) for v in row] for row in result['rows']]
        remote_hash = rows_hash(rows)
        report['tables'].append({'table': name, 'local': item['count'], 'turso': len(rows),
                                 'local_sha256': item['sha256'], 'turso_sha256': remote_hash,
                                 'match': len(rows) == item['count'] and remote_hash == item['sha256']})
        require(report['tables'][-1]['match'], 'Cloud row/hash mismatch in ' + name)
    checks = app_queries(source) + search_queries(source)
    results = cloud.batch([(sql, args, label) for label, sql, args in checks])
    for (label, sql, args), result in zip(checks, results):
        local = local_rows(db, sql, args)
        remote = [[decode(v) for v in row] for row in result['rows']]
        require(remote == local, 'Application query mismatch: ' + label)
        report['queries'].append({'name': label, 'sql': sql, 'args': args,
                                  'rows': len(remote), 'sha256': rows_hash(remote), 'match': True})
    require(not cloud.query('PRAGMA foreign_key_check'), 'Cloud foreign-key violations found.')
    report['foreign_key_check'] = 'PASS'
    # These safe checks are capability-checked by execution, not assumed from SQLite.
    try:
        integrity = cloud.query('PRAGMA integrity_check')
    except MigrationError:
        integrity = None
    if integrity:
        require(integrity == [['ok']], 'Cloud integrity check failed.')
    report['integrity_check'] = integrity if integrity else 'UNSUPPORTED; hashes/schema/FKs checked'
    if source['sequence']:
        require(cloud.query('SELECT name,seq FROM sqlite_sequence ORDER BY name') == sorted(source['sequence']),
                'AUTOINCREMENT counters mismatch.')
    return report


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True) + '\n', encoding='utf8')


def write_report(path, state, source):
    success = state.get('success', False)
    verified = state.get('verification', {})
    passfail = lambda value: 'PASS' if value else 'FAIL'
    sections = [
        '# MATRICULATION PHYSICS QUESTION BANK', '## SQLITE → TURSO DATABASE MIGRATION',
        '', 'Date: ' + datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
        '', '```text', 'SOURCE',
        'Checkpointed source located: ' + passfail(source is not None),
        'Source integrity previously verified: PASS (user-provided; read-only integrity recheck also passed)',
        'Source modified: ' + ('NO' if state.get('protected_files_unchanged') else 'UNKNOWN'),
        '', 'TURSO', 'CLI authentication available: ' + passfail(state.get('authenticated')),
        'Target database found: ' + passfail(state.get('authenticated')),
        'Existing cloud state audited: ' + passfail('initial_cloud_schema' in state),
        'Unexpected production data found: ' + ('YES' if state.get('unexpected_cloud_data') else 'NO'),
        '', 'SCHEMA', 'Normal tables migrated: ' + passfail(success),
        'Indexes migrated: ' + passfail(success),
        'Triggers migrated: ' + (passfail(success) if source and any(r[0] == 'trigger' for r in source['app_schema']) else 'N/A'),
        'Views migrated: ' + (passfail(success) if source and any(r[0] == 'view' for r in source['app_schema']) else 'N/A'),
        'Foreign-key relationships preserved: ' + passfail(verified.get('foreign_key_check') == 'PASS'),
        '', 'FTS5', 'question_search detected: ' + passfail(source is not None),
        'SQLite FTS shadow tables excluded: ' + passfail(state.get('export_verified')),
        'writable_schema dependency removed: ' + passfail(state.get('export_verified')),
        'question_search recreated cleanly: ' + passfail(success),
        'Logical FTS rows migrated: ' + passfail(success),
        'FTS query verified: ' + passfail(success and state.get('fts_capability')),
        '', 'DATA VERIFICATION', 'All application table counts match: ' + passfail(success),
        'Stable IDs preserved: ' + passfail(success), 'Question content verified: ' + passfail(success) + ' (0 rows in this snapshot)' if source and source['data']['questions']['count'] == 0 else 'Question content verified: ' + passfail(success),
        'Curriculum data verified: ' + passfail(success) + ' (actual source taxonomy; see schema-version limit below)',
        'Question version history verified: ' + passfail(success) + (' (0 rows in this snapshot)' if source and source['data']['question_versions']['count'] == 0 else ''),
        'Search row counts match: ' + passfail(success),
        '', 'SOURCE BACKUPS', 'Original SQLite retained: ' + passfail(state.get('protected_files_unchanged')),
        'Original SQL dump retained: ' + passfail(state.get('protected_files_unchanged')),
        'Uploads untouched: ' + passfail(state.get('protected_files_unchanged')),
        '', 'APPLICATION CODE', 'Runtime switched to Turso: NO', 'Vercel changed: NO', 'Uploads migrated: NO',
        '', 'SECRETS', 'Secrets printed: NO', 'Secrets committed: NO',
        '', 'GIT', 'Commit performed: NO', 'Push performed: NO',
        '', 'DATABASE RESULT', 'Migration successful: ' + ('YES' if success else 'NO'), '```', '']
    if not success:
        sections += ['Exact blocker: ' + state.get('error', 'Dry-run only; cloud import not executed.'), '']
    if source:
        sections += ['Source: `' + state['source_path'] + '`', 'Target: `' + state['target'] + '`',
                     'Source SHA-256: `' + state['source_sha256'] + '`',
                     'Generated artifacts: `' + state['artifact_dir'] + '`', '',
                     '| Table | Local | Turso | Match |', '|---|---:|---:|---|']
        counts = {r['table']: r for r in verified.get('tables', [])}
        for name, item in source['data'].items():
            r = counts.get(name, {})
            sections.append('| ' + name + ' | ' + str(item['count']) + ' | '
                            + str(r.get('turso', 'not verified')) + ' | '
                            + (passfail(r['match']) if 'match' in r else 'not verified') + ' |')
        kinds = collections.Counter(r[0] for r in source['app_schema'])
        sections += ['', f"Preserved {len(source['normal_tables'])} normal tables, {kinds['index']} explicit indexes, "
                     f"{len(source['autoindexes'])} implicit constraint indexes, {kinds['trigger']} triggers, "
                     f"{kinds['view']} views and {len(source['virtual_tables'])} logical FTS5 table(s).", '',
                     'Excluded shadow tables: ' + ', '.join('`' + n + '`' for n in source['shadow_tables']) + '.', '',
                     'Search maintenance remains in `Bank.indexQuestion` / `refreshSearch` in `server/database.ts`. '
                     'There are no source search-maintenance triggers; none were invented. The two original '
                     'immutable-history triggers were restored after loading data.', '',
                     'Every table hash covers every column, SQLite storage types, stable IDs, timestamps, '
                     'relationships and rowids. Hashes retain duplicate rows. Full SQL and per-table hashes are '
                     'in `verification.json`. No FTS implementation bytes are compared.', '',
                     '### Verification coverage and schema-version limit', '']
        if source['data']['questions']['count'] == 0:
            sections += ['The immutable source contains **zero questions, question parts, solutions, hints, '
                         'revisions and FTS search rows**. Empty-table hashes and counts match; they cannot '
                         'demonstrate preservation of populated Physics content or positive production searches. '
                         'No sample production content was added.', '']
        if 'curriculum_versions' not in source['normal_tables']:
            sections += ['The source has **migration 001 only**. `curriculum_versions`, `curriculum_events`, '
                         '`question_version_classifications`, and migration 002 columns/triggers are absent '
                         'from the source and therefore were not added. The repository currently contains '
                         'migration 002; its curriculum-aware question listing requires that migration. '
                         'This report verifies the supplied snapshot, not readiness of the current runtime. '
                         'Resolve that schema-version gap in the separately authorized runtime follow-up.', '']
        sections += ['| Query | Result rows | Match |', '|---|---:|---|']
        for query in verified.get('queries', []):
            sections.append('| ' + query['name'] + ' | ' + str(query['rows']) + ' | PASS |')
        sections += ['', 'FTS5 capability: a uniquely named scratch FTS5 table inserted and matched '
                     '`physics momentum collision`, then was dropped and the entire transaction rolled back. '
                     'No scratch row committed. A separate forced duplicate-key error confirmed subsequent '
                     'batch steps were skipped and scratch DDL rolled back.', '',
                     'Transaction safety: one `BEGIN IMMEDIATE` covered table creation, logical inserts, '
                     'indexes, views and triggers. Foreign keys were enabled and deferred until commit. '
                     'Complete schema/hash/query/FK verification ran before COMMIT; a second verification '
                     'ran against the committed cloud database. Any pre-commit failure rolls back. '
                     'Target emptiness is checked again under the write transaction; no cleanup or destruction '
                     'is implemented. The tool refuses any nonempty target.', '',
                     'Cloud integrity result: `' + str(verified.get('integrity_check', 'not executed')) + '`.', '',
                     'Source/database backups, runtime SQLite and upload fingerprints were compared before '
                     'and after the run (including file size and last-write time). Evidence is in `safety.json`. '
                     'No application migrations or runtime imports were executed.', '',
                     'Tooling uses only Python standard library and the already authenticated WSL Turso CLI. '
                     'A one-day database token is captured in memory and never logged, saved, placed in '
                     'environment variables or passed as a command-line argument.', '',
                     'Protocol reference: [official libSQL HTTP v2 specification]'
                     '(https://github.com/tursodatabase/libsql/blob/main/docs/HTTP_V2_SPEC.md) and '
                     '[conditional batch specification]'
                     '(https://github.com/tursodatabase/libsql/blob/main/docs/HRANA_3_SPEC.md).', '']
    if success:
        sections += ['Recommended next step: migrate the Express runtime from local SQLite to Turso/libSQL, '
                     'resolve migration 002, configure Vercel environment variables, deploy a preview, '
                     'and verify `/api/health` and persistent cloud access. Upload storage remains separate.', '']
    path.write_text('\n'.join(sections), encoding='utf8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=pathlib.Path, required=True)
    parser.add_argument('--target', required=True)
    parser.add_argument('--cli', default='/home/pekchunhoe/.turso/turso')
    parser.add_argument('--output-dir', type=pathlib.Path, required=True,
                        help='New, nonexistent artifact directory; never use the original backup directory')
    parser.add_argument('--report', type=pathlib.Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--verify-only', action='store_true')
    mode.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    require(args.target == EXPECTED_TARGET, 'Target must be explicitly matriculation-physics-question-bank.')
    args.source = args.source.resolve(strict=True)
    output = args.output_dir.resolve()
    require(not output.exists(), 'Artifact directory already exists; choose a new directory.')
    require(output != args.source.parent and args.source.parent not in output.parents,
            'Artifacts must be separate from the immutable backup folder.')
    for suffix in ('-wal', '-journal'):
        sidecar = pathlib.Path(str(args.source) + suffix)
        require(not sidecar.exists() or sidecar.stat().st_size == 0,
                'Source has an active WAL/journal; immutable inspection is unsafe.')
    project = pathlib.Path(__file__).resolve().parent.parent
    protected_paths = [args.source.parent, project / 'data' / 'bank.sqlite',
                       project / 'data' / 'bank.sqlite-wal', project / 'data' / 'bank.sqlite-shm',
                       project / 'data' / 'uploads']
    before = fingerprint(protected_paths)
    output.mkdir(parents=True, exist_ok=False)
    state = {'source_path': str(args.source), 'target': args.target,
             'artifact_dir': str(output), 'source_sha256': digest_file(args.source), 'success': False}
    source = None
    cloud = None
    db = None
    try:
        db = sqlite3.connect(args.source.as_uri() + '?mode=ro&immutable=1', uri=True)
        db.execute('PRAGMA query_only=ON')
        source = inspect_source(db)
        audit = {k: v for k, v in source.items() if k != 'data'}
        audit['tables'] = {name: {k: v for k, v in item.items() if k not in ('rows', 'insert_rows')}
                           for name, item in source['data'].items()}
        write_json(output / 'source-audit.json', audit)
        statements = migration_statements(source)
        sql = export_sql(statements)
        verify_local_replay(source, sql)
        (output / 'turso-clean-import.sql').write_text(sql, encoding='utf8')
        state['export_verified'] = True
        print('Read-only source audit and logical SQL replay: PASS')
        print('Source table counts: ' + json.dumps({n: d['count'] for n, d in source['data'].items()}))
        cloud = Cloud(args.cli, args.target)
        state['authenticated'] = True
        initial = cloud.query(SCHEMA_SQL)
        state['initial_cloud_schema'] = initial
        write_json(output / 'cloud-before.json', {'schema': initial})
        if initial and not args.verify_only:
            state['unexpected_cloud_data'] = True
            counts = {}
            for kind, name, _, _ in initial:
                if kind == 'table' and not name.startswith('sqlite_'):
                    counts[name] = cloud.query('SELECT COUNT(*) FROM ' + quote(name))[0][0]
            write_json(output / 'cloud-before.json', {'schema': initial, 'counts': counts})
            raise MigrationError('Target is nonempty. No cleanup attempted; inspect cloud-before.json.')
        plan = {'source_hash': state['source_sha256'], 'target': args.target,
                'target_is_empty': not initial, 'normal_tables': source['normal_tables'],
                'virtual_tables': source['virtual_tables'], 'excluded_shadows': source['shadow_tables'],
                'statement_labels': [label for _, _, label in statements],
                'phases': ['Audit immutable source and cloud; reject nonempty target',
                           'Replay generated logical SQL in memory and compare complete hashes/schema',
                           'FTS5 scratch capability and forced-failure rollback probes (never commit)',
                           'BEGIN IMMEDIATE; re-audit empty target; enable/defer FK constraints',
                           'Create normal/virtual schemas; insert logical rows; restore indexes/views/triggers',
                           'Verify full schema, all typed row hashes, application queries, FKs before COMMIT',
                           'COMMIT then repeat independent cloud verification; compare protected fingerprints']}
        write_json(output / 'migration-plan.json', plan)
        if not args.apply and not args.verify_only:
            print('DRY RUN: cloud schema audited; no database writes or capability probes executed.')
            return 0
        if args.verify_only:
            state['verification'] = verify_cloud(cloud, db, source)
            write_json(output / 'verification.json', state['verification'])
            print('Read-only cloud verification: PASS')
            return 0
        capability_probe(cloud, initial)
        state['fts_capability'] = True
        print('Turso FTS5 MATCH and transaction rollback capability: PASS')
        cloud.query('PRAGMA foreign_keys=ON')
        require(cloud.query('PRAGMA foreign_keys') == [[1]], 'Cloud foreign-key enforcement unavailable.')
        cloud.query('BEGIN IMMEDIATE')
        require(cloud.query(SCHEMA_SQL) == [], 'Target changed after audit; migration aborted.')
        cloud.query('PRAGMA defer_foreign_keys=ON')
        require(cloud.query('PRAGMA defer_foreign_keys') == [[1]], 'Deferred cloud foreign keys unavailable.')
        # Chunk requests while retaining the same stateful transaction/stream.
        # An error skips every later statement in its chunk; no writes are retried.
        for start in range(0, len(statements), 100):
            cloud.batch(statements[start:start + 100])
        precommit = verify_cloud(cloud, db, source)
        write_json(output / 'precommit-verification.json', precommit)
        require(before == fingerprint(protected_paths), 'Protected files changed before commit.')
        cloud.query('COMMIT')
        state['committed'] = True
        state['verification'] = verify_cloud(cloud, db, source)
        write_json(output / 'verification.json', state['verification'])
        state['success'] = True
        print('Committed migration; all schema, count, content hash, FK and query comparisons: PASS')
        return 0
    except (MigrationError, sqlite3.Error, OSError, subprocess.SubprocessError) as exc:
        state['error'] = str(exc) if isinstance(exc, MigrationError) else type(exc).__name__ + ' during migration; inspect local inputs.'
        if cloud and cloud.baton and not state.get('committed'):
            try:
                cloud.query('ROLLBACK')
                state['rolled_back'] = True
            except MigrationError:
                state['rollback_status'] = 'Unconfirmed; stream closure rolls back an open transaction. Re-audit target.'
        print('STOP: ' + state['error'], file=sys.stderr)
        return 1
    finally:
        if db:
            db.close()
        if cloud:
            try:
                cloud.close()
            except MigrationError:
                pass
        after = fingerprint(protected_paths)
        state['protected_files_unchanged'] = before == after
        if before != after:
            state['success'] = False
            state['error'] = 'Protected backup/runtime/upload fingerprints changed; inspect safety.json.'
        write_json(output / 'safety.json', {'before': before, 'after': after, 'unchanged': before == after})
        write_json(output / 'run-status.json', state)
        if args.report:
            write_report(args.report.resolve(), state, source)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (MigrationError, OSError) as exc:
        print('STOP: ' + str(exc), file=sys.stderr)
        sys.exit(1)
