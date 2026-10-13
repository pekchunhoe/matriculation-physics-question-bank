import { useEffect, useMemo, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import {
  orderedQuestions,
  type ImageQuestion,
  type ImageQuestionList,
} from '../shared/image-question';
import { api } from './api';
import { useAuth } from './Auth';
import { Field } from './components';
import { CurriculumFields, emptyMapping } from './CurriculumFields';
export function Browser({ tax }: { tax: Taxonomy }) {
  const { session } = useAuth();
  const initial = new URLSearchParams(location.search);
  const [mapping, setMapping] = useState({
      ...emptyMapping,
      curriculumVersionId:
        initial.get('curriculum') ??
        tax.curriculumVersions?.find((v) => v.status === 'active')?.id ??
        '',
      semesterId: initial.get('semester') ?? '',
    }),
    [status, setStatus] = useState('approved'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [result, setResult] = useState<ImageQuestionList>(),
    [selected, setSelected] = useState<ImageQuestion[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const filters = useMemo(
    () =>
      new URLSearchParams(
        Object.entries({
          curriculum: mapping.curriculumVersionId,
          semester: mapping.semesterId,
          chapter: mapping.chapterId,
          topic: mapping.topicId,
          subtopic: mapping.subtopicId,
          difficulty: mapping.difficultyId,
          status,
          q: search,
          page: String(page),
        }).filter(([, v]) => Boolean(v)),
      ).toString(),
    [mapping, status, search, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    history.replaceState(null, '', '/?' + filters);
    void api<ImageQuestionList>('/questions?' + filters, { signal: controller.signal })
      .then(setResult)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters]);
  function select(q: ImageQuestion, checked: boolean) {
    setError('');
    try {
      const next = checked ? [...selected, q] : selected.filter((x) => x.id !== q.id);
      setSelected(next.length ? orderedQuestions(next, tax) : []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const name = (kind: 'chapters' | 'topics' | 'subtopics', id: string) =>
    tax[kind].find((t) => t.id === id)?.name ?? '';
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MATRICULATION PHYSICS</p>
          <h1>Question bank</h1>
          <p>Choose questions and download a PDF with matching answers.</p>
        </div>
        {session.authenticated && (
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
              setMapping(next);
              setPage(1);
            }}
          />
          {session.authenticated && (
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
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
              value={search}
              maxLength={200}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <a href="/curriculum">View syllabus hierarchy</a>
          {session.authenticated && <a href="/admin/legacy">Legacy archive</a>}
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
                {selected.map((q) => (
                  <li key={q.id}>
                    {name('chapters', q.chapterId)} - {q.totalMarks} marks{' '}
                    <button aria-label={'Remove ' + q.id} onClick={() => select(q, false)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {loading && <p role="status">Loading questions...</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!loading && !result?.items.length && (
            <div className="empty">
              <h2>No questions match these filters</h2>
              <p>Published image questions appear here after administrator review.</p>
            </div>
          )}
          <div className="question-grid">
            {!error &&
              result?.items.map((q) => (
                <article className="question-card" key={q.id}>
                  <p className="taxonomy-path">
                    {name('chapters', q.chapterId)} / {name('topics', q.topicId)} /{' '}
                    {q.subtopicId ? name('subtopics', q.subtopicId) : 'Subtopic: Not specified'}
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
                    {session.authenticated && (
                      <a className="button" href={'/edit/' + q.id}>
                        Edit
                      </a>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {result && result.pages > 1 && (
            <nav className="pagination" aria-label="Question pages">
              <button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {result.pages}
              </span>
              <button disabled={page >= result.pages || loading} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
