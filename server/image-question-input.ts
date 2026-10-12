import { z } from 'zod';
import type { ImageQuestionInput } from '../shared/image-question.js';
const id = z.string().min(1).max(120);
export const imageQuestionInput = z
  .object({
    curriculumVersionId: id,
    semesterId: id,
    chapterId: id,
    topicId: id,
    subtopicId: id,
    difficultyId: id,
    totalMarks: z.number().int().positive().max(10000),
    expectedRevision: z.number().int().positive().optional(),
    confirmPublishedReplacement: z.boolean().optional(),
    legacyId: id.optional(),
  })
  .strict() satisfies z.ZodType<ImageQuestionInput>;
