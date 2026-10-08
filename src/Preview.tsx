import { useEffect, useState } from 'react';
import type { Asset, QuestionDocument, Taxonomy } from '../shared/schema';
import type { Difference } from '../server/revisions';
import { api, json, download } from './api';
import { Field, QuestionMetadata, type LoadedQuestion } from './components';
import { Equation, MathText } from './MathText';
import { useAuth } from './Auth';

function Assets({ items }: { items: Asset[] }) {
  return (
    <div className="assets">
      {[...items]
        .sort((a, b) => a.order - b.order)
        .map((a) =>
          a.mime === 'application/pdf' ? (
            <a className="button" key={a.id} href={a.url} target="_blank" rel="noreferrer">
              {a.kind.replaceAll('_', ' ')} · {a.alt}
            </a>
          ) : (
            <figure key={a.id}>
              <img src={a.url} alt={a.alt} loading="lazy" />
              <figcaption>
                {a.alt}
                {a.kind === 'answer_diagram' ? ' · Answer diagram' : ''}
              </figcaption>
            </figure>
          ),
        )}
    </div>
  );
}
export function ContentPreview({
  doc,
  teacher,
  print = false,
}: {
  doc: QuestionDocument;
  teacher: boolean;
  print?: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  useEffect(() => setRevealed({}), [doc, teacher]);
  const hints = (partId: string | null) => {
    const items = doc.hints.filter((h) => h.partId === partId).sort((a, b) => a.order - b.order),
      key = partId ?? 'whole',
      count = revealed[key] ?? 0;
    if (!items.length) return null;
    return (
      <div className="hint-block">
        <h3>Student hints</h3>
        {items.slice(0, teacher || print ? items.length : count).map((h, i) => (
          <div className="hint" key={h.id}>
            <strong>Hint {i + 1}</strong>
            <MathText value={h.text} />
          </div>
        ))}
        {!teacher && !print && count < items.length && (
          <button
            className="button"
            onClick={() => setRevealed((v) => ({ ...v, [key]: count + 1 }))}
          >
            Reveal hint {count + 1}
          </button>
        )}
      </div>
    );
  };
  const visibleAssets = (partId: string | null) =>
    doc.assets.filter(
      (a) =>
        a.partId === partId &&
        (teacher || !['answer_diagram', 'answer_pdf', 'original_pdf'].includes(a.kind)),
    );
  const parts = (parentId: string | null): React.ReactNode =>
    doc.parts
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map((p) => (
        <section className="preview-part" key={p.id}>
          <div className="part-heading">
            <h3>{p.label}</h3>
            <span>{p.marks} marks</span>
          </div>
          <MathText value={p.prompt} />
          <Assets
            items={visibleAssets(p.id).filter(
              (a) => !['answer_diagram', 'answer_pdf'].includes(a.kind),
            )}
          />
          {hints(p.id)}
          {parts(p.id)}
        </section>
      ));
  return (
    <div className="content-preview">
      <article className="paper">
        <div className="card-meta">
          <code>{doc.question.questionCode}</code>
          <span>
            {doc.question.totalMarks} marks · {doc.question.estimatedMinutes} min
          </span>
        </div>
        <h2>{doc.question.title}</h2>
        <MathText value={doc.question.scenario} />
        <Assets
          items={visibleAssets(null).filter(
            (a) =>
              !['answer_diagram', 'answer_pdf', 'original_pdf', 'question_pdf'].includes(a.kind),
          )}
        />
        {parts(null)}
        {hints(null)}
      </article>
      {teacher && (
        <section className="panel answer-scheme">
          <h2>Answer scheme</h2>
          {!doc.solutions.length && <p>No answer scheme has been authored.</p>}
          {[...doc.solutions]
            .sort(
              (a, b) =>
                (doc.parts.find((p) => p.id === a.partId)?.order ?? 0) -
                (doc.parts.find((p) => p.id === b.partId)?.order ?? 0),
            )
            .map((s) => (
              <section key={s.partId} className="solution">
                <h3>Part {doc.parts.find((p) => p.id === s.partId)?.label}</h3>
                <MathText value={s.solution} />
                <Equation value={s.equationLatex} />
                {[...s.steps]
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <div className="solution-step" key={step.number}>
                      <div className="part-heading">
                        <h4>Step {step.number}</h4>
                        <span>{step.marks} marks</span>
                      </div>
                      <MathText value={step.explanation} />
                      <Equation value={step.equationLatex} />
                      <MathText value={step.working} />
                      {step.markingPoint && (
                        <p>
                          <strong>Marking point: </strong>
                          {step.markingPoint}
                        </p>
                      )}
                    </div>
                  ))}
                {s.teacherNotes && (
                  <div className="teacher-notes">
                    <strong>Teacher notes</strong>
                    <MathText value={s.teacherNotes} />
                  </div>
                )}
                <Assets
                  items={doc.assets.filter(
                    (a) =>
                      a.partId === s.partId && ['answer_diagram', 'answer_pdf'].includes(a.kind),
                  )}
                />
              </section>
            ))}
          <Assets
            items={doc.assets.filter(
              (a) => a.partId === null && ['answer_diagram', 'answer_pdf'].includes(a.kind),
            )}
          />
        </section>
      )}
      {teacher && (
        <Assets
          items={doc.assets.filter(
            (a) =>
              a.partId !== null &&
              ['answer_diagram', 'answer_pdf'].includes(a.kind) &&
              !doc.solutions.some((s) => s.partId === a.partId),
          )}
        />
      )}
      <Assets
        items={doc.assets.filter(
          (a) =>
            a.partId === null &&
            (a.kind === 'question_pdf' || (teacher && a.kind === 'original_pdf')),
        )}
      />
    </div>
  );
}
type Candidate = {
  id: string;
  base_version: number;
  source: string;
  change_note: string;
  author: string;
  status: string;
  created_at: string;
  document: QuestionDocument;
  diff: Difference[];
};
type Version = { version: number; note: string; author: string | null; createdAt: string };
const display = (value: unknown) =>
  value === undefined
    ? '(absent)'
    : typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
export function Preview({ tax, id }: { tax: Taxonomy; id: string }) {
  const { session } = useAuth();
  const admin = session.authenticated;
  const teacher = new URLSearchParams(location.search).get('view') !== 'student';
  const [selected, setSelected] = useState(
    new URLSearchParams(location.search).get('version') ?? '',
  );
  const [loaded, setLoaded] = useState<LoadedQuestion | null>(null),
    [versions, setVersions] = useState<Version[]>([]),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [error, setError] = useState(''),
    [reviewer, setReviewer] = useState(''),
    [approval, setApproval] = useState(false),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setLoaded(null);
    void api<LoadedQuestion>(
      '/questions/' +
        id +
        '?view=' +
        (teacher ? 'teacher' : 'student') +
        (selected ? '&version=' + selected : ''),
    )
      .then(setLoaded)
      .catch((e) => setError(e.message));
  }, [id, teacher, selected, refresh]);
  useEffect(() => {
    if (teacher && admin) {
      void api<Version[]>('/questions/' + id + '/versions')
        .then(setVersions)
        .catch((e) => setError(e.message));
      void api<Candidate[]>('/questions/' + id + '/revisions')
        .then(setCandidates)
        .catch((e) => setError(e.message));
    }
  }, [id, teacher, admin, refresh]);
  async function review(candidateId: string, approve: boolean) {
    setBusy(true);
    setError('');
    try {
      await api('/revisions/' + candidateId + '/review', json('POST', { approve, reviewer }));
      setApproval(false);
      setSelected('');
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const q = loaded?.document.question,
    t = tax.topics.find((x) => x.id === q?.topicId),
    c = tax.chapters.find((x) => x.id === t?.parentId),
    s = tax.semesters.find((x) => x.id === c?.parentId),
    st = tax.subtopics.find((x) => x.id === q?.subtopicId);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {teacher ? (admin ? 'TEACHER VIEW' : 'MARKING SCHEME') : 'STUDENT PREVIEW'}
          </p>
          <h1>{q?.title ?? 'Question preview'}</h1>
          <p>
            {selected && loaded?.savedClassification ? (
              `${loaded.savedClassification.semester.name} · ${loaded.savedClassification.chapter.name} · ${loaded.savedClassification.topic.name}${loaded.savedClassification.subtopic ? ' · ' + loaded.savedClassification.subtopic.name : ''}`
            ) : (
              <>
                {s?.name} · {c?.name} · {t?.name}
                {st ? ' · ' + st.name : ''}
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <a className="button" href={'/questions/' + id + (teacher ? '?view=student' : '')}>
            {teacher ? 'Student preview' : admin ? 'Teacher view' : 'View marking scheme'}
          </a>
          {teacher && admin && (
            <a className="button primary" href={'/edit/' + id}>
              Edit question
            </a>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loaded && (
        <>
          {teacher && admin && (
            <div className="version-controls">
              <span className={'badge ' + q?.status}>{q?.status}</span>
              <span>
                Version {loaded.version}
                {selected ? ' · Historical snapshot' : ''}
              </span>
              <Field label="View version">
                <select
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    history.replaceState(
                      null,
                      '',
                      '/questions/' + id + (e.target.value ? '?version=' + e.target.value : ''),
                    );
                  }}
                >
                  <option value="">Current version</option>
                  {versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      Version {v.version} · {v.note}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="button"
                onClick={() => download(q!.questionCode + '.json', loaded.document)}
              >
                Export JSON
              </button>
              <button
                className="button"
                disabled={!loaded.savedClassification}
                onClick={() =>
                  download(q!.questionCode + '-provenance.json', {
                    schemaVersion: 2,
                    document: loaded.document,
                    savedClassification: loaded.savedClassification,
                  })
                }
              >
                Download provenance JSON
              </button>
            </div>
          )}
          {teacher && admin && (
            <QuestionMetadata doc={loaded.document} tax={tax} saved={loaded.savedClassification} />
          )}
          {loaded.warnings.map((w) => (
            <p className="warning" role="status" key={w}>
              {w}
            </p>
          ))}
          <ContentPreview
            key={loaded.version + String(teacher)}
            doc={loaded.document}
            teacher={teacher}
          />
        </>
      )}
      {teacher && admin && (
        <>
          <section className="panel">
            <h2>Version history</h2>
            {versions.map((v) => (
              <div className="history-row" key={v.version}>
                <button className="text-button" onClick={() => setSelected(String(v.version))}>
                  Version {v.version}
                </button>
                <span>{v.note}</span>
                <small>
                  {v.author ?? 'Author not recorded'} ·{' '}
                  {new Date(v.createdAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
                </small>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Review revisions</h2>
            {!candidates.length && (
              <p className="muted">
                No revision candidates. Saved changes to approved questions appear here for review.
              </p>
            )}
            {candidates.map((candidate) => (
              <details
                className="revision"
                key={candidate.id}
                open={candidate.status === 'pending'}
              >
                <summary>
                  {candidate.change_note} · {candidate.status} · based on version{' '}
                  {candidate.base_version}
                </summary>
                <p>
                  {candidate.source} revision · {candidate.author || 'Author not recorded'}
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Current version</th>
                        <th>Candidate revision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidate.diff.map((d) => (
                        <tr key={d.path}>
                          <th>{d.path}</th>
                          <td>
                            <pre>{display(d.before)}</pre>
                          </td>
                          <td>
                            <pre>{display(d.after)}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details>
                  <summary>Preview candidate content</summary>
                  <ContentPreview doc={candidate.document} teacher />
                </details>
                {candidate.status === 'pending' && (
                  <div className="review-actions">
                    <Field label="Reviewing teacher">
                      <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
                    </Field>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={approval}
                        onChange={(e) => setApproval(e.target.checked)}
                      />
                      I reviewed these changes and approve replacing the active version.
                    </label>
                    <div className="actions">
                      <button
                        className="button primary"
                        disabled={!approval || !reviewer.trim() || busy}
                        onClick={() => void review(candidate.id, true)}
                      >
                        Approve replacement
                      </button>
                      <button
                        className="button danger"
                        disabled={!reviewer.trim() || busy}
                        onClick={() => void review(candidate.id, false)}
                      >
                        Reject revision
                      </button>
                    </div>
                  </div>
                )}
              </details>
            ))}
          </section>
        </>
      )}
    </>
  );
}
