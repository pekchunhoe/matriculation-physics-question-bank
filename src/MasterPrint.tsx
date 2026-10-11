import { useEffect, useRef } from 'react';
import type { QuestionDocument, Taxonomy } from '../shared/schema';
import { exportContent, type ExportNode } from '../shared/export-content';
import { Equation, MathText } from './MathText';
export type NumberedQuestion = { id: string; document: QuestionDocument; displayNumber: number };
function Nodes({ nodes }: { nodes: ExportNode[] }) {
  return (
    <>
      {nodes.map((node, i) =>
        node.type === 'prose' ? (
          <div
            key={i}
            className={
              node.style === 'hint'
                ? 'step-hint'
                : node.style === 'total'
                  ? 'master-total'
                  : node.style === 'part'
                    ? 'master-part'
                    : 'export-prose'
            }
          >
            {node.style === 'part' ? <h3>{node.text}</h3> : <MathText value={node.text} />}
          </div>
        ) : node.type === 'math' ? (
          <Equation key={i} value={node.latex} />
        ) : node.type === 'step' ? (
          <section
            key={i}
            className="master-step"
            data-step-id={node.id}
            data-long-content={node.nodes.some((n) => n.type === 'prose' && n.text.length > 1000)}
          >
            <div className="part-heading">
              <h3>
                Step {node.number} {node.part}
              </h3>
              <div className="step-award">
                {node.code && <code className="marking-code">{node.code}</code>}
                <span>{node.marks} marks</span>
              </div>
            </div>
            <Nodes nodes={node.nodes} />
          </section>
        ) : (
          <div key={i} className={node.equations.length ? 'visual-equation-pair' : undefined}>
            <div className="assets">
              <figure>
                <img src={node.asset.url} alt={node.asset.alt} />
                <figcaption>{node.asset.importMetadata?.caption ?? node.asset.alt}</figcaption>
              </figure>
            </div>
            {!!node.equations.length && (
              <div>
                {node.equations.map((latex, j) => (
                  <Equation key={j} value={latex} />
                ))}
              </div>
            )}
          </div>
        ),
      )}
    </>
  );
}
export function MasterPrint({
  item,
  tax,
  answer = false,
  hints = true,
  groups,
}: {
  item: NumberedQuestion;
  tax: Taxonomy;
  answer?: boolean;
  hints?: boolean;
  groups?: string[];
}) {
  const paper = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = paper.current;
    if (!root) return;
    const fit = () => {
      for (const node of root.querySelectorAll<HTMLElement>('.master-step,.visual-equation-pair')) {
        const long = node.dataset.longContent === 'true' || node.scrollHeight > 320;
        node.classList.toggle('oversized-step', long);
        node.classList.toggle('compact-step', !long);
      }
      for (const equation of root.querySelectorAll<HTMLElement>('.katex-display')) {
        equation.style.fontSize = '';
        const math = equation.querySelector<HTMLElement>('.katex-html');
        if (math && math.scrollWidth > equation.clientWidth && equation.clientWidth > 0)
          equation.style.fontSize = String((equation.clientWidth / math.scrollWidth) * 100) + '%';
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
  const doc = item.document,
    topic = tax.topics.find((t) => t.id === doc.question.topicId),
    chapter = tax.chapters.find((t) => t.id === topic?.parentId),
    semester = tax.semesters.find((t) => t.id === chapter?.parentId)?.name;
  const difficulty = tax.difficulties.find((t) => t.id === doc.question.difficultyId)?.name;
  const content = exportContent(
    hints ? doc : { ...doc, hints: [] },
    answer ? 'answer' : 'question',
  );
  return (
    <article
      ref={paper}
      className={'master-paper ' + (answer ? 'master-answer' : 'master-question')}
      data-question-number={item.displayNumber}
      data-question-id={item.id}
    >
      {groups ? (
        groups.map((name, i) => (
          <h2 className="export-group" key={i}>
            {name}
          </h2>
        ))
      ) : (
        <header className="master-header">
          Matriculation Physics | {semester === 'Semester 2' ? 'Semester 2' : 'Semester 1'}
        </header>
      )}
      <h2>
        Question {item.displayNumber}
        {answer ? ' · Answer scheme' : ''}
      </h2>
      <div className="master-meta">
        <span>
          {topic?.name} · {doc.question.totalMarks} marks
        </span>
        <span>DIFFICULTY: {difficulty?.toUpperCase()}</span>
      </div>
      <Nodes nodes={content} />
    </article>
  );
}
