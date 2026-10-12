import type { DatabaseAdapter, SQLInputValue } from './database-adapter.js';
import { randomUUID } from 'node:crypto';
import { CurriculumService } from './curriculum.js';
import type { Taxonomy } from '../shared/schema.js';
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
    if (kind === 'semesters' && !['Semester 1', 'Semester 2'].includes(name.trim()))
      throw new BankError('Use the permanent semester names Semester 1 or Semester 2');
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
  requireNote(note: string) {
    if (typeof note !== 'string' || !note.trim() || note.length > 2000)
      throw new BankError('A change note is required');
  }
  requireAuthor(author: string | null) {
    if (author !== null && (typeof author !== 'string' || author.length > 200))
      throw new BankError('Invalid author');
  }
  async legacyRecords(page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BankError('Invalid archive page');
    return this.all(
      'SELECT id,question_code,title,status,total_marks,topic_id,subtopic_id FROM questions WHERE id NOT IN (SELECT id FROM image_questions) ORDER BY created_at DESC,id LIMIT 100 OFFSET ?',
      (page - 1) * 100,
    );
  }
  async legacyRecord(id: string) {
    const row = await this.one('SELECT * FROM questions WHERE id=?', id);
    if (!row) throw new BankError('Legacy question not found', 404);
    return {
      record: row,
      versions: await this.all(
        'SELECT version_number,snapshot,change_note,created_at FROM question_versions WHERE question_id=? ORDER BY version_number',
        id,
      ),
    };
  }
  async close() {
    await this.db.close();
  }
}
