import { z } from 'zod';
import { math as latex, prose, blocksSchema, visualMetadataSchema } from './content.js';
import { assetKinds } from './model.js';
export { assetKinds, warnings } from './model.js';
import { assetKeyFromReference } from './asset-reference.js';

const text = z.string().max(30000);
const id = z.string().min(1).max(120);
const marks = z.number().int().min(0).max(10000);
export const partSchema = z
  .object({
    id,
    label: id,
    prompt: prose,
    marks,
    order: z.number().int().min(0),
    parentId: id.nullable(),
    blocks: blocksSchema.optional(),
  })
  .strict()
  .refine((p) => Boolean(p.prompt.trim() || p.blocks?.length), {
    path: ['prompt'],
    message: 'Part prompt or content blocks are required',
  });
export const stepSchema = z
  .object({
    id: id.optional(),
    markingCode: z
      .string()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9+._/-]{0,23}$/,
        'Use 1–24 letters, digits or + . _ / -; start with a letter or digit',
      )
      .optional(),
    blocks: blocksSchema.optional(),
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
    partId: id.nullable(),
    blocks: blocksSchema.optional(),
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
    solutionStepId: id.nullable().optional(),
    text: prose.refine((v) => Boolean(v.trim()), 'Hint text is required'),
    order: z.number().int().min(0),
  })
  .strict();
/** Explicit question-scoped step keys; never infer a relationship from array position. */
export function validateStepHints(
  doc: { solutions: z.infer<typeof solutionSchema>[]; hints: z.infer<typeof hintSchema>[] },
  ctx: z.RefinementCtx,
) {
  const steps = new Map<string, string | null>();
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });
  for (const [i, solution] of doc.solutions.entries())
    for (const [j, step] of solution.steps.entries()) {
      if (!step.id) continue;
      if (steps.has(step.id))
        fail(
          ['solutions', i, 'steps', j, 'id'],
          'Step keys must be unique across all solutions in this question',
        );
      steps.set(step.id, solution.partId);
    }
  const orders = new Map<string, Set<number>>();
  for (const [i, hint] of doc.hints.entries()) {
    if (hint.solutionStepId) {
      if (!steps.has(hint.solutionStepId))
        fail(['hints', i, 'solutionStepId'], 'Unknown solution step in this question');
      else if (steps.get(hint.solutionStepId) !== hint.partId)
        fail(['hints', i, 'partId'], 'Hint part must match the targeted solution step owner');
    }
    const target = JSON.stringify([hint.partId, hint.solutionStepId ?? null]);
    const used = orders.get(target) ?? new Set<number>();
    if (used.has(hint.order))
      fail(['hints', i, 'order'], 'Hint order must be unique within its target');
    used.add(hint.order);
    orders.set(target, used);
  }
}
export const assetSchema = z
  .object({
    id,
    partId: id.nullable(),
    kind: z.enum(assetKinds),
    importMetadata: visualMetadataSchema.optional(),
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
    alt: z.string().max(1000),
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
        blocks: blocksSchema.optional(),
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
    parts: z.array(partSchema).max(100),
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
      if (s.partId !== null && !ids.has(s.partId)) fail('Solution references unknown part');
      if (new Set(s.steps.map((t) => t.number)).size !== s.steps.length)
        fail('Step numbers must be unique within a solution');
    }
    if (doc.parts.length && doc.solutions.some((s) => s.partId === null))
      fail('Whole-question solutions require a no-part question');
    validateStepHints(doc, ctx);
    const blockOwners = [
      doc.question.blocks,
      ...doc.parts.map((p) => p.blocks),
      ...doc.solutions.flatMap((s) => [s.blocks, ...s.steps.map((t) => t.blocks)]),
    ];
    for (const blocks of blockOwners)
      for (const block of blocks ?? [])
        if (block.type === 'image' && !doc.assets.some((a) => a.id === block.assetId))
          fail('Content block references unknown asset');
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
      ((!doc.parts.length &&
        !doc.solutions.some(
          (s) => s.partId === null && (s.solution.trim() || s.blocks?.length || s.steps.length),
        )) ||
        doc.parts.some(
          (p) =>
            !doc.parts.some((child) => child.parentId === p.id) &&
            !doc.solutions.some(
              (s) => s.partId === p.id && (s.solution.trim() || s.blocks?.length || s.steps.length),
            ),
        ))
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
