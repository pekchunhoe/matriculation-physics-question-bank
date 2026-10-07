import { useState } from 'react';
import type { QuestionDocument, Taxonomy } from '../shared/schema';
import type { Classification } from '../shared/curriculum';
import { api, json } from './api';
import { Field, QuestionMetadata } from './components';
import { ContentPreview } from './Preview';
export function Importer({ tax }: { tax: Taxonomy }) {
  const [source, setSource] = useState(''),
    [doc, setDoc] = useState<QuestionDocument | null>(null),
    [provenance, setProvenance] = useState<Classification | undefined>(undefined),
    [warnings, setWarnings] = useState<string[]>([]),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [author, setAuthor] = useState(''),
    [mode, setMode] = useState('new'),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  async function validate() {
    setBusy(true);
    setError('');
    setDoc(null);
    try {
      const result = await api<{
        document: QuestionDocument;
        warnings: string[];
        savedClassification?: Classification;
      }>('/import/validate', json('POST', { document: JSON.parse(source) }));
      setDoc(result.document);
      setProvenance(result.savedClassification);
      setWarnings(result.warnings);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!doc) return;
    setBusy(true);
    setError('');
    try {
      let target: { id: string; active_version: number } | undefined;
      if (mode === 'revise') {
        const result = await api<{
          items: { id: string; question_code: string; active_version: number }[];
        }>('/questions?q=' + encodeURIComponent(doc.question.questionCode) + '&limit=100');
        target = result.items.find((q) => q.question_code === doc.question.questionCode);
        if (!target)
          throw new Error('No existing question has this code. Choose new question to import it.');
      }
      const result = await api<{ id: string; pending?: boolean }>(
        '/import',
        json('POST', {
          document: provenance
            ? { schemaVersion: 2, document: doc, savedClassification: provenance }
            : doc,
          note,
          author,
          confirmApproval: confirm,
          questionId: target?.id,
          baseVersion: target?.active_version,
        }),
      );
      location.href = '/questions/' + result.id + (result.pending ? '?review=1' : '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STRUCTURED CONTENT</p>
          <h1>Import a question</h1>
          <p>Validate a versioned JSON document, review its content, then save it.</p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!tax.topics.length && (
        <p className="notice">
          Add your chapter and topic records in <a href="/curriculum">Curriculum</a> first. Imports
          resolve existing taxonomy and never invent curriculum records.
        </p>
      )}
      <section className="panel">
        <Field label="Choose a JSON file">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              if (e.target.files?.[0])
                void e.target.files[0]
                  .text()
                  .then((v) => {
                    setSource(v);
                    setDoc(null);
                  })
                  .catch((e) => setError(e.message));
            }}
          />
        </Field>
        <Field label="Question JSON (schemaVersion 1)">
          <textarea
            className="json-editor"
            rows={14}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setDoc(null);
            }}
            spellCheck={false}
          />
        </Field>
        <button
          className="button primary"
          disabled={busy || !source}
          onClick={() => void validate()}
        >
          Validate and preview
        </button>
        <p className="muted">
          Accepts the original schemaVersion 1 format and schemaVersion 2 exports with
          classification provenance. Use stable topic and difficulty IDs from the curriculum API. An
          optional classification object can resolve course, semester, chapter, topic and subtopic
          by ID, slug or normalized name.
        </p>
      </section>
      {doc && (
        <>
          {warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          <QuestionMetadata doc={doc} tax={tax} saved={provenance} />
          <ContentPreview doc={doc} teacher />
          <section className="panel">
            <h2>Save validated content</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Field label="Import action">
                <select
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setConfirm(false);
                  }}
                >
                  <option value="new">Create new question</option>
                  <option value="revise">Revise existing question with this stable code</option>
                </select>
              </Field>
              <Field label="Revision note">
                <textarea
                  required
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <Field label="Author">
                <input value={author} onChange={(e) => setAuthor(e.target.value)} />
              </Field>
              <label className="check">
                <input
                  required
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                {mode === 'new' && doc.question.status === 'approved'
                  ? 'I reviewed and approve this question.'
                  : 'I reviewed this imported content and want to save it.'}
              </label>
              <button className="button primary" disabled={busy || !confirm}>
                {mode === 'revise' ? 'Save revision for review' : 'Import question'}
              </button>
            </form>
          </section>
        </>
      )}
    </>
  );
}
