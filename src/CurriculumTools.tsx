import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import type {
  CurriculumImpact,
  CurriculumPlan,
  CurriculumVersion,
  EditableKind,
} from '../shared/curriculum';
import { api, download, json } from './api';
import { Field } from './components';

const kinds: EditableKind[] = ['semesters', 'chapters', 'topics', 'subtopics'];
function Impact({ value }: { value: CurriculumImpact }) {
  return (
    <p className="notice" role="status">
      This item contains {value.currentQuestions} current questions; {value.historicalQuestions}{' '}
      questions reference it in saved history, with {value.pendingRevisions} pending revisions and{' '}
      {value.descendants} descendant records. Retirement removes it from active browsing. Referenced
      subtrees cannot move; use a new curriculum version.
      {value.previousActive &&
        ` Activation also retires ${value.previousActive.name}, containing ${value.previousActive.currentQuestions} current questions. They remain available by selecting the retired version.`}
    </p>
  );
}
export function TaxonomyEditor({ tax, reload }: { tax: Taxonomy; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<EditableKind>('topics'),
    [id, setId] = useState(''),
    [name, setName] = useState(''),
    [order, setOrder] = useState(0),
    [status, setStatus] = useState<'active' | 'retired'>('active'),
    [parent, setParent] = useState(''),
    [impact, setImpact] = useState<CurriculumImpact | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const parentKind =
    kind === 'chapters'
      ? 'semesters'
      : kind === 'topics'
        ? 'chapters'
        : kind === 'subtopics'
          ? 'topics'
          : null;
  function versionOf(k: EditableKind, entityId: string): string | undefined {
    const row = tax[k].find((t) => t.id === entityId);
    return k === 'semesters'
      ? row?.curriculumVersionId
      : row?.parentId
        ? versionOf(kinds[kinds.indexOf(k) - 1], row.parentId)
        : undefined;
  }
  function label(k: EditableKind, entityId: string): string {
    const row = tax[k].find((t) => t.id === entityId);
    if (!row) return entityId;
    const prefix =
      k === 'semesters'
        ? tax.curriculumVersions?.find((v) => v.id === row.curriculumVersionId)?.code
        : label(kinds[kinds.indexOf(k) - 1], row.parentId!);
    return `${prefix ?? ''} / ${row.name}${row.status === 'retired' ? ' (retired)' : ''}`;
  }
  useEffect(() => {
    const row = tax[kind].find((t) => t.id === id);
    setImpact(null);
    setConfirmed(false);
    setError('');
    setMessage('');
    if (!row) return;
    setName(row.name);
    setOrder(row.order);
    setStatus(row.status ?? 'active');
    setParent(row.parentId ?? '');
    let active = true;
    void api<CurriculumImpact>(`/taxonomy/${kind}/${id}/impact`)
      .then((r) => {
        if (active) setImpact(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [kind, id, tax]);
  async function save() {
    if (!impact) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(
        `/taxonomy/${kind}/${id}`,
        json('PATCH', {
          name,
          order,
          status,
          ...(parentKind ? { parentId: parent } : {}),
          expectedRevision: impact.revision,
          impactToken: impact.token,
          confirmImpact: confirmed,
          note,
        }),
      );
      await reload();
      setMessage('Curriculum change saved. Question content and saved history are preserved.');
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Edit curriculum records</h2>
      <p>
        Rename, reorder, retire or restore records while keeping their IDs and slugs. Unreferenced
        chapters, topics and subtopics can move within the same version.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="form-grid">
        <Field label="Edit record type">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as EditableKind);
              setId('');
            }}
          >
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Curriculum record">
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Select a record</option>
            {tax[kind].map((t) => (
              <option key={t.id} value={t.id}>
                {label(kind, t.id)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {id && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {impact && <Impact value={impact} />}
          <div className="form-grid">
            <Field label="Edited name">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Display order">
              <input
                type="number"
                min={0}
                required
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
            </Field>
            <Field label="Curriculum item status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'retired')}
              >
                <option value="active">Active</option>
                <option value="retired">Retired</option>
              </select>
            </Field>
            {parentKind && (
              <Field label="Move to parent">
                <select
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  disabled={Boolean(
                    impact &&
                    (impact.currentQuestions ||
                      impact.historicalQuestions ||
                      impact.pendingRevisions),
                  )}
                >
                  {tax[parentKind]
                    .filter((t) => versionOf(parentKind, t.id) === versionOf(kind, id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {label(parentKind, t.id)}
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </div>
          <Field label="Curriculum change note">
            <textarea
              required
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the impact on current browsing and linked questions.
          </label>
          <div className="actions">
            <button className="button primary" disabled={busy || !impact}>
              Save curriculum change
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                void api<CurriculumImpact>(`/taxonomy/${kind}/${id}/impact`)
                  .then((r) => {
                    setImpact(r);
                    setConfirmed(false);
                    setError('');
                  })
                  .catch((e) => setError(e.message))
              }
            >
              Refresh impact preview
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function CurriculumVersions({
  tax,
  reload,
}: {
  tax: Taxonomy;
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(''),
    [course, setCourse] = useState(tax.courses[0]?.id ?? ''),
    [code, setCode] = useState(''),
    [name, setName] = useState(''),
    [clone, setClone] = useState(''),
    [editName, setEditName] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [status, setStatus] = useState<CurriculumVersion['status']>('draft'),
    [order, setOrder] = useState(0),
    [impact, setImpact] = useState<CurriculumImpact | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(''),
    [createNote, setCreateNote] = useState(''),
    [source, setSource] = useState(''),
    [plan, setPlan] = useState<CurriculumPlan | null>(null),
    [importNote, setImportNote] = useState(''),
    [importConfirmed, setImportConfirmed] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const versions = tax.curriculumVersions ?? [];
  useEffect(() => {
    setImpact(null);
    setConfirmed(false);
    const v = versions.find((v) => v.id === selected);
    if (!v) return;
    setEditName(v.name);
    setFrom(v.effectiveFrom ?? '');
    setTo(v.effectiveTo ?? '');
    setStatus(v.status);
    setOrder(v.order);
    let active = true;
    void api<CurriculumImpact>(`/curriculum-versions/${selected}/impact`)
      .then((r) => {
        if (active) setImpact(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
    // tax carries the server revision; refresh impact whenever its data changes.
  }, [selected, tax]);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const v = versions.find((v) => v.id === selected);
  return (
    <section className="panel">
      <h2>Curriculum versions</h2>
      <p>
        Prepare official changes in a new draft. Activation retires the previous active version for
        that course. Its questions remain available through the version filter.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <Field label="Curriculum version to manage">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a version</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {tax.courses.find((c) => c.id === v.courseId)?.name} / {v.code} — {v.name} ({v.status}
              )
            </option>
          ))}
        </select>
      </Field>
      {v && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void work(async () => {
              if (!impact) return;
              await api(
                `/curriculum-versions/${selected}`,
                json('PATCH', {
                  name: editName,
                  effectiveFrom: from || null,
                  effectiveTo: to || null,
                  status,
                  order,
                  expectedRevision: impact.revision,
                  impactToken: impact.token,
                  confirmImpact: confirmed,
                  note,
                }),
              );
              await reload();
              setMessage('Curriculum version updated. Historical questions are preserved.');
            });
          }}
        >
          {impact && <Impact value={impact} />}
          <div className="form-grid">
            <Field label="Version name">
              <input
                required
                maxLength={200}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>
            <Field label="Version status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CurriculumVersion['status'])}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="retired">Retired</option>
              </select>
            </Field>
            <Field label="Effective from">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Effective to">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Version display order">
              <input
                type="number"
                min={0}
                required
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Version change note">
            <textarea
              required
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed linked questions and the change to default browsing. Activation retires the
            previous active version.
          </label>
          <div className="actions">
            <button className="button primary" disabled={busy || !impact}>
              Save version changes
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                void work(async () => {
                  const doc = await api(`/curriculum-versions/${selected}/export`);
                  download(`curriculum-${v.code}.json`, doc);
                })
              }
            >
              Export curriculum JSON
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                void work(async () => {
                  setImpact(await api<CurriculumImpact>(`/curriculum-versions/${selected}/impact`));
                  setConfirmed(false);
                })
              }
            >
              Refresh version impact
            </button>
          </div>
        </form>
      )}
      <details>
        <summary>Create or clone a draft version</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void work(async () => {
              const result = await api<{ id: string }>(
                '/curriculum-versions',
                json('POST', {
                  version: {
                    courseId: course,
                    code,
                    name,
                    effectiveFrom: null,
                    effectiveTo: null,
                    status: 'draft',
                    order: 0,
                    ...(clone ? { cloneFromId: clone } : {}),
                  },
                  note: createNote,
                }),
              );
              await reload();
              setSelected(result.id);
              setMessage(
                'Draft created. Cloning copies taxonomy with new IDs; questions stay in their original version.',
              );
              setCode('');
              setName('');
            });
          }}
        >
          <Field label="Version course">
            <select
              required
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setClone('');
              }}
            >
              {tax.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New version code">
            <input
              required
              pattern="[A-Z0-9][A-Z0-9-]{1,79}"
              maxLength={80}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Field label="New version name">
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Clone taxonomy from">
            <select value={clone} onChange={(e) => setClone(e.target.value)}>
              <option value="">Start with an empty hierarchy</option>
              {versions
                .filter((v) => v.courseId === course)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="New version note">
            <textarea
              required
              maxLength={2000}
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
            />
          </Field>
          <button className="button primary" disabled={busy}>
            Create draft version
          </button>
        </form>
      </details>
      <details>
        <summary>Import an authoritative curriculum JSON</summary>
        <p>
          Imports create a new draft in an existing course. Review all names, statuses and counts
          before applying. An exported existing version is a backup; to create a changed copy, use
          Clone or supply a new version code and new IDs.
        </p>
        <Field label="Curriculum JSON file">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void file
                  .text()
                  .then((s) => {
                    setSource(s);
                    setPlan(null);
                  })
                  .catch((e) => setError(e.message));
            }}
          />
        </Field>
        <Field label="Curriculum JSON (schemaVersion 1)">
          <textarea
            rows={10}
            className="json-editor"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPlan(null);
            }}
            spellCheck={false}
          />
        </Field>
        <button
          className="button"
          disabled={busy || !source}
          onClick={() =>
            void work(async () => {
              setPlan(null);
              setImportConfirmed(false);
              setPlan(
                await api<CurriculumPlan>(
                  '/curriculum/import/validate',
                  json('POST', { document: JSON.parse(source) }),
                ),
              );
            })
          }
        >
          Validate curriculum and preview
        </button>
        {plan && (
          <div>
            <h3>Curriculum import preview</h3>
            <p>
              {plan.document.course.name} / {plan.document.curriculumVersion.code} /{' '}
              {plan.document.curriculumVersion.name} (draft)
            </p>
            <p>
              {plan.counts.semesters} semesters · {plan.counts.chapters} chapters ·{' '}
              {plan.counts.topics} topics · {plan.counts.subtopics} subtopics
            </p>
            {plan.warnings.map((w) => (
              <p className="notice" key={w}>
                {w}
              </p>
            ))}
            <ul>
              {plan.document.semesters.map((s) => (
                <li key={s.id}>
                  {s.name} (order {s.order}, {s.status})
                  <ul>
                    {s.chapters.map((c) => (
                      <li key={c.id}>
                        {c.name} (order {c.order}, {c.status})
                        <ul>
                          {c.topics.map((t) => (
                            <li key={t.id}>
                              {t.name} (order {t.order}, {t.status})
                              {t.subtopics.length > 0 && (
                                <ul>
                                  {t.subtopics.map((st) => (
                                    <li key={st.id}>
                                      {st.name} (order {st.order}, {st.status})
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <Field label="Curriculum import note">
              <textarea
                required
                maxLength={2000}
                value={importNote}
                onChange={(e) => setImportNote(e.target.value)}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={importConfirmed}
                onChange={(e) => setImportConfirmed(e.target.checked)}
              />
              I checked this supplied hierarchy and will import it as a draft.
            </label>
            <button
              className="button primary"
              disabled={busy || !importNote.trim() || !importConfirmed}
              onClick={() =>
                void work(async () => {
                  const result = await api<{ id: string }>(
                    '/curriculum/import',
                    json('POST', { document: plan.document, token: plan.token, note: importNote }),
                  );
                  setPlan(null);
                  await reload();
                  setSelected(result.id);
                  setMessage(
                    'Curriculum imported atomically as draft. Review the hierarchy before activation.',
                  );
                })
              }
            >
              Import reviewed curriculum
            </button>
          </div>
        )}
      </details>
    </section>
  );
}
