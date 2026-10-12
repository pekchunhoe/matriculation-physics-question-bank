import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { imageLimits, type ImageQuestion, type ImageQuestionInput } from '../shared/image-question';
import { api, json } from './api';
import { Field } from './components';
import { CurriculumFields, emptyMapping } from './CurriculumFields';
function usePreview(file: File | undefined, fallback?: string) {
  const [url, setUrl] = useState(fallback ?? '');
  useEffect(() => {
    if (!file) {
      setUrl(fallback ?? '');
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file, fallback]);
  return url;
}
export function Editor({ tax, id }: { tax: Taxonomy; id?: string }) {
  const [saved, setSaved] = useState<ImageQuestion>(),
    [mapping, setMapping] = useState(emptyMapping),
    [marks, setMarks] = useState(''),
    [question, setQuestion] = useState<File>(),
    [answer, setAnswer] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(Boolean(id && id !== 'new'));
  const legacy = new URLSearchParams(location.search).get('legacy');
  const qPreview = usePreview(question, saved?.questionImage.url),
    aPreview = usePreview(answer, saved?.answerImage?.url);
  useEffect(() => {
    if (!id || id === 'new') return;
    void api<ImageQuestion>('/questions/' + id)
      .then((q) => {
        setSaved(q);
        setMapping(q);
        setMarks(String(q.totalMarks));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  function file(event: React.ChangeEvent<HTMLInputElement>, set: (f: File | undefined) => void) {
    setError('');
    setNotice('');
    const f = event.target.files?.[0];
    if (
      f &&
      (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) ||
        f.size > imageLimits.bytes ||
        !f.size)
    ) {
      setError('Choose a PNG, JPEG or WebP up to 1.5 MiB.');
      event.target.value = '';
      set(undefined);
      return;
    }
    set(f);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const metadata: ImageQuestionInput = {
        ...emptyMapping,
        ...Object.fromEntries(
          Object.keys(emptyMapping).map((k) => [k, mapping[k as keyof typeof emptyMapping]]),
        ),
        totalMarks: Number(marks),
        ...(saved
          ? { expectedRevision: saved.revision, confirmPublishedReplacement: confirmed }
          : legacy
            ? { legacyId: legacy }
            : {}),
      };
      const body = new FormData();
      body.set('metadata', JSON.stringify(metadata));
      if (question) body.set('question', question);
      if (answer) body.set('answer', answer);
      const result = await api<{ question: ImageQuestion; duplicateImages: number }>(
        '/questions' + (saved ? '/' + saved.id : ''),
        { method: saved ? 'PUT' : 'POST', body },
      );
      setSaved(result.question);
      setQuestion(undefined);
      setAnswer(undefined);
      setConfirmed(false);
      setNotice(
        `Saved ${result.question.status} question ${result.question.id}.${result.duplicateImages ? ' Identical image bytes already exist; records remain independent.' : ''}`,
      );
      history.replaceState(null, '', '/edit/' + result.question.id);
      for (const input of document.querySelectorAll<HTMLInputElement>('input[type=file]'))
        input.value = '';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function status(value: string) {
    if (
      !saved ||
      busy ||
      !window.confirm(
        value === 'approved'
          ? 'Publish this complete question and answer pair to students?'
          : `Change this question to ${value}? Its images and history will be preserved.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const q = await api<ImageQuestion>(
        '/questions/' + saved.id + '/status',
        json('PATCH', { status: value, expectedRevision: saved.revision, confirmed: true }),
      );
      setSaved(q);
      setNotice(`Question ${q.id} is now ${q.status}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading question...</p>;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATOR</p>
          <h1>{saved ? 'Edit question' : 'Add question'}</h1>
          <p>One question picture and its matching answer picture.</p>
        </div>
        <a href="/admin/legacy" className="button">
          Legacy archive
        </a>
      </div>
      {saved && (
        <p>
          Question ID: <code>{saved.id}</code> - <strong>{saved.status}</strong> - revision{' '}
          {saved.revision}
        </p>
      )}
      {legacy && !saved && (
        <p className="notice">
          The original legacy record stays preserved. This image pair will use Question ID {legacy}{' '}
          and save as a draft.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || (!!id && id !== 'new' && !saved)}>
          <legend className="sr-only">Question editor</legend>
          <section className="panel">
            <h2>A. Image upload</h2>
            <p>
              PNG, JPEG or WebP; up to 1.5 MiB each. Use upright images without embedded question
              numbers. Export numbering is added outside each image.
            </p>
            <div className="image-pair">
              {(['question', 'answer'] as const).map((kind) => (
                <div key={kind}>
                  <Field label={kind === 'question' ? 'Question Picture' : 'Answer Picture'}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required={!saved}
                      onChange={(e) => file(e, kind === 'question' ? setQuestion : setAnswer)}
                    />
                  </Field>
                  {(kind === 'question' ? qPreview : aPreview) && (
                    <img
                      className="upload-preview"
                      src={kind === 'question' ? qPreview : aPreview}
                      alt={
                        kind === 'question' ? 'Question picture preview' : 'Answer picture preview'
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>B. Academic mapping</h2>
            <div className="form-grid">
              <CurriculumFields tax={tax} value={mapping} onChange={setMapping} required admin />
              <Field label="Total Marks">
                <input
                  type="number"
                  required
                  min="1"
                  max="10000"
                  step="1"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                />
              </Field>
            </div>
            {mapping.topicId && !tax.subtopics.some((s) => s.parentId === mapping.topicId) && (
              <p className="notice">
                This topic has no subtopics. Add the authoritative subtopic in{' '}
                <a href="/curriculum">Curriculum</a>, then return to classify this question.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>C. Save</h2>
            {saved?.status === 'approved' && (
              <label className="check">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Confirm replacement of the published question
              </label>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save Question'}
            </button>
            <p>New questions are saved as drafts. Publication is a separate confirmed action.</p>
          </section>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {saved && (
        <section className="panel">
          <h2>Publication</h2>
          <div className="actions">
            {(['draft', 'reviewing', 'approved', 'retired'] as const)
              .filter((s) => s !== saved.status)
              .map((s) => (
                <button disabled={busy} className="button" key={s} onClick={() => void status(s)}>
                  {s === 'approved'
                    ? 'Publish Question'
                    : s === 'retired'
                      ? 'Archive Question'
                      : s === 'reviewing'
                        ? 'Mark for review'
                        : 'Return to draft'}
                </button>
              ))}
            <a className="button" href={'/questions/' + saved.id}>
              Preview saved question
            </a>
          </div>
          <p>
            Archiving preserves both images and revision history. Permanent deletion is disabled.
          </p>
        </section>
      )}
    </>
  );
}
