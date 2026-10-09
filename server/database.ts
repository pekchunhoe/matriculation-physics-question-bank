import type { DatabaseAdapter, SQLInputValue } from './database-adapter.js';
import { randomUUID } from 'node:crypto';
import { CurriculumService } from './curriculum.js';
import { publicQuestionSql, publishedCurriculumSql } from './public-visibility-policy.js';
import { questionExportSchema, type Classification } from '../shared/curriculum.js';
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
  curriculum = new CurriculumService(this);
  constructor(readonly db: DatabaseAdapter) {}
  async one(sql: string, ...params: SQLInputValue[]): Promise<Row | undefined> {
    return (await this.db.execute(sql, params)).rows[0];
  }
  async all(sql: string, ...params: SQLInputValue[]): Promise<Row[]> {
    return (await this.db.execute(sql, params)).rows;
  }
  async run(sql: string, ...params: SQLInputValue[]) {
    return this.db.execute(sql, params);
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }
  async taxonomy(): Promise<Taxonomy> {
    const entries = [];
    for (const [key, parent] of Object.entries(taxonomyTables)) {
      const rows = await this.all(
        `SELECT * FROM ${sqlTable(key as keyof typeof taxonomyTables)} ORDER BY sort_order,name`,
      );
      entries.push([
        key,
        rows.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          slug: String(r.slug),
          parentId: parent ? String(r[parent]) : null,
          order: Number(r.sort_order),
          isTest: Boolean(r.is_test),
          ...(r.status ? { status: String(r.status), revision: Number(r.revision) } : {}),
          ...(r.curriculum_version_id
            ? { curriculumVersionId: String(r.curriculum_version_id) }
            : {}),
        })),
      ]);
    }
    return {
      ...Object.fromEntries(entries),
      curriculumVersions: await this.curriculum.versions(),
    } as Taxonomy;
  }
  async addTaxon(
    kind: keyof typeof taxonomyTables,
    name: string,
    parentId: string | null,
    isTest = false,
    curriculumVersionId?: string,
  ) {
    const slug = slugify(name);
    if (!slug || name.length > 200) throw new BankError('Enter a valid taxonomy name');
    const table = sqlTable(kind),
      parent = taxonomyTables[kind];
    if (parent && !parentId) throw new BankError('Select the parent taxonomy record');
    const cv =
      kind === 'semesters'
        ? (await this.curriculum.versions()).find(
            (v) =>
              v.courseId === parentId &&
              (curriculumVersionId ? v.id === curriculumVersionId : v.status === 'active'),
          )
        : undefined;
    if (kind === 'semesters' && !cv)
      throw new BankError('Select a curriculum version belonging to this course');
    if (cv?.status === 'retired')
      throw new BankError('Restore or create a curriculum version before adding records');
    if (kind === 'chapters' || kind === 'topics' || kind === 'subtopics') {
      const parentKind =
        kind === 'chapters' ? 'semesters' : kind === 'topics' ? 'chapters' : 'topics';
      await this.curriculum.assertWritableParent(parentKind, parentId!);
    }
    if (
      (
        await this.all(
          `SELECT name FROM ${table}${parent ? ' WHERE ' + parent + '=?' : ''}${kind === 'semesters' ? ' AND curriculum_version_id=?' : ''}`,
          ...(parent ? [parentId] : []),
          ...(cv ? [cv.id] : []),
        )
      ).some((r) => normalize(String(r.name)) === normalize(name))
    )
      throw new BankError('This taxonomy name already exists under this parent', 409);
    const id = randomUUID();
    try {
      await this.transaction(async () => {
        await this.run(
          `INSERT INTO ${table}(id,name,slug,sort_order${parent ? ',' + parent : ''}${kind !== 'difficulties' ? ',is_test' : ''}${cv ? ',curriculum_version_id' : ''}) VALUES(?,?,?,?${parent ? ',?' : ''}${kind !== 'difficulties' ? ',?' : ''}${cv ? ',?' : ''})`,
          id,
          name.trim().replace(/\s+/g, ' '),
          cv && cv.code !== 'LEGACY' ? `${slugify(cv.code)}-${slug}`.slice(0, 200) : slug,
          Date.now(),
          ...(parent ? [parentId] : []),
          ...(kind !== 'difficulties' ? [Number(isTest)] : []),
          ...(cv ? [cv.id] : []),
        );
        if (kind === 'courses') {
          const now = new Date().toISOString();
          await this.run(
            'INSERT INTO curriculum_versions VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            'legacy-' + id,
            id,
            'LEGACY',
            'Existing curriculum (unversioned)',
            null,
            null,
            'active',
            0,
            1,
            now,
            now,
          );
        }
      });
    } catch {
      throw new BankError('Invalid parent or duplicate taxonomy slug', 409);
    }
    return id;
  }
  async validate(input: unknown): Promise<QuestionDocument> {
    const parsed = documentSchema.safeParse(input);
    if (!parsed.success)
      throw new BankError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    const doc = parsed.data;
    if (!(await this.one('SELECT id FROM topics WHERE id=?', doc.question.topicId)))
      throw new BankError('Unknown topic');
    if (
      doc.question.subtopicId &&
      !(await this.one(
        'SELECT id FROM subtopics WHERE id=? AND topic_id=?',
        doc.question.subtopicId,
        doc.question.topicId,
      ))
    )
      throw new BankError('Subtopic does not belong to this topic');
    if (!(await this.one('SELECT id FROM difficulty_levels WHERE id=?', doc.question.difficultyId)))
      throw new BankError('Unknown difficulty');
    return doc;
  }
  async resolveImport(input: unknown): Promise<QuestionDocument> {
    if (typeof input !== 'object' || !input) throw new BankError('Import must be a JSON object');
    const copy = structuredClone(input) as Record<string, unknown>;
    if (copy.schemaVersion === 2) {
      const envelope = questionExportSchema.safeParse(copy);
      if (!envelope.success)
        throw new BankError(
          envelope.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
        );
      const doc = await this.validate(envelope.data.document),
        live = await this.curriculum.classification(doc);
      for (const key of [
        'course',
        'curriculumVersion',
        'semester',
        'chapter',
        'topic',
        'subtopic',
      ] as const)
        if (envelope.data.savedClassification[key]?.id !== live[key]?.id)
          throw new BankError(`Export classification conflicts with ${key} relationship`);
      return doc;
    }
    if (copy.classification) {
      const c = copy.classification as Record<string, unknown>;
      if (
        typeof c !== 'object' ||
        !c ||
        Array.isArray(c) ||
        Object.keys(c).some(
          (k) =>
            !['course', 'curriculumVersion', 'semester', 'chapter', 'topic', 'subtopic'].includes(
              k,
            ),
        ) ||
        typeof copy.question !== 'object' ||
        !copy.question
      )
        throw new BankError('Invalid import classification');
      let parent: string | null = null;
      const tax = await this.taxonomy();
      for (const key of ['course', 'semester', 'chapter', 'topic', 'subtopic'] as const) {
        if (key === 'subtopic' && !c[key]) continue;
        if (typeof c[key] !== 'string') throw new BankError(`Classification requires ${key}`);
        const collection =
          tax[`${key}s` as 'courses' | 'semesters' | 'chapters' | 'topics' | 'subtopics'];
        const matches = collection.filter(
          (t) =>
            (t.id === c[key] ||
              normalize(t.name) === normalize(String(c[key])) ||
              t.slug === normalize(String(c[key]))) &&
            t.parentId === parent &&
            (key !== 'semester' ||
              !c.curriculumVersion ||
              (tax.curriculumVersions ?? []).some(
                (v) =>
                  v.id === t.curriculumVersionId &&
                  (v.id === c.curriculumVersion || v.code === c.curriculumVersion),
              )),
        );
        if (matches.length > 1)
          throw new BankError(`Ambiguous ${key}; supply stable IDs and curriculumVersion`);
        const match = matches[0];
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
    return await this.validate(copy);
  }
  private async writeContent(id: string, doc: QuestionDocument) {
    for (const table of [
      'solution_steps',
      'solutions',
      'hints',
      'assets',
      'question_parts',
      'question_tags',
    ])
      await this.run(`DELETE FROM ${table} WHERE question_id=?`, id);
    for (const p of doc.parts)
      await this.run(
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
      await this.run(
        'INSERT INTO solutions VALUES(?,?,?,?,?)',
        id,
        s.partId,
        s.solution,
        s.equationLatex,
        s.teacherNotes,
      );
      for (const t of s.steps)
        await this.run(
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
      await this.run('INSERT INTO hints VALUES(?,?,?,?,?)', id, h.id, h.partId, h.text, h.order);
    for (const a of doc.assets)
      await this.run(
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
      let row = await this.one('SELECT id FROM tags WHERE normalized=?', key);
      if (!row) {
        const tagId = randomUUID();
        await this.run('INSERT INTO tags VALUES(?,?,?)', tagId, tag, key);
        row = { id: tagId };
      }
      await this.run('INSERT OR IGNORE INTO question_tags VALUES(?,?)', id, row.id);
    }
    await this.indexQuestion(id, doc);
  }
  private async indexQuestion(id: string, doc: QuestionDocument) {
    const path = await this.one(
      'SELECT t.name topic,c.name chapter,s.name semester,co.name course,st.name subtopic FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id LEFT JOIN subtopics st ON st.id=? WHERE t.id=?',
      doc.question.subtopicId,
      doc.question.topicId,
    );
    await this.run('DELETE FROM question_search WHERE question_id=?', id);
    await this.run(
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
  async refreshSearch() {
    for (const q of await this.all('SELECT id FROM questions'))
      await this.indexQuestion(String(q.id), await this.document(String(q.id)));
  }
  async savedClassification(id: string, version?: number): Promise<Classification | undefined> {
    const row = await this.one(
      'SELECT snapshot FROM question_version_classifications WHERE question_id=? AND version_number=?',
      id,
      version ?? (await this.current(id)).active_version,
    );
    return row ? JSON.parse(String(row.snapshot)) : undefined;
  }
  private async activeAssignment(doc: QuestionDocument, current?: QuestionDocument) {
    if (
      current &&
      current.question.topicId === doc.question.topicId &&
      current.question.subtopicId === doc.question.subtopicId
    )
      return;
    const path = await this.curriculum.classification(doc),
      tax = await this.taxonomy();
    if (
      (await this.curriculum.versions()).find((v) => v.id === path.curriculumVersion.id)?.status ===
        'retired' ||
      (['semesters', 'chapters', 'topics', 'subtopics'] as const).some(
        (k) =>
          tax[k].find(
            (t) =>
              t.id === path[k.slice(0, -1) as 'semester' | 'chapter' | 'topic' | 'subtopic']?.id,
          )?.status === 'retired',
      )
    )
      throw new BankError(
        'New assignments cannot use retired curriculum items. Restore the hierarchy or select another topic.',
        409,
      );
  }
  private async activate(
    id: string,
    doc: QuestionDocument,
    note: string,
    author: string | null,
    version: number,
    isNew = false,
    classification?: Classification,
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
      await this.run(
        'INSERT INTO questions(question_code,topic_id,subtopic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,active_version,updated_at,approved_at,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ...args,
        id,
        now,
      );
    else
      await this.run(
        'UPDATE questions SET question_code=?,topic_id=?,subtopic_id=?,title=?,scenario=?,difficulty_id=?,question_type=?,total_marks=?,estimated_minutes=?,status=?,contains_diagram=?,contains_graph=?,contains_fbd=?,active_version=?,updated_at=?,approved_at=? WHERE id=?',
        ...args,
        id,
      );
    await this.writeContent(id, doc);
    await this.run(
      'INSERT INTO question_versions VALUES(?,?,?,?,?,?)',
      id,
      version,
      JSON.stringify(doc),
      note,
      author,
      now,
    );
    await this.run(
      'INSERT INTO question_version_classifications VALUES(?,?,?)',
      id,
      version,
      JSON.stringify(classification ?? (await this.curriculum.classification(doc))),
    );
  }
  async create(
    input: unknown,
    note: string,
    author: string | null = null,
    confirmApproval = false,
    classification?: Classification,
  ) {
    const doc = await this.validate(input);
    this.requireNote(note);
    this.requireAuthor(author);
    if (doc.question.status === 'approved' && !confirmApproval)
      throw new BankError('Explicit human approval is required', 409);
    if (await this.one('SELECT id FROM questions WHERE question_code=?', doc.question.questionCode))
      throw new BankError('Question code already exists; use the revision workflow', 409);
    const id = randomUUID();
    await this.transaction(async () => {
      await this.activeAssignment(doc);
      if (classification) {
        const live = await this.curriculum.classification(doc);
        for (const key of [
          'course',
          'curriculumVersion',
          'semester',
          'chapter',
          'topic',
          'subtopic',
        ] as const)
          if (classification[key]?.id !== live[key]?.id)
            throw new BankError(`Saved classification conflicts with ${key} relationship`);
      }
      await this.activate(id, doc, note, author, 1, true, classification);
    });
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
  async current(id: string) {
    const row = await this.one('SELECT * FROM questions WHERE id=?', id);
    if (!row) throw new BankError('Question not found', 404);
    return row;
  }
  async document(id: string, version?: number): Promise<QuestionDocument> {
    const active = await this.current(id);
    const row = await this.one(
      'SELECT snapshot FROM question_versions WHERE question_id=? AND version_number=?',
      id,
      version ?? active.active_version,
    );
    if (!row) throw new BankError('Version not found', 404);
    return JSON.parse(String(row.snapshot));
  }
  async save(
    id: string,
    input: unknown,
    note: string,
    baseVersion: number,
    author: string | null = null,
    source: 'manual' | 'json' | 'pdf' = 'manual',
  ) {
    const doc = await this.validate(input);
    this.requireNote(note);
    this.requireAuthor(author);
    if (!Number.isInteger(baseVersion) || baseVersion < 1)
      throw new BankError('A valid base version is required');
    return await this.transaction(async () => {
      const current = await this.current(id);
      await this.activeAssignment(doc, await this.document(id));
      if (current.active_version !== baseVersion)
        throw new BankError('This question changed. Reload before saving.', 409);
      if (doc.question.questionCode !== current.question_code)
        throw new BankError('Question codes are stable and cannot be changed');
      if (JSON.stringify(doc) === JSON.stringify(await this.document(id)))
        throw new BankError('No content changes to save');
      if (current.status === 'approved' || doc.question.status === 'approved' || source === 'pdf') {
        const candidateId = randomUUID();
        await this.run(
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
      await this.activate(id, doc, note, author, baseVersion + 1);
      return { id, pending: false, version: baseVersion + 1, warnings: warnings(doc) };
    });
  }
  async review(candidateId: string, approve: boolean, reviewer: string) {
    if (typeof reviewer !== 'string' || !reviewer.trim() || reviewer.length > 200)
      throw new BankError('Enter the reviewing teacher’s name (maximum 200 characters)');
    return await this.transaction(async () => {
      const c = await this.one('SELECT * FROM revision_candidates WHERE id=?', candidateId);
      if (!c || c.status !== 'pending') throw new BankError('Pending revision not found', 404);
      const current = await this.current(String(c.question_id));
      if (approve && current.active_version !== c.base_version)
        throw new BankError(
          'Revision is stale. Compare against the latest version before resubmitting.',
          409,
        );
      const doc = await this.validate(JSON.parse(String(c.snapshot)));
      if (approve) await this.activeAssignment(doc, await this.document(String(c.question_id)));
      if (approve)
        await this.activate(
          String(c.question_id),
          doc,
          String(c.change_note),
          String(c.author ?? reviewer),
          Number(c.base_version) + 1,
        );
      await this.run(
        'UPDATE revision_candidates SET status=?,reviewed_at=?,reviewer=? WHERE id=?',
        approve ? 'approved' : 'rejected',
        new Date().toISOString(),
        reviewer,
        candidateId,
      );
      return { id: c.question_id, approved: approve };
    });
  }
  async versions(id: string) {
    await this.current(id);
    return await this.all(
      'SELECT version_number version,change_note note,author,created_at createdAt FROM question_versions WHERE question_id=? ORDER BY version_number DESC',
      id,
    );
  }
  async candidates(id: string) {
    await this.current(id);
    return (
      await this.all(
        'SELECT * FROM revision_candidates WHERE question_id=? ORDER BY created_at DESC',
        id,
      )
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
  private query(filters: Filters, publicOnly = false) {
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
    if (publicOnly) clauses.push(publicQuestionSql);
    if (filters.curriculum) {
      clauses.push(filters.curriculum === 'active' ? "cv.status='active'" : 'cv.id=?');
      if (filters.curriculum !== 'active') params.push(filters.curriculum);
    }
    if (filters.taxonomyStatus === 'active')
      clauses.push(
        "s.status='active' AND c.status='active' AND t.status='active' AND (st.id IS NULL OR st.status='active')",
      );
    else if (filters.taxonomyStatus && filters.taxonomyStatus !== 'all')
      throw new BankError('Invalid taxonomy status filter');
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
  async list(filters: Filters = {}, publicOnly = false) {
    const { where, params } = this.query(filters, publicOnly),
      join =
        ' FROM questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id JOIN difficulty_levels d ON d.id=q.difficulty_id LEFT JOIN subtopics st ON st.id=q.subtopic_id';
    const page = Number(filters.page ?? 1),
      limit = Number(filters.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BankError('Invalid pagination');
    const total = Number(
      (await this.one('SELECT count(*) total' + join + where, ...params))?.total ?? 0,
    );
    const items = await this.all(
      `SELECT q.*,co.name course,cv.id curriculum_version_id,cv.name curriculum_version,cv.status curriculum_status,s.name semester,c.name chapter,t.name topic,st.name subtopic,d.name difficulty,EXISTS(SELECT 1 FROM solutions x WHERE x.question_id=q.id) has_solution,EXISTS(SELECT 1 FROM hints h WHERE h.question_id=q.id) has_hints,(SELECT url FROM assets a WHERE a.question_id=q.id AND a.kind='original_pdf' LIMIT 1) original_pdf` +
        join +
        where +
        ' ORDER BY q.updated_at DESC,q.id LIMIT ? OFFSET ?',
      ...params,
      limit,
      (page - 1) * limit,
    );
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
  async counts(course?: string, publicOnly = false) {
    const clauses: string[] = [];
    if (publicOnly) clauses.push(publishedCurriculumSql('cv'));
    if (course) clauses.push('s.course_id=?');
    const rows = await this.all(
      'SELECT s.id semester_id,c.id chapter_id,t.id topic_id,q.difficulty_id,count(q.id) count FROM semesters s JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id LEFT JOIN chapters c ON c.semester_id=s.id LEFT JOIN topics t ON t.chapter_id=c.id LEFT JOIN questions q ON q.topic_id=t.id' +
        (publicOnly ? ' AND ' + publicQuestionSql : '') +
        (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') +
        ' GROUP BY s.id,c.id,t.id,q.difficulty_id',
      ...(course ? [course] : []),
    );
    return rows;
  }
  async close() {
    await this.db.close();
  }
}
