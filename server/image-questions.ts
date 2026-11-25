import { assignmentChangeInput, imageQuestionInput } from './image-question-input.js';
import { randomUUID } from 'node:crypto';
import {
  imageLimits,
  orderedQuestions,
  type ImageQuestion,
  type ImageAsset,
  type ImageQuestionInput,
  type QuestionStatus,
} from '../shared/image-question.js';
import { assetKeyFromReference } from '../shared/asset-reference.js';
import { Bank, BankError, type Filters } from './database.js';
import type { Row, SQLInputValue } from './database-adapter.js';
import { AssetStorageError, type AssetStorage, type StoredUpload } from './asset-storage.js';
import { validateImage, validateUpload } from './asset-validation.js';
import { VisibilityService } from './visibility.js';
import { parseQuestionPage, questionPagination, questionPageSize } from '../shared/pagination.js';
import {
  isUnassignedId,
  unassignedId,
  unassignedName,
  unassignedSlug,
  unassignedTopicSql,
} from './unassigned.js';

export type ImageFile = { buffer: Buffer; originalname: string; mimetype: string };
type QuestionMapping = Pick<
  ImageQuestionInput,
  'curriculumVersionId' | 'semesterId' | 'chapterId' | 'topicId' | 'subtopicId'
>;
const joins = `FROM image_questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id
 JOIN semesters s ON s.id=c.semester_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id
 LEFT JOIN subtopics st ON st.id=q.subtopic_id JOIN difficulty_levels d ON d.id=q.difficulty_id
 JOIN image_assets qi ON qi.key=q.question_image JOIN image_assets ai ON ai.key=q.answer_image`;
const approvedImageRevision = `EXISTS(
 SELECT 1 FROM image_question_versions v WHERE v.question_id=q.id AND v.revision=q.revision
 AND v.question_image=q.question_image AND v.answer_image=q.answer_image AND json_extract(v.snapshot,'$.status')='approved')`;
export const assignedImageQuestion = `NOT (${unassignedTopicSql})`;
export const publicImageQuestion = `${assignedImageQuestion} AND q.status='approved' AND cv.status IN ('active','retired') AND ${approvedImageRevision}`;
const activeSemesterSql = "s.status='active'";
const activeChapterSql = `${activeSemesterSql} AND c.status='active'`;
export const activeTopicSql = `${activeChapterSql} AND t.status='active'`;
const activeClassificationSql = `${activeTopicSql} AND (st.id IS NULL OR st.status='active')`;
const activeAcademicFilters: Record<string, string> = {
  semester: activeSemesterSql,
  chapter: activeChapterSql,
  topic: activeTopicSql,
  subtopic: activeClassificationSql,
};
const assetJson = (alias: string) =>
  `json_object('key',${alias}.key,'mime',${alias}.mime,'size',${alias}.size,'sha256',${alias}.sha256,'width',${alias}.width,'height',${alias}.height,'thumbnailKey',${alias}.thumbnail_key)`;
const fields = `q.*,c.id chapter_id,s.id semester_id,cv.id curriculum_version_id,
 s.name semester_name,c.name chapter_name,t.name topic_name,st.name subtopic_name,
 s.sort_order semester_order,c.sort_order chapter_order,t.sort_order topic_order,st.sort_order subtopic_order,
 NOT (${activeClassificationSql}) retired_classification,
 ${assetJson('qi')} qi_json,${assetJson('ai')} ai_json`;
function asset(value: unknown): ImageAsset {
  const a = JSON.parse(String(value));
  return {
    key: a.key,
    url: '/uploads/' + a.key,
    mime: a.mime,
    size: a.size,
    sha256: a.sha256,
    width: a.width,
    height: a.height,
    ...(a.thumbnailKey ? { thumbnailUrl: '/uploads/' + a.thumbnailKey } : {}),
  };
}
function record(row: Row, answers: boolean): ImageQuestion {
  const unassigned = isUnassignedId(String(row.topic_id));
  return {
    id: String(row.id),
    legacyId: row.legacy_id as string | null,
    revision: Number(row.revision),
    status: row.status as QuestionStatus,
    curriculumVersionId: String(row.curriculum_version_id),
    semesterId: String(row.semester_id),
    chapterId: String(row.chapter_id),
    topicId: String(row.topic_id),
    subtopicId: row.subtopic_id === null ? null : String(row.subtopic_id),
    difficultyId: String(row.difficulty_id),
    totalMarks: Number(row.total_marks),
    questionImage: asset(row.qi_json),
    ...(answers ? { answerImage: asset(row.ai_json) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(unassigned ? { unassigned: true as const } : {}),
    ...(!unassigned && row.retired_classification
      ? {
          retiredClassification: {
            chapter: String(row.chapter_name),
            topic: String(row.topic_name),
            subtopic: row.subtopic_name as string | null,
            order: [
              Number(row.semester_order),
              Number(row.chapter_order),
              Number(row.topic_order),
              Number(row.subtopic_id !== null),
              Number(row.subtopic_order),
            ],
          },
        }
      : {}),
  };
}
export class ImageQuestionService {
  constructor(
    private bank: Bank,
    private storage?: AssetStorage,
  ) {}
  async get(id: string, admin = false, answers = false) {
    const row = await this.bank.one(
      `SELECT ${fields} ${joins} WHERE q.id=?${admin ? '' : ' AND ' + publicImageQuestion}`,
      id,
    );
    if (!row) throw new BankError('Question not found', 404);
    return record(row, admin || answers);
  }
  private async mapping(input: QuestionMapping, current?: ImageQuestion) {
    if (isUnassignedId(input.chapterId) || isUnassignedId(input.topicId))
      throw new BankError('Choose a topic outside Unassigned Questions');
    const row = await this.bank.one(
      `SELECT cv.id cv,s.id semester,c.id chapter,t.id topic,st.id subtopic,
      cv.status cv_status,s.status s_status,c.status c_status,t.status t_status,st.status st_status
      FROM topics t JOIN chapters c ON c.id=t.chapter_id
      JOIN semesters s ON s.id=c.semester_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id
      LEFT JOIN subtopics st ON st.topic_id=t.id AND st.id=? WHERE t.id=?`,
      input.subtopicId ?? null,
      input.topicId,
    );
    if (
      !row ||
      row.cv !== input.curriculumVersionId ||
      row.semester !== input.semesterId ||
      row.chapter !== input.chapterId ||
      row.topic !== input.topicId ||
      (input.subtopicId != null && row.subtopic !== input.subtopicId)
    )
      throw new BankError(
        'Select a valid syllabus → semester → chapter → topic hierarchy and an optional subtopic belonging to that topic',
      );
    const same =
      current &&
      current.subtopicId === (input.subtopicId ?? null) &&
      current.curriculumVersionId === input.curriculumVersionId &&
      current.semesterId === input.semesterId &&
      current.chapterId === input.chapterId &&
      current.topicId === input.topicId;
    if (
      !same &&
      [row.cv_status, row.s_status, row.c_status, row.t_status, row.st_status].includes('retired')
    )
      throw new BankError('Choose active curriculum records for a new classification');
  }
  private async validateDifficulty(difficultyId: string) {
    if (
      !(await this.bank.one(
        "SELECT id FROM difficulty_levels WHERE id=? AND slug IN ('easy','medium','hard')",
        difficultyId,
      ))
    )
      throw new BankError('Select EASY, MEDIUM or HARD');
  }
  async list(filters: Filters = {}, admin = false, unassigned = false) {
    if (unassigned && !admin) throw new BankError('Administrator access required', 403);
    const conditions = [
        unassigned ? unassignedTopicSql : admin ? assignedImageQuestion : publicImageQuestion,
      ],
      params: SQLInputValue[] = [];
    const exact: Record<string, string> = {
      curriculum: 'cv.id',
      semester: 's.id',
      chapter: 'c.id',
      topic: 't.id',
      subtopic: 'st.id',
      difficulty: 'q.difficulty_id',
      status: 'q.status',
    };
    for (const [key, column] of Object.entries(exact))
      if (filters[key]) {
        if (key === 'curriculum' && filters[key] === 'active')
          conditions.push("cv.status='active'");
        else {
          conditions.push(`${column}=?`);
          if (!unassigned && activeAcademicFilters[key])
            conditions.push(activeAcademicFilters[key]);
          params.push(filters[key]!);
        }
      }
    if (filters.q) {
      const q = '%' + filters.q.slice(0, 200) + '%';
      if (unassigned) {
        conditions.push(
          '(q.id LIKE ? OR EXISTS(SELECT 1 FROM questions legacy WHERE legacy.id=q.legacy_id AND legacy.question_code LIKE ?))',
        );
        params.push(q, q);
      } else {
        conditions.push('(q.id LIKE ? OR c.name LIKE ? OR t.name LIKE ? OR st.name LIKE ?)');
        params.push(q, q, q, q);
      }
    }
    const requested = parseQuestionPage(filters.page),
      requestedLimit =
        filters.limit === undefined ? questionPageSize : parseQuestionPage(filters.limit);
    if (requested === undefined || requestedLimit === undefined)
      throw new BankError('Invalid pagination');
    // Older callers may request a smaller limit; no listing can request more than ten.
    const limit = Math.min(questionPageSize, requestedLimit);
    const where = ' WHERE ' + conditions.join(' AND '),
      total = Number((await this.bank.one('SELECT COUNT(*) n ' + joins + where, ...params))!.n);
    const pagination = questionPagination(total, requested, limit);
    const source = unassigned
      ? `,(SELECT question_code FROM questions WHERE id=q.legacy_id) legacy_question_code,
        (SELECT source_pdf_url FROM revision_candidates WHERE question_id=q.legacy_id
          AND status='approved' AND source_pdf_url IS NOT NULL ORDER BY created_at DESC,id LIMIT 1) legacy_source_pdf`
      : '';
    const rows = await this.bank.all(
      `SELECT ${fields}${source} ${joins}${where} ORDER BY cv.sort_order,s.sort_order,c.sort_order,t.sort_order,(q.subtopic_id IS NOT NULL),st.sort_order,q.id LIMIT ? OFFSET ?`,
      ...params,
      limit,
      (pagination.page - 1) * limit,
    );
    return {
      items: rows.map((row) => ({
        ...record(row, unassigned),
        ...(unassigned
          ? {
              semesterName: String(row.semester_name),
              legacyQuestionCode: row.legacy_question_code as string | null,
              legacySourcePdf: row.legacy_source_pdf as string | null,
            }
          : {}),
      })),
      ...pagination,
    };
  }
  private async snapshot(id: string, actor: string, recordedAt?: string) {
    const q = await this.get(id, true),
      classification = await this.bank.curriculum.classification({
        question: { topicId: q.topicId, subtopicId: q.subtopicId },
      });
    await this.bank.run(
      'INSERT INTO image_question_versions VALUES(?,?,?,?,?,?,?,?)',
      id,
      q.revision,
      q.questionImage.key,
      q.answerImage!.key,
      JSON.stringify(q),
      JSON.stringify(classification),
      actor,
      recordedAt ?? q.updatedAt,
    );
    return q;
  }
  private async holdingTopic(semesterId: string) {
    const chapterId = unassignedId('chapter', semesterId),
      topicId = unassignedId('topic', semesterId);
    await this.bank.run(
      "INSERT INTO chapters(id,semester_id,name,slug,status) VALUES(?,?,?,?,'retired') ON CONFLICT DO NOTHING",
      chapterId,
      semesterId,
      unassignedName,
      unassignedSlug,
    );
    await this.bank.run(
      "INSERT INTO topics(id,chapter_id,name,slug,status) SELECT ?,id,?,?,'retired' FROM chapters WHERE id=? ON CONFLICT DO NOTHING",
      topicId,
      unassignedName,
      unassignedSlug,
      chapterId,
    );
    if (
      !(await this.bank.one(
        'SELECT 1 FROM topics t JOIN chapters c ON c.id=t.chapter_id WHERE t.id=? AND c.id=? AND c.semester_id=? AND t.slug=? AND c.slug=?',
        topicId,
        chapterId,
        semesterId,
        unassignedSlug,
        unassignedSlug,
      ))
    )
      throw new BankError(
        'The reserved holding area conflicts with an existing curriculum record',
        409,
      );
    return topicId;
  }
  async changeAssignment(id: string, raw: unknown, actor: string) {
    const parsed = assignmentChangeInput.safeParse(raw);
    if (!parsed.success)
      throw new BankError('Confirm the assignment change and select a valid destination');
    const { expectedRevision, mapping } = parsed.data;
    return this.bank.transaction(async () => {
      const current = await this.get(id, true);
      if (current.revision !== expectedRevision)
        throw new BankError('Question changed. Reload before changing its assignment.', 409);
      if (Boolean(current.unassigned) !== Boolean(mapping))
        throw new BankError('The question is already in the requested assignment state', 409);
      if (mapping) await this.mapping(mapping);
      const topicId = mapping?.topicId ?? (await this.holdingTopic(current.semesterId));
      return this.writeAssignment(current, topicId, mapping?.subtopicId ?? null, actor);
    });
  }
  // The curriculum edit owns the transaction and checks legacy and pending references first.
  async transferTopicQuestions(topicId: string, actor: string) {
    const assigned = await this.bank.all(
      'SELECT id FROM image_questions WHERE topic_id=?',
      topicId,
    );
    if (!assigned.length) return;
    const first = await this.get(String(assigned[0].id), true);
    const holding = await this.holdingTopic(first.semesterId);
    for (const { id } of assigned)
      await this.writeAssignment(await this.get(String(id), true), holding, null, actor);
  }
  private async writeAssignment(
    current: ImageQuestion,
    topicId: string,
    subtopicId: string | null,
    actor: string,
  ) {
    if (
      current.status === 'approved' &&
      !(await this.bank.one(
        `SELECT 1 FROM image_questions q WHERE q.id=? AND ${approvedImageRevision}`,
        current.id,
      ))
    )
      throw new BankError(`Question ${current.id} has no matching approval history`, 409);
    await this.bank.run(
      'UPDATE image_questions SET topic_id=?,subtopic_id=?,revision=revision+1 WHERE id=?',
      topicId,
      subtopicId,
      current.id,
    );
    return this.snapshot(current.id, actor, new Date().toISOString());
  }
  private async cleanup(uploads: StoredUpload[]) {
    for (const upload of uploads) {
      try {
        // Only receipts created by this save are considered. No old files or hash peers are deleted.
        const referenced = await this.bank.one(
          'SELECT 1 FROM image_assets WHERE key=? OR thumbnail_key=?',
          upload.key,
          upload.key,
        );
        if (!referenced) await this.storage!.delete(upload.key);
      } catch {
        console.error('Image upload requires reconciliation', upload.url);
      }
    }
  }
  async save(
    id: string | undefined,
    raw: unknown,
    files: { question?: ImageFile; answer?: ImageFile },
    actor: string,
  ) {
    if (!this.storage) throw new AssetStorageError('Image storage is not configured');
    const parsed = imageQuestionInput.safeParse(raw);
    if (!parsed.success)
      throw new BankError(
        parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('\n'),
      );
    const input = parsed.data,
      current = id ? await this.get(id, true) : undefined;
    if (current?.unassigned)
      throw new BankError('Reassign this question in Unassigned Questions before editing it', 409);
    if (current && input.expectedRevision !== current.revision)
      throw new BankError('Question changed. Reload before saving.', 409);
    if (!current && input.expectedRevision !== undefined)
      throw new BankError('Unexpected revision');
    if (current?.status === 'approved' && !input.confirmPublishedReplacement)
      throw new BankError('Confirm replacement of the published question', 409);
    if (current && input.legacyId)
      throw new BankError('Legacy conversion is only available for a new image record');
    if (!current && (!files.question || !files.answer))
      throw new BankError('Exactly one question image and one answer image are required');
    if (
      Object.values(files).reduce((n, f) => n + (f?.buffer.length ?? 0), 0) > imageLimits.totalBytes
    )
      throw new BankError('Combined images exceed 3 MiB', 413);
    if (input.legacyId) {
      if (!(await this.bank.one('SELECT id FROM questions WHERE id=?', input.legacyId)))
        throw new BankError('Legacy record not found', 404);
      if (await this.bank.one('SELECT id FROM image_questions WHERE id=?', input.legacyId))
        throw new BankError('Legacy record is already converted', 409);
    }
    await this.mapping(input, current);
    await this.validateDifficulty(input.difficultyId);
    // Validate both complete files before any upload.
    const q = files.question
      ? await validateImage(
          files.question.buffer,
          files.question.originalname,
          files.question.mimetype,
          true,
        )
      : undefined;
    const a = files.answer
      ? await validateImage(files.answer.buffer, files.answer.originalname, files.answer.mimetype)
      : undefined;
    const receipts: StoredUpload[] = [],
      pending: {
        value: Awaited<ReturnType<typeof validateImage>>;
        original: StoredUpload;
        thumbnail?: StoredUpload;
      }[] = [];
    const now = new Date().toISOString(),
      questionId = id ?? input.legacyId ?? randomUUID();
    try {
      const upload = async (value: typeof q) => {
        if (!value) return;
        const original = await this.storage!.put(value.upload);
        receipts.push(original);
        let thumbnail: StoredUpload | undefined;
        if (value.thumbnail) {
          thumbnail = await this.storage!.put(
            validateUpload(value.thumbnail, 'preview.webp', 'image/webp'),
          );
          receipts.push(thumbnail);
        }
        pending.push({ value, original, thumbnail });
        return original.key;
      };
      const questionKey = (await upload(q)) ?? current!.questionImage.key,
        answerKey = (await upload(a)) ?? current!.answerImage!.key;
      for (const key of [questionKey, answerKey])
        if (!(await this.storage.metadata(key)))
          throw new BankError('A referenced image is missing; save aborted', 409);
      return await this.bank.transaction(async () => {
        if (current && (await this.get(current.id, true)).revision !== input.expectedRevision)
          throw new BankError('Question changed. Reload before saving.', 409);
        await this.mapping(input, current);
        await this.validateDifficulty(input.difficultyId);
        const duplicateImages: string[] = [];
        for (const p of pending) {
          if (
            await this.bank.one(
              'SELECT key FROM image_assets WHERE sha256=? LIMIT 1',
              p.value.upload.sha256,
            )
          )
            duplicateImages.push(p.value.upload.sha256);
          await this.bank.run(
            'INSERT INTO image_assets VALUES(?,?,?,?,?,?,?,?)',
            p.original.key,
            p.original.mime,
            p.original.size,
            p.value.upload.sha256,
            p.value.width,
            p.value.height,
            p.thumbnail?.key ?? null,
            now,
          );
        }
        if (current)
          await this.bank.run(
            'UPDATE image_questions SET topic_id=?,subtopic_id=?,difficulty_id=?,total_marks=?,question_image=?,answer_image=?,revision=revision+1,updated_at=? WHERE id=?',
            input.topicId,
            input.subtopicId,
            input.difficultyId,
            input.totalMarks,
            questionKey,
            answerKey,
            now,
            questionId,
          );
        else
          await this.bank.run(
            "INSERT INTO image_questions VALUES(?,?,?,?,?,?,'draft',?,?,1,?,?)",
            questionId,
            input.legacyId ?? null,
            input.topicId,
            input.subtopicId,
            input.difficultyId,
            input.totalMarks,
            questionKey,
            answerKey,
            now,
            now,
          );
        const result = await this.snapshot(questionId, actor);
        return { question: result, duplicateImages: duplicateImages.length };
      });
    } catch (error) {
      await this.cleanup(receipts);
      throw error;
    }
  }
  async status(id: string, raw: unknown, actor: string) {
    if (!raw || typeof raw !== 'object') throw new BankError('Invalid status request');
    const { status, expectedRevision, confirmed } = raw as Record<string, unknown>;
    if (
      !['draft', 'reviewing', 'approved', 'retired'].includes(String(status)) ||
      !Number.isInteger(expectedRevision) ||
      confirmed !== true
    )
      throw new BankError('Confirm the status change and current revision');
    if (!this.storage) throw new AssetStorageError('Image storage is not configured');
    const before = await this.get(id, true);
    if (status === 'approved')
      for (const image of [before.questionImage, before.answerImage!]) {
        const stored = await this.storage.get(image.key);
        if (!stored || (stored.metadata.sha256 && stored.metadata.sha256 !== image.sha256))
          throw new BankError('Both intact images are required before publication', 409);
      }
    return this.bank.transaction(async () => {
      const q = await this.get(id, true);
      if (q.revision !== expectedRevision)
        throw new BankError('Question changed. Reload before changing status.', 409);
      if (status === 'approved') {
        const cv = await this.bank.one(
          'SELECT status FROM curriculum_versions WHERE id=?',
          q.curriculumVersionId,
        );
        if (cv?.status === 'draft')
          throw new BankError('Activate the syllabus before publishing questions', 409);
      }
      if (q.status === status) throw new BankError('No status change');
      await this.bank.run(
        'UPDATE image_questions SET status=?,revision=revision+1,updated_at=? WHERE id=?',
        String(status),
        new Date().toISOString(),
        id,
      );
      return this.snapshot(id, actor);
    });
  }
  async publicAsset(reference: string) {
    const key = assetKeyFromReference(reference);
    if (!key) return false;
    return Boolean(
      await this.bank.one(
        `SELECT 1 ${joins} WHERE ${publicImageQuestion} AND (qi.key=? OR qi.thumbnail_key=? OR ai.key=?) LIMIT 1`,
        key,
        key,
        key,
      ),
    );
  }
  async questionSet(raw: unknown) {
    if (typeof raw !== 'string' || raw.length > 6500)
      throw new BankError('Invalid question selection');
    const ids = raw.split(',');
    if (
      !ids.length ||
      ids.length > imageLimits.selection ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !/^[a-zA-Z0-9_-]{1,120}$/.test(id))
    )
      throw new BankError('Select 1–50 distinct approved questions');
    const rows = await this.bank.all(
      `SELECT ${fields} ${joins} WHERE ${publicImageQuestion} AND q.id IN (${ids.map(() => '?').join(',')})`,
      ...ids,
    );
    if (rows.length !== ids.length)
      throw new BankError(
        'A selected question is no longer available. Reload your selection.',
        409,
      );
    try {
      return {
        items: orderedQuestions(
          rows.map((row) => record(row, true)),
          await new VisibilityService(this.bank).taxonomy(),
        ),
      };
    } catch (error) {
      throw new BankError((error as Error).message);
    }
  }
}
