import { z } from 'zod';
import katex from 'katex';

export const contentText = z.string().max(30000);
export const math = contentText.superRefine((value, ctx) => {
  try {
    if (value) katex.renderToString(value, { throwOnError: true, trust: false, maxExpand: 1000 });
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid LaTeX equation; check braces and commands' });
  }
});
export const prose = contentText.superRefine((value, ctx) => {
  const chunks = value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  for (const chunk of chunks) {
    if (!chunk.startsWith('$')) {
      if (chunk.includes('$'))
        ctx.addIssue({
          code: 'custom',
          message: 'Unmatched LaTeX delimiter; use $...$ or $$...$$',
        });
      continue;
    }
    const result = math.safeParse(
      chunk.slice(chunk.startsWith('$$') ? 2 : 1, chunk.startsWith('$$') ? -2 : -1),
    );
    if (!result.success)
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid LaTeX in text; check delimiters, braces and commands',
      });
  }
});
export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: prose }).strict(),
  z
    .object({
      type: z.literal('math'),
      latex: math.refine((v) => Boolean(v.trim()), 'Equation is required'),
    })
    .strict(),
  z.object({ type: z.literal('image'), assetId: z.string().min(1).max(120) }).strict(),
]);
export const blocksSchema = z.array(blockSchema).max(100);
export type ContentBlock = z.infer<typeof blockSchema>;

export const visualRoles = [
  'question_diagram',
  'answer_diagram',
  'free_body_diagram',
  'graph',
  'circuit_diagram',
  'table_image',
  'other_visual',
] as const;
export const visualMetadataSchema = z
  .object({
    role: z.enum(visualRoles),
    caption: z.string().max(1000).optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteLength: z.number().int().positive(),
  })
  .strict();
