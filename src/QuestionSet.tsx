import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { orderedQuestions, type ImageQuestion } from '../shared/image-question';
import { api } from './api';
import { questionPagination } from '../shared/pagination';
import { Pagination, useQuestionLocation, useQuestionListStart } from './Pagination';
export function QuestionSet() {
  const { params, page, navigate, setPage, replacePage } = useQuestionLocation();
  const ids = params.get('ids') ?? '';
  const [items, setItems] = useState<ImageQuestion[]>([]),
    [tax, setTax] = useState<Taxonomy>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [loadedIds, setLoadedIds] = useState<string>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    if (!ids) {
      setLoadedIds(ids);
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
        if (active) {
          setLoadedIds(ids);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [ids]);
  const ready = !loading && loadedIds === ids,
    pagination = questionPagination(items.length, page),
    offset = (pagination.page - 1) * pagination.pageSize,
    listStart = useQuestionListStart(pagination.page, ready);
  useEffect(() => {
    if (ready && !error && page !== pagination.page) replacePage(pagination.page);
  }, [ready, error, page, pagination.page, replacePage]);
  async function exportPdf() {
    if (busy || !ready || !items.length || !tax) return;
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
          {ready ? items.length : 0} questions -{' '}
          {ready ? items.reduce((n, q) => n + q.totalMarks, 0) : 0} total marks
        </h2>
        <p>A4 PDF - up to 50 questions - one syllabus and semester - 64 MiB image budget</p>
        <button
          className="button primary"
          disabled={busy || !ready || !items.length || Boolean(error)}
          onClick={() => void exportPdf()}
        >
          {busy ? 'Preparing PDF...' : 'Download combined PDF'}
        </button>
        {!ids && <p>Select questions from the bank to begin.</p>}
      </section>
      {!ready && <p role="status">Loading selection...</p>}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {ready && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div ref={listStart} tabIndex={-1} className="question-list-start">
        <h2>Selected questions in syllabus order</h2>
      </div>
      <ol
        className="set-order"
        start={offset + 1}
        aria-label="Selected questions in syllabus order"
      >
        {ready &&
          items.slice(offset, offset + pagination.pageSize).map((q, index) => (
            <li className="panel" key={q.id}>
              <strong>
                Question {offset + index + 1} / Answer {offset + index + 1}
              </strong>
              <p>
                {tax?.chapters.find((t) => t.id === q.chapterId)?.name} ?{' '}
                {tax?.topics.find((t) => t.id === q.topicId)?.name} ? {q.totalMarks} marks
              </p>
              <code>{q.id}</code>
              <button
                className="button"
                disabled={busy}
                aria-label={'Remove Question ' + (offset + index + 1)}
                onClick={() =>
                  navigate({
                    ids: ids
                      .split(',')
                      .filter((v) => v !== q.id)
                      .join(','),
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
      </ol>
      {ready && items.length > 0 && (
        <Pagination
          info={pagination}
          onChange={setPage}
          label="Selected question pages"
          disabled={busy}
        />
      )}
    </>
  );
}
