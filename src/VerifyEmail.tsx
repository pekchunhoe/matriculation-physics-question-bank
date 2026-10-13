import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './verification.css';
// Fragment never reaches the HTTP server or its access logs. Remove it before any request.
let token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
history.replaceState(null, '', location.pathname);
function VerifyEmail() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  return (
    <main>
      <p>Matriculation Physics Question Bank</p>
      <h1>Verify your email</h1>
      {done ? (
        <>
          <p role="status">
            Email verified. Your administrator must now issue your access code before you can sign
            in.
          </p>
          <a href="/">Go to student login</a>
        </>
      ) : (
        <>
          <p>
            Your administrator registered your email. Confirm that you control this inbox.
            Verification does not activate access or sign you in.
          </p>
          {!token ? (
            <p role="alert">The verification link is missing. Open the full link in your email.</p>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const response = await fetch('/api/student-auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Question-Bank-Request': '1' },
                    body: JSON.stringify({ token }),
                    credentials: 'same-origin',
                    cache: 'no-store',
                  });
                  if (!response.ok)
                    throw new Error(
                      'Verification could not be completed. The link may be expired or already used. Ask your administrator to resend it.',
                    );
                  token = '';
                  setDone(true);
                } catch {
                  setError(
                    'Verification could not be completed. The link may be expired or already used. Ask your administrator to resend it.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Verifying…' : 'Verify My Email'}
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          <p>If you did not expect this registration, close this page without confirming.</p>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<VerifyEmail />);
