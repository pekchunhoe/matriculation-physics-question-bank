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
import type { Taxon, Taxonomy } from '../shared/schema.js';

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

/** Preserved curriculum administration, including legacy and image-record references. */
export class CurriculumService {
  constructor(private bank: Bank) {}
  async versions(): Promise<CurriculumVersion[]> {
    return (await this.bank.all('SELECT * FROM curriculum_versions ORDER BY sort_order,name')).map(
      (r) => ({
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
      }),
    );
  }
  private async state() {
    return {
      taxonomy: await this.bank.taxonomy(),
      questions: await this.bank.all(
        'SELECT id,active_version,topic_id,subtopic_id FROM questions ORDER BY id',
      ),
      images: await this.bank.all(
        'SELECT id,revision,topic_id,subtopic_id FROM image_questions ORDER BY id',
      ),
      imageHistory: await this.bank.all(
        'SELECT question_id,revision,classification FROM image_question_versions ORDER BY question_id,revision',
      ),
      history: await this.bank.all(
        'SELECT question_id,version_number FROM question_version_classifications ORDER BY question_id,version_number',
      ),
      candidates: await this.bank.all(
        "SELECT id,status,snapshot FROM revision_candidates WHERE status='pending' ORDER BY id",
      ),
    };
  }
  private async versionOf(kind: EditableKind, id: string): Promise<string> {
    const joins = {
      semesters: 'FROM semesters s',
      chapters: 'FROM chapters c JOIN semesters s ON s.id=c.semester_id',
      topics:
        'FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id',
      subtopics:
        'FROM subtopics st JOIN topics t ON t.id=st.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id',
    };
    const alias = { semesters: 's', chapters: 'c', topics: 't', subtopics: 'st' }[kind];
    const row = await this.bank.one(
      `SELECT s.curriculum_version_id ${joins[kind]} WHERE ${alias}.id=?`,
      id,
    );
    if (!row) throw new BankError('Curriculum record not found', 404);
    return String(row.curriculum_version_id);
  }
  async assertWritableParent(kind: EditableKind, id: string) {
    const tax = await this.bank.taxonomy();
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
    if (
      (await this.versions()).find((v) => v.id === row?.curriculumVersionId)?.status === 'retired'
    )
      throw new BankError(
        'Restore or create a curriculum version before adding or moving records.',
        409,
      );
  }
  async classification(
    doc: { question: { topicId: string; subtopicId: string | null } },
    provenance: Classification['provenance'] = 'captured',
  ): Promise<Classification> {
    const row = await this.bank.one(
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
  async impact(kind: EditableKind | 'curriculumVersions', id: string): Promise<CurriculumImpact> {
    const tax = await this.bank.taxonomy();
    const record =
      kind === 'curriculumVersions'
        ? (await this.versions()).find((v) => v.id === id)
        : tax[kind].find((t) => t.id === id);
    if (!record) throw new BankError('Curriculum record not found', 404);
    const versionId = kind === 'curriculumVersions' ? id : await this.versionOf(kind, id);
    const relevant = async (d: { question: { topicId: string; subtopicId: string | null } }) => {
      const path = await this.classification(d);
      return kind === 'curriculumVersions'
        ? path.curriculumVersion.id === id
        : path[kind.slice(0, -1) as 'semester' | 'chapter' | 'topic' | 'subtopic']?.id === id;
    };
    let currentQuestions = 0;
    for (const q of await this.bank.all(
      'SELECT id,topic_id,subtopic_id FROM questions WHERE id NOT IN (SELECT id FROM image_questions) UNION ALL SELECT id,topic_id,subtopic_id FROM image_questions',
    ))
      if (
        await relevant({
          question: {
            topicId: String(q.topic_id),
            subtopicId: q.subtopic_id ? String(q.subtopic_id) : null,
          },
        })
      )
        currentQuestions++;
    const key = kind === 'curriculumVersions' ? 'curriculumVersion' : kind.slice(0, -1);
    const history = (
      await this.bank.all(
        'SELECT question_id,snapshot FROM question_version_classifications UNION ALL SELECT question_id,classification AS snapshot FROM image_question_versions',
      )
    ).filter((r) => JSON.parse(String(r.snapshot))[key]?.id === id);
    let pendingRevisions = 0;
    for (const r of await this.bank.all(
      "SELECT snapshot FROM revision_candidates WHERE status='pending'",
    ))
      if (await relevant(JSON.parse(String(r.snapshot)))) pendingRevisions++;
    let descendants = 0;
    for (const k of editableKinds)
      for (const t of tax[k])
        if (
          kind === 'curriculumVersions'
            ? (await this.versionOf(k, t.id)) === id
            : editableKinds.indexOf(k) > editableKinds.indexOf(kind) &&
              this.isDescendant(k, t.id, kind, id, tax)
        )
          descendants++;
    const previous =
      kind === 'curriculumVersions'
        ? (await this.versions()).find(
            (v) =>
              v.id !== id &&
              v.courseId === (record as CurriculumVersion).courseId &&
              v.status === 'active',
          )
        : undefined;
    return {
      id,
      kind,
      currentQuestions,
      historicalQuestions: new Set(history.map((r) => r.question_id)).size,
      pendingRevisions,
      descendants,
      revision: record.revision ?? 1,
      versionId,
      ...(previous
        ? {
            previousActive: {
              id: previous.id,
              name: previous.name,
              currentQuestions: Number(
                (await this.bank.one(
                  'SELECT COUNT(*) n FROM (SELECT id,topic_id FROM questions WHERE id NOT IN (SELECT id FROM image_questions) UNION ALL SELECT id,topic_id FROM image_questions) q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id WHERE s.curriculum_version_id=?',
                  previous.id,
                ))!.n,
              ),
            },
          }
        : {}),
      token: hash({ kind, id, state: await this.state() }),
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
  private async event(
    kind: string,
    id: string,
    before: unknown,
    after: unknown,
    note: string,
    author: string | null,
  ) {
    await this.bank.run(
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
  async edit(kind: EditableKind, id: string, input: unknown) {
    const edit = parse(taxonomyEditSchema, input);
    this.bank.requireNote(edit.note);
    this.bank.requireAuthor(edit.author ?? null);
    return await this.bank.transaction(async () => {
      const impact = await this.impact(kind, id);
      this.confirm(impact, edit.expectedRevision, edit.impactToken, edit.confirmImpact);
      const before = (await this.bank.taxonomy())[kind].find((t) => t.id === id)!;
      const next = {
        ...before,
        name: edit.name?.trim().replace(/\s+/g, ' ') ?? before.name,
        order: edit.order ?? before.order,
        status: edit.status ?? before.status,
        parentId: edit.parentId ?? before.parentId,
      };
      if (kind === 'semesters' && !['Semester 1', 'Semester 2'].includes(next.name))
        throw new BankError('Use the permanent semester names Semester 1 or Semester 2');
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
        if ((await this.versionOf(parentKind, next.parentId!)) !== impact.versionId)
          throw new BankError(
            'Moves must stay within one curriculum version; clone or import a new version for syllabus changes.',
            409,
          );
        await this.assertWritableParent(parentKind, next.parentId!);
      }
      const siblings = (await this.bank.taxonomy())[kind];
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
        await this.bank.run(
          `UPDATE ${kind} SET name=?,sort_order=?,status=?,${parents[kind]}=?,revision=revision+1 WHERE id=?`,
          next.name,
          next.order,
          next.status!,
          next.parentId,
          id,
        );
      } catch {
        throw new BankError(
          'Curriculum update rejected by a relationship or uniqueness constraint',
          409,
        );
      }
      await this.event(
        kind,
        id,
        before,
        { ...next, revision: impact.revision + 1 },
        edit.note,
        edit.author ?? null,
      );
      return { id, impact };
    });
  }
  async createVersion(input: unknown, note: string, author: string | null = null) {
    const value = parse(curriculumVersionSchema, input);
    if (value.status !== 'draft')
      throw new BankError(
        'Create new curriculum versions as draft, then review and activate them.',
      );
    if (value.cloneFromId) {
      const source = await this.export(value.cloneFromId);
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
      const plan = await this.plan(doc);
      return await this.import(plan.document, plan.token, note, author);
    }
    const course = (await this.bank.taxonomy()).courses.find((c) => c.id === value.courseId);
    if (!course) throw new BankError('Unknown course');
    const { courseId, cloneFromId, ...version } = value;
    void courseId;
    void cloneFromId;
    const plan = await this.plan({
      schemaVersion: 1,
      course: { id: course.id, name: course.name, slug: course.slug },
      curriculumVersion: version,
      semesters: [],
    });
    return await this.import(plan.document, plan.token, note, author);
  }
  async editVersion(id: string, input: unknown) {
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
    return await this.bank.transaction(async () => {
      const before = (await this.versions()).find((v) => v.id === id);
      if (!before) throw new BankError('Curriculum version not found', 404);
      this.confirm(
        await this.impact('curriculumVersions', id),
        edit.expectedRevision,
        edit.impactToken,
        edit.confirmImpact,
      );
      if (before.status === 'active' && edit.status === 'draft')
        throw new BankError('Retire an active version; draft is reserved for preparation.');
      const now = new Date().toISOString();
      if (edit.status === 'active' && before.status !== 'active') {
        const previous = (await this.versions()).find(
          (v) => v.courseId === before.courseId && v.status === 'active',
        );
        if (previous) {
          // Activation changes the default view for the entire course, even when the new version is empty.
          if (!edit.confirmImpact)
            throw new BankError(
              'Confirm that activation retires the previous active curriculum and changes default browsing.',
              409,
            );
          await this.bank.run(
            "UPDATE curriculum_versions SET status='retired',revision=revision+1,updated_at=? WHERE id=?",
            now,
            previous.id,
          );
          await this.event(
            'curriculumVersions',
            previous.id,
            previous,
            { ...previous, status: 'retired' },
            edit.note,
            edit.author ?? null,
          );
        }
      }
      await this.bank.run(
        'UPDATE curriculum_versions SET name=?,effective_from=?,effective_to=?,status=?,sort_order=?,revision=revision+1,updated_at=? WHERE id=?',
        edit.name.trim(),
        edit.effectiveFrom,
        edit.effectiveTo,
        edit.status,
        edit.order,
        now,
        id,
      );
      await this.event('curriculumVersions', id, before, edit, edit.note, edit.author ?? null);
      return { id };
    });
  }
  async export(id: string): Promise<CurriculumDocument> {
    const tax = await this.bank.taxonomy(),
      v = (await this.versions()).find((v) => v.id === id);
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
  async plan(input: unknown): Promise<CurriculumPlan> {
    const doc = parse(curriculumImportSchema, input),
      tax = await this.bank.taxonomy();
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
      (await this.versions()).some(
        (v) => v.courseId === course.id && v.code === doc.curriculumVersion.code,
      )
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
        (tax.curriculumVersions ?? []).some((v) => v.id === valueId) ||
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
        if (kind === 'semesters' && !['Semester 1', 'Semester 2'].includes(item.name))
          throw new BankError('Use the permanent semester names Semester 1 or Semester 2');
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
      token: hash({ doc, state: await this.state() }),
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
  async import(input: unknown, token: string, note: string, author: string | null = null) {
    this.bank.requireNote(note);
    this.bank.requireAuthor(author);
    return await this.bank.transaction(async () => {
      const plan = await this.plan(input);
      if (plan.token !== token)
        throw new BankError(
          'Curriculum import preview is stale. Validate the original JSON again.',
          409,
        );
      const doc = plan.document,
        v = doc.curriculumVersion,
        now = new Date().toISOString();
      await this.bank.run(
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
        await this.bank.run(
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
          await this.bank.run(
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
            await this.bank.run(
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
              await this.bank.run(
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
      await this.event('curriculumVersions', v.id!, null, doc, note, author);
      return { id: v.id!, counts: plan.counts };
    });
  }
}
