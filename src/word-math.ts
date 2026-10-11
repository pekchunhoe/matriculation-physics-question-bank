import katex from 'katex';
import { SaxesParser } from 'saxes';

export const xmlText = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
type Node = { name: string; attrs: Record<string, string>; children: Node[]; text: string };
export class UnsupportedWordMath extends Error {
  constructor(detail: string) {
    super(
      `Word cannot safely export this equation (${detail}). Choose PDF or revise the equation before exporting Word.`,
    );
  }
}
export function latexToOmml(latex: string, display = false): string {
  let markup: string;
  try {
    markup = katex.renderToString(latex, {
      output: 'mathml',
      displayMode: display,
      throwOnError: true,
      trust: false,
      maxExpand: 1000,
    });
  } catch {
    throw new UnsupportedWordMath('invalid LaTeX');
  }
  const stack: Node[] = [];
  let root: Node | undefined;
  const parser = new SaxesParser();
  parser.on('opentag', (tag) => {
    const n: Node = {
      name: tag.name,
      attrs: tag.attributes as Record<string, string>,
      children: [],
      text: '',
    };
    stack.at(-1)?.children.push(n);
    stack.push(n);
    if (tag.name === 'math') root = n;
  });
  parser.on('text', (text) => {
    if (stack.length) stack.at(-1)!.text += text;
  });
  parser.on('closetag', () => {
    stack.pop();
  });
  parser.write(markup).close();
  if (!root) throw new UnsupportedWordMath('missing MathML');
  const tag = (name: string, body: string) => `<m:${name}>${body}</m:${name}>`;
  const chr = (name: string, value: string) => `<m:${name} m:val="${xmlText(value)}"/>`;
  const convert = (n: Node, inherited = ''): string => {
    const variant = n.attrs.mathvariant ?? inherited;
    if (n.attrs.mathcolor || n.attrs.mathbackground || n.attrs.style)
      throw new UnsupportedWordMath('custom equation styling');
    const children = () => n.children.map((c) => convert(c, variant)).join('');
    const child = (i: number) => {
      if (!n.children[i]) throw new UnsupportedWordMath(`incomplete ${n.name}`);
      return convert(n.children[i], variant);
    };
    switch (n.name) {
      case 'math':
        return children();
      case 'semantics':
        return child(0); // annotation is original LaTeX, not a second equation.
      case 'mstyle':
      case 'mpadded':
        if (n.name === 'mpadded') throw new UnsupportedWordMath('phantom or padded notation');
        return children();
      case 'mrow': {
        const first = n.children[0],
          last = n.children.at(-1);
        if (
          first?.name === 'mo' &&
          last?.name === 'mo' &&
          first.attrs.fence === 'true' &&
          last.attrs.fence === 'true' &&
          n.children.length > 1
        )
          return tag(
            'd',
            tag('dPr', chr('begChr', first.text) + chr('endChr', last.text)) +
              tag(
                'e',
                n.children
                  .slice(1, -1)
                  .map((c) => convert(c, variant))
                  .join(''),
              ),
          );
        return children();
      }
      case 'mi':
      case 'mn':
      case 'mo':
      case 'mtext': {
        const styles: Record<string, string> = {
          normal: 'p',
          italic: 'i',
          bold: 'b',
          'bold-italic': 'bi',
          'double-struck': 'p',
          script: 'p',
          fraktur: 'p',
          'sans-serif': 'p',
          monospace: 'p',
          'bold-script': 'b',
          'bold-fraktur': 'b',
          'bold-sans-serif': 'b',
          'sans-serif-italic': 'i',
          'sans-serif-bold-italic': 'bi',
        };
        if (variant && !styles[variant]) throw new UnsupportedWordMath(`math variant ${variant}`);
        const scripts: Record<string, string> = {
          'double-struck': 'double-struck',
          script: 'script',
          'bold-script': 'script',
          fraktur: 'fraktur',
          'bold-fraktur': 'fraktur',
          'sans-serif': 'sans-serif',
          'bold-sans-serif': 'sans-serif',
          'sans-serif-italic': 'sans-serif',
          'sans-serif-bold-italic': 'sans-serif',
          monospace: 'monospace',
        };
        const style = styles[variant] ?? (n.name === 'mi' && n.text.length === 1 ? 'i' : 'p');
        const props = tag(
          'rPr',
          chr('sty', style) + (scripts[variant] ? chr('scr', scripts[variant]) : ''),
        );
        return tag('r', props + `<m:t xml:space="preserve">${xmlText(n.text)}</m:t>`);
      }
      case 'mspace': {
        const width = n.attrs.width ?? '0';
        if (width.startsWith('-')) throw new UnsupportedWordMath('negative mathematical spacing');
        return tag('r', '<m:t xml:space="preserve"> </m:t>');
      }
      case 'mfrac':
        if (n.attrs.linethickness && n.attrs.linethickness !== '0px')
          throw new UnsupportedWordMath('custom fraction rule');
        return tag(
          'f',
          (n.attrs.linethickness === '0px' ? tag('fPr', chr('type', 'noBar')) : '') +
            tag('num', child(0)) +
            tag('den', child(1)),
        );
      case 'msup':
        return tag('sSup', tag('e', child(0)) + tag('sup', child(1)));
      case 'msub':
        return tag('sSub', tag('e', child(0)) + tag('sub', child(1)));
      case 'msubsup':
        return tag('sSubSup', tag('e', child(0)) + tag('sub', child(1)) + tag('sup', child(2)));
      case 'msqrt':
        return tag(
          'rad',
          tag('radPr', chr('degHide', '1')) + tag('deg', '') + tag('e', children()),
        );
      case 'mroot':
        return tag('rad', tag('deg', child(1)) + tag('e', child(0)));
      case 'mover':
      case 'munder': {
        const accent = n.children[1];
        if (n.name === 'mover' && (n.attrs.accent === 'true' || accent?.text === '→')) {
          const accents: Record<string, string> = {
            '⃗': '⃗',
            '̂': '̂',
            '̃': '̃',
            '̇': '̇',
            '̈': '̈',
            '̅': '̅',
            '→': '⃗',
            '^': '̂',
            ˆ: '̂',
            '~': '̃',
            '˜': '̃',
            '˙': '̇',
            '¨': '̈',
            '¯': '̅',
            '‾': '̅',
            ˇ: '̌',
            '˘': '̆',
          };
          const c = accents[accent?.text];
          if (!c) throw new UnsupportedWordMath(`accent ${accent?.text ?? ''}`);
          return tag('acc', tag('accPr', chr('chr', c)) + tag('e', child(0)));
        }
        if (n.name === 'munder' && n.attrs.accentunder === 'true')
          throw new UnsupportedWordMath('under accent');
        return tag(
          n.name === 'mover' ? 'limUpp' : 'limLow',
          tag('e', child(0)) + tag('lim', child(1)),
        );
      }
      case 'munderover':
        return tag(
          'limUpp',
          tag('e', tag('limLow', tag('e', child(0)) + tag('lim', child(1)))) + tag('lim', child(2)),
        );
      case 'mtable': {
        if (n.attrs.rowlines || n.attrs.columnlines)
          throw new UnsupportedWordMath('ruled math table');
        const rows = n.children;
        const cols = rows[0]?.children.length ?? 0;
        if (
          !cols ||
          rows.some(
            (r) =>
              r.name !== 'mtr' ||
              r.children.length !== cols ||
              r.children.some((c) => c.name !== 'mtd'),
          )
        )
          throw new UnsupportedWordMath('irregular equation alignment');
        const alignment = (n.attrs.columnalign ?? '').split(/\s+/);
        if (
          alignment.length === cols &&
          alignment.every((a, i) => a === (i % 2 ? 'left' : 'right'))
        ) {
          // Use native run alignment properties, keeping marker characters out of
          // equation text. Operator-leading matrix cells are not equation arrays.
          return tag(
            'eqArr',
            rows
              .map((r) =>
                tag(
                  'e',
                  r.children
                    .map((c, i) => {
                      const value = convert(c, variant);
                      if (!i) return value;
                      if (!value.startsWith('<m:r><m:rPr>'))
                        throw new UnsupportedWordMath('alignment before a compound expression');
                      return value.replace('<m:rPr>', '<m:rPr><m:aln/>');
                    })
                    .join(''),
                ),
              )
              .join(''),
          );
        }
        const mcs = Array.from({ length: cols }, (_, i) =>
          tag(
            'mc',
            tag(
              'mcPr',
              chr('count', '1') +
                chr(
                  'mcJc',
                  alignment[i] === 'left' ? 'left' : alignment[i] === 'right' ? 'right' : 'center',
                ),
            ),
          ),
        ).join('');
        return tag(
          'm',
          tag('mPr', tag('mcs', mcs)) +
            rows
              .map((r) => tag('mr', r.children.map((c) => tag('e', convert(c, variant))).join('')))
              .join(''),
        );
      }
      case 'mtd':
        return children();
      case 'menclose': {
        if (n.attrs.notation !== 'box')
          throw new UnsupportedWordMath(`enclosure ${n.attrs.notation}`);
        return tag(
          'borderBox',
          tag(
            'borderBoxPr',
            ['hideTop', 'hideBot', 'hideLeft', 'hideRight'].map((p) => chr(p, '0')).join(''),
          ) + tag('e', children()),
        );
      }
      default:
        throw new UnsupportedWordMath(`MathML ${n.name}`);
    }
  };
  const math = tag('oMath', convert(root));
  return display ? tag('oMathPara', tag('oMathParaPr', chr('jc', 'center')) + math) : math;
}
