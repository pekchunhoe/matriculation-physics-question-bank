import type { Taxon, Taxonomy } from '../shared/schema.js';
import type { ExportItem } from '../shared/export-plan.js';
const taxon = (id: string, name: string, parentId: string | null, order: number): Taxon => ({
  id,
  name,
  parentId,
  order,
  slug: id,
  isTest: true,
});
export function exportFixture() {
  const tax: Taxonomy = {
    courses: [],
    curriculumVersions: [],
    semesters: [taxon('s2', 'Semester 2', null, 1), taxon('s1', 'Semester 1', null, 0)],
    chapters: [
      taxon('c4', 'A Chapter Four', 's1', 4),
      taxon('c1', 'Z Chapter One', 's1', 1),
      taxon('c2', 'M Chapter Two', 's1', 2),
      taxon('c-s2', 'Semester Two Chapter', 's2', 1),
    ],
    topics: [
      taxon('t42', 'A Topic 4.2', 'c4', 2),
      taxon('t11', 'Z Topic 1.1', 'c1', 1),
      taxon('t12', 'A Topic 1.2', 'c1', 2),
      taxon('t23', 'M Topic 2.3', 'c2', 3),
      taxon('t-s2', 'Semester Two Topic', 'c-s2', 1),
    ],
    subtopics: [
      taxon('st2', 'A Subtopic second', 't11', 2),
      taxon('st1', 'Z Subtopic first', 't11', 1),
    ],
    difficulties: [taxon('medium', 'Medium', null, 1)],
  };
  const question = (id: string, topicId: string, subtopicId: string | null = null): ExportItem => ({
    id,
    document: {
      schemaVersion: 1,
      question: {
        questionCode: 'SOURCE-' + id.toUpperCase(),
        title: 'Unexported source title ' + id,
        scenario: 'STEM ' + id + ' with $F_c=\\frac{mv^2}{r}$.',
        topicId,
        subtopicId,
        difficultyId: 'medium',
        totalMarks: 1,
        estimatedMinutes: 2,
        questionType: 'structured',
        status: 'approved',
        containsDiagram: false,
        containsGraph: false,
        containsFbd: false,
      },
      parts: [],
      solutions: [
        {
          partId: null,
          solution: 'ANSWER ' + id,
          equationLatex: 'N_{\\mathrm{top}}=3.0\\,\\mathrm{m\\,s^{-1}}',
          teacherNotes: 'PRIVATE NOTE',
          steps: [
            {
              id: 'step',
              number: 1,
              order: 0,
              explanation: 'REASON ' + id,
              equationLatex: '\\vec{F}=m\\vec{a},\\quad F_c=\\frac{mv^2}{r}',
              working: 'FINAL ' + id,
              markingPoint: 'AWARD ' + id,
              markingCode: 'JU1',
              marks: 1,
            },
          ],
        },
      ],
      hints: [
        { id: 'h', partId: null, text: 'GENERAL HINT ' + id, order: 0 },
        { id: 'hs', partId: null, solutionStepId: 'step', text: 'STEP HINT ' + id, order: 0 },
      ],
      assets: [],
      tags: [],
    },
  });
  const items = [
    question('D', 't42'),
    question('A', 't11'),
    question('C', 't23'),
    question('B', 't12'),
  ];
  return { tax, items, question };
}
