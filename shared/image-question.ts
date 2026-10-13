import type { Taxonomy } from './schema.js';

export const imageLimits = {
  bytes: 1572864,
  totalBytes: 3145728,
  pixels: 40000000,
  width: 12000,
  height: 30000,
  selection: 50,
  exportBytes: 64 * 1024 * 1024,
  pages: 400,
} as const;
export type ImageQuestionInput = {
  curriculumVersionId: string;
  semesterId: string;
  chapterId: string;
  topicId: string;
  subtopicId?: string | null;
  difficultyId: string;
  totalMarks: number;
  expectedRevision?: number;
  confirmPublishedReplacement?: boolean;
  legacyId?: string;
};
export type QuestionStatus = 'draft' | 'reviewing' | 'approved' | 'retired';
export type ImageAsset = {
  key: string;
  url: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  sha256: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
};
export type ImageQuestion = {
  id: string;
  legacyId: string | null;
  revision: number;
  status: QuestionStatus;
  curriculumVersionId: string;
  semesterId: string;
  chapterId: string;
  topicId: string;
  subtopicId: string | null;
  difficultyId: string;
  totalMarks: number;
  questionImage: ImageAsset;
  answerImage?: ImageAsset;
  createdAt: string;
  updatedAt: string;
};
export type ImageQuestionList = {
  items: ImageQuestion[];
  total: number;
  page: number;
  pages: number;
};
export function orderedQuestions(items: ImageQuestion[], tax: Taxonomy): ImageQuestion[] {
  if (!items.length || items.length > imageLimits.selection)
    throw new Error('Select 1–50 questions.');
  if (new Set(items.map((q) => q.id)).size !== items.length)
    throw new Error('Duplicate question selection.');
  if (
    new Set(items.map((q) => q.curriculumVersionId)).size !== 1 ||
    new Set(items.map((q) => q.semesterId)).size !== 1
  )
    throw new Error('Choose questions from one syllabus version and one semester.');
  const order = (q: ImageQuestion) => {
    const s = tax.semesters.find((t) => t.id === q.semesterId),
      c = tax.chapters.find((t) => t.id === q.chapterId),
      t = tax.topics.find((t) => t.id === q.topicId),
      st = tax.subtopics.find((t) => t.id === q.subtopicId);
    if (
      !s ||
      !c ||
      !t ||
      (q.subtopicId !== null && !st) ||
      s.curriculumVersionId !== q.curriculumVersionId ||
      c.parentId !== s.id ||
      t.parentId !== c.id ||
      (st && st.parentId !== t.id)
    )
      throw new Error('Question classification is no longer valid. Reload the selection.');
    return [s.order, c.order, t.order, st ? 1 : 0, st?.order ?? 0];
  };
  const orders = new Map(items.map((q) => [q.id, order(q)]));
  return [...items].sort((a, b) => {
    const x = orders.get(a.id)!,
      y = orders.get(b.id)!;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
