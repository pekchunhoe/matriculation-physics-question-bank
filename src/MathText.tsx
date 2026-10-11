import katex from 'katex';
export function Equation({ value }: { value: string }) {
  if (!value) return null;
  return (
    <div
      className="equation"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          displayMode: true,
          throwOnError: false,
          trust: false,
        }),
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
              __html: katex.renderToString(
                s.slice(s.startsWith('$$') ? 2 : 1, s.startsWith('$$') ? -2 : -1),
                { displayMode: s.startsWith('$$'), throwOnError: false, trust: false },
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
