import { useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import { api, json } from './api';
import { Field } from './components';
import { CurriculumVersions, TaxonomyEditor } from './CurriculumTools';
type TaxonomyKind = Exclude<keyof Taxonomy, 'curriculumVersions'>;
export function Curriculum({ tax, reload }: { tax: Taxonomy; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<TaxonomyKind>('chapters'),
    [version, setVersion] = useState(''),
    [parent, setParent] = useState(''),
    [name, setName] = useState(''),
    [isTest, setIsTest] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const parents: Record<TaxonomyKind, TaxonomyKind | null> = {
    courses: null,
    semesters: 'courses',
    chapters: 'semesters',
    topics: 'chapters',
    subtopics: 'topics',
    difficulties: null,
  };
  const parentKind = parents[kind];
  const parentLabel = (id: string): string => {
    const record = [...tax.courses, ...tax.semesters, ...tax.chapters, ...tax.topics].find(
      (x) => x.id === id,
    );
    return record
      ? record.parentId
        ? parentLabel(record.parentId) + ' / ' + record.name
        : record.name
      : id;
  };
  async function add() {
    setBusy(true);
    setError('');
    try {
      await api(
        '/taxonomy/' + kind,
        json('POST', {
          name,
          parentId: parentKind ? parent : null,
          isTest,
          ...(kind === 'semesters' && version ? { curriculumVersionId: version } : {}),
        }),
      );
      await reload();
      setMessage(name + ' added.');
      setName('');
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
          <p className="eyebrow">CURRICULUM STRUCTURE</p>
          <h1>Courses, semesters and topics</h1>
          <p>
            Enter your authoritative curriculum. The bank uses these records for browsing and
            classification.
          </p>
        </div>
      </div>
      <CurriculumVersions tax={tax} reload={reload} />
      <TaxonomyEditor tax={tax} reload={reload} />
      <div className="curriculum-layout">
        <section className="panel">
          <h2>Add a curriculum record</h2>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Field label="Record type">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as TaxonomyKind);
                  setParent('');
                  setVersion('');
                  setMessage('');
                }}
              >
                {Object.keys(parents).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            {parentKind && (
              <Field label={'Parent ' + parentKind}>
                <select
                  required
                  value={parent}
                  onChange={(e) => {
                    setParent(e.target.value);
                    setVersion('');
                  }}
                >
                  <option value="">Select parent</option>
                  {tax[parentKind].map((t) => (
                    <option key={t.id} value={t.id}>
                      {parentLabel(t.id)}
                      {t.isTest ? ' (test taxonomy)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind === 'semesters' && (
              <Field label="Record curriculum version">
                <select required value={version} onChange={(e) => setVersion(e.target.value)}>
                  <option value="">Select version</option>
                  {(tax.curriculumVersions ?? [])
                    .filter((v) => v.courseId === parent && v.status !== 'retired')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name} ({v.status})
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Name">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {kind !== 'difficulties' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                />
                Clearly label this as test taxonomy
              </label>
            )}
            <button className="button primary" disabled={busy}>
              Add record
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Current hierarchy</h2>
          {tax.courses.map((co) => (
            <section key={co.id} className="curriculum-course">
              <h3>
                {co.name}
                {co.isTest ? ' (test taxonomy)' : ''}
              </h3>
              {tax.semesters
                .filter((s) => s.parentId === co.id)
                .map((s) => (
                  <details key={s.id} open>
                    <summary>
                      <span>{s.name}</span>
                      {' · ' +
                        (tax.curriculumVersions?.find((v) => v.id === s.curriculumVersionId)
                          ?.code ?? '') +
                        ' · ' +
                        s.status +
                        ' · order ' +
                        s.order}
                      {s.isTest ? ' (test taxonomy)' : ''}
                    </summary>
                    {tax.chapters
                      .filter((c) => c.parentId === s.id)
                      .map((c) => (
                        <details key={c.id} className="tree-level" open>
                          <summary>
                            {c.name}
                            {' · ' + c.status + ' · order ' + c.order}
                            {c.isTest ? ' (test taxonomy)' : ''}
                          </summary>
                          {tax.topics
                            .filter((t) => t.parentId === c.id)
                            .map((t) => (
                              <div key={t.id} className="tree-level">
                                <strong>
                                  {t.name}
                                  {' · ' + t.status + ' · order ' + t.order}
                                  {t.isTest ? ' (test taxonomy)' : ''}
                                </strong>
                                {tax.subtopics
                                  .filter((st) => st.parentId === t.id)
                                  .map((st) => (
                                    <p className="tree-level" key={st.id}>
                                      {st.name}
                                      {' · ' + st.status + ' · order ' + st.order}
                                      {st.isTest ? ' (test taxonomy)' : ''}
                                    </p>
                                  ))}
                              </div>
                            ))}
                        </details>
                      ))}
                    {!tax.chapters.some((c) => c.parentId === s.id) && (
                      <p className="tree-level muted">
                        Awaiting authoritative chapter and topic data.
                      </p>
                    )}
                  </details>
                ))}
            </section>
          ))}
          <h3>Controlled difficulty levels</h3>
          <p>{tax.difficulties.map((d) => d.name).join(' · ')}</p>
        </section>
      </div>
    </>
  );
}
