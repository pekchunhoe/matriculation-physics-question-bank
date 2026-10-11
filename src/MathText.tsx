import katex from 'katex';
function renderMath(value: string, displayMode: boolean) {
  // Display equations can overflow on narrow screens. Make their scroll region
  // keyboard accessible, including browsers without automatic scroll focus.
  return katex
    .renderToString(value, { displayMode, throwOnError: false, trust: false })
    .replace('<span class="katex-display">', '<span class="katex-display" tabindex="0">');
}
export function Equation({ value }: { value: string }) {
  if (!value) return null;
  return (
    <div
      className="equation"
      dangerouslySetInnerHTML={{
        __html: renderMath(value, true),
      }}
    />
  );
}
export function MathText({ value }: { value: string }) {
  if (!value) return null;
  const chunks = value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return (
    <div className="prose">
      {chunks.map((s, i) =>
        s.startsWith('$') ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: renderMath(
                s.slice(s.startsWith('$$') ? 2 : 1, s.startsWith('$$') ? -2 : -1),
                s.startsWith('$$'),
              ),
            }}
          />
        ) : (
          <span key={i}>{s}</span>
        ),
      )}
    </div>
  );
}
