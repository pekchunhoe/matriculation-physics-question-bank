import { useEffect, useState } from 'react';
import { api } from './api';
import {
  Pagination,
  useQuestionLocation,
  useQuestionPage,
  useQuestionListStart,
} from './Pagination';
type Legacy = {
  id: string;
  question_code: string;
  title: string;
  status: string;
  total_marks: number;
};
export function LegacyArchive() {
  const { query, page, setPage, replacePage } = useQuestionLocation();
  const filters = new URLSearchParams(query);
  filters.set('paginated', 'true');
  const {
    result,
    error: requestError,
    loading,
  } = useQuestionPage<Legacy>('/admin/legacy-questions', filters.toString(), replacePage);
  const listStart = useQuestionListStart(page, Boolean(result));
  const [detailId, setDetailId] = useState(''),
    [error, setError] = useState(''),
    [detail, setDetail] = useState('');
  useEffect(() => {
    setDetailId('');
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail('');
    setError('');
    if (detailId)
      void api('/admin/legacy-questions/' + detailId, { signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) setDetail(JSON.stringify(value, null, 2));
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [detailId]);
  return (
    <section className="panel">
      <p className="eyebrow">PRESERVED RECORDS</p>
      <h1>Legacy archive</h1>
      <p>
        Original records and revision history are preserved. Supply the original question and answer
        images to create an image record under the same Question ID. Conversion saves a draft.
      </p>
      <div ref={listStart} tabIndex={-1} className="question-list-start">
        <h2>Unconverted questions</h2>
      </div>
      {loading && <p role="status">Loading questions...</p>}
      {(requestError || error) && (
        <p role="alert" className="error">
          {requestError || error}
        </p>
      )}
      {result?.total === 0 && <p>No unconverted legacy records.</p>}
      {result?.items.map((q) => (
        <article className="panel" key={q.id}>
          <h2>{q.title}</h2>
          <p>
            {q.question_code} · {q.status} · {q.total_marks} marks
          </p>
          <code>{q.id}</code>
          <div className="actions">
            <a className="button" href={'/edit/new?legacy=' + encodeURIComponent(q.id)}>
              Supply image pair
            </a>
            <button onClick={() => setDetailId(q.id)}>View preserved record</button>
          </div>
        </article>
      ))}
      {detail && <pre className="archive-data">{detail}</pre>}
      {result && <Pagination info={result} onChange={setPage} label="Legacy archive pages" />}
    </section>
  );
}
