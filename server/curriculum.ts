import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BankError, type Bank } from './database.js';
import {
  curriculumImportSchema,
  curriculumVersionSchema,
  taxonomyEditSchema,
  type Classification,
  type CurriculumDocument,
  type CurriculumImpact,
  type CurriculumPlan,
  type CurriculumVersion,
  type EditableKind,
} from '../shared/curriculum.js';
import type { QuestionDocument, Taxon, Taxonomy } from '../shared/schema.js';

export const editableKinds = ['semesters', 'chapters', 'topics', 'subtopics'] as const;
const parents = {
  semesters: 'course_id',
  chapters: 'semester_id',
  topics: 'chapter_id',
  subtopics: 'topic_id',
};
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const slug = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, value]) => [k, canonical(value)]),
        )
      : v;
const hash = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BankError(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  return result.data;
}

/** Adds curriculum administration to the existing Bank; question documents stay schema v1. */
export class CurriculumService {
  constructor(private bank: Bank) {}
  versions(): CurriculumVersion[] {
    return this.bank.all('SELECT * FROM curriculum_versions ORDER BY sort_order,name').map((r) => ({
      id: String(r.id),
      courseId: String(r.course_id),
      code: String(r.code),
      name: String(r.name),
      effectiveFrom: r.effective_from as string | null,
      effectiveTo: r.effective_to as string | null,
      status: r.status as CurriculumVersion['status'],
      order: Number(r.sort_order),
      revision: Number(r.revision),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  }
  private state() {
    return {
      taxonomy: this.bank.taxonomy(),
      questions: this.bank.all(
        'SELECT id,active_version,topic_id,subtopic_id FROM questions ORDER BY id',
      ),
      history: this.bank.all(
        'SELECT question_id,version_number FROM question_version_classifications ORDER BY question_id,version_number',
      ),
      candidates: this.bank.all(
        "SELECT id,status,snapshot FROM revision_candidates WHERE status='pending' ORDER BY id",
      ),
    };
  }
  private versionOf(kind: EditableKind, id: string): string {
    const joins = {
      semesters: 'FROM semesters s',
      chapters: 'FROM chapters c JOIN semesters s ON s.id=c.semester_id',
      topics:
        'FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id',
      subtopics:
        'FROM subtopics st JOIN topics t ON t.id=st.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id',
    };
    const alias = { semesters: 's', chapters: 'c', topics: 't', subtopics: 'st' }[kind];
    const row = this.bank.one(
      `SELECT s.curriculum_version_id ${joins[kind]} WHERE ${alias}.id=?`,
      id,
    );
    if (!row) throw new BankError('Curriculum record not found', 404);
    return String(row.curriculum_version_id);
  }
  assertWritableParent(kind: EditableKind, id: string) {
    const tax = this.bank.taxonomy();
    let row = tax[kind].find((t) => t.id === id);
    if (!row) throw new BankError('Unknown curriculum parent');
    for (let i = editableKinds.indexOf(kind); i >= 0; i--) {
      if (row?.status === 'retired')
        throw new BankError(
          'Restore the retired parent hierarchy before adding or moving child records.',
          409,
        );
      if (i > 0) row = tax[editableKinds[i - 1]].find((t) => t.id === row?.parentId);
    }
    if (this.versions().find((v) => v.id === row?.curriculumVersionId)?.status === 'retired')
      throw new BankError(
        'Restore or create a curriculum version before adding or moving records.',
        409,
      );
  }
  classification(
    doc: QuestionDocument,
    provenance: Classification['provenance'] = 'captured',
  ): Classification {
    const row = this.bank.one(
      'SELECT co.id course_id,co.name course_name,co.slug course_slug,cv.id cv_id,cv.name cv_name,cv.code cv_code,s.id semester_id,s.name semester_name,s.slug semester_slug,c.id chapter_id,c.name chapter_name,c.slug chapter_slug,t.id topic_id,t.name topic_name,t.slug topic_slug,st.id subtopic_id,st.name subtopic_name,st.slug subtopic_slug FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN courses co ON co.id=s.course_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id LEFT JOIN subtopics st ON st.id=? AND st.topic_id=t.id WHERE t.id=?',
      doc.question.subtopicId,
      doc.question.topicId,
    );
    if (!row) throw new BankError('Incomplete question classification');
    const entity = (prefix: string) => ({
      id: String(row[prefix + '_id']),
      name: String(row[prefix + '_name']),
      slug: String(row[prefix + '_slug']),
    });
    return {
      course: entity('course'),
      curriculumVersion: {
        id: String(row.cv_id),
        name: String(row.cv_name),
        code: String(row.cv_code),
      },
      semester: entity('semester'),
      chapter: entity('chapter'),
      topic: entity('topic'),
      subtopic: row.subtopic_id ? entity('subtopic') : null,
      provenance,
    };
  }
  impact(kind: EditableKind | 'curriculumVersions', id: string): CurriculumImpact {
    const tax = this.bank.taxonomy();
    const record =
      kind === 'curriculumVersions'
        ? this.versions().find((v) => v.id === id)
        : tax[kind].find((t) => t.id === id);
    if (!record) throw new BankError('Curriculum record not found', 404);
    const versionId = kind === 'curriculumVersions' ? id : this.versionOf(kind, id);
    const relevant = (d: QuestionDocument) => {
      const path = this.classification(d);
      return kind === 'curriculumVersions'
        ? path.curriculumVersion.id === id
        : path[kind.slice(0, -1) as 'semester' | 'chapter' | 'topic' | 'subtopic']?.id === id;
    };
    const current = this.bank
      .all('SELECT id,active_version FROM questions')
      .filter((q) => relevant(this.bank.document(String(q.id))));
    const key = kind === 'curriculumVersions' ? 'curriculumVersion' : kind.slice(0, -1);
    const history = this.bank
      .all('SELECT question_id,snapshot FROM question_version_classifications')
      .filter((r) => JSON.parse(String(r.snapshot))[key]?.id === id);
    const candidates = this.bank
      .all("SELECT snapshot FROM revision_candidates WHERE status='pending'")
      .filter((r) => relevant(JSON.parse(String(r.snapshot))));
    const descendants = editableKinds.reduce(
      (count, k) =>
        count +
        tax[k].filter((t) =>
          kind === 'curriculumVersions'
            ? this.versionOf(k, t.id) === id
            : editableKinds.indexOf(k) > editableKinds.indexOf(kind) &&
              this.isDescendant(k, t.id, kind, id, tax),
        ).length,
      0,
    );
    const previous =
      kind === 'curriculumVersions'
        ? this.versions().find(
            (v) =>
              v.id !== id &&
              v.courseId === (record as CurriculumVersion).courseId &&
              v.status === 'active',
          )
        : undefined;
    return {
      id,
      kind,
      currentQuestions: current.length,
      historicalQuestions: new Set(history.map((r) => r.question_id)).size,
      pendingRevisions: candidates.length,
      descendants,
      revision: record.revision ?? 1,
      versionId,
      ...(previous
        ? {
            previousActive: {
              id: previous.id,
              name: previous.name,
              currentQuestions: this.bank.list({ curriculum: previous.id, limit: '1' }).total,
            },
          }
        : {}),
      token: hash({ kind, id, state: this.state() }),
    };
  }
  private isDescendant(
    kind: EditableKind,
    id: string,
    ancestor: EditableKind,
    ancestorId: string,
    tax: Taxonomy,
  ) {
    let row = tax[kind].find((t) => t.id === id);
    for (let i = editableKinds.indexOf(kind); i > editableKinds.indexOf(ancestor); i--)
      row = tax[editableKinds[i - 1]].find((t) => t.id === row?.parentId);
    return row?.id === ancestorId;
  }
  private confirm(impact: CurriculumImpact, revision: number, token: string, confirmed: boolean) {
    if (impact.revision !== revision || impact.token !== token)
      throw new BankError('Curriculum or its references changed. Reload the impact preview.', 409);
    if (
      (impact.currentQuestions || impact.historicalQuestions || impact.pendingRevisions) &&
      !confirmed
    )
      throw new BankError(
        'Confirm the displayed impact on linked questions before applying this change.',
        409,
      );
  }
  private event(
    kind: string,
    id: string,
    before: unknown,
    after: unknown,
    note: string,
    author: string | null,
  ) {
    this.bank.run(
      'INSERT INTO curriculum_events VALUES(?,?,?,?,?,?,?,?)',
      randomUUID(),
      kind,
      id,
      before === null ? null : JSON.stringify(before),
      JSON.stringify(after),
      note,
      author,
      new Date().toISOString(),
    );
  }
  edit(kind: EditableKind, id: string, input: unknown) {
    const edit = parse(taxonomyEditSchema, input);
    this.bank.requireNote(edit.note);
    this.bank.requireAuthor(edit.author ?? null);
    return this.bank.transaction(() => {
      const impact = this.impact(kind, id);
      this.confirm(impact, edit.expectedRevision, edit.impactToken, edit.confirmImpact);
      const before = this.bank.taxonomy()[kind].find((t) => t.id === id)!;
      const next = {
        ...before,
        name: edit.name?.trim().replace(/\s+/g, ' ') ?? before.name,
        order: edit.order ?? before.order,
        status: edit.status ?? before.status,
        parentId: edit.parentId ?? before.parentId,
      };
      if (next.parentId !== before.parentId) {
        if (kind === 'semesters')
          throw new BankError(
            'Create a new curriculum version to change semester membership.',
            409,
          );
        if (impact.currentQuestions || impact.historicalQuestions || impact.pendingRevisions)
          throw new BankError(
            'This subtree is referenced by question history or pending revisions. Create a new curriculum version instead of moving it.',
            409,
          );
        const parentKind = editableKinds[editableKinds.indexOf(kind) - 1];
        if (this.versionOf(parentKind, next.parentId!) !== impact.versionId)
          throw new BankError(
            'Moves must stay within one curriculum version; clone or import a new version for syllabus changes.',
            409,
          );
        this.assertWritableParent(parentKind, next.parentId!);
      }
      const siblings = this.bank.taxonomy()[kind];
      if (
        siblings.some(
          (t) =>
            t.id !== id &&
            t.parentId === next.parentId &&
            (kind !== 'semesters' || t.curriculumVersionId === before.curriculumVersionId) &&
            normalize(t.name) === normalize(next.name),
        )
      )
        throw new BankError('This name already exists under the selected parent.', 409);
      if (
        next.name === before.name &&
        next.order === before.order &&
        next.status === before.status &&
        next.parentId === before.parentId
      )
        throw new BankError('No curriculum changes to save');
      try {
        this.bank.run(
          `UPDATE ${kind} SET name=?,sort_order=?,status=?,${parents[kind]}=?,revision=revision+1 WHERE id=?`,
          next.name,
          next.order,
          next.status!,
          next.parentId,
          id,
        );
      } catch (error) {
        throw new BankError(`Curriculum update rejected: ${(error as Error).message}`, 409);
      }
      this.event(
        kind,
        id,
        before,
        { ...next, revision: impact.revision + 1 },
        edit.note,
        edit.author ?? null,
      );
      this.bank.refreshSearch();
      return { id, impact };
    });
  }
  createVersion(input: unknown, note: string, author: string | null = null) {
    const value = parse(curriculumVersionSchema, input);
    if (value.status !== 'draft')
      throw new BankError(
        'Create new curriculum versions as draft, then review and activate them.',
      );
    if (value.cloneFromId) {
      const source = this.export(value.cloneFromId);
      if (source.course.id !== value.courseId)
        throw new BankError('Clone source must belong to the same course');
      const { courseId, cloneFromId, ...version } = value;
      void cloneFromId;
      const doc: CurriculumDocument = {
        ...source,
        curriculumVersion: { ...version, id: value.id ?? randomUUID() },
        course: { ...source.course, id: courseId },
      };
      for (const s of doc.semesters) {
        s.id = randomUUID();
        s.slug = `${slug(value.code)}-${slug(s.name).slice(0, 100)}-${s.id.slice(0, 8)}`;
        for (const c of s.chapters) {
          c.id = randomUUID();
          for (const t of c.topics) {
            t.id = randomUUID();
            for (const st of t.subtopics) st.id = randomUUID();
          }
        }
      }
      const plan = this.plan(doc);
      return this.import(plan.document, plan.token, note, author);
    }
    const course = this.bank.taxonomy().courses.find((c) => c.id === value.courseId);
    if (!course) throw new BankError('Unknown course');
    const { courseId, cloneFromId, ...version } = value;
    void courseId;
    void cloneFromId;
    const plan = this.plan({
      schemaVersion: 1,
      course: { id: course.id, name: course.name, slug: course.slug },
      curriculumVersion: version,
      semesters: [],
    });
    return this.import(plan.document, plan.token, note, author);
  }
  editVersion(id: string, input: unknown) {
    const schema = z
      .object({
        name: z.string().min(1).max(200),
        effectiveFrom: z.iso.date().nullable(),
        effectiveTo: z.iso.date().nullable(),
        status: z.enum(['draft', 'active', 'retired']),
        order: z.number().int().nonnegative(),
        expectedRevision: z.number().int().positive(),
        impactToken: z.string(),
        confirmImpact: z.boolean(),
        note: z.string(),
        author: z.string().max(200).optional(),
      })
      .strict();
    const edit = parse(schema, input);
    this.bank.requireNote(edit.note);
    if (
      !edit.name.trim() ||
      (edit.effectiveFrom && edit.effectiveTo && edit.effectiveFrom > edit.effectiveTo)
    )
      throw new BankError('Invalid name or effective dates');
    return this.bank.transaction(() => {
      const before = this.versions().find((v) => v.id === id);
      if (!before) throw new BankError('Curriculum version not found', 404);
      this.confirm(
        this.impact('curriculumVersions', id),
        edit.expectedRevision,
        edit.impactToken,
        edit.confirmImpact,
      );
      if (before.status === 'active' && edit.status === 'draft')
        throw new BankError('Retire an active version; draft is reserved for preparation.');
      const now = new Date().toISOString();
      if (edit.status === 'active' && before.status !== 'active') {
        const previous = this.versions().find(
          (v) => v.courseId === before.courseId && v.status === 'active',
        );
        if (previous) {
          // Activation changes the default view for the entire course, even when the new version is empty.
          if (!edit.confirmImpact)
            throw new BankError(
              'Confirm that activation retires the previous active curriculum and changes default browsing.',
              409,
            );
          this.bank.run(
            "UPDATE curriculum_versions SET status='retired',revision=revision+1,updated_at=? WHERE id=?",
            now,
            previous.id,
          );
          this.event(
            'curriculumVersions',
            previous.id,
            previous,
            { ...previous, status: 'retired' },
            edit.note,
            edit.author ?? null,
          );
        }
      }
      this.bank.run(
        'UPDATE curriculum_versions SET name=?,effective_from=?,effective_to=?,status=?,sort_order=?,revision=revision+1,updated_at=? WHERE id=?',
        edit.name.trim(),
        edit.effectiveFrom,
        edit.effectiveTo,
        edit.status,
        edit.order,
        now,
        id,
      );
      this.event('curriculumVersions', id, before, edit, edit.note, edit.author ?? null);
      return { id };
    });
  }
  export(id: string): CurriculumDocument {
    const tax = this.bank.taxonomy(),
      v = this.versions().find((v) => v.id === id);
    if (!v) throw new BankError('Curriculum version not found', 404);
    const course = tax.courses.find((c) => c.id === v.courseId)!;
    const node = (t: Taxon) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      order: t.order,
      status: t.status ?? 'active',
      isTest: t.isTest,
    });
    return {
      schemaVersion: 1,
      course: { id: course.id, slug: course.slug, name: course.name },
      curriculumVersion: {
        id: v.id,
        code: v.code,
        name: v.name,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: v.effectiveTo,
        status: v.status,
        order: v.order,
      },
      semesters: tax.semesters
        .filter((s) => s.curriculumVersionId === id)
        .map((s) => ({
          ...node(s),
          chapters: tax.chapters
            .filter((c) => c.parentId === s.id)
            .map((c) => ({
              ...node(c),
              topics: tax.topics
                .filter((t) => t.parentId === c.id)
                .map((t) => ({
                  ...node(t),
                  subtopics: tax.subtopics.filter((st) => st.parentId === t.id).map(node),
                })),
            })),
        })),
    };
  }
  plan(input: unknown): CurriculumPlan {
    const doc = parse(curriculumImportSchema, input),
      tax = this.bank.taxonomy();
    const course = tax.courses.find(
      (c) => c.id === doc.course.id || (!doc.course.id && c.slug === doc.course.slug),
    );
    if (
      !course ||
      (doc.course.slug && doc.course.slug !== course.slug) ||
      normalize(doc.course.name) !== normalize(course.name)
    )
      throw new BankError(
        'Course ID/slug/name must identify one existing course. Add the course first.',
      );
    doc.course = { id: course.id, slug: course.slug, name: course.name };
    if (
      this.versions().some((v) => v.courseId === course.id && v.code === doc.curriculumVersion.code)
    )
      throw new BankError(
        'Curriculum code already exists for this course. Imports create a new version; they never overwrite it.',
        409,
      );
    if (doc.curriculumVersion.status !== 'draft')
      throw new BankError(
        'Import a new curriculum as draft. Review its hierarchy before activation.',
      );
    const seenIds = new Set<string>(),
      counts = { semesters: 0, chapters: 0, topics: 0, subtopics: 0 };
    const takeId = (value: string | undefined) => {
      const valueId = value ?? randomUUID();
      if (
        seenIds.has(valueId) ||
        this.versions().some((v) => v.id === valueId) ||
        editableKinds.some((k) => tax[k].some((t) => t.id === valueId))
      )
        throw new BankError(`Duplicate or existing curriculum ID: ${valueId}`, 409);
      seenIds.add(valueId);
      return valueId;
    };
    doc.curriculumVersion.id = takeId(doc.curriculumVersion.id);
    type Node =
      | CurriculumDocument['semesters'][number]
      | CurriculumDocument['semesters'][number]['chapters'][number]
      | CurriculumDocument['semesters'][number]['chapters'][number]['topics'][number]
      | CurriculumDocument['semesters'][number]['chapters'][number]['topics'][number]['subtopics'][number];
    const nodes = (items: Node[], kind: EditableKind) => {
      const names = new Set<string>(),
        slugs = new Set<string>();
      for (const item of items) {
        item.id = takeId(item.id);
        item.name = item.name.trim().replace(/\s+/g, ' ');
        item.slug ??= (
          (kind === 'semesters' ? slug(doc.curriculumVersion.code) + '-' : '') + slug(item.name)
        ).slice(0, 200);
        if (!item.slug || names.has(normalize(item.name)) || slugs.has(item.slug))
          throw new BankError(`Duplicate or invalid ${kind} name/slug: ${item.name}`, 409);
        if (
          kind === 'semesters' &&
          tax.semesters.some((s) => s.parentId === course.id && s.slug === item.slug)
        )
          throw new BankError(
            `Semester slug already exists for this course: ${item.slug}. Use a version-specific slug.`,
            409,
          );
        names.add(normalize(item.name));
        slugs.add(item.slug);
        counts[kind]++;
        if ('chapters' in item) nodes(item.chapters, 'chapters');
        if ('topics' in item) nodes(item.topics, 'topics');
        if ('subtopics' in item) nodes(item.subtopics, 'subtopics');
      }
    };
    nodes(doc.semesters, 'semesters');
    if (Object.values(counts).reduce((a, b) => a + b, 0) > 10000)
      throw new BankError('Curriculum import is limited to 10000 records');
    return {
      document: doc,
      token: hash({ doc, state: this.state() }),
      counts,
      warnings: [
        'Creates a new draft curriculum. Existing questions and taxonomy remain unchanged.',
        ...(doc.semesters.length === 0 ? ['This curriculum has no semesters yet.'] : []),
        ...(doc.semesters.some((s) => s.isTest)
          ? ['Contains explicitly labelled test taxonomy.']
          : []),
      ],
    };
  }
  import(input: unknown, token: string, note: string, author: string | null = null) {
    this.bank.requireNote(note);
    this.bank.requireAuthor(author);
    return this.bank.transaction(() => {
      const plan = this.plan(input);
      if (plan.token !== token)
        throw new BankError(
          'Curriculum import preview is stale. Validate the original JSON again.',
          409,
        );
      const doc = plan.document,
        v = doc.curriculumVersion,
        now = new Date().toISOString();
      this.bank.run(
        'INSERT INTO curriculum_versions VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        v.id!,
        doc.course.id!,
        v.code,
        v.name,
        v.effectiveFrom,
        v.effectiveTo,
        'draft',
        v.order,
        1,
        now,
        now,
      );
      for (const s of doc.semesters) {
        this.bank.run(
          'INSERT INTO semesters(id,course_id,curriculum_version_id,name,slug,sort_order,is_test,status) VALUES(?,?,?,?,?,?,?,?)',
          s.id!,
          doc.course.id!,
          v.id!,
          s.name,
          s.slug!,
          s.order,
          Number(s.isTest),
          s.status,
        );
        for (const c of s.chapters) {
          this.bank.run(
            'INSERT INTO chapters(id,semester_id,name,slug,sort_order,is_test,status) VALUES(?,?,?,?,?,?,?)',
            c.id!,
            s.id!,
            c.name,
            c.slug!,
            c.order,
            Number(c.isTest),
            c.status,
          );
          for (const t of c.topics) {
            this.bank.run(
              'INSERT INTO topics(id,chapter_id,name,slug,sort_order,is_test,status) VALUES(?,?,?,?,?,?,?)',
              t.id!,
              c.id!,
              t.name,
              t.slug!,
              t.order,
              Number(t.isTest),
              t.status,
            );
            for (const st of t.subtopics)
              this.bank.run(
                'INSERT INTO subtopics(id,topic_id,name,slug,sort_order,is_test,status) VALUES(?,?,?,?,?,?,?)',
                st.id!,
                t.id!,
                st.name,
                st.slug!,
                st.order,
                Number(st.isTest),
                st.status,
              );
          }
        }
      }
      this.event('curriculumVersions', v.id!, null, doc, note, author);
      return { id: v.id!, counts: plan.counts };
    });
  }
}
