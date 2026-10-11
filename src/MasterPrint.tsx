import type { QuestionDocument, Taxonomy } from '../shared/schema';
import { Assets, Blocks } from './Preview';
import { Equation, MathText } from './MathText';
import { useEffect, useRef } from 'react';

export type NumberedQuestion = { id: string; document: QuestionDocument; displayNumber: number };
function partPath(doc: QuestionDocument, id: string | null): string {
  const part = doc.parts.find((p) => p.id === id);
  return part ? partPath(doc, part.parentId) + part.label : '';
}
function orderedParts(
  doc: QuestionDocument,
  parent: string | null = null,
): QuestionDocument['parts'] {
  return doc.parts
    .filter((p) => p.parentId === parent)
    .sort((a, b) => a.order - b.order)
    .flatMap((p) => [p, ...orderedParts(doc, p.id)]);
}
function partAncestors(doc: QuestionDocument, id: string | null): string[] {
  const part = doc.parts.find((p) => p.id === id);
  return part ? [part.id, ...partAncestors(doc, part.parentId)] : [];
}
export function MasterPrint({
  item,
  tax,
  answer = false,
  hints = false,
}: {
  item: NumberedQuestion;
  tax: Taxonomy;
  answer?: boolean;
  hints?: boolean;
}) {
  const paper = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = paper.current;
    if (!root) return;
    const fit = () => {
      for (const step of root.querySelectorAll<HTMLElement>(
        '.master-step, .master-solution-intro, .master-final-answer',
      )) {
        // Let unusually tall steps flow instead of leaving most of a page empty.
        step.classList.toggle('oversized-step', step.scrollHeight > 470);
      }
      for (const equation of root.querySelectorAll<HTMLElement>('.katex-display')) {
        equation.style.fontSize = '';
        const math = equation.querySelector<HTMLElement>('.katex-html');
        if (math && math.scrollWidth > equation.clientWidth && equation.clientWidth > 0)
          equation.style.fontSize = `${(equation.clientWidth / math.scrollWidth) * 100}%`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    window.addEventListener('beforeprint', fit);
    void document.fonts.ready.then(fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', fit);
    };
  }, [item.document]);
  const doc = item.document;
  const topic = tax.topics.find((t) => t.id === doc.question.topicId);
  const chapter = tax.chapters.find((c) => c.id === topic?.parentId);
  const semester = tax.semesters.find((s) => s.id === chapter?.parentId)?.name;
  const difficulty = tax.difficulties.find((d) => d.id === doc.question.difficultyId)?.name;
  const header = `Matriculation Physics | ${semester === 'Semester 2' ? 'Semester 2' : 'Semester 1'}`;
  const footer = `QUESTION ${item.displayNumber} | ${topic?.name?.toUpperCase() ?? ''}${answer ? ' | ANSWER SCHEME' : ''}`;
  const pageName = `master-${item.displayNumber}-${answer ? 'answer' : 'question'}`;
  // Hex-escape every character so authored taxonomy text cannot escape a CSS string.
  const cssString = (text: string) =>
    '"' + Array.from(text, (c) => `\\${c.codePointAt(0)!.toString(16)} `).join('') + '"';
  const placed = new Set(
    [
      doc.question.blocks,
      ...doc.parts.map((p) => p.blocks),
      ...doc.solutions.flatMap((s) => [s.blocks, ...s.steps.map((t) => t.blocks)]),
    ].flatMap((blocks) => (blocks ?? []).flatMap((b) => (b.type === 'image' ? [b.assetId] : []))),
  );
  const legacyAssets = (partId: string | null, inAnswer: boolean) =>
    doc.assets.filter(
      (a) =>
        !placed.has(a.id) &&
        a.partId === partId &&
        a.mime !== 'application/pdf' &&
        ['answer_diagram', 'fbd'].includes(a.kind) === inAnswer,
    );
  const studentHints = (partId: string | null, stepId?: string) =>
    hints &&
    doc.hints
      .filter((h) =>
        stepId ? h.solutionStepId === stepId : !h.solutionStepId && h.partId === partId,
      )
      .sort((a, b) => a.order - b.order)
      .map((h) => (
        <div className="step-hint" key={h.id}>
          <strong>Student hint:</strong> <MathText value={h.text} />
        </div>
      ));
  const parts = orderedParts(doc);
  const solutions = [...doc.solutions].sort(
    (a, b) => parts.findIndex((p) => p.id === a.partId) - parts.findIndex((p) => p.id === b.partId),
  );
  return (
    <article
      ref={paper}
      style={{ page: pageName }}
      className={'master-paper ' + (answer ? 'master-answer' : 'master-question')}
      data-question-number={item.displayNumber}
      data-question-id={item.id}
    >
      <style media="print">{`@page ${pageName} { @top-left { content: ${cssString(header)}; font: 8pt Arial, sans-serif; color: #536f88; } @bottom-left { content: ${cssString(footer)}; font: 7pt Arial, sans-serif; color: #536f88; } }`}</style>
      <header className="master-header">{header}</header>
      <h2>
        {answer
          ? `Question ${item.displayNumber} · Answer scheme`
          : `Question ${item.displayNumber}`}
      </h2>
      {answer && <p className="master-subtitle">Answer scheme with step-by-step student hints</p>}
      <div className="master-meta">
        <span>
          {topic?.name} · {doc.question.totalMarks} marks
        </span>
        <span>DIFFICULTY: {difficulty?.toUpperCase()}</span>
      </div>
      {!answer ? (
        <>
          <MathText value={doc.question.scenario} />
          <Blocks blocks={doc.question.blocks} assets={doc.assets} />
          <Assets items={legacyAssets(null, false)} />
          {parts.map((p, index) => (
            <div
              key={p.id}
              className={index === parts.length - 1 ? 'master-final-part' : undefined}
            >
              <section className="master-part">
                <div className="part-heading">
                  <h3>{partPath(doc, p.id)}</h3>
                  <span>[{p.marks} marks]</span>
                </div>
                <MathText value={p.prompt} />
                <Blocks blocks={p.blocks} assets={doc.assets} />
                <Assets items={legacyAssets(p.id, false)} />
              </section>
              {index === parts.length - 1 && (
                <p className="master-total">[{doc.question.totalMarks} marks]</p>
              )}
            </div>
          ))}
          {!parts.length && <p className="master-total">[{doc.question.totalMarks} marks]</p>}
        </>
      ) : (
        <>
          {studentHints(null)}
          {solutions.map((s) => (
            <section className="master-solution" key={s.partId ?? 'whole'}>
              <div className="master-solution-intro">
                {s.partId && <h3>Part {partPath(doc, s.partId)}</h3>}
                {s.partId &&
                  [...parts.filter((p) => partAncestors(doc, s.partId).includes(p.id))].map((p) =>
                    // Parent/part hints render once, before the first leaf answer in their scope.
                    solutions.find((x) => partAncestors(doc, x.partId).includes(p.id)) === s ? (
                      <div key={p.id}>{studentHints(p.id)}</div>
                    ) : null,
                  )}
                <MathText value={s.solution} />
                <Equation value={s.equationLatex} />
                <Blocks blocks={s.blocks} assets={doc.assets} />
              </div>
              {[...s.steps]
                .sort((a, b) => a.order - b.order)
                .map((step, index) => (
                  <div
                    key={step.number}
                    className={
                      s === solutions.at(-1) && index === s.steps.length - 1
                        ? 'master-final-answer'
                        : undefined
                    }
                  >
                    <section className="master-step" data-step-id={step.id}>
                      <div className="part-heading">
                        <h4>
                          Step {step.number} {partPath(doc, s.partId)}
                          {step.explanation.length <= 180 && !step.explanation.includes('\n') && (
                            <span className="step-title">
                              {' '}
                              <MathText value={step.explanation} />
                            </span>
                          )}
                        </h4>
                        <div className="step-award">
                          {step.markingCode && (
                            <code className="marking-code">{step.markingCode}</code>
                          )}
                          <span>{step.marks} marks</span>
                        </div>
                      </div>
                      {step.id && studentHints(s.partId, step.id)}
                      {(step.explanation.length > 180 || step.explanation.includes('\n')) && (
                        <MathText value={step.explanation} />
                      )}
                      <Equation value={step.equationLatex} />
                      <MathText value={step.working} />
                      <Blocks blocks={step.blocks} assets={doc.assets} pairedVisuals />
                      {step.markingPoint && <p className="marking-point">{step.markingPoint}</p>}
                    </section>
                    {s === solutions.at(-1) && index === s.steps.length - 1 && (
                      <>
                        <Assets items={legacyAssets(s.partId, true)} />
                        <p className="master-total">Total: {doc.question.totalMarks} marks</p>
                      </>
                    )}
                  </div>
                ))}
              {!(s === solutions.at(-1) && s.steps.length) && (
                <Assets items={legacyAssets(s.partId, true)} />
              )}
            </section>
          ))}
          {!solutions.at(-1)?.steps.length && (
            <p className="master-total">Total: {doc.question.totalMarks} marks</p>
          )}
        </>
      )}
      <div className="master-footer">{footer}</div>
    </article>
  );
}
