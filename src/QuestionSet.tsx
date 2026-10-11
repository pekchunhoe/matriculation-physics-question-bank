import { useEffect, useState } from 'react';
import type { QuestionDocument, Taxonomy } from '../shared/schema';
import { api } from './api';
import { MasterPrint } from './MasterPrint';
import { numberingPlan } from '../shared/question-numbering';
export function QuestionSet() {
  const query = new URLSearchParams(location.search);
  const [ids, setIds] = useState(query.get('ids') ?? '');
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [answers, setAnswers] = useState(query.get('answers') === 'true'),
    [hints, setHints] = useState(query.get('hints') === 'true');
  const [items, setItems] = useState<{ id: string; document: QuestionDocument }[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<Taxonomy>('/taxonomy')
      .then(setTax)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
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
  const plan = numberingPlan(
    ids.split(',').flatMap((id) => items.filter((item) => item.id === id)),
  );
  function selection(next: string[]) {
    setIds(next.join(','));
    query.set('ids', next.join(','));
    query.set('answers', String(answers));
    query.set('hints', String(hints));
    history.replaceState(null, '', '/question-set?' + query);
  }
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
            disabled={!answers}
            onChange={(event) => setHints(event.target.checked)}
          />
          Include student hints
        </label>
        <button
          className="button primary"
          disabled={loading || !items.length || !tax || Boolean(error)}
          onClick={async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.querySelectorAll<HTMLImageElement>('.print-set img')).map((img) =>
                img.decode().catch(() => undefined),
              ),
            );
            window.print();
          }}
        >
          Print / Save as PDF
        </button>
      </div>
      <ol className="set-order print-controls" aria-label="Selected question order">
        {plan.map((item, i) => (
          <li key={item.id}>
            <span>
              Question {item.displayNumber}: {item.document.question.title}
            </span>
            <button
              className="button"
              aria-label={`Move Question ${item.displayNumber} up`}
              disabled={i === 0 || loading}
              onClick={() => {
                const next = ids.split(',');
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                selection(next);
              }}
            >
              Move up
            </button>
            <button
              className="button"
              aria-label={`Move Question ${item.displayNumber} down`}
              disabled={i === plan.length - 1 || loading}
              onClick={() => {
                const next = ids.split(',');
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                selection(next);
              }}
            >
              Move down
            </button>
            <button
              className="button"
              aria-label={`Remove Question ${item.displayNumber}`}
              disabled={plan.length === 1 || loading}
              onClick={() => selection(ids.split(',').filter((id) => id !== item.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      {loading && <p role="status">Preparing approved questions…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="print-set">
        {tax && plan.map((item) => <MasterPrint key={item.id} item={item} tax={tax} />)}
        {tax &&
          answers &&
          plan.map((item) => (
            <MasterPrint key={'answer-' + item.id} item={item} tax={tax} answer hints={hints} />
          ))}
      </div>
    </>
  );
}
