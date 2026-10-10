import type { QuestionDocument } from './schema.js';
export const assetKinds = [
  'illustration',
  'physics_diagram',
  'fbd',
  'graph',
  'vector_diagram',
  'circuit_diagram',
  'answer_diagram',
  'reference_image',
  'original_pdf',
  'question_pdf',
  'answer_pdf',
] as const;
export function warnings(doc: QuestionDocument): string[] {
  const total = doc.parts.length
    ? doc.parts.filter((p) => p.parentId === null).reduce((sum, p) => sum + p.marks, 0)
    : doc.question.totalMarks;
  const result =
    total === doc.question.totalMarks
      ? []
      : [
          `Part marks total ${total}; question total is ${doc.question.totalMarks}. Authored marks were preserved.`,
        ];
  for (const s of doc.solutions) {
    const allocated = s.steps.reduce((sum, x) => sum + x.marks, 0);
    const part = doc.parts.find((p) => p.id === s.partId);
    if (s.steps.length && allocated !== (part?.marks ?? doc.question.totalMarks))
      result.push(
        `Solution steps for ${part?.label ?? 'whole question'} allocate ${allocated} marks; target has ${part?.marks ?? doc.question.totalMarks}.`,
      );
  }
  return result;
}
