import { z } from 'zod';
import { documentSchema } from './schema.js';
const id = z.string().min(1).max(120),
  name = z
    .string()
    .min(1)
    .max(200)
    .refine((s) => Boolean(s.trim()), 'Name is required');
const date = z.iso.date().nullable();
const versionFields = z
  .object({
    id: id.optional(),
    courseId: id,
    code: z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,79}$/),
    name,
    effectiveFrom: date,
    effectiveTo: date,
    status: z.enum(['draft', 'active', 'retired']),
    order: z.number().int().min(0),
    cloneFromId: id.optional(),
  })
  .strict();
export const curriculumVersionSchema = versionFields.refine(
  (v) => !v.effectiveFrom || !v.effectiveTo || v.effectiveFrom <= v.effectiveTo,
  'Effective dates are inconsistent',
);
const nodeFields = {
  id: id.optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(200)
    .optional(),
  name,
  order: z.number().int().min(0),
  status: z.enum(['active', 'retired']),
  isTest: z.boolean(),
};
const subtopic = z.object(nodeFields).strict(),
  topic = z.object({ ...nodeFields, subtopics: z.array(subtopic).max(1000) }).strict(),
  chapter = z.object({ ...nodeFields, topics: z.array(topic).max(1000) }).strict(),
  semester = z.object({ ...nodeFields, chapters: z.array(chapter).max(1000) }).strict();
export const curriculumImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    course: z
      .object({ id: id.optional(), slug: id.optional(), name })
      .strict()
      .refine((c) => Boolean(c.id || c.slug), 'Course ID or slug is required'),
    curriculumVersion: versionFields
      .omit({ courseId: true, cloneFromId: true })
      .refine(
        (v) => !v.effectiveFrom || !v.effectiveTo || v.effectiveFrom <= v.effectiveTo,
        'Effective dates are inconsistent',
      ),
    semesters: z.array(semester).max(100),
  })
  .strict();
export type CurriculumDocument = z.infer<typeof curriculumImportSchema>;
export type EditableKind = 'semesters' | 'chapters' | 'topics' | 'subtopics';
export const taxonomyEditSchema = z
  .object({
    name: name.optional(),
    order: z.number().int().min(0).optional(),
    status: z.enum(['active', 'retired']).optional(),
    parentId: id.optional(),
    expectedRevision: z.number().int().positive(),
    impactToken: id,
    confirmImpact: z.boolean(),
    note: z.string().min(1).max(2000),
    author: z.string().max(200).optional(),
  })
  .strict();
export type TaxonomyEdit = z.infer<typeof taxonomyEditSchema>;
export type CurriculumVersionInput = z.infer<typeof curriculumVersionSchema>;
export type CurriculumVersion = {
  id: string;
  courseId: string;
  code: string;
  name: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: 'draft' | 'active' | 'retired';
  order: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
const savedEntity = z.object({ id, name, slug: id }).strict();
export const classificationSchema = z
  .object({
    course: savedEntity,
    curriculumVersion: z.object({ id, name, code: id }).strict(),
    semester: savedEntity,
    chapter: savedEntity,
    topic: savedEntity,
    subtopic: savedEntity.nullable(),
    provenance: z.enum(['captured', 'reconstructed']),
  })
  .strict();
export type Classification = z.infer<typeof classificationSchema>;
export const questionExportSchema = z
  .object({
    schemaVersion: z.literal(2),
    document: documentSchema,
    savedClassification: classificationSchema,
  })
  .strict();
export type CurriculumImpact = {
  id: string;
  kind: EditableKind | 'curriculumVersions';
  currentQuestions: number;
  historicalQuestions: number;
  pendingRevisions: number;
  descendants: number;
  token: string;
  revision: number;
  versionId: string;
  previousActive?: { id: string; name: string; currentQuestions: number };
};
export type CurriculumPlan = {
  document: CurriculumDocument;
  token: string;
  counts: { semesters: number; chapters: number; topics: number; subtopics: number };
  warnings: string[];
};
