import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { imageQuestionInput } from '../server/image-question-input.js';
const value = JSON.stringify(z.toJSONSchema(imageQuestionInput), null, 2) + '\n',
  file = 'docs/image-question-metadata.schema.json';
if (process.argv.includes('--check')) assert.equal(readFileSync(file, 'utf8'), value);
else writeFileSync(file, value);
console.log('Image metadata schema: PASS');
