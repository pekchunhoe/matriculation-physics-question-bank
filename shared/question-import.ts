import { z } from 'zod';
import { partSchema, solutionSchema, hintSchema } from './schema.js';
import { prose, blocksSchema, visualMetadataSchema } from './content.js';

export const importLimits = {
  packageBytes: 5 * 1024 * 1024,
  manifestBytes: 384 * 1024,
  assetBytes: 3 * 1024 * 1024,
  totalAssetBytes: 3 * 1024 * 1024,
  assetCount: 8,
  planLifetimeMs: 15 * 60 * 1000,
} as const;
const assetManifestSchema = visualMetadataSchema
  .extend({
    key: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(importLimits.assetBytes, 'Asset exceeds maximum permitted size (3 MiB)'),
    alt: z.string().max(1000).optional(),
  })
  .strict();
const packageFields = {
  schemaVersion: z.literal(1),
  kind: z.literal('matriculation-physics-question'),
  classification: z
    .object({
      curriculumVersionCode: z.string().min(1).max(100),
      semester: z.enum(['Semester 1', 'Semester 2']),
      chapter: z.string().min(1).max(200),
      topic: z.string().min(1).max(200),
      subtopic: z.string().min(1).max(200).nullable(),
    })
    .strict(),
  difficulty: z.string().min(1).max(100),
  question: z
    .object({
      questionCode: z
        .string()
        .regex(/^[A-Z0-9][A-Z0-9-]{2,79}$/)
        .optional(),
      title: z.string().min(1).max(300),
      scenario: prose,
      blocks: blocksSchema.optional(),
      totalMarks: z.number().int().positive().max(10000),
      estimatedMinutes: z.number().int().positive().max(10000),
      questionType: z.enum(['structured', 'multiple_choice', 'short_answer', 'essay']),
    })
    .strict(),
  parts: z.array(partSchema).max(100),
  solutions: z.array(solutionSchema).min(1).max(100),
  hints: z.array(hintSchema).max(100),
  tags: z.array(z.string().trim().min(1).max(100)).max(50),
};
function validatePackage(doc: ImportManifest, ctx: z.RefinementCtx) {
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });
  if (doc.assets.reduce((sum, a) => sum + a.byteLength, 0) > importLimits.totalAssetBytes)
    fail(
      ['assets'],
      'Question JSON contains too much embedded asset data (combined maximum 3 MiB)',
    );
  if (new Set(doc.assets.map((a) => a.key)).size !== doc.assets.length)
    fail(['assets'], 'Asset keys must be unique');
  const partIds = new Set(doc.parts.map((p) => p.id));
  if (partIds.size !== doc.parts.length) fail(['parts'], 'Part keys must be unique');
  for (const [i, p] of doc.parts.entries()) {
    if (!p.prompt.trim() && !p.blocks?.length)
      fail(['parts', i, 'prompt'], 'Supply prompt or content blocks');
    const children = doc.parts.filter((c) => c.parentId === p.id);
    if (children.length && children.reduce((sum, c) => sum + c.marks, 0) !== p.marks)
      fail(
        ['parts', i, 'marks'],
        'Parent marks must equal direct child marks; parent totals are not added twice',
      );
    if (p.parentId !== null && !partIds.has(p.parentId))
      fail(['parts', i, 'parentId'], 'Unknown parent part');
    let parent: string | null = p.parentId;
    const seen = new Set([p.id]);
    while (parent !== null) {
      if (seen.has(parent)) {
        fail(['parts', i, 'parentId'], 'Part hierarchy contains a cycle');
        break;
      }
      seen.add(parent);
      parent = doc.parts.find((c) => c.id === parent)?.parentId ?? null;
    }
  }
  const roots = doc.parts.filter((p) => p.parentId === null);
  if (doc.parts.length && roots.reduce((sum, p) => sum + p.marks, 0) !== doc.question.totalMarks)
    fail(['question', 'totalMarks'], 'Part totals must equal question total marks');
  const leaves = doc.parts.filter((p) => !doc.parts.some((c) => c.parentId === p.id));
  const targets: (string | null)[] = doc.parts.length ? leaves.map((p) => p.id) : [null];
  if (
    doc.solutions.length !== targets.length ||
    new Set(doc.solutions.map((s) => s.partId)).size !== targets.length
  )
    fail(
      ['solutions'],
      'Supply exactly one marking scheme for each leaf part, or one whole-question scheme for a no-part question',
    );
  for (const [i, s] of doc.solutions.entries()) {
    if (!targets.includes(s.partId))
      fail(
        ['solutions', i, 'partId'],
        'Solutions must target a leaf part or null for a no-part question',
      );
    const expected = leaves.find((p) => p.id === s.partId)?.marks ?? doc.question.totalMarks;
    if (s.steps.reduce((sum, step) => sum + step.marks, 0) !== expected)
      fail(['solutions', i, 'steps'], `Marking scheme must allocate exactly ${expected} marks`);
    if (new Set(s.steps.map((t) => t.number)).size !== s.steps.length)
      fail(['solutions', i, 'steps'], 'Step numbers must be unique');
    if (new Set(s.steps.map((t) => t.order)).size !== s.steps.length)
      fail(['solutions', i, 'steps'], 'Step order must be unique');
  }
  for (const [i, h] of doc.hints.entries())
    if (h.partId !== null && !partIds.has(h.partId))
      fail(['hints', i, 'partId'], 'Unknown hint part');
  if (new Set(doc.hints.map((h) => h.id)).size !== doc.hints.length)
    fail(['hints'], 'Hint keys must be unique');
  for (const partId of [null, ...partIds]) {
    const hints = doc.hints.filter((h) => h.partId === partId);
    if (new Set(hints.map((h) => h.order)).size !== hints.length)
      fail(['hints'], 'Hint order must be unique within its target');
    const siblings = doc.parts.filter((p) => p.parentId === partId);
    if (new Set(siblings.map((p) => p.order)).size !== siblings.length)
      fail(['parts'], 'Sibling part order must be unique');
  }
  const placements: {
    blocks: z.infer<typeof blocksSchema> | undefined;
    path: (string | number)[];
    answer: boolean;
  }[] = [
    { blocks: doc.question.blocks, path: ['question', 'blocks'], answer: false },
    ...doc.parts.map((p, i) => ({ blocks: p.blocks, path: ['parts', i, 'blocks'], answer: false })),
    ...doc.solutions.flatMap((s, i) => [
      { blocks: s.blocks, path: ['solutions', i, 'blocks'], answer: true },
      ...s.steps.map((t, j) => ({
        blocks: t.blocks,
        path: ['solutions', i, 'steps', j, 'blocks'],
        answer: true,
      })),
    ]),
  ];
  const used = new Set<string>();
  for (const { blocks, path, answer } of placements)
    for (const [i, b] of (blocks ?? []).entries()) {
      if (b.type !== 'image') continue;
      const asset = doc.assets.find((a) => a.key === b.assetId);
      if (!asset) fail([...path, i, 'assetId'], 'Unknown embedded asset key');
      if (!answer && asset && ['answer_diagram', 'free_body_diagram'].includes(asset.role))
        fail(
          [...path, i, 'assetId'],
          'Answer diagrams and FBDs must be placed in an answer or marking step',
        );
      if (used.has(b.assetId))
        fail(
          [...path, i, 'assetId'],
          'Place each asset exactly once; duplicate the asset with a distinct key if intentional',
        );
      used.add(b.assetId);
    }
  for (const [i, a] of doc.assets.entries())
    if (!used.has(a.key))
      fail(['assets', i, 'key'], 'Every asset needs an explicit image content block placement');
  if (!doc.parts.length && !doc.question.scenario.trim() && !doc.question.blocks?.length)
    fail(['question', 'scenario'], 'Question content is required');
}
const manifestObject = z
  .object({ ...packageFields, assets: z.array(assetManifestSchema).max(importLimits.assetCount) })
  .strict();
export type ImportManifest = z.infer<typeof manifestObject>;
export const importManifestSchema = manifestObject.superRefine(validatePackage);
export const questionPackageSchema = z
  .object({
    ...packageFields,
    assets: z
      .array(
        assetManifestSchema
          .extend({
            dataBase64: z
              .string()
              .min(4)
              .max(4 * Math.ceil(importLimits.assetBytes / 3))
              .regex(
                /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
                'Use canonical Base64 without a data URL or whitespace',
              ),
          })
          .strict(),
      )
      .max(importLimits.assetCount),
  })
  .strict()
  .superRefine(validatePackage);
export type QuestionPackage = z.infer<typeof questionPackageSchema>;
export function validationMessage(error: z.ZodError) {
  return error.issues
    .map((i) => {
      const path = i.path
        .map((p, index) => (typeof p === 'number' ? `[${p}]` : `${index ? '.' : ''}${String(p)}`))
        .join('');
      return `${path || 'package'}: ${i.message}`;
    })
    .join('\n');
}
export type ImportPreview = {
  token: string;
  document: import('./schema.js').QuestionDocument;
  classification: import('./curriculum.js').Classification;
  warnings: string[];
  marks: { question: number; parts: number; markingScheme: number };
  assets: {
    key: string;
    placement: string;
    role: string;
    byteLength: number;
    sha256: string;
  }[];
  expiresAt: number;
};
