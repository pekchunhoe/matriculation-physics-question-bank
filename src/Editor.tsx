import { useEffect, useState } from 'react';
import type { QuestionDocument, Taxonomy, Solution } from '../shared/schema';
import { assetKinds, warnings } from '../shared/model';
import { api, json } from './api';
import { Field, TaxonSelect, type LoadedQuestion } from './components';
import { ContentPreview } from './Preview';

export function blankQuestion(): QuestionDocument {
  return {
    schemaVersion: 1,
    question: {
      questionCode: '',
      topicId: '',
      subtopicId: null,
      title: '',
      scenario: '',
      difficultyId: '',
      questionType: 'structured',
      totalMarks: 1,
      estimatedMinutes: 1,
      status: 'draft',
      containsDiagram: false,
      containsGraph: false,
      containsFbd: false,
    },
    parts: [
      { id: crypto.randomUUID(), label: '(a)', prompt: '', marks: 1, order: 0, parentId: null },
    ],
    solutions: [],
    hints: [],
    assets: [],
    tags: [],
  };
}
export function Editor({ tax, id }: { tax: Taxonomy; id?: string }) {
  const isNew = !id || id === 'new';
  const [doc, setDoc] = useState<QuestionDocument>(blankQuestion),
    [version, setVersion] = useState(0),
    [originalStatus, setOriginalStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(''),
    [author, setAuthor] = useState(''),
    [confirmApproval, setConfirmApproval] = useState(false),
    [preview, setPreview] = useState(false),
    [course, setCourse] = useState(tax.courses[0]?.id ?? ''),
    [curriculum, setCurriculum] = useState(
      tax.curriculumVersions?.find(
        (v) => v.courseId === tax.courses[0]?.id && v.status === 'active',
      )?.id ?? '',
    ),
    [semester, setSemester] = useState(''),
    [chapter, setChapter] = useState('');
  useEffect(() => {
    if (!isNew)
      void api<LoadedQuestion>('/questions/' + id)
        .then((r) => {
          setDoc(r.document);
          setVersion(r.version);
          setOriginalStatus(r.document.question.status);
          const t = tax.topics.find((x) => x.id === r.document.question.topicId),
            c = tax.chapters.find((x) => x.id === t?.parentId),
            s = tax.semesters.find((x) => x.id === c?.parentId);
          setChapter(c?.id ?? '');
          setSemester(s?.id ?? '');
          setCourse(s?.parentId ?? '');
          setCurriculum(s?.curriculumVersionId ?? '');
        })
        .catch((e) => setError(e.message));
  }, [id, isNew, tax]);
  const q = doc.question;
  const change = <K extends keyof QuestionDocument['question']>(
    key: K,
    value: QuestionDocument['question'][K],
  ) => setDoc((d) => ({ ...d, question: { ...d.question, [key]: value } }));
  const editPart = (index: number, patch: Partial<QuestionDocument['parts'][number]>) =>
    setDoc((d) => ({ ...d, parts: d.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  const editSolution = (index: number, patch: Partial<Solution>) =>
    setDoc((d) => ({
      ...d,
      solutions: d.solutions.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  const textInput = (
    label: string,
    key: 'title' | 'questionCode' | 'scenario',
    multiline = false,
  ) => (
    <Field label={label}>
      {multiline ? (
        <textarea rows={5} value={q[key]} onChange={(e) => change(key, e.target.value)} />
      ) : (
        <input
          required
          value={q[key]}
          disabled={key === 'questionCode' && !isNew}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </Field>
  );
  async function save() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string; pending?: boolean }>(
        isNew ? '/questions' : '/questions/' + id,
        json(isNew ? 'POST' : 'PUT', {
          document: doc,
          note,
          author,
          baseVersion: version,
          confirmApproval,
        }),
      );
      location.href = '/questions/' + result.id + (result.pending ? '?review=1' : '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, index: number) {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api<{ url: string; mime: QuestionDocument['assets'][number]['mime'] }>(
        '/uploads',
        { method: 'POST', body },
      );
      setDoc((d) => ({
        ...d,
        assets: d.assets.map((a, i) =>
          i === index ? { ...a, url: result.url, mime: result.mime } : a,
        ),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const partChoices = doc.parts.map((p) => (
    <option key={p.id} value={p.id}>
      {p.label}
    </option>
  ));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STRUCTURED AUTHORING</p>
          <h1>{isNew ? 'Add question' : 'Edit question'}</h1>
          <p>
            {isNew ? 'Create an authored master record.' : `${q.questionCode} · Version ${version}`}
          </p>
        </div>
        <button className="button" onClick={() => setPreview(!preview)}>
          {preview ? 'Return to editor' : 'Preview'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {originalStatus === 'approved' && (
        <p className="notice">
          Saving changes creates a review candidate. The approved question stays active until the
          replacement is reviewed.
        </p>
      )}
      {preview ? (
        <ContentPreview doc={doc} teacher />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="editor"
        >
          <section className="panel">
            <h2>Classification</h2>
            <div className="three-columns">
              <TaxonSelect
                label="Course"
                items={tax.courses}
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  setCurriculum(
                    tax.curriculumVersions?.find(
                      (cv) => cv.courseId === v && cv.status === 'active',
                    )?.id ?? '',
                  );
                  setSemester('');
                  setChapter('');
                  change('topicId', '');
                  change('subtopicId', null);
                }}
              />
              <Field label="Curriculum version">
                <select
                  value={curriculum}
                  onChange={(e) => {
                    setCurriculum(e.target.value);
                    setSemester('');
                    setChapter('');
                    change('topicId', '');
                    change('subtopicId', null);
                  }}
                >
                  <option value="">Select curriculum version</option>
                  {(tax.curriculumVersions ?? [])
                    .filter(
                      (v) =>
                        v.courseId === course && (v.status !== 'retired' || v.id === curriculum),
                    )
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name} ({v.status})
                      </option>
                    ))}
                </select>
              </Field>
              <TaxonSelect
                label="Semester"
                items={tax.semesters.filter(
                  (s) =>
                    s.parentId === course &&
                    s.curriculumVersionId === curriculum &&
                    (s.status !== 'retired' || s.id === semester),
                )}
                value={semester}
                onChange={(v) => {
                  setSemester(v);
                  setChapter('');
                  change('topicId', '');
                  change('subtopicId', null);
                }}
              />
              <TaxonSelect
                label="Chapter"
                items={tax.chapters.filter(
                  (c) => c.parentId === semester && (c.status !== 'retired' || c.id === chapter),
                )}
                value={chapter}
                onChange={(v) => {
                  setChapter(v);
                  change('topicId', '');
                  change('subtopicId', null);
                }}
              />
              <TaxonSelect
                label="Topic"
                items={tax.topics.filter(
                  (t) => t.parentId === chapter && (t.status !== 'retired' || t.id === q.topicId),
                )}
                value={q.topicId}
                onChange={(v) => {
                  change('topicId', v);
                  change('subtopicId', null);
                }}
              />
              <TaxonSelect
                label="Subtopic"
                optional
                items={tax.subtopics.filter(
                  (t) =>
                    t.parentId === q.topicId && (t.status !== 'retired' || t.id === q.subtopicId),
                )}
                value={q.subtopicId ?? ''}
                onChange={(v) => change('subtopicId', v || null)}
              />
              <TaxonSelect
                label="Difficulty"
                items={tax.difficulties}
                value={q.difficultyId}
                onChange={(v) => change('difficultyId', v)}
              />
            </div>
            {!tax.topics.length && (
              <p className="notice">
                Add the authoritative chapter and topic structure in{' '}
                <a href="/curriculum">Curriculum</a> before saving a question.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Question metadata</h2>
            <div className="two-columns">
              {textInput('Stable question code', 'questionCode')}
              {textInput('Title', 'title')}
              <Field label="Question type">
                <select
                  value={q.questionType}
                  onChange={(e) => change('questionType', e.target.value as typeof q.questionType)}
                >
                  {['structured', 'multiple_choice', 'short_answer', 'essay'].map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={q.status}
                  onChange={(e) => change('status', e.target.value as typeof q.status)}
                >
                  {['draft', 'reviewing', 'approved', 'retired'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Total marks">
                <input
                  required
                  type="number"
                  min="1"
                  max="10000"
                  value={q.totalMarks}
                  onChange={(e) => change('totalMarks', Number(e.target.value))}
                />
              </Field>
              <Field label="Estimated minutes">
                <input
                  required
                  type="number"
                  min="1"
                  max="10000"
                  value={q.estimatedMinutes}
                  onChange={(e) => change('estimatedMinutes', Number(e.target.value))}
                />
              </Field>
            </div>
            {textInput('Scenario (LaTeX: $inline$ or $$display$$)', 'scenario', true)}
            <Field label="Tags (comma separated)">
              <input
                value={doc.tags.join(', ')}
                onChange={(e) =>
                  setDoc((d) => ({
                    ...d,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </Field>
            <div className="inline-checks">
              {(['containsDiagram', 'containsGraph', 'containsFbd'] as const).map((k) => (
                <label key={k} className="check">
                  <input
                    type="checkbox"
                    checked={q[k]}
                    onChange={(e) => change(k, e.target.checked)}
                  />
                  {k === 'containsDiagram'
                    ? 'Contains diagram'
                    : k === 'containsGraph'
                      ? 'Contains graph'
                      : 'Contains FBD'}
                </label>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Question parts</h2>
            <p className="muted">
              Use parent parts for (a)(i) and (a)(ii). For a grouping part, author 0 marks to avoid
              double counting.
            </p>
            {doc.parts.map((p, i) => (
              <fieldset className="entry" key={p.id}>
                <legend>Part {i + 1}</legend>
                <div className="three-columns">
                  <Field label="Part label">
                    <input
                      value={p.label}
                      onChange={(e) => editPart(i, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Marks">
                    <input
                      type="number"
                      min="0"
                      value={p.marks}
                      onChange={(e) => editPart(i, { marks: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Display order">
                    <input
                      type="number"
                      min="0"
                      value={p.order}
                      onChange={(e) => editPart(i, { order: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Parent part">
                    <select
                      value={p.parentId ?? ''}
                      onChange={(e) => editPart(i, { parentId: e.target.value || null })}
                    >
                      <option value="">None</option>
                      {doc.parts
                        .filter((x) => x.id !== p.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.label}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <Field label="Prompt">
                  <textarea
                    rows={3}
                    value={p.prompt}
                    onChange={(e) => editPart(i, { prompt: e.target.value })}
                  />
                </Field>
                <button
                  type="button"
                  className="button danger"
                  disabled={doc.parts.length === 1}
                  onClick={() => {
                    if (
                      doc.parts.some((x) => x.parentId === p.id) ||
                      doc.solutions.some((x) => x.partId === p.id) ||
                      [...doc.hints, ...doc.assets].some((x) => x.partId === p.id)
                    ) {
                      setError(
                        'Remove or reassign the child parts, solution, hints and assets before removing this part.',
                      );
                      return;
                    }
                    setDoc((d) => ({ ...d, parts: d.parts.filter((x) => x.id !== p.id) }));
                  }}
                >
                  Remove part
                </button>
              </fieldset>
            ))}
            <button
              className="button"
              type="button"
              onClick={() =>
                setDoc((d) => ({
                  ...d,
                  parts: [
                    ...d.parts,
                    {
                      id: crypto.randomUUID(),
                      label: '',
                      prompt: '',
                      marks: 0,
                      order: d.parts.length,
                      parentId: null,
                    },
                  ],
                }))
              }
            >
              Add part
            </button>
            {warnings(doc).map((w) => (
              <p key={w} className="warning" role="status">
                {w}
              </p>
            ))}
          </section>
          <section className="panel">
            <h2>Answer scheme</h2>
            {doc.solutions.map((s, i) => (
              <fieldset className="entry" key={i}>
                <legend>Solution {i + 1}</legend>
                <Field label="Question part">
                  <select
                    value={s.partId ?? ''}
                    onChange={(e) => editSolution(i, { partId: e.target.value || null })}
                  >
                    {!doc.parts.length && <option value="">Whole question</option>}
                    {partChoices}
                  </select>
                </Field>
                <Field label="Solution">
                  <textarea
                    rows={3}
                    value={s.solution}
                    onChange={(e) => editSolution(i, { solution: e.target.value })}
                  />
                </Field>
                <Field label="Equation (LaTeX)">
                  <textarea
                    value={s.equationLatex}
                    onChange={(e) => editSolution(i, { equationLatex: e.target.value })}
                  />
                </Field>
                <Field label="Teacher notes">
                  <textarea
                    value={s.teacherNotes}
                    onChange={(e) => editSolution(i, { teacherNotes: e.target.value })}
                  />
                </Field>
                {s.steps.map((step, j) => (
                  <div className="step-editor" key={j}>
                    <h3>Step {step.number}</h3>
                    <div className="three-columns">
                      {(['number', 'marks', 'order'] as const).map((k) => (
                        <Field
                          key={k}
                          label={
                            k === 'number'
                              ? 'Step number'
                              : k === 'marks'
                                ? 'Step marks'
                                : 'Step display order'
                          }
                        >
                          <input
                            type="number"
                            min={k === 'number' ? 1 : 0}
                            value={step[k]}
                            onChange={(e) =>
                              editSolution(i, {
                                steps: s.steps.map((t, n) =>
                                  n === j ? { ...t, [k]: Number(e.target.value) } : t,
                                ),
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <Field label="Marking code (optional)">
                      <input
                        maxLength={24}
                        value={step.markingCode ?? ''}
                        onChange={(e) =>
                          editSolution(i, {
                            steps: s.steps.map((t, n) =>
                              n === j ? { ...t, markingCode: e.target.value || undefined } : t,
                            ),
                          })
                        }
                      />
                    </Field>
                    {(['explanation', 'equationLatex', 'working', 'markingPoint'] as const).map(
                      (k) => (
                        <Field
                          key={k}
                          label={
                            {
                              explanation: 'Explanation',
                              equationLatex: 'Step equation (LaTeX)',
                              working: 'Working',
                              markingPoint: 'Marking point',
                            }[k]
                          }
                        >
                          <textarea
                            rows={2}
                            value={step[k]}
                            onChange={(e) =>
                              editSolution(i, {
                                steps: s.steps.map((t, n) =>
                                  n === j ? { ...t, [k]: e.target.value } : t,
                                ),
                              })
                            }
                          />
                        </Field>
                      ),
                    )}
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        if (
                          doc.hints.some((h) => h.solutionStepId && h.solutionStepId === step.id)
                        ) {
                          setError('Remove or reassign linked hints before removing this step.');
                          return;
                        }
                        editSolution(i, { steps: s.steps.filter((_, n) => n !== j) });
                      }}
                    >
                      Remove step
                    </button>
                  </div>
                ))}
                <div className="actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      editSolution(i, {
                        steps: [
                          ...s.steps,
                          {
                            id: crypto.randomUUID(),
                            number: Math.max(0, ...s.steps.map((x) => x.number)) + 1,
                            explanation: '',
                            equationLatex: '',
                            working: '',
                            markingPoint: '',
                            marks: 0,
                            order: s.steps.length,
                          },
                        ],
                      })
                    }
                  >
                    Add solution step
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => {
                      if (
                        doc.hints.some(
                          (h) => h.solutionStepId && s.steps.some((t) => t.id === h.solutionStepId),
                        )
                      ) {
                        setError('Remove or reassign linked hints before removing this solution.');
                        return;
                      }
                      setDoc((d) => ({ ...d, solutions: d.solutions.filter((_, n) => n !== i) }));
                    }}
                  >
                    Remove solution
                  </button>
                </div>
              </fieldset>
            ))}
            <button
              className="button"
              type="button"
              disabled={doc.solutions.length >= doc.parts.length}
              onClick={() => {
                const part = doc.parts.find((p) => !doc.solutions.some((s) => s.partId === p.id));
                if (part)
                  setDoc((d) => ({
                    ...d,
                    solutions: [
                      ...d.solutions,
                      {
                        partId: part.id,
                        solution: '',
                        equationLatex: '',
                        teacherNotes: '',
                        steps: [],
                      },
                    ],
                  }));
              }}
            >
              Add solution
            </button>
          </section>
          <section className="panel">
            <h2>Student hints</h2>
            {doc.hints.map((h, i) => (
              <fieldset className="entry" key={h.id}>
                <legend>Hint {i + 1}</legend>
                <Field label="Attach hint to">
                  <select
                    value={h.partId ?? ''}
                    onChange={(e) =>
                      setDoc((d) => ({
                        ...d,
                        hints: d.hints.map((x, j) =>
                          j === i
                            ? { ...x, partId: e.target.value || null, solutionStepId: undefined }
                            : x,
                        ),
                      }))
                    }
                  >
                    <option value="">Whole question</option>
                    {partChoices}
                  </select>
                </Field>
                <Field label="Solution step (optional)">
                  <select
                    value={h.solutionStepId ?? ''}
                    onChange={(e) =>
                      setDoc((d) => ({
                        ...d,
                        hints: d.hints.map((x, j) =>
                          j === i ? { ...x, solutionStepId: e.target.value || undefined } : x,
                        ),
                      }))
                    }
                  >
                    <option value="">General question / part hint</option>
                    {doc.solutions
                      .filter((s) => s.partId === h.partId)
                      .flatMap((s) =>
                        s.steps
                          .filter((t) => t.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              Step {t.number}
                            </option>
                          )),
                      )}
                  </select>
                </Field>
                <Field label="Hint text">
                  <textarea
                    value={h.text}
                    onChange={(e) =>
                      setDoc((d) => ({
                        ...d,
                        hints: d.hints.map((x, j) =>
                          j === i ? { ...x, text: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Hint display order">
                  <input
                    type="number"
                    min="0"
                    value={h.order}
                    onChange={(e) =>
                      setDoc((d) => ({
                        ...d,
                        hints: d.hints.map((x, j) =>
                          j === i ? { ...x, order: Number(e.target.value) } : x,
                        ),
                      }))
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="button danger"
                  onClick={() =>
                    setDoc((d) => ({ ...d, hints: d.hints.filter((_, j) => j !== i) }))
                  }
                >
                  Remove hint
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="button"
              onClick={() =>
                setDoc((d) => ({
                  ...d,
                  hints: [
                    ...d.hints,
                    { id: crypto.randomUUID(), partId: null, text: '', order: d.hints.length },
                  ],
                }))
              }
            >
              Add hint
            </button>
          </section>
          <section className="panel">
            <h2>Diagrams and PDFs</h2>
            <p className="muted">
              SVG for schematics; PNG, JPEG or WebP for illustrations. PDFs are archives. Files up
              to 20 MB.
            </p>
            {doc.assets.map((a, i) => (
              <fieldset className="entry" key={a.id}>
                <legend>Asset {i + 1}</legend>
                <div className="two-columns">
                  <Field label="Asset type">
                    <select
                      value={a.kind}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, kind: e.target.value as typeof a.kind } : x,
                          ),
                        }))
                      }
                    >
                      {assetKinds.map((k) => (
                        <option key={k} value={k}>
                          {k.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Attach asset to">
                    <select
                      value={a.partId ?? ''}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, partId: e.target.value || null } : x,
                          ),
                        }))
                      }
                    >
                      <option value="">Whole question</option>
                      {partChoices}
                    </select>
                  </Field>
                  <Field label="Description / alternative text">
                    <input
                      value={a.alt}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, alt: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Asset display order">
                    <input
                      type="number"
                      min="0"
                      value={a.order}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, order: Number(e.target.value) } : x,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Upload file">
                    <input
                      disabled={busy}
                      type="file"
                      accept=".svg,.png,.jpg,.jpeg,.webp,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) void upload(e.target.files[0], i);
                      }}
                    />
                  </Field>
                  <Field label="Asset URL">
                    <input
                      value={a.url}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, url: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Field label="MIME type">
                    <select
                      value={a.mime}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          assets: d.assets.map((x, j) =>
                            j === i ? { ...x, mime: e.target.value as typeof a.mime } : x,
                          ),
                        }))
                      }
                    >
                      {[
                        'image/svg+xml',
                        'image/png',
                        'image/jpeg',
                        'image/webp',
                        'application/pdf',
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  className="button danger"
                  onClick={() =>
                    setDoc((d) => ({ ...d, assets: d.assets.filter((_, j) => j !== i) }))
                  }
                >
                  Remove asset
                </button>
              </fieldset>
            ))}
            <button
              className="button"
              type="button"
              onClick={() =>
                setDoc((d) => ({
                  ...d,
                  assets: [
                    ...d.assets,
                    {
                      id: crypto.randomUUID(),
                      partId: null,
                      kind: 'physics_diagram',
                      url: '',
                      alt: '',
                      mime: 'image/svg+xml',
                      order: d.assets.length,
                    },
                  ],
                }))
              }
            >
              Add asset
            </button>
          </section>
          <section className="panel">
            <h2>Save revision</h2>
            <Field label="Revision note">
              <textarea
                required
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Field label="Author">
              <input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </Field>
            {isNew && q.status === 'approved' && (
              <label className="check">
                <input
                  type="checkbox"
                  required
                  checked={confirmApproval}
                  onChange={(e) => setConfirmApproval(e.target.checked)}
                />
                I reviewed the content and approve this master question.
              </label>
            )}
            <button
              disabled={busy || !q.topicId || !q.difficultyId}
              className="button primary"
              type="submit"
            >
              {busy
                ? 'Saving…'
                : originalStatus === 'approved' || (!isNew && q.status === 'approved')
                  ? 'Save for review'
                  : 'Save revision'}
            </button>
          </section>
        </form>
      )}
    </>
  );
}
