import { useState } from 'react';
import type { CompatibilityResult, MappingReview } from '../shared/import-compatibility';
import { isAdministrativeSourcePath } from '../shared/import-compatibility';
import type { Taxonomy } from '../shared/schema';
import { Field } from './components';

export function ImportCompatibilityReview({
  analysis,
  source,
  review,
  candidateText,
  busy,
  tax,
  onCandidateText,
  onReview,
}: {
  analysis: CompatibilityResult;
  source: string;
  review: MappingReview;
  candidateText: string;
  busy: boolean;
  tax: Taxonomy;
  onCandidateText: (value: string) => void;
  onReview: (review: MappingReview) => void;
}) {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('/question/title'),
    [editError, setEditError] = useState('');
  const [version, setVersion] = useState(''),
    [semester, setSemester] = useState(''),
    [chapter, setChapter] = useState(''),
    [topic, setTopic] = useState(''),
    [subtopic, setSubtopic] = useState('');
  const versions = (tax.curriculumVersions ?? []).filter((v) => v.status !== 'retired');
  const semesters = tax.semesters.filter(
    (s) => s.curriculumVersionId === version && s.status !== 'retired',
  );
  const chapters = tax.chapters.filter((c) => c.parentId === semester && c.status !== 'retired');
  const topics = tax.topics.filter((t) => t.parentId === chapter && t.status !== 'retired');
  const subtopics = tax.subtopics.filter((s) => s.parentId === topic && s.status !== 'retired');
  const select = (
    label: string,
    value: string,
    options: { id: string; name: string }[],
    change: (v: string) => void,
  ) => (
    <Field label={label}>
      <select value={value} disabled={busy} onChange={(e) => change(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const omitted = [
    ...new Set(
      analysis.diagnostics
        .filter(
          (d) =>
            d.category === 'unsupported' &&
            d.sourcePath &&
            !['/format_version', '/schemaVersion'].includes(d.sourcePath),
        )
        .map((d) => d.sourcePath)
        .filter(isAdministrativeSourcePath),
    ),
  ];
  return (
    <section className="panel" aria-labelledby="compatibility-heading">
      <h2 id="compatibility-heading">Format and compatibility review</h2>
      <p role="status">
        Detected: {analysis.format} · Source version: {analysis.sourceVersion} · Adapter:{' '}
        {analysis.adapter}
      </p>
      <p>
        {analysis.valid
          ? 'Canonical structure is ready for server validation.'
          : 'Manual review required before preview or draft creation.'}{' '}
        {analysis.lossless
          ? 'Mapped content preserved.'
          : 'Review all corrections and exclusions; this conversion is not certified lossless.'}
      </p>
      {(
        [
          'required',
          'ambiguous',
          'unsupported',
          'conflict',
          'security',
          'optional',
          'default',
          'mapped',
        ] as const
      ).map((category) => {
        const items = analysis.diagnostics.filter((d) => d.category === category);
        if (!items.length) return null;
        return (
          <details key={category} open={items.some((d) => d.blocking)}>
            <summary>
              {category === 'required'
                ? 'Missing required fields'
                : category === 'optional'
                  ? 'Missing optional fields'
                  : category}{' '}
              ({items.length})
            </summary>
            <ul>
              {items.map((d, i) => (
                <li key={i}>
                  {d.message}
                  <br />
                  <code>
                    {d.sourcePath || 'source'} → {d.destinationPath || 'manual review'}
                  </code>
                  {d.blocking && ' · Blocks import'}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      <details>
        <summary>Source and normalized values / technical details</summary>
        <Field label="Original source (read only)">
          <textarea className="json-editor" rows={8} readOnly value={source} />
        </Field>
      </details>
      <details
        open={
          analysis.manualRequired ||
          Boolean(review.candidate) ||
          Boolean(Object.keys(review.mappings ?? {}).length)
        }
      >
        <summary>Map source fields and correct missing values</summary>
        <p>
          Use JSON pointers for exact fields, such as /metadata/question_title → /question/title.
          Select whole arrays only when they already use the canonical record structure. Never
          classify academic information as administrative metadata.
        </p>
        <Field label="Source field path">
          <select value={from} disabled={busy} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Select source field…</option>
            {analysis.sourcePaths.map((p) => (
              <option key={p} value={p || '$ROOT'}>
                {p || 'Root value'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Canonical destination path">
          <input value={to} disabled={busy} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <button
          className="button"
          disabled={busy || !from || !to}
          onClick={() =>
            onReview({
              ...review,
              mappings: { ...review.mappings, [to]: from === '$ROOT' ? '' : from },
            })
          }
        >
          Apply field mapping
        </button>
        {Object.entries(review.mappings ?? {}).map(([dest, src]) => (
          <p key={dest}>
            <code>
              {src} → {dest}
            </code>{' '}
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                const mappings = { ...review.mappings };
                delete mappings[dest];
                onReview({ ...review, mappings });
              }}
            >
              Remove mapping
            </button>
          </p>
        ))}
        <Field label="Normalized Master JSON (administrator corrections)">
          <textarea
            className="json-editor"
            rows={14}
            value={candidateText}
            spellCheck={false}
            disabled={busy}
            onChange={(e) => onCandidateText(e.target.value)}
          />
        </Field>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            try {
              const candidate: unknown = JSON.parse(candidateText);
              setEditError('');
              onReview({ ...review, candidate });
            } catch {
              setEditError('Invalid JSON in the normalized candidate.');
            }
          }}
        >
          Apply corrections and recheck
        </button>
        {editError && (
          <p role="alert" className="error">
            {editError}
          </p>
        )}
        {omitted.map((path) => (
          <label className="check" key={path}>
            <input
              type="checkbox"
              disabled={busy}
              checked={review.administrativePaths?.includes(path) ?? false}
              onChange={(e) =>
                onReview({
                  ...review,
                  administrativePaths: e.target.checked
                    ? [...(review.administrativePaths ?? []), path]
                    : review.administrativePaths?.filter((p) => p !== path),
                })
              }
            />
            I reviewed {path}; it contains only nonacademic metadata and may be excluded from stored
            question content.
          </label>
        ))}
        <h3>Review curriculum mapping</h3>
        <p>
          Original classification stays visible in the source. Choose an existing available
          curriculum and verify the mapping. This does not create or modify curriculum records.
        </p>
        {select(
          'Import curriculum version',
          version,
          versions.map((v) => ({ id: v.id, name: v.code })),
          (v) => {
            setVersion(v);
            setSemester('');
            setChapter('');
            setTopic('');
            setSubtopic('');
          },
        )}
        {select('Import semester', semester, semesters, (v) => {
          setSemester(v);
          setChapter('');
          setTopic('');
          setSubtopic('');
        })}
        {select('Import chapter', chapter, chapters, (v) => {
          setChapter(v);
          setTopic('');
          setSubtopic('');
        })}
        {select('Import topic', topic, topics, (v) => {
          setTopic(v);
          setSubtopic('');
        })}
        {select('Import subtopic (optional)', subtopic, subtopics, setSubtopic)}
        <button
          className="button"
          disabled={busy || !version || !semester || !chapter || !topic}
          onClick={() =>
            onReview({
              ...review,
              classificationApproved: true,
              candidate: {
                ...analysis.candidate,
                classification: {
                  curriculumVersionCode: versions.find((v) => v.id === version)!.code,
                  semester: semesters.find((s) => s.id === semester)!.name,
                  chapter: chapters.find((c) => c.id === chapter)!.name,
                  topic: topics.find((t) => t.id === topic)!.name,
                  subtopic: subtopics.find((s) => s.id === subtopic)?.name ?? null,
                },
              },
            })
          }
        >
          Confirm reviewed curriculum mapping
        </button>
      </details>
    </section>
  );
}
