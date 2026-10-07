import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { documentSchema } from '../shared/schema.js';
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
