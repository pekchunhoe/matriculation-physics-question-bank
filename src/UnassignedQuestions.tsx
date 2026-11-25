import { useState } from 'react';
import type { UnassignedQuestion } from '../shared/image-question';
import type { Taxonomy } from '../shared/schema';
import { api, json } from './api';
import { Field } from './components';
import { CurriculumFields, emptyMapping } from './CurriculumFields';
import {
  Pagination,
  useQuestionListStart,
  useQuestionLocation,
  useQuestionPage,
} from './Pagination';

function Reassign({
  question,
  tax,
  onCancel,
  onSaved,
}: {
  question: UnassignedQuestion;
  tax: Taxonomy;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const version = tax.curriculumVersions?.find((v) => v.id === question.curriculumVersionId),
    semester = tax.semesters.find((s) => s.id === question.semesterId);
  const [mapping, setMapping] = useState({
      ...emptyMapping,
      ...(version?.status !== 'retired' && {
        curriculumVersionId: question.curriculumVersionId,
        semesterId: semester?.id ?? '',
      }),
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    const { curriculumVersionId, semesterId, chapterId, topicId, subtopicId } = mapping;
    try {
      await api(
        '/admin/unassigned/' + encodeURIComponent(question.id),
        json('PATCH', {
          expectedRevision: question.revision,
          confirmed: true,
          mapping: { curriculumVersionId, semesterId, chapterId, topicId, subtopicId },
        }),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy}>
        <legend>Reassign question</legend>
        <div className="form-grid">
          <CurriculumFields
            tax={tax}
            value={mapping}
            onChange={setMapping}
            required
            admin
            showDifficulty={false}
          />
        </div>
        <div className="actions">
          <button className="button primary">Save assignment</button>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}

export function UnassignedQuestions({ tax }: { tax: Taxonomy }) {
  const { query, params, page, navigate, setPage, replacePage } = useQuestionLocation(),
    { result, error, loading, refresh } = useQuestionPage<UnassignedQuestion>(
      '/admin/unassigned',
      query,
      replacePage,
    ),
    listStart = useQuestionListStart(page, Boolean(result));
  const [selected, setSelected] = useState(''),
    [message, setMessage] = useState('');
  const curriculum = params.get('curriculum') ?? '',
    versions = tax.curriculumVersions ?? [];
  function filter(changes: Record<string, string>) {
    setSelected('');
    setMessage('');
    navigate({ ...changes, page: '1' });
  }
  return (
    <section className="panel">
      <h1>Unassigned Questions</h1>
      <div className="form-grid">
        <Field label="Question search">
          <input
            type="search"
            value={params.get('q') ?? ''}
            onChange={(e) => filter({ q: e.target.value })}
          />
        </Field>
        <Field label="Filter by syllabus version">
          <select
            value={curriculum}
            onChange={(e) => filter({ curriculum: e.target.value, semester: '' })}
          >
            <option value="">All syllabus versions</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter by semester">
          <select
            value={params.get('semester') ?? ''}
            onChange={(e) => filter({ semester: e.target.value })}
          >
            <option value="">All semesters</option>
            {tax.semesters
              .filter((s) => !curriculum || s.curriculumVersionId === curriculum)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {!curriculum &&
                    ` (${versions.find((v) => v.id === s.curriculumVersionId)?.code ?? ''})`}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <div ref={listStart} tabIndex={-1} className="question-list-start">
        <h2>Questions awaiting reassignment</h2>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {loading && <p role="status">Loading questions...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result?.total === 0 && <p>No unassigned questions match these filters.</p>}
      {result?.items.map((q) => (
        <article className="panel" key={q.id}>
          <h3>
            Question <code>{q.id}</code>
          </h3>
          <p>
            {versions.find((v) => v.id === q.curriculumVersionId)?.name} · {q.semesterName} ·{' '}
            {tax.difficulties.find((d) => d.id === q.difficultyId)?.name} · {q.totalMarks} marks
          </p>
          {q.legacyQuestionCode && (
            <p>
              Legacy question code <code>{q.legacyQuestionCode}</code>
            </p>
          )}
          {q.legacySourcePdf && (
            <p>
              Legacy source PDF <code>{q.legacySourcePdf}</code>
            </p>
          )}
          <div className="image-pair">
            <img
              className="upload-preview"
              loading="lazy"
              src={q.questionImage.url}
              alt="Question picture preview"
            />
            <img
              className="upload-preview"
              loading="lazy"
              src={q.answerImage?.url}
              alt="Answer picture preview"
            />
          </div>
          {selected === q.id ? (
            <Reassign
              question={q}
              tax={tax}
              onCancel={() => setSelected('')}
              onSaved={() => {
                setSelected('');
                setMessage(`Question ${q.id} was reassigned.`);
                refresh();
              }}
            />
          ) : (
            <div className="actions">
              <button className="button" onClick={() => setSelected(q.id)}>
                Reassign
              </button>
            </div>
          )}
        </article>
      ))}
      {result && (
        <Pagination
          info={result}
          onChange={(next) => {
            setSelected('');
            setPage(next);
          }}
          label="Unassigned question pages"
        />
      )}
    </section>
  );
}
