import { Bank } from '../server/database.js';
import type { QuestionDocument } from '../shared/schema.js';
export function setup() {
  const bank = new Bank();
  const c1 = bank.addTaxon('chapters', 'TEST ONLY Momentum chapter', 'semester-1', true),
    c2 = bank.addTaxon('chapters', 'TEST ONLY Circular Motion chapter', 'semester-2', true);
  const momentum = bank.addTaxon('topics', 'TEST ONLY Momentum', c1, true),
    circular = bank.addTaxon('topics', 'TEST ONLY Circular Motion', c2, true),
    dynamics = bank.addTaxon('topics', 'TEST ONLY Dynamics', c1, true);
  const subtopic = bank.addTaxon('subtopics', 'TEST ONLY 2D collision', momentum, true);
  const fixture = (
    code: string,
    topicId: string = momentum,
    difficultyId = 'hard',
  ): QuestionDocument => ({
    schemaVersion: 1,
    question: {
      questionCode: code,
      topicId,
      subtopicId: topicId === momentum ? subtopic : null,
      title: 'TEST ONLY ' + code,
      scenario: 'TEST ONLY: 2D collision fixture; not authored Physics content.',
      difficultyId,
      questionType: 'structured',
      totalMarks: 2,
      estimatedMinutes: 3,
      status: 'approved',
      containsDiagram: false,
      containsGraph: false,
      containsFbd: false,
    },
    parts: [
      {
        id: 'part-a',
        label: '(a)',
        prompt: 'TEST ONLY prompt. $\\vec{p} = m\\vec{v}$',
        marks: 2,
        order: 0,
        parentId: null,
      },
    ],
    solutions: [
      {
        partId: 'part-a',
        solution: 'TEST ONLY solution',
        equationLatex: '\\sum F = ma',
        teacherNotes: 'PRIVATE TEACHER NOTE',
        steps: [
          {
            number: 1,
            explanation: 'TEST ONLY step',
            equationLatex: 'N = \\frac{mv^2}{r}',
            working: 'TEST ONLY working',
            markingPoint: 'PRIVATE MARKING POINT',
            marks: 2,
            order: 0,
          },
        ],
      },
    ],
    hints: [
      { id: 'hint-1', partId: null, text: 'TEST ONLY hint one', order: 0 },
      { id: 'hint-2', partId: 'part-a', text: 'TEST ONLY hint two', order: 1 },
    ],
    assets: [],
    tags: ['TEST ONLY', 'collision'],
  });
  return { bank, c1, c2, momentum, circular, dynamics, subtopic, fixture };
}
export function seedTests() {
  const env = setup();
  for (const [index, difficulty] of ['easy', 'medium', 'hard'].entries()) {
    env.bank.create(
      env.fixture('TEST-S1-' + index, env.momentum, difficulty),
      'Test fixture',
      null,
      true,
    );
    env.bank.create(
      env.fixture('TEST-S2-' + index, env.circular, difficulty),
      'Test fixture',
      null,
      true,
    );
  }
  env.bank.create(env.fixture('TEST-DYNAMICS', env.dynamics, 'medium'), 'Test fixture', null, true);
  return env;
}
