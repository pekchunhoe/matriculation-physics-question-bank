import { useEffect, useState } from 'react';
import { api, json } from './api';
import type { StudentList, StudentRecord } from '../shared/student';
import { Field } from './components';
const statusLabels = {
  PENDING_VERIFICATION: 'Pending verification',
  VERIFIED_AWAITING_CODE: 'Verified — awaiting access code',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
};
export function Students() {
  const [result, setResult] = useState<StudentList>(),
    [email, setEmail] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [issued, setIssued] = useState<{ email: string; code: string }>(),
    [manual, setManual] = useState<{ email: string; link: string }>(),
    [copied, setCopied] = useState(false),
    [changing, setChanging] = useState<StudentRecord>(),
    [replacement, setReplacement] = useState('');
  async function load() {
    setResult(
      await api<StudentList>(
        '/admin/students?' + new URLSearchParams({ search, page: String(page) }),
      ),
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [search, page]);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setIssued(undefined);
    setManual(undefined);
    setCopied(false);
    try {
      await operation();
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function action(s: StudentRecord, action: string) {
    await run(async () => {
      const response = await api<{ code?: string; link?: string }>(
        '/admin/students/' + s.id + '/' + action,
        json('POST', {
          revision: s.revision,
          requestId: crypto.randomUUID(),
          ...(action === 'email' ? { email: replacement } : {}),
        }),
      );
      if (response.code) setIssued({ email: s.email, code: response.code });
      if (response.link) setManual({ email: s.email, link: response.link });
      if (action === 'email') setChanging(undefined);
    });
  }
  return (
    <section className="panel">
      <h1>Student Access Management</h1>
      <p>
        Register an email, wait for verification, then issue an individual access code privately.
      </p>
      {result && !result.emailConfigured && (
        <p role="status">
          Manual email delivery: generate a verification link and email it yourself to the
          registered address. No email is sent automatically. Maximum five registrations per day
          (Malaysia time).
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {issued && (
        <aside className="panel" aria-label="New access code">
          <h2>Access code for {issued.email}</h2>
          <p>This code is shown once. Deliver it privately before dismissing this message.</p>
          <output aria-label="Issued access code">{issued.code}</output>
          <p>
            <button className="button" onClick={() => setIssued(undefined)}>
              Dismiss code
            </button>
          </p>
        </aside>
      )}
      {manual && (
        <aside className="panel" aria-label="Manual verification link">
          <h2>Send verification to {manual.email}</h2>
          <p>
            This link is shown once and expires in 24 hours. Copy it into an email addressed only to{' '}
            {manual.email}. Tell the student to open it and choose Verify My Email. If registration
            was unexpected, they should ignore it.
          </p>
          <p>
            Do not open the link on the student's behalf or send it through another channel.
            Generating or sending it does not verify the account. A replacement link invalidates the
            previous one.
          </p>
          <Field label="Verification link">
            <textarea readOnly rows={4} value={manual.link} onFocus={(e) => e.target.select()} />
          </Field>
          <button
            className="button primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(manual.link);
                setCopied(true);
              } catch {
                setError('Select and copy the link from the field.');
              }
            }}
          >
            {copied ? 'Link copied' : 'Copy verification link'}
          </button>
          <button className="button" onClick={() => setManual(undefined)}>
            Dismiss link
          </button>
          <p>
            Clear your clipboard after pasting. If you lose the link, wait one minute and generate a
            replacement.
          </p>
        </aside>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api('/admin/students', json('POST', { email, requestId: crypto.randomUUID() }));
            setEmail('');
          });
        }}
      >
        <Field label="New student email">
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <button className="button primary" disabled={busy}>
          Add student
        </button>
      </form>
      <Field label="Search students">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      <button className="button" disabled={busy} onClick={() => void run(async () => {})}>
        Refresh status
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Verification</th>
              <th>Account status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>
                  {s.verifiedAt ? 'Verified ' + new Date(s.verifiedAt).toLocaleString() : 'Pending'}
                  <br />
                  Email: {s.deliveryState.toLowerCase().replaceAll('_', ' ')}
                </td>
                <td>{statusLabels[s.status]}</td>
                <td>
                  {s.status === 'PENDING_VERIFICATION' && (
                    <button disabled={busy} onClick={() => void action(s, 'verification-link')}>
                      {s.deliveryState === 'MANUAL_READY'
                        ? 'Generate replacement link'
                        : 'Generate verification link'}
                    </button>
                  )}
                  {s.status === 'PENDING_VERIFICATION' && result.emailConfigured && (
                    <button
                      disabled={busy || !result.emailConfigured}
                      onClick={() => void action(s, 'send')}
                    >
                      {s.deliveryState === 'SENT'
                        ? 'Resend verification email'
                        : 'Send verification'}
                    </button>
                  )}
                  {s.status === 'VERIFIED_AWAITING_CODE' && (
                    <button disabled={busy} onClick={() => void action(s, 'generate')}>
                      Generate access code
                    </button>
                  )}
                  {s.status === 'ACTIVE' && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm('Replace this access code and sign out all student sessions?')
                          )
                            void action(s, 'reset');
                        }}
                      >
                        Reset access code
                      </button>
                      <button disabled={busy} onClick={() => void action(s, 'revoke')}>
                        Revoke sessions
                      </button>
                    </>
                  )}
                  {s.status === 'DISABLED' ? (
                    <button disabled={busy} onClick={() => void action(s, 'reactivate')}>
                      Reactivate student
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (confirm('Disable this student and revoke their code and sessions?'))
                          void action(s, 'disable');
                      }}
                    >
                      Disable student
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => {
                      setChanging(s);
                      setReplacement('');
                      setIssued(undefined);
                    }}
                  >
                    Change email
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {changing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(changing, 'email');
          }}
        >
          <h2>Change email for {changing.email}</h2>
          <p>
            This revokes the current code and sessions. The replacement address must verify before a
            new code can be issued.
          </p>
          <Field label="Replacement email">
            <input
              type="email"
              required
              maxLength={254}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </Field>
          <button disabled={busy}>Save new email</button>
          <button type="button" onClick={() => setChanging(undefined)}>
            Cancel
          </button>
        </form>
      )}
      <p>
        {result?.total ?? 0} students · Page {page} of {result?.pages ?? 1}
      </p>
      <button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      <button disabled={busy || page >= (result?.pages ?? 1)} onClick={() => setPage(page + 1)}>
        Next
      </button>
    </section>
  );
}
