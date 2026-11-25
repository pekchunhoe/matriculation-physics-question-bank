import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parseQuestionPage,
  questionPageNumbers,
  type PageInfo,
  type QuestionPage,
} from '../shared/pagination';
import { api } from './api';

export function Pagination({
  info,
  onChange,
  label = 'Question pages',
  disabled = false,
}: {
  info: PageInfo;
  onChange: (page: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { page, pages, pageSize, total } = info;
  return (
    <div className="question-pagination">
      <p aria-live="polite" className="pagination-summary">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of{' '}
        {total} questions
        {pages > 1 && (
          <span>
            Page {page} of {pages}
          </span>
        )}
      </p>
      {pages > 1 && (
        <nav className="pagination question-page-controls" aria-label={label}>
          <button
            className="button page-previous"
            disabled={disabled || page === 1}
            onClick={() => onChange(page - 1)}
          >
            Previous
          </button>
          <div className="page-numbers">
            {questionPageNumbers(page, pages).map((value, i) =>
              value === 'gap' ? (
                <span key={'gap-' + i} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  className="button"
                  key={value}
                  aria-label={'Page ' + value}
                  aria-current={value === page ? 'page' : undefined}
                  disabled={disabled}
                  onClick={() => onChange(value)}
                >
                  {value}
                </button>
              ),
            )}
          </div>
          <button
            className="button page-next"
            disabled={disabled || page === pages}
            onClick={() => onChange(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

/** Keep filters and page in history so reloads and Back/Forward restore the same view. */
export function useQuestionLocation(defaults = '') {
  const read = useCallback(() => {
    const params = new URLSearchParams(location.search);
    new URLSearchParams(defaults).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
    params.set('page', String(parseQuestionPage(params.get('page') ?? undefined) ?? 1));
    return params.toString();
  }, [defaults]);
  const [query, setQuery] = useState(read);
  useEffect(() => {
    const restore = () => setQuery(read());
    history.replaceState(history.state, '', location.pathname + '?' + read() + location.hash);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [read]);
  const navigate = useCallback(
    (changes: Record<string, string>, replace = false) => {
      const params = new URLSearchParams(read());
      for (const [key, value] of Object.entries(changes)) params.set(key, value);
      const next = params.toString();
      if (next !== read()) {
        history[replace ? 'replaceState' : 'pushState'](
          history.state,
          '',
          location.pathname + '?' + next + location.hash,
        );
      }
      setQuery(next);
    },
    [read],
  );
  const setPage = useCallback((page: number) => navigate({ page: String(page) }), [navigate]);
  const replacePage = useCallback(
    (page: number) => navigate({ page: String(page) }, true),
    [navigate],
  );
  const params = useMemo(() => new URLSearchParams(query), [query]);
  return { query, params, page: Number(params.get('page')), navigate, setPage, replacePage };
}

/** Abort obsolete requests and never render a response belonging to a previous filter/page. */
export function useQuestionPage<T>(
  endpoint: string,
  query: string,
  replacePage: (page: number) => void,
) {
  type Result = { key: string; result: QuestionPage<T> };
  const key = endpoint + '?' + query,
    cache = useRef<Result | undefined>(undefined),
    [data, setData] = useState<Result>(),
    [failure, setFailure] = useState({ key: '', message: '' }),
    [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => {
    cache.current = undefined;
    setData(undefined);
    setRefreshVersion((version) => version + 1);
  }, []);
  useEffect(() => {
    if (cache.current?.key === key) {
      setData(cache.current);
      return;
    }
    const controller = new AbortController();
    setFailure({ key: '', message: '' });
    void api<QuestionPage<T>>(key, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const canonical = new URLSearchParams(query);
        canonical.set('page', String(result.page));
        cache.current = { key: endpoint + '?' + canonical.toString(), result };
        setData(cache.current);
        if (canonical.toString() !== query) replacePage(result.page);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setFailure({ key, message: e.message });
      });
    return () => controller.abort();
  }, [endpoint, key, query, replacePage, refreshVersion]);
  const error = failure.key === key ? failure.message : '';
  return {
    result: data?.key === key ? data.result : undefined,
    error,
    loading: data?.key !== key && !error,
    refresh,
  };
}

export function useQuestionListStart(page: number, ready: boolean) {
  const start = useRef<HTMLDivElement>(null),
    previous = useRef(page);
  useEffect(() => {
    if (!ready || previous.current === page) return;
    previous.current = page;
    start.current?.focus({ preventScroll: true });
    start.current?.scrollIntoView({ block: 'start' });
  }, [page, ready]);
  return start;
}
