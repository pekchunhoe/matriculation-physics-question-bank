import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Taxonomy } from '../shared/schema';
import { api } from './api';
import { Browser } from './Browser';
import 'katex/dist/katex.min.css';
import './styles.css';

const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));
const Preview = lazy(() => import('./Preview').then((m) => ({ default: m.Preview })));
const Curriculum = lazy(() => import('./Curriculum').then((m) => ({ default: m.Curriculum })));
const Importer = lazy(() => import('./Importer').then((m) => ({ default: m.Importer })));
function App() {
  const [tax, setTax] = useState<Taxonomy | null>(null),
    [error, setError] = useState('');
  const load = () =>
    api<Taxonomy>('/taxonomy')
      .then(setTax)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
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
          <a aria-current={current === 'import' ? 'page' : undefined} href="/import">
            Import JSON
          </a>
          <a className="button primary" href="/edit/new">
            Add question
          </a>
        </nav>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Suspense fallback={<p role="status">Loading…</p>}>
          {!tax ? (
            <p role="status">Loading question bank…</p>
          ) : current === 'edit' ? (
            <Editor tax={tax} id={path[1]} />
          ) : current === 'questions' ? (
            <Preview tax={tax} id={path[1]} />
          ) : current === 'curriculum' ? (
            <Curriculum tax={tax} reload={load} />
          ) : current === 'import' ? (
            <Importer tax={tax} />
          ) : (
            <Browser tax={tax} />
          )}
        </Suspense>
      </main>
      <footer>Authored Physics content · Structured records · Reviewed revisions</footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
