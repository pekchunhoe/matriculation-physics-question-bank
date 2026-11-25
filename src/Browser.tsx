import { useEffect, useRef, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { orderedQuestions, type ImageQuestion } from '../shared/image-question';
import { useAuth } from './Auth';
import { Field } from './components';
import { CurriculumFields, emptyMapping } from './CurriculumFields';
import {
  Pagination,
  useQuestionLocation,
  useQuestionPage,
  useQuestionListStart,
} from './Pagination';
const academicFilters = [
  ['semester', 'semesters'],
  ['chapter', 'chapters'],
  ['topic', 'topics'],
  ['subtopic', 'subtopics'],
] as const;
export function Browser({ tax }: { tax: Taxonomy }) {
  const { session } = useAuth();
  const defaults = new URLSearchParams({
    curriculum: tax.curriculumVersions?.find((v) => v.status === 'active')?.id ?? '',
    status: 'approved',
  }).toString();
  const { query, params, page, navigate, setPage, replacePage } = useQuestionLocation(defaults);
  const mapping = {
    ...emptyMapping,
    curriculumVersionId: params.get('curriculum') ?? '',
    semesterId: params.get('semester') ?? '',
    chapterId: params.get('chapter') ?? '',
    topicId: params.get('topic') ?? '',
    subtopicId: params.get('subtopic') ?? '',
    difficultyId: params.get('difficulty') ?? '',
  };
  const [selected, setSelected] = useState<ImageQuestion[]>([]),
    [selectionError, setSelectionError] = useState('');
  const {
    result,
    error: requestError,
    loading,
    refresh,
  } = useQuestionPage<ImageQuestion>('/questions', query, replacePage);
  const previousTax = useRef(tax);
  useEffect(() => {
    const changed = previousTax.current !== tax;
    previousTax.current = tax;
    const unavailable = academicFilters.findIndex(([filter, kind]) => {
      const id = params.get(filter);
      return Boolean(id && !tax[kind].some((record) => record.id === id));
    });
    if (unavailable >= 0) {
      const clear = Object.fromEntries(
        academicFilters.slice(unavailable).map(([filter]) => [filter, '']),
      );
      navigate({ ...clear, page: '1' }, true);
    } else if (changed) refresh();
  }, [tax, params, navigate, refresh]);
  const listStart = useQuestionListStart(page, Boolean(result));
  const error = requestError || selectionError;
  function select(q: ImageQuestion, checked: boolean) {
    setSelectionError('');
    try {
      const next = checked
        ? [...selected.filter((x) => x.id !== q.id), q]
        : selected.filter((x) => x.id !== q.id);
      setSelected(next.length ? orderedQuestions(next, tax) : []);
    } catch (e) {
      setSelectionError((e as Error).message);
    }
  }
  const name = (
    kind: 'chapters' | 'topics' | 'subtopics',
    id: string,
    retiredName?: string | null,
  ) => retiredName ?? tax[kind].find((t) => t.id === id)?.name ?? '';
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MATRICULATION PHYSICS</p>
          <h1>Question bank</h1>
          <p>Choose questions and download a PDF with matching answers.</p>
        </div>
        {session.user?.role === 'admin' && (
          <a href="/edit/new" className="button primary">
            Add question
          </a>
        )}
      </div>
      <div className="browser-layout">
        <aside className="panel filters">
          <h2>Browse by syllabus</h2>
          <CurriculumFields
            tax={tax}
            value={mapping}
            onChange={(next) => {
              if (
                next.curriculumVersionId !== mapping.curriculumVersionId ||
                next.semesterId !== mapping.semesterId
              )
                setSelected([]);
              setSelectionError('');
              navigate({
                curriculum: next.curriculumVersionId,
                semester: next.semesterId,
                chapter: next.chapterId,
                topic: next.topicId,
                subtopic: next.subtopicId,
                difficulty: next.difficultyId,
                page: '1',
              });
            }}
          />
          {session.user?.role === 'admin' && (
            <Field label="Status">
              <select
                value={params.get('status') ?? 'approved'}
                onChange={(e) => {
                  navigate({ status: e.target.value, page: '1' });
                }}
              >
                {['approved', 'draft', 'reviewing', 'retired'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Search question ID or topic">
            <input
              type="search"
              value={params.get('q') ?? ''}
              maxLength={200}
              onChange={(e) => {
                navigate({ q: e.target.value, page: '1' });
              }}
            />
          </Field>
          <a href="/curriculum">View syllabus hierarchy</a>
          {session.user?.role === 'admin' && <a href="/admin/legacy">Legacy archive</a>}
        </aside>
        <section className="results" aria-label="Matching questions">
          {selected.length > 0 && (
            <section className="panel selection-bar" aria-label="Selected questions">
              <strong>
                {selected.length} selected - {selected.reduce((n, q) => n + q.totalMarks, 0)} total
                marks
              </strong>
              <a
                className="button primary"
                href={'/question-set?ids=' + selected.map((q) => q.id).join(',')}
              >
                Create combined PDF
              </a>
              <button onClick={() => setSelected([])}>Clear selection</button>
              <ol>
                {selected.slice(0, 3).map((q) => (
                  <li key={q.id}>
                    {name('chapters', q.chapterId, q.retiredClassification?.chapter)} -{' '}
                    {q.totalMarks} marks{' '}
                    <button aria-label={'Remove ' + q.id} onClick={() => select(q, false)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
              {selected.length > 3 && (
                <p>
                  {selected.length - 3} more selected. Review the full selection in your question
                  set.
                </p>
              )}
            </section>
          )}
          <div ref={listStart} tabIndex={-1} className="question-list-start">
            <h2>Matching questions</h2>
          </div>
          {loading && <p role="status">Loading questions...</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!loading && !requestError && result?.total === 0 && (
            <div className="empty">
              <h2>No questions match these filters</h2>
              <p>Published image questions appear here after administrator review.</p>
            </div>
          )}
          <div className="question-grid">
            {!loading &&
              !requestError &&
              result?.items.map((q) => (
                <article className="question-card" key={q.id}>
                  <p className="taxonomy-path">
                    {name('chapters', q.chapterId, q.retiredClassification?.chapter)} /{' '}
                    {name('topics', q.topicId, q.retiredClassification?.topic)} /{' '}
                    {q.subtopicId
                      ? name('subtopics', q.subtopicId, q.retiredClassification?.subtopic)
                      : 'Subtopic: Not specified'}
                  </p>
                  <h2>
                    {q.totalMarks} marks ?{' '}
                    {tax.difficulties.find((d) => d.id === q.difficultyId)?.name.toUpperCase()}
                  </h2>
                  <code>{q.id}</code>
                  {q.questionImage.thumbnailUrl && (
                    <a href={'/questions/' + q.id}>
                      <img
                        loading="lazy"
                        decoding="async"
                        className="question-thumbnail"
                        src={q.questionImage.thumbnailUrl}
                        alt="Question preview"
                      />
                    </a>
                  )}
                  <div className="actions">
                    {q.status === 'approved' && (
                      <label className="check">
                        <input
                          type="checkbox"
                          aria-label={'Select ' + q.id}
                          checked={selected.some((x) => x.id === q.id)}
                          disabled={selected.length >= 50 && !selected.some((x) => x.id === q.id)}
                          onChange={(e) => select(q, e.target.checked)}
                        />
                        Select
                      </label>
                    )}
                    <a className="button" href={'/questions/' + q.id}>
                      Preview
                    </a>
                    {session.user?.role === 'admin' && (
                      <a className="button" href={'/edit/' + q.id}>
                        Edit
                      </a>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {result && <Pagination info={result} onChange={setPage} />}
        </section>
      </div>
    </>
  );
}
