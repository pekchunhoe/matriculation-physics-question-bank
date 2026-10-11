import type { QuestionDocument, Taxon, Taxonomy } from './schema.js';

export type ExportMode = 'question' | 'answer';
export type ExportItem = { id: string; document: QuestionDocument };
export type ExportPlanItem = ExportItem & {
  displayNumber: number;
  semester: Taxon;
  chapter: Taxon;
  topic: Taxon;
  subtopic: Taxon | null;
  positions: readonly [number, number, number, number];
};
const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function compareTaxon(a: Taxon, b: Taxon) {
  return a.order - b.order || compareId(a.id, b.id);
}
/** One ephemeral syllabus plan for PDF/Word and question/answer. Never mutate input. */
export function exportPlan(selected: readonly ExportItem[], tax: Taxonomy): ExportPlanItem[] {
  if (new Set(selected.map((q) => q.id)).size !== selected.length)
    throw new Error('Selected question IDs must be unique');
  return selected
    .map((item) => {
      const topic = tax.topics.find((t) => t.id === item.document.question.topicId);
      const chapter = tax.chapters.find((t) => t.id === topic?.parentId);
      const semester = tax.semesters.find((t) => t.id === chapter?.parentId);
      const subtopic =
        item.document.question.subtopicId === null
          ? null
          : tax.subtopics.find((t) => t.id === item.document.question.subtopicId);
      if (
        !topic ||
        !chapter ||
        !semester ||
        subtopic === undefined ||
        (subtopic && subtopic.parentId !== topic.id)
      )
        throw new Error(
          'A selected question has unavailable curriculum classification. Refresh your selection.',
        );
      return {
        ...item,
        semester,
        chapter,
        topic,
        subtopic,
        positions: [semester.order, chapter.order, topic.order, subtopic?.order ?? -1] as const,
      };
    })
    .sort(
      (a, b) =>
        compareTaxon(a.semester, b.semester) ||
        compareTaxon(a.chapter, b.chapter) ||
        compareTaxon(a.topic, b.topic) ||
        (a.subtopic === null
          ? b.subtopic === null
            ? 0
            : -1
          : b.subtopic === null
            ? 1
            : compareTaxon(a.subtopic, b.subtopic)) ||
        compareId(a.id, b.id),
    )
    .map((item, index) => ({ ...item, displayNumber: index + 1 }));
}
export function exportGroups(item: ExportPlanItem, previous?: ExportPlanItem) {
  const groups: { level: 'semester' | 'chapter' | 'topic' | 'subtopic'; label: string }[] = [];
  if (!previous || item.semester.id !== previous.semester.id)
    groups.push({ level: 'semester', label: `Matriculation Physics | ${item.semester.name}` });
  if (!previous || item.chapter.id !== previous.chapter.id)
    groups.push({ level: 'chapter', label: item.chapter.name });
  if (!previous || item.topic.id !== previous.topic.id)
    groups.push({ level: 'topic', label: item.topic.name });
  if (
    item.subtopic &&
    (!previous || item.subtopic.id !== previous.subtopic?.id || item.topic.id !== previous.topic.id)
  )
    groups.push({ level: 'subtopic', label: item.subtopic.name });
  return groups;
}
export function groupHeadings(item: ExportPlanItem, previous?: ExportPlanItem) {
  return exportGroups(item, previous).map((group) => group.label);
}
export function exportFilename(
  plan: readonly ExportPlanItem[],
  mode: ExportMode,
  format: 'pdf' | 'docx',
) {
  const semesters = new Set(plan.map((q) => q.semester.name));
  const only = semesters.size === 1 ? [...semesters][0] : '';
  const scope = only === 'Semester 1' ? '-semester-1' : only === 'Semester 2' ? '-semester-2' : '';
  return `matriculation-physics${scope}-${mode === 'question' ? 'questions' : 'answer-scheme'}.${format}`;
}
