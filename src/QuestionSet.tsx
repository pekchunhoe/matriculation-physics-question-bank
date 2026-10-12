import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { orderedQuestions, type ImageQuestion } from '../shared/image-question';
import { api } from './api';
export function QuestionSet() {
  const [ids, setIds] = useState(new URLSearchParams(location.search).get('ids') ?? ''),
    [items, setItems] = useState<ImageQuestion[]>([]),
    [tax, setTax] = useState<Taxonomy>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    history.replaceState(null, '', '/question-set?ids=' + encodeURIComponent(ids));
    if (!ids) {
      setLoading(false);
      return;
    }
    void Promise.all([
      api<{ items: ImageQuestion[] }>('/public/question-set?ids=' + encodeURIComponent(ids)),
      api<Taxonomy>('/taxonomy'),
    ])
      .then(([r, t]) => {
        if (active) {
          setItems(orderedQuestions(r.items, t));
          setTax(t);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ids]);
  async function exportPdf() {
    if (busy || loading || !items.length || !tax) return;
    setBusy(true);
    setError('');
    setNotice('Checking selected questions...');
    try {
      const [fresh, currentTax, { createImagePdf }] = await Promise.all([
        api<{ items: ImageQuestion[] }>('/public/question-set?ids=' + encodeURIComponent(ids)),
        api<Taxonomy>('/taxonomy'),
        import('./image-pdf'),
      ]);
      const plan = orderedQuestions(fresh.items, currentTax);
      setItems(plan);
      setTax(currentTax);
      const bytes = await createImagePdf(plan, currentTax, undefined, (done, total) =>
        setNotice(`Preparing images ${done} / ${total}...`),
      );
      const url = URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        ),
        link = document.createElement('a');
      link.href = url;
      link.download = 'physics-questions-and-answers.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Combined PDF downloaded. Questions and answers use matching numbering.');
    } catch (e) {
      setNotice('');
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR SELECTION</p>
          <h1>Question set</h1>
          <p>Questions first, then matching answers, automatically ordered by your syllabus.</p>
        </div>
        <a href="/" className="button">
          Back to question bank
        </a>
      </div>
      <section className="panel">
        <h2>
          {items.length} questions - {items.reduce((n, q) => n + q.totalMarks, 0)} total marks
        </h2>
        <p>A4 PDF - up to 50 questions - one syllabus and semester - 64 MiB image budget</p>
        <button
          className="button primary"
          disabled={busy || loading || !items.length || Boolean(error)}
          onClick={() => void exportPdf()}
        >
          {busy ? 'Preparing PDF...' : 'Download combined PDF'}
        </button>
        {!ids && <p>Select questions from the bank to begin.</p>}
      </section>
      {loading && <p role="status">Loading selection...</p>}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <ol className="set-order" aria-label="Selected questions in syllabus order">
        {items.map((q, index) => (
          <li className="panel" key={q.id}>
            <strong>
              Question {index + 1} / Answer {index + 1}
            </strong>
            <p>
              {tax?.chapters.find((t) => t.id === q.chapterId)?.name} ?{' '}
              {tax?.topics.find((t) => t.id === q.topicId)?.name} ? {q.totalMarks} marks
            </p>
            <code>{q.id}</code>
            <button
              className="button"
              disabled={busy}
              aria-label={'Remove Question ' + (index + 1)}
              onClick={() =>
                setIds(
                  ids
                    .split(',')
                    .filter((v) => v !== q.id)
                    .join(','),
                )
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
