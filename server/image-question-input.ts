import { z } from 'zod';
import type { ImageQuestionInput } from '../shared/image-question.js';
const id = z.string().min(1).max(120);
export const imageQuestionInput = z
  .object({
    curriculumVersionId: id,
    semesterId: id,
    chapterId: id,
    topicId: id,
    subtopicId: z
      .string()
      .max(120)
      .nullable()
      .optional()
      .transform((value) => (value?.trim() ? value : null)),
    difficultyId: id,
    totalMarks: z.number().int().positive().max(10000),
    expectedRevision: z.number().int().positive().optional(),
    confirmPublishedReplacement: z.boolean().optional(),
    legacyId: id.optional(),
  })
  .strict() satisfies z.ZodType<ImageQuestionInput>;

export const assignmentChangeInput = z
  .object({
    expectedRevision: z.number().int().positive(),
    confirmed: z.literal(true),
    mapping: imageQuestionInput
      .pick({
        curriculumVersionId: true,
        semesterId: true,
        chapterId: true,
        topicId: true,
        subtopicId: true,
      })
      .nullable(),
  })
  .strict();
