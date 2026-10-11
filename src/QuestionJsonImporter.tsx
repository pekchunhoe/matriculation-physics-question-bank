import { useEffect, useRef, useState } from 'react';
import { api, json } from './api';
import { ContentPreview } from './Preview';
import { Field, QuestionMetadata } from './components';
import { MathText } from './MathText';
import { ImportCompatibilityReview } from './ImportCompatibilityReview';
import {
  normalizeQuestionImport,
  parseImportSource,
  type CompatibilityResult,
  type MappingReview,
  compatibilitySubmission,
} from '../shared/import-compatibility';
import type { Taxonomy } from '../shared/schema';
import {
  difficultyOptions,
  importLimits,
  type ImportPreview,
  type SelectedDifficulty,
} from '../shared/question-import';
import {
  prepareQuestionImport,
  releaseImport,
  type PreparedImport,
} from './question-import-preparation';

export function QuestionJsonImporter({ tax }: { tax: Taxonomy }) {
  const [source, setSource] = useState(''),
    [selectedDifficulty, setSelectedDifficulty] = useState<SelectedDifficulty | ''>(''),
    [difficultyError, setDifficultyError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [reviewed, setReviewed] = useState(false),
    [saved, setSaved] = useState<{ id: string } | null>(null),
    [dimensions, setDimensions] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<CompatibilityResult | null>(null),
    [mappingReview, setMappingReview] = useState<MappingReview>({}),
    [candidateText, setCandidateText] = useState(''),
    [candidateDirty, setCandidateDirty] = useState(false),
    [allowDuplicate, setAllowDuplicate] = useState(false),
    [duplicateReview, setDuplicateReview] = useState<ImportPreview['duplicates']>([]),
    [sourceDifficulty, setSourceDifficulty] = useState<SelectedDifficulty | undefined>();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const prepared = useRef<PreparedImport | null>(null),
    revision = useRef(0),
    locked = useRef(false);
  useEffect(() => () => releaseImport(prepared.current), []);
  const reset = (preserveDuplicates = false) => {
    revision.current++;
    releaseImport(prepared.current);
    prepared.current = null;
    setPreview(null);
    setReviewed(false);
    setSaved(null);
    setDimensions({});
    setError('');
    setDifficultyError('');
    if (!preserveDuplicates) setDuplicateReview([]);
  };
  function updateSource(text: string) {
    reset();
    setSource(text);
    setMappingReview({});
    setAllowDuplicate(false);
    setSelectedDifficulty('');
    setSourceDifficulty(undefined);
    setCandidateDirty(false);
    try {
      const result = normalizeQuestionImport(parseImportSource(text));
      setAnalysis(result);
      setCandidateText(JSON.stringify(result.candidate, null, 2));
      if (result.difficulty) {
        setSelectedDifficulty(result.difficulty);
        setSourceDifficulty(result.difficulty);
      }
    } catch {
      setAnalysis(null);
      setCandidateText('');
    }
  }
  function review(next: MappingReview) {
    reset();
    setAllowDuplicate(false);
    try {
      const result = normalizeQuestionImport(parseImportSource(source), next);
      setMappingReview(next);
      setCandidateDirty(false);
      setAnalysis(result);
      setCandidateText(JSON.stringify(result.candidate, null, 2));
      if (result.difficulty) setSelectedDifficulty(result.difficulty);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function validate() {
    if (locked.current) return;
    reset();
    if (candidateDirty) {
      setError('Apply corrections and recheck the edited Master JSON before validating.');
      return;
    }
    if (!selectedDifficulty) {
      setDifficultyError('Select a difficulty before validating this question.');
      return;
    }
    locked.current = true;
    setBusy(true);
    const generation = revision.current;
    let next: PreparedImport | null = null;
    try {
      const approvedReview = { ...mappingReview, confirmedDifficulty: selectedDifficulty };
      const result = normalizeQuestionImport(parseImportSource(source), approvedReview);
      setAnalysis(result);
      setCandidateText(JSON.stringify(result.candidate, null, 2));
      next = await prepareQuestionImport(source, approvedReview);
      const response = await api<ImportPreview>(
        '/admin/questions/import/validate',
        json('POST', {
          manifest: next.manifest,
          selectedDifficulty,
          allowDuplicate,
          compatibility: compatibilitySubmission(parseImportSource(source), approvedReview),
        }),
      );
      if (generation !== revision.current) {
        releaseImport(next);
        return;
      }
      prepared.current = next;
      response.document.assets = response.document.assets.map((a) => ({
        ...a,
        url: next!.urls.get(a.id)!,
      }));
      setPreview(response);
      setDuplicateReview(response.duplicates);
    } catch (e) {
      releaseImport(next);
      if (generation === revision.current) {
        const message = (e as Error).message;
        if (message.startsWith('selectedDifficulty:'))
          setDifficultyError(message.slice('selectedDifficulty:'.length).trim());
        else setError(message);
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function commit() {
    if (locked.current || !preview || !prepared.current || !reviewed || !selectedDifficulty) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('manifest', JSON.stringify(prepared.current.manifest));
      form.append('token', preview.token);
      form.append('selectedDifficulty', selectedDifficulty);
      for (const a of prepared.current.manifest.assets)
        form.append(
          a.key,
          prepared.current.blobs.get(a.key)!,
          `${a.key}.${a.mimeType === 'image/jpeg' ? 'jpg' : a.mimeType.split('/')[1].replace('+xml', '')}`,
        );
      const result = await api<{ id: string }>('/admin/questions/import/commit', {
        method: 'POST',
        body: form,
      });
      setSaved(result);
      setSource('');
      setAnalysis(null);
      setMappingReview({});
      setCandidateText('');
      setAllowDuplicate(false);
      setDuplicateReview([]);
      setSourceDifficulty(undefined);
      setSelectedDifficulty('');
      if (fileInput.current) fileInput.current.value = '';
      setPreview(null);
      setReviewed(false);
      releaseImport(prepared.current);
      prepared.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMIN · DRAFT ONLY</p>
          <h1>Import Question JSON</h1>
          <p>
            Paste or upload one self-contained question. Validate, review the rendered content, then
            create a draft.
          </p>
        </div>
      </div>
      {error && (
        <div id="import-errors" role="alert" className="error import-errors">
          <p>{error.split('\n')[0]}</p>
          <details>
            <summary>Technical validation details</summary>
            <pre>{error}</pre>
          </details>
        </div>
      )}
      {saved && (
        <p className="notice" role="status">
          Draft created. <a href={'/questions/' + saved.id}>Review imported draft</a>. Approval
          remains a separate action.
        </p>
      )}
      <section className="panel" aria-labelledby="import-input-heading">
        <h2 id="import-input-heading">Question package</h2>
        <Field label="Upload one .json file">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            disabled={busy}
            aria-describedby="import-limits"
            onChange={(e) => {
              const file = e.target.files?.[0];
              reset();
              setSelectedDifficulty('');
              if (!file) return;
              if (!file.name.toLowerCase().endsWith('.json')) {
                setError('package: Choose one .json file');
                return;
              }
              if (file.size > importLimits.packageBytes) {
                setError('package: Question JSON exceeds 5 MiB');
                return;
              }
              const generation = revision.current;
              void file
                .text()
                .then((text) => {
                  if (generation === revision.current) updateSource(text);
                })
                .catch(() => setError('package: Unable to read file'));
            }}
          />
        </Field>
        <Field label="Paste Question JSON">
          <textarea
            className="json-editor"
            rows={14}
            maxLength={importLimits.packageBytes}
            value={source}
            disabled={busy}
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'import-errors import-limits' : 'import-limits'}
            onChange={(e) => {
              updateSource(e.target.value);
            }}
          />
        </Field>
        <Field label="Difficulty">
          <select
            required
            value={selectedDifficulty}
            disabled={busy || Boolean(sourceDifficulty)}
            aria-invalid={Boolean(difficultyError)}
            aria-describedby={
              difficultyError ? 'difficulty-error difficulty-help' : 'difficulty-help'
            }
            onChange={(e) => {
              reset();
              setSelectedDifficulty(e.target.value as SelectedDifficulty | '');
            }}
          >
            <option value="">Select difficulty...</option>
            {difficultyOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted" id="difficulty-help">
          Recognized source difficulty is preserved. If it is absent or ambiguous, select and
          confirm it explicitly; marks and content do not determine it.
        </p>
        {sourceDifficulty && (
          <p className="notice">
            Source difficulty preserved: {sourceDifficulty}. Correct the source only if the source
            itself is wrong.
          </p>
        )}
        {difficultyError && (
          <p id="difficulty-error" role="alert" className="error">
            {difficultyError}
          </p>
        )}
        <p className="muted" id="import-limits">
          Package ≤ 5 MiB. Up to 8 supplied visuals, combined ≤ 3 MiB. Master JSON, supported
          portable JSON and reviewed field mappings normalize to Master schema v1. No API token is
          needed.
        </p>
        <button
          className="button primary"
          disabled={busy || !source.trim()}
          onClick={() => void validate()}
        >
          Validate &amp; Preview
        </button>
        <p className="muted">
          <a href="/import">Import existing structured exports / revisions</a>
        </p>
      </section>
      {analysis && (
        <ImportCompatibilityReview
          analysis={analysis}
          source={source}
          review={mappingReview}
          candidateText={candidateText}
          busy={busy}
          tax={tax}
          onCandidateText={(text) => {
            reset();
            setCandidateText(text);
            setCandidateDirty(true);
          }}
          onReview={review}
        />
      )}
      {allowDuplicate && (
        <p className="notice" role="status">
          Separate duplicate draft explicitly selected. Validate again to sign this choice.
        </p>
      )}
      {!!duplicateReview.length && (
        <section className="panel">
          <h3>Existing identical questions</h3>
          {duplicateReview.map((d) => (
            <p key={d.id}>
              <a href={'/questions/' + d.id}>{d.title}</a>
            </p>
          ))}
          <label className="check">
            <input
              type="checkbox"
              checked={allowDuplicate}
              disabled={busy}
              onChange={(e) => {
                reset(true);
                setAllowDuplicate(e.target.checked);
              }}
            />
            I intentionally want a separate draft of this identical content. Validate again after
            selecting.
          </label>
        </section>
      )}
      {preview && (
        <>
          <section className="panel">
            <h2>Validation results</h2>
            <p>
              DIFFICULTY:{' '}
              {tax.difficulties
                .find((d) => d.id === preview.document.question.difficultyId)
                ?.name.toUpperCase()}
            </p>
            <p role="status">
              Validated structure, classification and mark totals. Embedded hashes verified locally;
              the server verifies binary signatures and hashes when importing.
            </p>
            <p>
              Question total: {preview.marks.question} · Part allocation:{' '}
              {preview.document.parts.length
                ? preview.marks.parts
                : 'No parts (' + preview.marks.parts + ')'}{' '}
              · Marking scheme total: {preview.marks.markingScheme}
            </p>
            <p>Preview expires in 15 minutes. Changes require validation again.</p>
            {preview.warnings.map((w) => (
              <p className="warning" key={w}>
                WARNING — {w}
              </p>
            ))}
          </section>
          <QuestionMetadata doc={preview.document} tax={tax} saved={preview.classification} />
          <h2>Question and marking scheme preview</h2>
          <ContentPreview doc={preview.document} teacher showHints={false} showStepHints />
          <section className="panel">
            <h2>Student Hints</h2>
            {!preview.document.hints.length && <p>No hints supplied.</p>}
            {[...preview.document.hints]
              .sort((a, b) => a.order - b.order)
              .map((h) => (
                <div className="hint" key={h.id}>
                  <h3>
                    Hint {h.order + 1} · {h.partId ?? 'Whole question'}
                  </h3>
                  <MathText value={h.text} />
                </div>
              ))}
          </section>
          {!!preview.assets.length && (
            <section className="panel">
              <h2>Visual asset review</h2>
              <p>Check crops, labels, force arrows and axes before importing.</p>
              <div className="import-asset-grid">
                {preview.assets.map((a) => (
                  <figure key={a.key}>
                    <img
                      src={prepared.current?.urls.get(a.key)}
                      alt={preview.document.assets.find((v) => v.id === a.key)?.alt ?? ''}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setDimensions((v) => ({
                          ...v,
                          [a.key]: `${img.naturalWidth} × ${img.naturalHeight} px`,
                        }));
                      }}
                    />
                    <figcaption>
                      <strong>{a.role}</strong> · {a.placement}
                      <br />
                      {dimensions[a.key]} · {a.byteLength} bytes
                      <br />
                      SHA-256 matched locally; server verification on import.
                      <br />
                      <code>{a.sha256}</code>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
          <section className="panel">
            <h2>Create draft</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={busy}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I reviewed the question, marking scheme, hints, classification and visuals.
            </label>
            <button
              className="button primary"
              disabled={
                busy || !reviewed || (Boolean(preview.duplicates.length) && !allowDuplicate)
              }
              onClick={() => void commit()}
            >
              Import as Draft
            </button>
          </section>
        </>
      )}
    </>
  );
}
