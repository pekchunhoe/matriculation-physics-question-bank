import { cloneElement, useId, type ReactElement } from 'react';
import type { QuestionDocument, Taxon, Taxonomy } from '../shared/schema';
import type { Classification } from '../shared/curriculum';
export type LoadedQuestion = {
  id: string;
  version: number;
  document: QuestionDocument;
  warnings: string[];
  metadata?: Record<string, unknown>;
  savedClassification?: Classification;
};
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ 'aria-labelledby'?: string }>;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {cloneElement(children, { 'aria-labelledby': labelId })}
    </label>
  );
}
export function QuestionMetadata({
  doc,
  tax,
  saved,
}: {
  doc: QuestionDocument;
  tax: Taxonomy;
  saved?: Classification;
}) {
  const topic = tax.topics.find((t) => t.id === doc.question.topicId),
    chapter = tax.chapters.find((c) => c.id === topic?.parentId),
    semester = tax.semesters.find((s) => s.id === chapter?.parentId),
    course = tax.courses.find((c) => c.id === semester?.parentId),
    cv = tax.curriculumVersions?.find((v) => v.id === semester?.curriculumVersionId),
    subtopic = tax.subtopics.find((t) => t.id === doc.question.subtopicId);
  return (
    <div className="panel metadata-summary">
      <p>
        <strong>{doc.question.questionCode}</strong> · {doc.question.status} · Difficulty:{' '}
        {tax.difficulties.find((d) => d.id === doc.question.difficultyId)?.name} ·{' '}
        {doc.question.totalMarks} marks
      </p>
      <p>
        {saved?.course.name ?? course?.name} / {saved?.curriculumVersion.name ?? cv?.name} (
        {saved?.curriculumVersion.code ?? cv?.code}) / {saved?.semester.name ?? semester?.name} /{' '}
        {saved?.chapter.name ?? chapter?.name} / {saved?.topic.name ?? topic?.name}
        {(saved?.subtopic ?? subtopic) ? ' / ' + (saved?.subtopic?.name ?? subtopic?.name) : ''}
      </p>
      <p>
        {doc.parts.length} parts · {doc.solutions.reduce((n, s) => n + s.steps.length, 0)} solution
        steps · {doc.hints.length} hints · {doc.assets.length} assets
      </p>
      {saved && (
        <p className="muted">
          Saved classification:{' '}
          {saved.provenance === 'reconstructed'
            ? 'reconstructed from taxonomy at migration time; earlier names were not recorded'
            : 'captured with this question version'}
          . Stable IDs connect it to the curriculum.
        </p>
      )}
    </div>
  );
}
export function TaxonSelect({
  label,
  value,
  onChange,
  items,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: Taxon[];
  optional?: boolean;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{optional ? 'None' : 'Select ' + label.toLowerCase()}</option>
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.isTest ? ' (test taxonomy)' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}
