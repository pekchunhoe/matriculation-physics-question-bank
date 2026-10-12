import type { ImageQuestionInput } from '../shared/image-question';
import type { Taxonomy } from '../shared/schema';
import { Field } from './components';
import { inStoredOrder } from './taxonomy-order';
type Mapping = Pick<
  ImageQuestionInput,
  'curriculumVersionId' | 'semesterId' | 'chapterId' | 'topicId' | 'subtopicId' | 'difficultyId'
>;
export const emptyMapping: Mapping = {
  curriculumVersionId: '',
  semesterId: '',
  chapterId: '',
  topicId: '',
  subtopicId: '',
  difficultyId: '',
};
export function CurriculumFields({
  tax,
  value,
  onChange,
  required = false,
  admin = false,
}: {
  tax: Taxonomy;
  value: Mapping;
  onChange: (value: Mapping) => void;
  required?: boolean;
  admin?: boolean;
}) {
  const keys = ['curriculumVersionId', 'semesterId', 'chapterId', 'topicId', 'subtopicId'] as const;
  const change = (key: keyof Mapping, id: string) => {
    const next = { ...value, [key]: id },
      index = keys.indexOf(key as (typeof keys)[number]);
    if (index >= 0) for (const child of keys.slice(index + 1)) next[child] = '';
    onChange(next);
  };
  const versions = (tax.curriculumVersions ?? []).filter((v) =>
    admin ? v.status !== 'retired' || v.id === value.curriculumVersionId : v.status !== 'draft',
  );
  const choices: [keyof Mapping, string, { id: string; name: string }[]][] = [
    [
      'curriculumVersionId',
      'Syllabus Version',
      inStoredOrder(versions).map((v) => ({ id: v.id, name: `${v.name} (${v.code})` })),
    ],
    [
      'semesterId',
      'Semester',
      inStoredOrder(
        tax.semesters.filter((s) => s.curriculumVersionId === value.curriculumVersionId),
      ),
    ],
    [
      'chapterId',
      'Chapter',
      inStoredOrder(tax.chapters.filter((c) => c.parentId === value.semesterId)),
    ],
    ['topicId', 'Topic', inStoredOrder(tax.topics.filter((t) => t.parentId === value.chapterId))],
    [
      'subtopicId',
      'Subtopic',
      inStoredOrder(tax.subtopics.filter((s) => s.parentId === value.topicId)),
    ],
    [
      'difficultyId',
      'Difficulty',
      inStoredOrder(
        tax.difficulties.filter((d) => ['easy', 'medium', 'hard'].includes(d.slug)),
      ).map((d) => ({ ...d, name: d.name.toUpperCase() })),
    ],
  ];
  return (
    <>
      {choices.map(([key, label, items]) => (
        <Field label={label} key={key}>
          <select
            required={required}
            value={value[key]}
            onChange={(e) => change(key, e.target.value)}
          >
            <option value="">
              {required ? 'Select' : 'All'} {label.toLowerCase()}
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </>
  );
}
