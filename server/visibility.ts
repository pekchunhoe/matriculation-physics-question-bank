import { Bank, BankError, type Filters } from './database.js';
import type { QuestionDocument, Taxonomy } from '../shared/schema.js';
import { isPublishedCurriculum, publicQuestionSql } from './public-visibility-policy.js';

export function publicDocument(doc: QuestionDocument): QuestionDocument {
  return {
    ...doc,
    solutions: doc.solutions.map((solution) => ({ ...solution, teacherNotes: '' })),
    assets: doc.assets.filter((asset) => asset.kind !== 'original_pdf'),
  };
}
export class VisibilityService {
  constructor(private readonly bank: Bank) {}
  async approved(id: string) {
    const row = await this.bank.one(
      'SELECT v.snapshot,q.active_version FROM questions q JOIN question_versions v ON v.question_id=q.id AND v.version_number=q.active_version WHERE q.id=? AND ' +
        publicQuestionSql,
      id,
    );
    if (!row) throw new BankError('Question not found', 404);
    return {
      document: publicDocument(JSON.parse(String(row.snapshot))),
      version: Number(row.active_version),
    };
  }
  async list(filters: Filters) {
    const result = await this.bank.list({ ...filters, status: 'approved' }, true);
    return { ...result, items: result.items.map((item) => ({ ...item, original_pdf: null })) };
  }
  async taxonomy(): Promise<Taxonomy> {
    const tax = await this.bank.taxonomy(),
      curriculumVersions = (tax.curriculumVersions ?? []).filter((v) =>
        isPublishedCurriculum(v.status),
      ),
      semesters = tax.semesters.filter((s) =>
        curriculumVersions.some((v) => v.id === s.curriculumVersionId),
      ),
      chapters = tax.chapters.filter((c) => semesters.some((s) => s.id === c.parentId)),
      topics = tax.topics.filter((t) => chapters.some((c) => c.id === t.parentId)),
      subtopics = tax.subtopics.filter((st) => topics.some((t) => t.id === st.parentId));
    return { ...tax, curriculumVersions, semesters, chapters, topics, subtopics };
  }
  async publicAsset(reference: string) {
    return Boolean(
      await this.bank.one(
        "SELECT 1 FROM assets a JOIN questions q ON q.id=a.question_id WHERE a.url=? AND a.kind!='original_pdf' AND " +
          publicQuestionSql +
          ' LIMIT 1',
        reference,
      ),
    );
  }
  async questionSet(ids: unknown, answers: unknown, hints: unknown) {
    if (
      typeof ids !== 'string' ||
      ids.length > 2000 ||
      !['true', 'false', undefined].includes(answers as string | undefined) ||
      !['true', 'false', undefined].includes(hints as string | undefined)
    )
      throw new BankError('Invalid question set options');
    const selected = ids.split(',');
    if (
      !selected.length ||
      selected.length > 20 ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    )
      throw new BankError('Select 1 to 20 distinct approved questions');
    const items = [];
    for (const id of selected) {
      const loaded = await this.approved(id),
        doc = loaded.document;
      items.push({
        id,
        ...loaded,
        document: {
          ...doc,
          solutions: answers === 'true' ? doc.solutions : [],
          hints: hints === 'true' ? doc.hints : [],
          assets: doc.assets.filter(
            (asset) => answers === 'true' || !['answer_diagram', 'answer_pdf'].includes(asset.kind),
          ),
        },
      });
    }
    if (Buffer.byteLength(JSON.stringify(items)) > 1024 * 1024)
      throw new BankError('Question set is too large; select fewer questions', 413);
    return { items };
  }
}
