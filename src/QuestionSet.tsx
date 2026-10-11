import { useEffect, useMemo, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import {
  exportPlan,
  exportFilename,
  groupHeadings,
  type ExportItem,
  type ExportMode,
} from '../shared/export-plan';
import { api } from './api';
import { Field } from './components';
import { MasterPrint } from './MasterPrint';
export function QuestionSet() {
  const initial = new URLSearchParams(location.search);
  const [ids, setIds] = useState(initial.get('ids') ?? ''),
    [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [mode, setMode] = useState<ExportMode>(
    initial.get('document') === 'answer' || initial.get('answers') === 'true'
      ? 'answer'
      : 'question',
  );
  const [tax, setTax] = useState<Taxonomy | null>(null),
    [items, setItems] = useState<ExportItem[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  useEffect(() => {
    void api<Taxonomy>('/taxonomy')
      .then(setTax)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setError('');
    setStatus('');
    setLoading(true);
    setItems([]);
    const query = new URLSearchParams(location.search);
    query.set('ids', ids);
    query.set('document', mode);
    query.delete('answers');
    query.delete('hints');
    history.replaceState(null, '', '/question-set?' + query);
    if (!ids) {
      setLoading(false);
      return;
    }
    const options = new URLSearchParams({
      ids,
      answers: String(mode === 'answer'),
      hints: String(mode === 'answer'),
    });
    void api<{ items: ExportItem[] }>('/public/question-set?' + options)
      .then((result) => {
        if (active) setItems(result.items);
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
  }, [ids, mode]);
  const prepared = useMemo(() => {
    try {
      return { plan: tax ? exportPlan(items, tax) : [], error: '' };
    } catch (e) {
      return { plan: [], error: (e as Error).message };
    }
  }, [items, tax]);
  const { plan } = prepared;
  async function exportDocument() {
    if (busy || loading || !tax || !plan.length || error || prepared.error) return;
    setBusy(true);
    setError('');
    setStatus('Preparing export...');
    try {
      // Recheck eligibility immediately before either export; never trust an old selection cache.
      const fresh = await api<{ items: ExportItem[] }>(
        '/public/question-set?' +
          new URLSearchParams({
            ids,
            answers: String(mode === 'answer'),
            hints: String(mode === 'answer'),
          }),
      );
      const freshTax = await api<Taxonomy>('/taxonomy');
      const currentPlan = exportPlan(fresh.items, freshTax);
      setTax(freshTax);
      setItems(fresh.items);
      const filename = exportFilename(currentPlan, mode, format);
      if (format === 'docx') {
        const { createWordExport, browserImageLoader } = await import('./word-export');
        const bytes = await createWordExport(currentPlan, mode, freshTax, browserImageLoader);
        const url = URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('Word document downloaded.');
      } else {
        // Wait for refreshed React content and original images before invoking device printing.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        await document.fonts.ready;
        await Promise.all(
          [...document.querySelectorAll<HTMLImageElement>('.print-set img')].map((img) =>
            img.decode(),
          ),
        );
        const title = document.title;
        document.title = filename.replace(/\.pdf$/, '');
        try {
          window.print();
        } finally {
          document.title = title;
        }
        setStatus('Print dialog opened. Choose Save as PDF.');
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading print-controls">
        <div>
          <p className="eyebrow">QUESTION SELECTION</p>
          <h1>Question set</h1>
          <p>Export selected approved questions in syllabus order.</p>
        </div>
        <a className="button" href="/">
          Back to question bank
        </a>
      </div>
      <section className="panel print-controls" aria-label="Export options">
        <div className="export-options">
          <Field label="Export format">
            <select
              value={format}
              disabled={busy}
              onChange={(e) => {
                setError('');
                setStatus('');
                setFormat(e.target.value as 'pdf' | 'docx');
              }}
            >
              <option value="pdf">PDF</option>
              <option value="docx">Word (.docx)</option>
            </select>
          </Field>
          <Field label="Document">
            <select
              value={mode}
              disabled={busy}
              onChange={(e) => setMode(e.target.value as ExportMode)}
            >
              <option value="question">Question</option>
              <option value="answer">Answer Scheme with Student's Hints</option>
            </select>
          </Field>
          <button
            className="button primary"
            disabled={busy || loading || !plan.length || !tax || Boolean(error || prepared.error)}
            onClick={() => void exportDocument()}
          >
            {busy ? 'Preparing...' : 'Export'}
          </button>
        </div>
        {format === 'pdf' && (
          <p className="muted">PDF opens your device's print dialog. Choose Save as PDF.</p>
        )}
        {!ids && <p>Select at least one question to export.</p>}
      </section>
      <ol className="set-order print-controls" aria-label="Selected questions in syllabus order">
        {plan.map((item) => (
          <li key={item.id}>
            <span>
              Question {item.displayNumber}: {item.document.question.title}
            </span>
            <button
              className="button"
              disabled={loading || busy}
              aria-label={'Remove Question ' + item.displayNumber}
              onClick={() =>
                setIds(
                  ids
                    .split(',')
                    .filter((id) => id !== item.id)
                    .join(','),
                )
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      {(loading || status) && (
        <p className="print-controls" role="status">
          {loading ? 'Preparing approved questions...' : status}
        </p>
      )}
      {(error || prepared.error) && (
        <p className="error print-controls" role="alert">
          {error || prepared.error}
        </p>
      )}
      <div className="print-set" data-document={mode}>
        <h1 className="export-document-title">
          {mode === 'answer' ? "Answer Scheme with Student's Hints" : 'Questions'}
        </h1>
        {tax &&
          !loading &&
          !error &&
          plan.map((item, i) => (
            <MasterPrint
              key={item.id}
              item={item}
              tax={tax}
              answer={mode === 'answer'}
              hints={mode === 'answer'}
              groups={groupHeadings(item, plan[i - 1])}
            />
          ))}
      </div>
    </>
  );
}
