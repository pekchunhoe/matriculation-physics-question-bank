import { z } from 'zod';
import katex from 'katex';
import { assetKinds } from './model.js';
export { assetKinds, warnings } from './model.js';
import { assetKeyFromReference } from './asset-reference.js';

const text = z.string().max(30000);
const id = z.string().min(1).max(120);
const marks = z.number().int().min(0).max(10000);
const latex = text.superRefine((value, ctx) => {
  try {
    if (value) katex.renderToString(value, { throwOnError: true, trust: false });
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid LaTeX equation' });
  }
});
const prose = text.superRefine((value, ctx) => {
  for (const match of value.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)) {
    try {
      katex.renderToString(match[1] ?? match[2], { throwOnError: true, trust: false });
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid LaTeX in text' });
    }
  }
});
export const partSchema = z
  .object({
    id,
    label: id,
    prompt: prose.refine((v) => Boolean(v.trim()), 'Part prompt is required'),
    marks,
    order: z.number().int().min(0),
    parentId: id.nullable(),
  })
  .strict();
export const stepSchema = z
  .object({
    number: z.number().int().positive(),
    explanation: prose,
    equationLatex: latex,
    working: prose,
    markingPoint: text,
    marks,
    order: z.number().int().min(0),
  })
  .strict();
export const solutionSchema = z
  .object({
    partId: id,
    solution: prose,
    equationLatex: latex,
    teacherNotes: prose,
    steps: z.array(stepSchema).max(100),
  })
  .strict();
export const hintSchema = z
  .object({
    id,
    partId: id.nullable(),
    text: prose.refine((v) => Boolean(v.trim()), 'Hint text is required'),
    order: z.number().int().min(0),
  })
  .strict();
export const assetSchema = z
  .object({
    id,
    partId: id.nullable(),
    kind: z.enum(assetKinds),
    url: z
      .string()
      .max(2000)
      .refine((v) => {
        if (v.startsWith('/uploads/')) return Boolean(assetKeyFromReference(v));
        try {
          const url = new URL(v);
          return (
            url.protocol === 'https:' &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password &&
            !url.hostname.endsWith('.blob.vercel-storage.com')
          );
        } catch {
          return false;
        }
      }, 'Use an uploaded file or HTTPS URL'),
    alt: z.string().min(1).max(1000),
    mime: z.enum(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
    order: z.number().int().min(0),
  })
  .strict();
export const documentSchema = z
  .object({
    schemaVersion: z.literal(1),
    question: z
      .object({
        questionCode: z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,79}$/),
        topicId: id,
        subtopicId: id.nullable(),
        title: z.string().min(1).max(300),
        scenario: prose,
        difficultyId: id,
        questionType: z.enum(['structured', 'multiple_choice', 'short_answer', 'essay']),
        totalMarks: marks.refine((n) => n > 0, 'Total marks must be positive'),
        estimatedMinutes: z.number().int().positive().max(10000),
        status: z.enum(['draft', 'reviewing', 'approved', 'retired']),
        containsDiagram: z.boolean(),
        containsGraph: z.boolean(),
        containsFbd: z.boolean(),
      })
      .strict(),
    parts: z.array(partSchema).min(1).max(100),
    solutions: z.array(solutionSchema).max(100),
    hints: z.array(hintSchema).max(100),
    assets: z.array(assetSchema).max(100),
    tags: z.array(z.string().trim().min(1).max(100)).max(50),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set(doc.parts.map((p) => p.id));
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (ids.size !== doc.parts.length) fail('Part IDs must be unique');
    for (const p of doc.parts) {
      if (p.parentId && !ids.has(p.parentId)) fail('Unknown parent part');
      const visited = new Set([p.id]);
      let parent = p.parentId;
      while (parent) {
        if (visited.has(parent)) {
          fail('Part hierarchy contains a cycle');
          break;
        }
        visited.add(parent);
        parent = doc.parts.find((x) => x.id === parent)?.parentId ?? null;
      }
    }
    if (new Set(doc.solutions.map((s) => s.partId)).size !== doc.solutions.length)
      fail('Only one answer scheme per part is allowed');
    for (const s of doc.solutions) {
      if (!ids.has(s.partId)) fail('Solution references unknown part');
      if (new Set(s.steps.map((t) => t.number)).size !== s.steps.length)
        fail('Step numbers must be unique within a solution');
    }
    for (const entry of [...doc.hints, ...doc.assets])
      if (entry.partId && !ids.has(entry.partId)) fail('Hint or asset references unknown part');
    for (const list of [doc.hints, doc.assets])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        fail('Hint and asset IDs must be unique within their collection');
    for (const a of doc.assets)
      if (a.kind.endsWith('pdf') !== (a.mime === 'application/pdf'))
        fail('Asset kind and MIME type disagree');
    if (
      doc.question.status === 'approved' &&
      doc.parts.some(
        (p) =>
          !doc.parts.some((child) => child.parentId === p.id) &&
          !doc.solutions.some((s) => s.partId === p.id && (s.solution.trim() || s.steps.length)),
      )
    )
      fail('Approved questions require an answer scheme for every leaf part');
  });
export type QuestionDocument = z.infer<typeof documentSchema>;
export type Part = z.infer<typeof partSchema>;
export type Solution = z.infer<typeof solutionSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Taxon = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
  isTest: boolean;
  status?: 'active' | 'retired';
  revision?: number;
  curriculumVersionId?: string;
};
export type Taxonomy = {
  curriculumVersions?: import('./curriculum.js').CurriculumVersion[];
  courses: Taxon[];
  semesters: Taxon[];
  chapters: Taxon[];
  topics: Taxon[];
  subtopics: Taxon[];
  difficulties: Taxon[];
};
