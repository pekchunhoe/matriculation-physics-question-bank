import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { api } from './api';
import { Field } from './components';
import { useAuth } from './Auth';
import { inStoredOrder } from './taxonomy-order';
type Card = {
  id: string;
  question_code: string;
  title: string;
  semester: string;
  chapter: string;
  topic: string;
  subtopic: string | null;
  difficulty: string;
  total_marks: number;
  estimated_minutes: number;
  status: string;
  contains_diagram: number;
  contains_graph: number;
  contains_fbd: number;
  has_solution: number;
  has_hints: number;
  original_pdf: string | null;
};
type Results = { items: Card[]; total: number; page: number; pages: number };
type Count = {
  semester_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  difficulty_id: string | null;
  count: number;
};
export function Browser({ tax }: { tax: Taxonomy }) {
  const { session } = useAuth();
  const [selection, setSelection] = useState<{ id: string; title: string }[]>([]);
  const initial = () => Object.fromEntries(new URLSearchParams(location.search));
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    status: 'approved',
    course: tax.courses[0]?.id ?? '',
    curriculum: initial().semester && !initial().curriculum ? '' : 'active',
    taxonomyStatus: initial().semester && !initial().taxonomyStatus ? 'all' : 'active',
    ...initial(),
  }));
  const [results, setResults] = useState<Results | null>(null),
    [counts, setCounts] = useState<Count[]>([]),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false);
  function update(key: string, value: string) {
    setFilters((previous) => {
      const next = { ...previous, page: '1', [key]: value };
      if (key === 'course' || key === 'curriculum' || key === 'taxonomyStatus')
        for (const k of ['semester', 'chapter', 'topic', 'subtopic']) delete next[k];
      if (key === 'course') next.curriculum = 'active';
      if (key === 'semester') for (const k of ['chapter', 'topic', 'subtopic']) delete next[k];
      if (key === 'chapter') for (const k of ['topic', 'subtopic']) delete next[k];
      if (key === 'topic') delete next.subtopic;
      return next;
    });
  }
  useEffect(() => {
    const onPop = () => setFilters({ status: 'approved', ...initial() });
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    history.replaceState(null, '', '/?' + query);
    const timer = setTimeout(() => {
      api<Results>('/questions?' + query)
        .then((v) => {
          if (active) {
            setResults(v);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters]);
  useEffect(() => {
    void api<Count[]>('/counts?course=' + encodeURIComponent(filters.course ?? ''))
      .then(setCounts)
      .catch((e) => setError(e.message));
  }, [filters.course]);
  const visible = (status?: string) => filters.taxonomyStatus !== 'active' || status !== 'retired';
  const versions = (tax.curriculumVersions ?? []).filter(
    (v) =>
      (!filters.course || v.courseId === filters.course) &&
      (!filters.curriculum || filters.curriculum === 'active'
        ? !filters.curriculum || v.status === 'active'
        : v.id === filters.curriculum),
  );
  const semesters = inStoredOrder(
      tax.semesters.filter(
        (s) =>
          (!filters.course || s.parentId === filters.course) &&
          visible(s.status) &&
          (!tax.curriculumVersions || versions.some((v) => v.id === s.curriculumVersionId)),
      ),
    ),
    chapters = inStoredOrder(
      tax.chapters.filter(
        (c) =>
          visible(c.status) &&
          (!filters.semester || c.parentId === filters.semester) &&
          semesters.some((s) => s.id === c.parentId),
      ),
    ),
    topics = inStoredOrder(
      tax.topics.filter(
        (t) =>
          visible(t.status) &&
          (!filters.chapter || t.parentId === filters.chapter) &&
          chapters.some((c) => c.id === t.parentId),
      ),
    ),
    subtopics = tax.subtopics.filter(
      (t) =>
        visible(t.status) &&
        topics.some((p) => p.id === t.parentId) &&
        (!filters.topic || filters.topic.split(',').includes(t.parentId!)),
    );
  const count = (
    field: 'semester_id' | 'chapter_id' | 'topic_id',
    id: string,
    difficulty?: string,
  ) =>
    counts
      .filter((c) => c[field] === id && (!difficulty || c.difficulty_id === difficulty))
      .reduce((s, c) => s + c.count, 0);
  const select = (label: string, key: string, items: { id: string; name: string }[]) => (
    <Field label={label}>
      <select value={filters[key] ?? ''} onChange={(e) => update(key, e.target.value)}>
        <option value="">All</option>
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {session.authenticated ? 'TEACHER LIBRARY' : 'PUBLIC QUESTION BANK'}
          </p>
          <h1>Question bank</h1>
          <p>Browse by semester, topic and difficulty.</p>
        </div>
        <span className="count-label">{results?.total ?? '—'} matching questions</span>
      </div>
      {select('Course', 'course', tax.courses)}
      <section className="panel" aria-label="Question selection">
        <h2>Question selection ({selection.length}/20)</h2>
        <p>Select approved questions to export as PDF or Word. Exports follow syllabus order.</p>
        {selection.length > 0 && (
          <>
            <ol>
              {selection.map((item) => (
                <li key={item.id}>
                  {item.title}{' '}
                  <button
                    className="text-button"
                    onClick={() =>
                      setSelection((items) => items.filter((selected) => selected.id !== item.id))
                    }
                  >
                    Remove {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <a
              className="button"
              href={'/question-set?ids=' + selection.map((item) => item.id).join(',')}
            >
              Prepare question set
            </a>
            <button className="button" onClick={() => setSelection([])}>
              Clear selection
            </button>
          </>
        )}
      </section>
      <details className="panel">
        <summary>Curriculum version and retired items</summary>
        <div className="form-grid">
          <Field label="Browse curriculum version">
            <select
              value={filters.curriculum ?? ''}
              onChange={(e) => update('curriculum', e.target.value)}
            >
              <option value="active">Active curriculum</option>
              <option value="">All versions</option>
              {(tax.curriculumVersions ?? [])
                .filter((v) => !filters.course || v.courseId === filters.course)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name} ({v.status})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Curriculum item visibility">
            <select
              value={filters.taxonomyStatus ?? 'all'}
              onChange={(e) => update('taxonomyStatus', e.target.value)}
            >
              <option value="active">Active items</option>
              <option value="all">Include retired items</option>
            </select>
          </Field>
        </div>
      </details>
      <div className="semester-grid">
        {semesters.map((s) => (
          <button
            className={'semester-card ' + (filters.semester === s.id ? 'selected' : '')}
            key={s.id}
            onClick={() => update('semester', filters.semester === s.id ? '' : s.id)}
            aria-pressed={filters.semester === s.id}
          >
            <span>{s.name}</span>
            <strong>
              {count('semester_id', s.id)}
              <small>
                {session.authenticated ? ' questions · all statuses' : ' approved questions'}
              </small>
            </strong>
            <span className="semester-action">Browse questions</span>
          </button>
        ))}
      </div>
      <button
        className="mobile-filter button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="filters"
      >
        {open ? 'Close filters' : 'Filters'}
      </button>
      <div className="bank-layout">
        <aside id="filters" className={'filter-panel ' + (open ? 'is-open' : '')}>
          <h2>Find questions</h2>
          {select('Semester', 'semester', semesters)}
          <fieldset className="topic-options">
            <legend>Topic</legend>
            {!topics.length && <p className="muted">No topics available for these filters.</p>}
            {semesters
              .filter((semester) =>
                chapters.some(
                  (chapter) =>
                    chapter.parentId === semester.id &&
                    topics.some((topic) => topic.parentId === chapter.id),
                ),
              )
              .map((semester) => (
                <fieldset className="topic-semester" key={semester.id}>
                  <legend>
                    {semester.name}
                    {new Set(semesters.map((s) => s.curriculumVersionId)).size > 1 && (
                      <span className="muted">
                        {' '}
                        {
                          tax.curriculumVersions?.find((v) => v.id === semester.curriculumVersionId)
                            ?.name
                        }
                      </span>
                    )}
                  </legend>
                  {chapters
                    .filter(
                      (chapter) =>
                        chapter.parentId === semester.id &&
                        topics.some((topic) => topic.parentId === chapter.id),
                    )
                    .map((chapter) => (
                      <fieldset className="topic-chapter" key={chapter.id}>
                        <legend>{chapter.name}</legend>
                        {topics
                          .filter((t) => t.parentId === chapter.id)
                          .map((t) => (
                            <label key={t.id} className="check">
                              <input
                                type="checkbox"
                                checked={filters.topic?.split(',').includes(t.id) ?? false}
                                onChange={(e) => {
                                  const values = new Set(filters.topic?.split(',').filter(Boolean));
                                  if (e.target.checked) values.add(t.id);
                                  else values.delete(t.id);
                                  update('topic', [...values].join(','));
                                }}
                              />
                              {t.name}
                              {t.isTest && <small>Test</small>}
                            </label>
                          ))}
                      </fieldset>
                    ))}
                </fieldset>
              ))}
          </fieldset>
          {select('Difficulty', 'difficulty', tax.difficulties)}
          <details>
            <summary>More filters</summary>
            {select('Chapter', 'chapter', chapters)}
            {select('Subtopic', 'subtopic', subtopics)}
            {session.authenticated &&
              select(
                'Status',
                'status',
                ['draft', 'reviewing', 'approved', 'retired'].map((id) => ({
                  id,
                  name: id[0].toUpperCase() + id.slice(1),
                })),
              )}
            {select(
              'Question type',
              'type',
              ['structured', 'multiple_choice', 'short_answer', 'essay'].map((id) => ({
                id,
                name: id.replaceAll('_', ' '),
              })),
            )}
            <div className="two-columns">
              <Field label="Minimum marks">
                <input
                  type="number"
                  min="0"
                  value={filters.minMarks ?? ''}
                  onChange={(e) => update('minMarks', e.target.value)}
                />
              </Field>
              <Field label="Maximum marks">
                <input
                  type="number"
                  min="0"
                  value={filters.maxMarks ?? ''}
                  onChange={(e) => update('maxMarks', e.target.value)}
                />
              </Field>
            </div>
            {['diagram', 'graph', 'fbd'].map((key) =>
              select('Contains ' + key.toUpperCase(), key, [
                { id: 'true', name: 'Yes' },
                { id: 'false', name: 'No' },
              ]),
            )}
            <Field label="Tags (comma separated)">
              <input value={filters.tags ?? ''} onChange={(e) => update('tags', e.target.value)} />
            </Field>
          </details>
          <button
            className="button"
            onClick={() =>
              setFilters({
                course: filters.course,
                status: 'approved',
                curriculum: 'active',
                taxonomyStatus: 'active',
              })
            }
          >
            Reset filters
          </button>
        </aside>
        <section className="results" aria-label="Matching questions">
          <Field label="Search the question bank">
            <input
              type="search"
              placeholder="Question code, wording, topic or tags…"
              value={filters.q ?? ''}
              onChange={(e) => update('q', e.target.value)}
            />
          </Field>
          {filters.semester && (
            <div className="topic-browser">
              <h2>Chapters and topics</h2>
              {chapters.map((c) => (
                <div key={c.id} className="chapter-row">
                  <button
                    className="text-button"
                    onClick={() => update('chapter', filters.chapter === c.id ? '' : c.id)}
                  >
                    {c.name}
                    {c.isTest ? ' (test taxonomy)' : ''} · {count('chapter_id', c.id)}
                  </button>
                  {inStoredOrder(
                    tax.topics.filter((t) => t.parentId === c.id && visible(t.status)),
                  ).map((t) => (
                    <button
                      className={
                        'topic-row ' + (filters.topic?.split(',').includes(t.id) ? 'selected' : '')
                      }
                      key={t.id}
                      onClick={() => update('topic', t.id)}
                    >
                      <span>{t.name}</span>
                      <small>
                        {tax.difficulties
                          .map((d) => `${d.name}: ${count('topic_id', t.id, d.id)}`)
                          .join(' · ')}
                      </small>
                    </button>
                  ))}
                </div>
              ))}
              {!chapters.length && (
                <p className="muted">
                  The chapter and topic structure is awaiting your authoritative curriculum.
                </p>
              )}
            </div>
          )}
          {loading && <p role="status">Searching…</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!loading && !error && results?.items.length === 0 && (
            <div className="empty">
              <span className="empty-symbol">φ</span>
              <h2>
                {counts.some((c) => c.count)
                  ? 'No questions match these filters'
                  : 'Your question bank is ready for content'}
              </h2>
              <p>
                {counts.some((c) => c.count)
                  ? 'Try another topic, difficulty or status.'
                  : 'Add your curriculum, then import your first reviewed Physics question.'}
              </p>
              <a className="button" href="/curriculum">
                Manage curriculum
              </a>
              <a className="button" href="/import">
                Import a question
              </a>
            </div>
          )}
          <div className="question-grid">
            {!error &&
              results?.items.map((q) => (
                <article className="question-card" key={q.id}>
                  <div className="card-meta">
                    <code>{q.question_code}</code>
                    <span className={'badge ' + q.status}>{q.status}</span>
                  </div>
                  <h2>{q.title}</h2>
                  <p className="taxonomy-path">
                    {q.semester} · {q.chapter}
                    <br />
                    {q.topic}
                    {q.subtopic && <> · {q.subtopic}</>}
                  </p>
                  <div className="metrics">
                    <span className="difficulty">{q.difficulty}</span>
                    <span>{q.total_marks} marks</span>
                    <span>{q.estimated_minutes} min</span>
                  </div>
                  <p className="availability">
                    {[
                      q.contains_diagram ? 'Diagram' : null,
                      q.contains_graph ? 'Graph' : null,
                      q.contains_fbd ? 'FBD' : null,
                      q.has_solution ? 'Answer scheme' : null,
                      q.has_hints ? 'Hints' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No supporting assets'}
                  </p>
                  <div className="actions">
                    {q.status === 'approved' && (
                      <label className="check">
                        <input
                          type="checkbox"
                          aria-label={'Select ' + q.question_code}
                          checked={selection.some((item) => item.id === q.id)}
                          disabled={
                            selection.length >= 20 && !selection.some((item) => item.id === q.id)
                          }
                          onChange={(event) =>
                            setSelection((items) =>
                              event.target.checked
                                ? [...items, { id: q.id, title: q.title }]
                                : items.filter((item) => item.id !== q.id),
                            )
                          }
                        />
                        Select
                      </label>
                    )}
                    <a className="button" href={'/questions/' + q.id + '?view=student'}>
                      Preview
                    </a>
                    {session.authenticated && (
                      <a className="button" href={'/edit/' + q.id}>
                        Edit
                      </a>
                    )}
                    <a className="text-link" href={'/questions/' + q.id}>
                      View solution
                    </a>
                    {q.original_pdf && (
                      <a
                        className="text-link"
                        href={q.original_pdf}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Original PDF
                      </a>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {results && results.pages > 1 && (
            <nav className="pagination" aria-label="Question pages">
              <button
                disabled={results.page === 1}
                onClick={() => update('page', String(results.page - 1))}
              >
                Previous
              </button>
              <span>
                Page {results.page} of {results.pages}
              </span>
              <button
                disabled={results.page === results.pages}
                onClick={() => update('page', String(results.page + 1))}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
