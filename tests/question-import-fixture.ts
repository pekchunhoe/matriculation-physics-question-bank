import { readFileSync } from 'node:fs';
import type { Bank } from '../server/database.js';
import type { QuestionPackage, ImportManifest } from '../shared/question-import.js';

export function examplePackage(visual = false): QuestionPackage {
  return JSON.parse(
    readFileSync(
      new URL(
        `../examples/question-import/${visual ? 'synthetic-visual' : 'dimensional-analysis'}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );
}
export async function localPackage(bank: Bank, visual = false) {
  const doc = examplePackage(visual),
    tax = await bank.taxonomy();
  const topic = tax.topics.find((t) => t.name === 'TEST ONLY Momentum')!;
  const chapter = tax.chapters.find((c) => c.id === topic.parentId)!;
  const semester = tax.semesters.find((s) => s.id === chapter.parentId)!;
  doc.classification = {
    curriculumVersionCode: tax.curriculumVersions!.find(
      (v) => v.id === semester.curriculumVersionId,
    )!.code,
    semester: 'Semester 1',
    chapter: chapter.name,
    topic: topic.name,
    subtopic: null,
  };
  return doc;
}
export function splitPackage(doc: QuestionPackage) {
  const manifest: ImportManifest = {
    ...doc,
    assets: doc.assets.map(({ dataBase64, ...a }) => {
      void dataBase64;
      return a;
    }),
  };
  const files = doc.assets.map((a) => ({
    fieldname: a.key,
    mimetype: a.mimeType,
    buffer: Buffer.from(a.dataBase64, 'base64'),
  }));
  return { manifest, files };
}
export function nestedPackage(doc: QuestionPackage) {
  const scheme = doc.solutions[0];
  doc.parts = [
    { id: 'a', label: '(a)', prompt: 'Parent stem.', marks: 2, order: 0, parentId: null },
    { id: 'ai', label: '(i)', prompt: 'Child one.', marks: 1, order: 0, parentId: 'a' },
    { id: 'aii', label: '(ii)', prompt: 'Child two.', marks: 1, order: 1, parentId: 'a' },
  ];
  doc.solutions = [
    { ...scheme, partId: 'ai', steps: [scheme.steps[0]] },
    { ...scheme, partId: 'aii', steps: [scheme.steps[1]] },
  ];
  return doc;
}
