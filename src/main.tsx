import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Taxonomy } from '../shared/schema';
import { api } from './api';
import { Browser } from './Browser';
import { AuthProvider, useAuth, AdminLogin, Logout } from './Auth';
import { PublicCurriculum } from './PublicCurriculum';
import 'katex/dist/katex.min.css';
import './styles.css';

const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));
const Preview = lazy(() => import('./Preview').then((m) => ({ default: m.Preview })));
const Curriculum = lazy(() => import('./Curriculum').then((m) => ({ default: m.Curriculum })));
const QuestionJsonImporter = lazy(() =>
  import('./QuestionJsonImporter').then((m) => ({ default: m.QuestionJsonImporter })),
);
const Importer = lazy(() => import('./Importer').then((m) => ({ default: m.Importer })));
const QuestionSet = lazy(() => import('./QuestionSet').then((m) => ({ default: m.QuestionSet })));
function App() {
  const { session, loading } = useAuth();
  const admin = session.authenticated;
  const [tax, setTax] = useState<Taxonomy | null>(null),
    [error, setError] = useState('');
  const load = () =>
    api<Taxonomy>('/taxonomy')
      .then(setTax)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [admin]);
  const path = location.pathname.split('/').filter(Boolean),
    current = path[0] ?? 'bank';
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-symbol">φ</span>
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
            <a
              aria-current={current === 'import' ? 'page' : undefined}
              href="/import/question-json"
            >
              Import Question JSON
            </a>
          )}
          {admin && (
            <a className="button primary" href="/edit/new">
              Add question
            </a>
          )}
          {admin ? <Logout /> : <a href="/admin/login">Admin login</a>}
        </nav>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Suspense fallback={<p role="status">Loading…</p>}>
          {current === 'admin' ? (
            <AdminLogin />
          ) : loading || !tax ? (
            <p role="status">Loading question bank…</p>
          ) : ['edit', 'import'].includes(current) && !admin ? (
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
          ) : current === 'import' ? (
            path[1] === 'question-json' ? (
              <QuestionJsonImporter tax={tax} />
            ) : (
              <Importer tax={tax} />
            )
          ) : (
            <Browser tax={tax} />
          )}
        </Suspense>
      </main>
      <footer>Authored Physics content · Structured records · Reviewed revisions</footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
