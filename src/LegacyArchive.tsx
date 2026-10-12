import { useEffect, useState } from 'react';
import { api } from './api';
type Legacy = {
  id: string;
  question_code: string;
  title: string;
  status: string;
  total_marks: number;
};
export function LegacyArchive() {
  const [items, setItems] = useState<Legacy[]>([]),
    [error, setError] = useState(''),
    [detail, setDetail] = useState(''),
    [page, setPage] = useState(1);
  useEffect(() => {
    setError('');
    setDetail('');
    void api<Legacy[]>('/admin/legacy-questions?page=' + page)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [page]);
  return (
    <section className="panel">
      <p className="eyebrow">PRESERVED RECORDS</p>
      <h1>Legacy archive</h1>
      <p>
        Original records and revision history are preserved. Supply the original question and answer
        images to create an image record under the same Question ID. Conversion saves a draft.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!items.length && <p>No unconverted legacy records.</p>}
      {items.map((q) => (
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
            <button
              onClick={() =>
                void api('/admin/legacy-questions/' + q.id)
                  .then((v) => setDetail(JSON.stringify(v, null, 2)))
                  .catch((e) => setError(e.message))
              }
            >
              View preserved record
            </button>
          </div>
        </article>
      ))}
      {detail && <pre className="archive-data">{detail}</pre>}
      <nav className="pagination" aria-label="Legacy archive pages">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button disabled={items.length < 100} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    </section>
  );
}
