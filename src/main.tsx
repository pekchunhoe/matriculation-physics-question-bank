import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Taxonomy } from '../shared/schema';
import { api } from './api';
import { Browser } from './Browser';
import { AuthProvider, useAuth, AdminLogin, StudentLogin, Logout } from './Auth';
import { PublicCurriculum } from './PublicCurriculum';
import './styles.css';

const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));
const Preview = lazy(() => import('./Preview').then((m) => ({ default: m.Preview })));
const Curriculum = lazy(() => import('./Curriculum').then((m) => ({ default: m.Curriculum })));
const LegacyArchive = lazy(() =>
  import('./LegacyArchive').then((m) => ({ default: m.LegacyArchive })),
);
const QuestionSet = lazy(() => import('./QuestionSet').then((m) => ({ default: m.QuestionSet })));
const Students = lazy(() => import('./Students').then((m) => ({ default: m.Students })));
function App() {
  const { session, loading } = useAuth();
  const admin = session.user?.role === 'admin';
  const [tax, setTax] = useState<Taxonomy | null>(null),
    [error, setError] = useState('');
  const load = () =>
    api<Taxonomy>('/taxonomy')
      .then(setTax)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (session.authenticated) void load();
    else setTax(null);
  }, [admin, session.authenticated]);
  const path = location.pathname.split('/').filter(Boolean),
    current = path[0] ?? 'bank';
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-symbol">P</span>
          <span>
            Matriculation Physics<small>QUESTION BANK</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a aria-current={current === 'bank' ? 'page' : undefined} href="/">
            Question bank
          </a>
          <a aria-current={current === 'curriculum' ? 'page' : undefined} href="/curriculum">
            Curriculum
          </a>
          {admin && (
            <a className="button primary" href="/edit/new">
              Add question
            </a>
          )}
          {admin && <a href="/admin/students">Student access</a>}
          {session.authenticated ? <Logout /> : <a href="/admin/login">Admin login</a>}
        </nav>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Suspense fallback={<p role="status">Loading...</p>}>
          {current === 'admin' && (path[1] === 'login' || !admin) ? (
            <AdminLogin />
          ) : loading ? (
            <p role="status">Loading...</p>
          ) : !session.authenticated ? (
            <StudentLogin />
          ) : current === 'admin' && path[1] === 'students' ? (
            <Students />
          ) : !tax ? (
            <p role="status">Loading...</p>
          ) : (['edit', 'import'].includes(current) ||
              (current === 'admin' && path[1] === 'legacy')) &&
            !admin ? (
            <AdminLogin />
          ) : current === 'question-set' ? (
            <QuestionSet />
          ) : current === 'edit' ? (
            <Editor tax={tax} id={path[1]} />
          ) : current === 'questions' ? (
            <Preview tax={tax} id={path[1]} />
          ) : current === 'curriculum' ? (
            admin ? (
              <Curriculum tax={tax} reload={load} />
            ) : (
              <PublicCurriculum tax={tax} />
            )
          ) : current === 'admin' && path[1] === 'legacy' ? (
            <LegacyArchive />
          ) : current === 'import' ? (
            <section className="panel">
              <h1>Image question upload</h1>
              <a href="/edit/new">Add a question and answer image pair</a>
            </section>
          ) : (
            <Browser tax={tax} />
          )}
        </Suspense>
      </main>
      <footer>Original question images - Matched answers - Syllabus order</footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
