import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, json } from './api';
import { Field } from './components';
type Session = {
  authenticated: boolean;
  user?: { id: string; email: string; role: 'admin' | 'student' };
};
const AuthContext = createContext({
  session: { authenticated: false } as Session,
  loading: true,
  refresh: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ authenticated: false }),
    [loading, setLoading] = useState(true);
  async function refresh() {
    try {
      setSession(await api<Session>('/auth/session'));
    } catch {
      setSession({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, refresh }}>{children}</AuthContext.Provider>
  );
}
export function AdminLogin() {
  const { session, refresh } = useAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', json('POST', { email, password }));
      setPassword('');
      await refresh();
      location.assign('/');
    } catch (error) {
      setError((error as Error).message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-login">
      <p className="eyebrow">ADMINISTRATOR ACCESS</p>
      <h1>Admin login</h1>
      <p>Administrator access is separate from student email verification and access codes.</p>
      {session.user?.role === 'admin' ? (
        <a className="button" href="/">
          Continue to question bank
        </a>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Administrator email">
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </section>
  );
}
export function Logout() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await Promise.all([
              api('/auth/logout', json('POST', {})),
              api('/student-auth/logout', json('POST', {})),
            ]);
            location.assign('/');
          } catch {
            setError('Could not sign out. Please try again.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Signing out…' : 'Logout'}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
export function StudentLogin() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="panel admin-login">
      <p className="eyebrow">STUDENT ACCESS</p>
      <h1>Student login</h1>
      <p>Use your verified email and the access code given to you by your administrator.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/student-auth/login', json('POST', { email, code }));
            setCode('');
            await refresh();
          } catch (e) {
            setError((e as Error).message);
            setCode('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Student email">
          <input
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Access code">
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p>For registration or a replacement code, contact your administrator.</p>
    </section>
  );
}
