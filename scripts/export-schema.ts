import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { questionPackageSchema } from '../shared/question-import.js';
import { documentSchema } from '../shared/schema.js';
import { curriculumImportSchema, questionExportSchema } from '../shared/curriculum.js';
const schema = z.toJSONSchema(documentSchema, { unrepresentable: 'any' });
const output =
  JSON.stringify(
    {
      ...schema,
      $id: 'urn:matriculation-physics:question:1',
      title: 'Structured question v1',
      description:
        'Canonical export schema. Database foreign keys, part relationships, approval requirements, and LaTeX are additionally validated by the server.',
    },
    null,
    2,
  ) + '\n';
mkdirSync('docs', { recursive: true });
if (process.argv.includes('--check')) {
  if (readFileSync('docs/question-v1.schema.json', 'utf8') !== output)
    throw new Error('Import schema is out of date');
  console.log('Versioned JSON schema: PASS');
} else writeFileSync('docs/question-v1.schema.json', output);
for (const [schema, path, id, title] of [
  [
    questionPackageSchema,
    'docs/question-json-import.schema.json',
    'urn:matriculation-physics:question-package:1',
    'Self-contained question package v1',
  ],
  [
    curriculumImportSchema,
    'docs/curriculum-v1.schema.json',
    'urn:matriculation-physics:curriculum:1',
    'Curriculum import/export v1',
  ],
  [
    questionExportSchema,
    'docs/question-v2.schema.json',
    'urn:matriculation-physics:question:2',
    'Question export with classification provenance v2',
  ],
] as const) {
  const output =
    JSON.stringify(
      {
        ...z.toJSONSchema(schema, { unrepresentable: 'any' }),
        $id: id,
        title,
        description:
          'Runtime validation additionally enforces database relationships, duplicates, effective dates, LaTeX and lifecycle rules.',
      },
      null,
      2,
    ) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== output) throw new Error(`${path} is out of date`);
  } else writeFileSync(path, output);
}
