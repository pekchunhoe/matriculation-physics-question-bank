import { useEffect, useState } from 'react';
import type { QuestionDocument } from '../shared/schema';
import { api } from './api';
import { ContentPreview } from './Preview';
export function QuestionSet() {
  const query = new URLSearchParams(location.search),
    ids = query.get('ids') ?? '';
  const [answers, setAnswers] = useState(query.get('answers') === 'true'),
    [hints, setHints] = useState(query.get('hints') === 'true');
  const [items, setItems] = useState<{ id: string; document: QuestionDocument }[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setItems([]);
    setError('');
    setLoading(true);
    const options = new URLSearchParams({ ids, answers: String(answers), hints: String(hints) });
    void api<{ items: { id: string; document: QuestionDocument }[] }>(
      '/public/question-set?' + options,
    )
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ids, answers, hints]);
  return (
    <>
      <div className="page-heading print-controls">
        <div>
          <p className="eyebrow">QUESTION SELECTION</p>
          <h1>Question set</h1>
          <p>Print your selection or choose Save as PDF in the print dialog.</p>
        </div>
        <a className="button" href="/">
          Back to question bank
        </a>
      </div>
      <div className="panel print-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={answers}
            onChange={(event) => setAnswers(event.target.checked)}
          />
          Include marking schemes
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={hints}
            onChange={(event) => setHints(event.target.checked)}
          />
          Include student hints
        </label>
        <button
          className="button primary"
          disabled={loading || !items.length || Boolean(error)}
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>
      {loading && <p role="status">Preparing approved questions…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="print-set">
        {items.map((item) => (
          <section className="print-question" key={item.id}>
            <ContentPreview doc={item.document} teacher={answers} print />
          </section>
        ))}
      </div>
    </>
  );
}
