import { useEffect, useState } from 'react';
import { Page } from '../components/AppShell';
import { EmptyState, useDocumentTitle } from '../components/ui';
import { fetchAdminUsers, type AdminUsersResult } from '../data/admin';
import { fmtMinutes } from '../logic/dates';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; result: AdminUsersResult };

export function AdminPage() {
  useDocumentTitle('Admin · Users');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchAdminUsers(page, query, controller.signal).then(
      result => { if (!controller.signal.aborted) setState({ kind: 'ready', result }); },
      error => { if (!controller.signal.aborted) setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load users.' }); },
    );
    return () => controller.abort();
  }, [page, query, refresh]);

  return (
    <Page label="Admin users">
      <header className="page-head">
        <div className="col" style={{ gap: 6 }}>
          <h1 className="page-title">Admin · Users</h1>
          <p className="muted">Read-only account and workspace statistics. Passwords, tokens, avatars, project/task content and personal notes are excluded.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setRefresh(value => value + 1)} disabled={state.kind === 'loading'}>Refresh users</button>
      </header>
      <form className="row wrap" style={{ gap: 10, marginBottom: 20 }} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); setRefresh(value => value + 1); }}>
        <label htmlFor="admin-search">Search users</label>
        <input id="admin-search" className="input" style={{ maxWidth: 360 }} placeholder="Username or display name" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      {state.kind === 'loading' && <p role="status">Loading users...</p>}
      {state.kind === 'error' && <div role="alert" className="card pad"><p>{state.message}</p><button type="button" className="btn btn-secondary" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {state.kind === 'ready' && <>
        <section aria-label="All users totals" className="card pad row wrap" style={{ gap: 24, marginBottom: 20 }}>
          <span><strong>{state.result.summary.users}</strong> users</span>
          <span><strong>{state.result.summary.projects}</strong> projects</span>
          <span><strong>{state.result.summary.tasks}</strong> tasks</span>
          <span><strong>{state.result.summary.sessions}</strong> focus sessions</span>
          <span><strong>{fmtMinutes(state.result.summary.focusMinutes)}</strong> focus logged</span>
        </section>
        <section aria-label="User list" className="card clip">
          {state.result.users.length === 0 ? <EmptyState icon="folder" title="No users found" body="Try a different username or display name." /> :
            <div className="table-wrap"><table className="data">
              <thead><tr><th scope="col">Username</th><th scope="col">Display name</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Projects</th><th scope="col">Tasks done / total</th><th scope="col">Sessions</th><th scope="col">Focus</th></tr></thead>
              <tbody>{state.result.users.map(user => <tr key={user.id}>
                <td>{user.username}</td><td>{user.name}</td><td>{user.role}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>{user.projects}</td><td>{user.completedTasks} / {user.tasks}</td><td>{user.sessions}</td><td>{fmtMinutes(user.focusMinutes)}</td>
              </tr>)}</tbody>
            </table></div>}
          <div className="foot-bar" aria-label="Users pagination">
            <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button>
            <span role="status">Page {page} of {state.result.totalPages} · {state.result.total} matching users</span>
            <button type="button" className="btn btn-secondary" disabled={page >= state.result.totalPages} onClick={() => setPage(value => value + 1)}>Next page</button>
          </div>
        </section>
      </>}
    </Page>
  );
}
