import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  documentSchema,
  warnings,
  type QuestionDocument,
  type Taxonomy,
} from '../shared/schema.js';

type Row = Record<string, string | number | null>;
export class BankError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const slugify = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const taxonomyTables = {
  courses: null,
  semesters: 'course_id',
  chapters: 'semester_id',
  topics: 'chapter_id',
  subtopics: 'topic_id',
  difficulties: null,
} as const;
const sqlTable = (kind: keyof typeof taxonomyTables) =>
  kind === 'difficulties' ? 'difficulty_levels' : kind;
export type Filters = Record<string, string | undefined>;
export class Bank {
  db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
    );
    const folder = new URL('./migrations/', import.meta.url);
    for (const name of readdirSync(folder)
      .filter((n) => /^\d+-.*\.sql$/.test(n))
      .sort()) {
      const version = Number(name.split('-')[0]);
      if (!this.one('SELECT version FROM schema_migrations WHERE version=?', version))
        this.transaction(() => {
          this.db.exec(readFileSync(new URL(name, folder), 'utf8'));
          this.run('INSERT INTO schema_migrations VALUES(?,?)', version, new Date().toISOString());
        });
    }
  }
  one(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }
  all(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).all(...params) as Row[];
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  taxonomy(): Taxonomy {
    return Object.fromEntries(
      Object.entries(taxonomyTables).map(([key, parent]) => [
        key,
        this.all(
          `SELECT * FROM ${sqlTable(key as keyof typeof taxonomyTables)} ORDER BY sort_order,name`,
        ).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          slug: String(r.slug),
          parentId: parent ? String(r[parent]) : null,
          order: Number(r.sort_order),
          isTest: Boolean(r.is_test),
        })),
      ]),
    ) as Taxonomy;
  }
  addTaxon(
    kind: keyof typeof taxonomyTables,
    name: string,
    parentId: string | null,
    isTest = false,
  ) {
    const slug = slugify(name);
    if (!slug || name.length > 200) throw new BankError('Enter a valid taxonomy name');
    const table = sqlTable(kind),
      parent = taxonomyTables[kind];
    if (parent && !parentId) throw new BankError('Select the parent taxonomy record');
    if (
      this.all(
        `SELECT name FROM ${table}${parent ? ' WHERE ' + parent + '=?' : ''}`,
        ...(parent ? [parentId] : []),
      ).some((r) => normalize(String(r.name)) === normalize(name))
    )
      throw new BankError('This taxonomy name already exists under this parent', 409);
    const id = randomUUID();
    try {
      this.run(
        `INSERT INTO ${table}(id,name,slug,sort_order${parent ? ',' + parent : ''}${kind !== 'difficulties' ? ',is_test' : ''}) VALUES(?,?,?,?${parent ? ',?' : ''}${kind !== 'difficulties' ? ',?' : ''})`,
        id,
        name.trim().replace(/\s+/g, ' '),
        slug,
        Date.now(),
        ...(parent ? [parentId] : []),
        ...(kind !== 'difficulties' ? [Number(isTest)] : []),
      );
    } catch {
      throw new BankError('Invalid parent or duplicate taxonomy slug', 409);
    }
    return id;
  }
  validate(input: unknown): QuestionDocument {
    const parsed = documentSchema.safeParse(input);
    if (!parsed.success)
      throw new BankError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    const doc = parsed.data;
    if (!this.one('SELECT id FROM topics WHERE id=?', doc.question.topicId))
      throw new BankError('Unknown topic');
    if (
      doc.question.subtopicId &&
      !this.one(
        'SELECT id FROM subtopics WHERE id=? AND topic_id=?',
        doc.question.subtopicId,
        doc.question.topicId,
      )
    )
      throw new BankError('Subtopic does not belong to this topic');
    if (!this.one('SELECT id FROM difficulty_levels WHERE id=?', doc.question.difficultyId))
      throw new BankError('Unknown difficulty');
    return doc;
  }
  resolveImport(input: unknown): QuestionDocument {
    if (typeof input !== 'object' || !input) throw new BankError('Import must be a JSON object');
    const copy = structuredClone(input) as Record<string, unknown>;
    if (copy.classification) {
      const c = copy.classification as Record<string, unknown>;
      if (
        typeof c !== 'object' ||
        !c ||
        Array.isArray(c) ||
        Object.keys(c).some(
          (k) => !['course', 'semester', 'chapter', 'topic', 'subtopic'].includes(k),
        ) ||
        typeof copy.question !== 'object' ||
        !copy.question
      )
        throw new BankError('Invalid import classification');
      let parent: string | null = null;
      const tax = this.taxonomy();
      for (const key of ['course', 'semester', 'chapter', 'topic', 'subtopic'] as const) {
        if (key === 'subtopic' && !c[key]) continue;
        if (typeof c[key] !== 'string') throw new BankError(`Classification requires ${key}`);
        const collection = tax[`${key}s` as keyof Taxonomy];
        const match = collection.find(
          (t) =>
            (t.id === c[key] ||
              normalize(t.name) === normalize(String(c[key])) ||
              t.slug === normalize(String(c[key]))) &&
            t.parentId === parent,
        );
        if (!match) throw new BankError(`Unknown or inconsistent ${key}: ${c[key]}`);
        if (key === 'topic' || key === 'subtopic') {
          const field = key === 'topic' ? 'topicId' : 'subtopicId',
            q = copy.question as Record<string, unknown>;
          if (q[field] && q[field] !== match.id)
            throw new BankError('Classification conflicts with supplied taxonomy IDs');
          q[field] = match.id;
        }
        parent = match.id;
      }
      const q = copy.question as Record<string, unknown>;
      if (!c.subtopic) {
        if (q.subtopicId) throw new BankError('Classification conflicts with supplied subtopic ID');
        q.subtopicId = null;
      }
      delete copy.classification;
    }
    return this.validate(copy);
  }
  private writeContent(id: string, doc: QuestionDocument) {
    for (const table of [
      'solution_steps',
      'solutions',
      'hints',
      'assets',
      'question_parts',
      'question_tags',
    ])
      this.run(`DELETE FROM ${table} WHERE question_id=?`, id);
    for (const p of doc.parts)
      this.run(
        'INSERT INTO question_parts VALUES(?,?,?,?,?,?,?)',
        id,
        p.id,
        p.label,
        p.prompt,
        p.marks,
        p.order,
        p.parentId,
      );
    for (const s of doc.solutions) {
      this.run(
        'INSERT INTO solutions VALUES(?,?,?,?,?)',
        id,
        s.partId,
        s.solution,
        s.equationLatex,
        s.teacherNotes,
      );
      for (const t of s.steps)
        this.run(
          'INSERT INTO solution_steps VALUES(?,?,?,?,?,?,?,?,?)',
          id,
          s.partId,
          t.number,
          t.explanation,
          t.equationLatex,
          t.working,
          t.markingPoint,
          t.marks,
          t.order,
        );
    }
    for (const h of doc.hints)
      this.run('INSERT INTO hints VALUES(?,?,?,?,?)', id, h.id, h.partId, h.text, h.order);
    for (const a of doc.assets)
      this.run(
        'INSERT INTO assets VALUES(?,?,?,?,?,?,?,?)',
        id,
        a.id,
        a.partId,
        a.kind,
        a.url,
        a.alt,
        a.mime,
        a.order,
      );
    for (const tag of doc.tags) {
      const key = normalize(tag);
      let row = this.one('SELECT id FROM tags WHERE normalized=?', key);
      if (!row) {
        const tagId = randomUUID();
        this.run('INSERT INTO tags VALUES(?,?,?)', tagId, tag, key);
        row = { id: tagId };
      }
      this.run('INSERT OR IGNORE INTO question_tags VALUES(?,?)', id, row.id);
    }
    this.indexQuestion(id, doc);
  }
  private indexQuestion(id: string, doc: QuestionDocument) {
    const path = this.one(
      'SELECT t.name topic,c.name chapter,s.name semester,co.name course,st.name subtopic FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id LEFT JOIN subtopics st ON st.id=? WHERE t.id=?',
      doc.question.subtopicId,
      doc.question.topicId,
    );
    this.run('DELETE FROM question_search WHERE question_id=?', id);
    this.run(
      'INSERT INTO question_search VALUES(?,?)',
      id,
      [
        doc.question.questionCode,
        doc.question.title,
        doc.question.scenario,
        ...doc.parts.map((p) => p.prompt),
        ...doc.tags,
        ...Object.values(path ?? {}),
      ].join(' '),
    );
  }
  private activate(
    id: string,
    doc: QuestionDocument,
    note: string,
    author: string | null,
    version: number,
    isNew = false,
  ) {
    const q = doc.question,
      now = new Date().toISOString();
    const args = [
      q.questionCode,
      q.topicId,
      q.subtopicId,
      q.title,
      q.scenario,
      q.difficultyId,
      q.questionType,
      q.totalMarks,
      q.estimatedMinutes,
      q.status,
      Number(q.containsDiagram),
      Number(q.containsGraph),
      Number(q.containsFbd),
      version,
      now,
      q.status === 'approved' ? now : null,
    ];
    if (isNew)
      this.run(
        'INSERT INTO questions(question_code,topic_id,subtopic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,active_version,updated_at,approved_at,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ...args,
        id,
        now,
      );
    else
      this.run(
        'UPDATE questions SET question_code=?,topic_id=?,subtopic_id=?,title=?,scenario=?,difficulty_id=?,question_type=?,total_marks=?,estimated_minutes=?,status=?,contains_diagram=?,contains_graph=?,contains_fbd=?,active_version=?,updated_at=?,approved_at=? WHERE id=?',
        ...args,
        id,
      );
    this.writeContent(id, doc);
    this.run(
      'INSERT INTO question_versions VALUES(?,?,?,?,?,?)',
      id,
      version,
      JSON.stringify(doc),
      note,
      author,
      now,
    );
  }
  create(input: unknown, note: string, author: string | null = null, confirmApproval = false) {
    const doc = this.validate(input);
    this.requireNote(note);
    this.requireAuthor(author);
    if (doc.question.status === 'approved' && !confirmApproval)
      throw new BankError('Explicit human approval is required', 409);
    if (this.one('SELECT id FROM questions WHERE question_code=?', doc.question.questionCode))
      throw new BankError('Question code already exists; use the revision workflow', 409);
    const id = randomUUID();
    this.transaction(() => this.activate(id, doc, note, author, 1, true));
    return { id, version: 1, warnings: warnings(doc) };
  }
  requireNote(note: string) {
    if (typeof note !== 'string' || !note.trim() || note.length > 2000)
      throw new BankError('A revision note is required (maximum 2000 characters)');
  }
  requireAuthor(author: string | null) {
    if (author !== null && (typeof author !== 'string' || author.length > 200))
      throw new BankError('Author must be text of at most 200 characters');
  }
  current(id: string) {
    const row = this.one('SELECT * FROM questions WHERE id=?', id);
    if (!row) throw new BankError('Question not found', 404);
    return row;
  }
  document(id: string, version?: number): QuestionDocument {
    const active = this.current(id);
    const row = this.one(
      'SELECT snapshot FROM question_versions WHERE question_id=? AND version_number=?',
      id,
      version ?? active.active_version,
    );
    if (!row) throw new BankError('Version not found', 404);
    return JSON.parse(String(row.snapshot));
  }
  save(
    id: string,
    input: unknown,
    note: string,
    baseVersion: number,
    author: string | null = null,
    source: 'manual' | 'json' | 'pdf' = 'manual',
  ) {
    const doc = this.validate(input);
    this.requireNote(note);
    this.requireAuthor(author);
    if (!Number.isInteger(baseVersion) || baseVersion < 1)
      throw new BankError('A valid base version is required');
    return this.transaction(() => {
      const current = this.current(id);
      if (current.active_version !== baseVersion)
        throw new BankError('This question changed. Reload before saving.', 409);
      if (doc.question.questionCode !== current.question_code)
        throw new BankError('Question codes are stable and cannot be changed');
      if (JSON.stringify(doc) === JSON.stringify(this.document(id)))
        throw new BankError('No content changes to save');
      if (current.status === 'approved' || doc.question.status === 'approved' || source === 'pdf') {
        const candidateId = randomUUID();
        this.run(
          'INSERT INTO revision_candidates(id,question_id,base_version,source,snapshot,change_note,author,created_at) VALUES(?,?,?,?,?,?,?,?)',
          candidateId,
          id,
          baseVersion,
          source,
          JSON.stringify(doc),
          note,
          author,
          new Date().toISOString(),
        );
        return { id, candidateId, pending: true, version: baseVersion, warnings: warnings(doc) };
      }
      this.activate(id, doc, note, author, baseVersion + 1);
      return { id, pending: false, version: baseVersion + 1, warnings: warnings(doc) };
    });
  }
  review(candidateId: string, approve: boolean, reviewer: string) {
    if (typeof reviewer !== 'string' || !reviewer.trim() || reviewer.length > 200)
      throw new BankError('Enter the reviewing teacher’s name (maximum 200 characters)');
    return this.transaction(() => {
      const c = this.one('SELECT * FROM revision_candidates WHERE id=?', candidateId);
      if (!c || c.status !== 'pending') throw new BankError('Pending revision not found', 404);
      const current = this.current(String(c.question_id));
      if (approve && current.active_version !== c.base_version)
        throw new BankError(
          'Revision is stale. Compare against the latest version before resubmitting.',
          409,
        );
      const doc = this.validate(JSON.parse(String(c.snapshot)));
      if (approve)
        this.activate(
          String(c.question_id),
          doc,
          String(c.change_note),
          String(c.author ?? reviewer),
          Number(c.base_version) + 1,
        );
      this.run(
        'UPDATE revision_candidates SET status=?,reviewed_at=?,reviewer=? WHERE id=?',
        approve ? 'approved' : 'rejected',
        new Date().toISOString(),
        reviewer,
        candidateId,
      );
      return { id: c.question_id, approved: approve };
    });
  }
  versions(id: string) {
    this.current(id);
    return this.all(
      'SELECT version_number version,change_note note,author,created_at createdAt FROM question_versions WHERE question_id=? ORDER BY version_number DESC',
      id,
    );
  }
  candidates(id: string) {
    this.current(id);
    return this.all(
      'SELECT * FROM revision_candidates WHERE question_id=? ORDER BY created_at DESC',
      id,
    ).map((c) => ({
      id: String(c.id),
      question_id: String(c.question_id),
      base_version: Number(c.base_version),
      source: String(c.source),
      source_pdf_url: c.source_pdf_url,
      change_note: String(c.change_note),
      author: c.author,
      status: String(c.status),
      created_at: String(c.created_at),
      reviewed_at: c.reviewed_at,
      reviewer: c.reviewer,
      document: JSON.parse(String(c.snapshot)) as QuestionDocument,
    }));
  }
  private query(filters: Filters) {
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
    const fields: Record<string, string> = {
      course: 'co.id',
      semester: 's.id',
      chapter: 'c.id',
      subtopic: 'q.subtopic_id',
      difficulty: 'q.difficulty_id',
      status: 'q.status',
      type: 'q.question_type',
    };
    for (const [key, field] of Object.entries(fields))
      if (filters[key]) {
        clauses.push(`${field}=?`);
        params.push(filters[key]!);
      }
    if (filters.topic) {
      const ids = filters.topic.split(',');
      clauses.push(`q.topic_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
    for (const [key, op] of [
      ['minMarks', '>='],
      ['maxMarks', '<='],
    ] as const)
      if (filters[key]) {
        const n = Number(filters[key]);
        if (!Number.isInteger(n) || n < 0 || n > 10000)
          throw new BankError('Marks filters must be nonnegative integers up to 10000');
        clauses.push(`q.total_marks${op}?`);
        params.push(n);
      }
    if (filters.minMarks && filters.maxMarks && Number(filters.minMarks) > Number(filters.maxMarks))
      throw new BankError('Minimum marks exceeds maximum marks');
    for (const [key, field] of [
      ['diagram', 'contains_diagram'],
      ['graph', 'contains_graph'],
      ['fbd', 'contains_fbd'],
    ] as const)
      if (filters[key]) {
        if (!['true', 'false'].includes(filters[key]!)) throw new BankError('Invalid asset filter');
        clauses.push(`q.${field}=?`);
        params.push(Number(filters[key] === 'true'));
      }
    for (const tag of filters.tags?.split(',').filter(Boolean) ?? []) {
      clauses.push(
        'EXISTS(SELECT 1 FROM question_tags qt JOIN tags tg ON tg.id=qt.tag_id WHERE qt.question_id=q.id AND tg.normalized=?)',
      );
      params.push(normalize(tag));
    }
    if (filters.q?.trim()) {
      if (filters.q.length > 500) throw new BankError('Search is limited to 500 characters');
      const terms = filters.q.match(/[\p{L}\p{N}-]+/gu) ?? [];
      if (terms.length) {
        clauses.push(
          'q.id IN (SELECT question_id FROM question_search WHERE question_search MATCH ?)',
        );
        params.push(terms.map((t) => `"${t}"*`).join(' AND '));
      }
    }
    return { where: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', params };
  }
  list(filters: Filters = {}) {
    const { where, params } = this.query(filters),
      join =
        ' FROM questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id JOIN difficulty_levels d ON d.id=q.difficulty_id LEFT JOIN subtopics st ON st.id=q.subtopic_id';
    const page = Number(filters.page ?? 1),
      limit = Number(filters.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BankError('Invalid pagination');
    const total = Number(this.one('SELECT count(*) total' + join + where, ...params)?.total ?? 0);
    const items = this.all(
      `SELECT q.*,co.name course,s.name semester,c.name chapter,t.name topic,st.name subtopic,d.name difficulty,EXISTS(SELECT 1 FROM solutions x WHERE x.question_id=q.id) has_solution,EXISTS(SELECT 1 FROM hints h WHERE h.question_id=q.id) has_hints,(SELECT url FROM assets a WHERE a.question_id=q.id AND a.kind='original_pdf' LIMIT 1) original_pdf` +
        join +
        where +
        ' ORDER BY q.updated_at DESC,q.id LIMIT ? OFFSET ?',
      ...params,
      limit,
      (page - 1) * limit,
    );
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
  counts(course?: string) {
    const rows = this.all(
      'SELECT s.id semester_id,c.id chapter_id,t.id topic_id,q.difficulty_id,count(q.id) count FROM semesters s LEFT JOIN chapters c ON c.semester_id=s.id LEFT JOIN topics t ON t.chapter_id=c.id LEFT JOIN questions q ON q.topic_id=t.id' +
        (course ? ' WHERE s.course_id=?' : '') +
        ' GROUP BY s.id,c.id,t.id,q.difficulty_id',
      ...(course ? [course] : []),
    );
    return rows;
  }
  close() {
    this.db.close();
  }
}
