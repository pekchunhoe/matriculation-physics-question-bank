import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeQuestionImport, type MappingReview } from '../shared/import-compatibility.js';
import { questionPackageSchema } from '../shared/question-import.js';
import type { Bank } from '../server/database.js';

export const realSourceSha256 = 'ffd04d8e057c7ea666a8e205949bbb55c1c0cc12ddb4d695070bca9ba073d1f5';
export function realPortableSource() {
  const bytes = readFileSync(
    new URL(
      '../examples/question-import/First_Law_of_Thermodynamics_MEDIUM_PORTABLE.json',
      import.meta.url,
    ),
  );
  if (createHash('sha256').update(bytes).digest('hex') !== realSourceSha256)
    throw new Error('Actual supplied portable source fixture was changed');
  return JSON.parse(bytes.toString('utf8'));
}
export const realAdministrativePaths = [
  '/importer_compatibility',
  '/pdf_export_contract',
  '/metadata/question_id',
  '/metadata/question_source',
  '/metadata/subject',
  '/metadata/programme',
  '/metadata/language',
];
// These values are TEST SCAFFOLDING ONLY, not inferred missing academic data.
// The user will supply the actual required mappings later on the website.
export async function realPortableReview(bank: Bank): Promise<MappingReview> {
  const chapter = await bank.addTaxon(
    'chapters',
    'TEST ONLY portable verification chapter',
    'semester-1',
    true,
  );
  await bank.addTaxon('topics', 'First law of thermodynamics', chapter, true);
  const tax = await bank.taxonomy();
  const semester = tax.semesters.find((s) => s.id === 'semester-1')!;
  const candidate = normalizeQuestionImport(realPortableSource()).candidate;
  Object.assign(candidate.question as object, { estimatedMinutes: 3, questionType: 'structured' });
  Object.assign(candidate.classification as object, {
    curriculumVersionCode: tax.curriculumVersions!.find(
      (v) => v.id === semester.curriculumVersionId,
    )!.code,
    chapter: 'TEST ONLY portable verification chapter',
  });
  return {
    candidate: questionPackageSchema.parse(candidate),
    administrativePaths: realAdministrativePaths,
  };
}
