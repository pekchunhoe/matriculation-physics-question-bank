import type { Asset, QuestionDocument } from './schema.js';
import type { ContentBlock } from './content.js';
import type { ExportMode } from './export-plan.js';

export type ExportNode =
  | { type: 'prose'; text: string; style?: 'part' | 'step' | 'hint' | 'total'; keepNext?: boolean }
  | { type: 'math'; latex: string }
  | { type: 'image'; asset: Asset; equations: string[] }
  | {
      type: 'step';
      id?: string;
      number: number;
      part: string;
      marks: number;
      code?: string;
      nodes: ExportNode[];
    };

/** Educational content shared by print and Word. Does not emit teacher notes or identity/provenance. */
export function exportContent(doc: QuestionDocument, mode: ExportMode): ExportNode[] {
  const out: ExportNode[] = [];
  const prose = (
    nodes: ExportNode[],
    text: string,
    style?: 'part' | 'step' | 'hint' | 'total',
    keepNext?: boolean,
  ) => {
    if (text) nodes.push({ type: 'prose', text, style, keepNext });
  };
  const math = (nodes: ExportNode[], latex: string) => {
    if (latex) nodes.push({ type: 'math', latex });
  };
  const placed = new Set(
    [
      doc.question.blocks,
      ...doc.parts.map((p) => p.blocks),
      ...doc.solutions.flatMap((s) => [s.blocks, ...s.steps.map((t) => t.blocks)]),
    ].flatMap((b) => (b ?? []).flatMap((v) => (v.type === 'image' ? [v.assetId] : []))),
  );
  const answerAssetIds = new Set(
    doc.solutions
      .flatMap((s) => [s.blocks, ...s.steps.map((t) => t.blocks)])
      .flatMap((b) => (b ?? []).flatMap((v) => (v.type === 'image' ? [v.assetId] : []))),
  );
  const assets = doc.assets.filter(
    (a) =>
      a.mime !== 'application/pdf' &&
      a.kind !== 'original_pdf' &&
      (mode === 'answer' ||
        (!['answer_diagram', 'answer_pdf', 'fbd'].includes(a.kind) && !answerAssetIds.has(a.id))),
  );
  const blocks = (nodes: ExportNode[], content?: ContentBlock[]) => {
    for (let i = 0; i < (content?.length ?? 0); i++) {
      const b = content![i];
      if (b.type === 'paragraph') prose(nodes, b.text);
      else if (b.type === 'math') math(nodes, b.latex);
      else {
        const asset = assets.find((a) => a.id === b.assetId);
        if (!asset)
          throw new Error('An export image is missing or unavailable. Refresh your selection.');
        const equations: string[] = [];
        if (mode === 'answer')
          while (content?.[i + 1]?.type === 'math') {
            const next = content[++i];
            if (next.type === 'math') equations.push(next.latex);
          }
        nodes.push({ type: 'image', asset, equations });
      }
    }
  };
  const legacy = (nodes: ExportNode[], partId: string | null) =>
    assets
      .filter(
        (a) =>
          !placed.has(a.id) &&
          a.partId === partId &&
          ['answer_diagram', 'fbd'].includes(a.kind) === (mode === 'answer'),
      )
      .sort((a, b) => a.order - b.order)
      .forEach((asset) => nodes.push({ type: 'image', asset, equations: [] }));
  const partPath = (id: string | null): string => {
    const p = doc.parts.find((p) => p.id === id);
    return p ? partPath(p.parentId) + p.label : '';
  };
  const ordered = (id: string | null): QuestionDocument['parts'] =>
    doc.parts
      .filter((p) => p.parentId === id)
      .sort((a, b) => a.order - b.order)
      .flatMap((p) => [p, ...ordered(p.id)]);
  const parts = ordered(null);
  const hintTargets = new Set<string>();
  const hints = (nodes: ExportNode[], partId: string | null, stepId?: string) => {
    const key = stepId ? `step:${stepId}` : `part:${partId}`;
    if (hintTargets.has(key)) return;
    hintTargets.add(key);
    doc.hints
      .filter((h) =>
        stepId ? h.solutionStepId === stepId : !h.solutionStepId && h.partId === partId,
      )
      .sort((a, b) => a.order - b.order)
      .forEach((h) => prose(nodes, `Student hint: ${h.text}`, 'hint'));
  };
  if (mode === 'question') {
    prose(out, doc.question.scenario);
    blocks(out, doc.question.blocks);
    legacy(out, null);
    for (const p of parts) {
      prose(out, `${partPath(p.id)} [${p.marks} marks]`, 'part', true);
      prose(out, p.prompt);
      blocks(out, p.blocks);
      legacy(out, p.id);
    }
    prose(out, `[${doc.question.totalMarks} marks]`, 'total');
  } else {
    hints(out, null);
    const solutions = [...doc.solutions].sort(
      (a, b) =>
        parts.findIndex((p) => p.id === a.partId) - parts.findIndex((p) => p.id === b.partId),
    );
    for (const s of solutions) {
      if (s.partId) {
        prose(out, `Part ${partPath(s.partId)}`, 'part', true);
        const ancestors = (id: string | null): string[] => {
          const p = parts.find((p) => p.id === id);
          return p ? [...ancestors(p.parentId), p.id] : [];
        };
        for (const id of ancestors(s.partId)) hints(out, id);
      }
      prose(out, s.solution);
      math(out, s.equationLatex);
      blocks(out, s.blocks);
      for (const step of [...s.steps].sort((a, b) => a.order - b.order)) {
        const nodes: ExportNode[] = [];
        if (step.id) hints(nodes, s.partId, step.id);
        prose(nodes, step.explanation);
        math(nodes, step.equationLatex);
        prose(nodes, step.working);
        blocks(nodes, step.blocks);
        prose(nodes, step.markingPoint);
        out.push({
          type: 'step',
          id: step.id,
          number: step.number,
          part: partPath(s.partId),
          marks: step.marks,
          code: step.markingCode,
          nodes,
        });
      }
      legacy(out, s.partId);
    }
    prose(out, `Total: ${doc.question.totalMarks} marks`, 'total');
  }
  return out;
}
