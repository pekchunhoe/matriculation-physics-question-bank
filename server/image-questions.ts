import { imageQuestionInput } from './image-question-input.js';
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

export type ImageFile = { buffer: Buffer; originalname: string; mimetype: string };
const joins = `FROM image_questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id
 JOIN semesters s ON s.id=c.semester_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id
 LEFT JOIN subtopics st ON st.id=q.subtopic_id JOIN difficulty_levels d ON d.id=q.difficulty_id
 JOIN image_assets qi ON qi.key=q.question_image JOIN image_assets ai ON ai.key=q.answer_image`;
export const publicImageQuestion = `q.status='approved' AND cv.status IN ('active','retired') AND EXISTS(
 SELECT 1 FROM image_question_versions v WHERE v.question_id=q.id AND v.revision=q.revision
 AND v.question_image=q.question_image AND v.answer_image=q.answer_image AND json_extract(v.snapshot,'$.status')='approved')`;
const assetJson = (alias: string) =>
  `json_object('key',${alias}.key,'mime',${alias}.mime,'size',${alias}.size,'sha256',${alias}.sha256,'width',${alias}.width,'height',${alias}.height,'thumbnailKey',${alias}.thumbnail_key)`;
const fields = `q.*,c.id chapter_id,s.id semester_id,cv.id curriculum_version_id,${assetJson('qi')} qi_json,${assetJson('ai')} ai_json`;
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
  async mapping(input: ImageQuestionInput, current?: ImageQuestion) {
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
    if (
      !(await this.bank.one(
        "SELECT id FROM difficulty_levels WHERE id=? AND slug IN ('easy','medium','hard')",
        input.difficultyId,
      ))
    )
      throw new BankError('Select EASY, MEDIUM or HARD');
  }
  async list(filters: Filters = {}, admin = false) {
    const conditions: string[] = admin ? ['1=1'] : [publicImageQuestion],
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
          params.push(filters[key]!);
        }
      }
    if (filters.q) {
      conditions.push('(q.id LIKE ? OR c.name LIKE ? OR t.name LIKE ? OR st.name LIKE ?)');
      const q = '%' + filters.q.slice(0, 200) + '%';
      params.push(q, q, q, q);
    }
    const page = Math.max(1, Math.min(100000, Number(filters.page) || 1)),
      limit = Math.min(50, Math.max(1, Number(filters.limit) || 20));
    if (!Number.isInteger(page) || !Number.isInteger(limit))
      throw new BankError('Invalid pagination');
    const where = ' WHERE ' + conditions.join(' AND '),
      total = Number((await this.bank.one('SELECT COUNT(*) n ' + joins + where, ...params))!.n);
    const rows = await this.bank.all(
      `SELECT ${fields} ${joins}${where} ORDER BY cv.sort_order,s.sort_order,c.sort_order,t.sort_order,(q.subtopic_id IS NOT NULL),st.sort_order,q.id LIMIT ? OFFSET ?`,
      ...params,
      limit,
      (page - 1) * limit,
    );
    return {
      items: rows.map((row) => record(row, false)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
  private async snapshot(id: string, actor: string) {
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
      q.updatedAt,
    );
    return q;
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
