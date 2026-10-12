import { createTestBank } from './test-bank.js';
import type { Bank } from '../server/database.js';
import type { ImageQuestionInput } from '../shared/image-question.js';
export async function setup(existingBank?: Bank) {
  const bank = existingBank ?? (await createTestBank());
  const c1 = await bank.addTaxon('chapters', 'TEST ONLY Chapter 2', 'semester-1', true),
    c2 = await bank.addTaxon('chapters', 'TEST ONLY Chapter 10', 'semester-2', true);
  const momentum = await bank.addTaxon('topics', 'TEST ONLY Momentum', c1, true),
    circular = await bank.addTaxon('topics', 'TEST ONLY Circular Motion', c2, true),
    dynamics = await bank.addTaxon('topics', 'TEST ONLY Dynamics', c1, true);
  const subtopic = await bank.addTaxon('subtopics', 'TEST ONLY Details', momentum, true),
    circularSubtopic = await bank.addTaxon('subtopics', 'TEST ONLY Details', circular, true);
  const fixture = (): ImageQuestionInput => ({
    curriculumVersionId: 'legacy-matriculation-physics',
    semesterId: 'semester-1',
    chapterId: c1,
    topicId: momentum,
    subtopicId: subtopic,
    difficultyId: 'medium',
    totalMarks: 5,
  });
  return { bank, c1, c2, momentum, circular, dynamics, subtopic, circularSubtopic, fixture };
}
