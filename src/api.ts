export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      `Question Bank API unavailable (HTTP ${response.status}). The frontend needs the configured Express backend; a static-only deployment cannot read or save the bank.`,
    );
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body as T;
}
export function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
