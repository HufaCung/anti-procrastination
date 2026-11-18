import { translateCopy } from '../i18n/copy';
import { useDateCopy, useCopy, useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import { Page } from '../components/AppShell';
import { EmptyState, useDocumentTitle } from '../components/ui';
import { fetchAdminUsers, type AdminUsersResult } from '../data/admin';


type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; result: AdminUsersResult };

export function AdminPage() {
  const { fmtMinutes } = useDateCopy();
  const copy = useCopy();
  const { language } = useLanguage();
  useDocumentTitle(copy("Admin · Users"));
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
      error => { if (!controller.signal.aborted) setState({ kind: 'error', message: error instanceof Error ? error.message : "Could not load users." }); },
    );
    return () => controller.abort();
  }, [page, query, refresh]);

  return (
    <Page label={copy("Admin users")}>
      <header className="page-head">
        <div className="col" style={{ gap: 6 }}>
          <h1 className="page-title">{copy("Admin · Users")}</h1>
          <p className="muted">{copy("Read-only account and workspace statistics. Passwords, tokens, avatars, project/task content and personal notes are excluded.")}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setRefresh(value => value + 1)} disabled={state.kind === 'loading'}>{copy("Refresh users")}</button>
      </header>
      <form className="row wrap" style={{ gap: 10, marginBottom: 20 }} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); setRefresh(value => value + 1); }}>
        <label htmlFor="admin-search">{copy("Search users")}</label>
        <input id="admin-search" className="input" style={{ maxWidth: 360 }} placeholder={copy("Username or display name")} maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
        <button type="submit" className="btn btn-primary">{copy("Search")}</button>
      </form>
      {state.kind === 'loading' && <p role="status">{copy("Loading users...")}</p>}
      {state.kind === 'error' && <div role="alert" className="card pad"><p>{translateCopy(language, state.message)}</p><button type="button" className="btn btn-secondary" onClick={() => setRefresh(value => value + 1)}>{copy("Try again")}</button></div>}
      {state.kind === 'ready' && <>
        <section aria-label={copy("All users totals")} className="card pad row wrap" style={{ gap: 24, marginBottom: 20 }}>
          <span><strong>{state.result.summary.users}</strong> {copy("users")}</span>
          <span><strong>{state.result.summary.projects}</strong> {copy("projects")}</span>
          <span><strong>{state.result.summary.tasks}</strong> {copy("tasks")}</span>
          <span><strong>{state.result.summary.sessions}</strong> {copy("focus sessions")}</span>
          <span><strong>{fmtMinutes(state.result.summary.focusMinutes)}</strong> {copy("focus logged")}</span>
        </section>
        <section aria-label={copy("User list")} className="card clip">
          {state.result.users.length === 0 ? <EmptyState icon="folder" title={copy("No users found")} body={copy("Try a different username or display name.")} /> :
            <div className="table-wrap"><table className="data">
              <thead><tr><th scope="col">{copy("Username")}</th><th scope="col">{copy("Display name")}</th><th scope="col">{copy("Role")}</th><th scope="col">{copy("Joined")}</th><th scope="col">{copy("Projects")}</th><th scope="col">{copy("Tasks done / total")}</th><th scope="col">{copy("Sessions")}</th><th scope="col">{copy("Focus")}</th></tr></thead>
              <tbody>{state.result.users.map(user => <tr key={user.id}>
                <td>{user.username}</td><td>{user.name}</td><td>{copy(user.role === 'admin' ? 'Admin' : 'User')}</td><td>{new Date(user.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                <td>{user.projects}</td><td>{user.completedTasks} / {user.tasks}</td><td>{user.sessions}</td><td>{fmtMinutes(user.focusMinutes)}</td>
              </tr>)}</tbody>
            </table></div>}
          <div className="foot-bar" aria-label={copy("Users pagination")}>
            <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{copy("Previous page")}</button>
            <span role="status">{copy("Page")} {page} {copy("of")} {state.result.totalPages} · {state.result.total} {copy("matching users")}</span>
            <button type="button" className="btn btn-secondary" disabled={page >= state.result.totalPages} onClick={() => setPage(value => value + 1)}>{copy("Next page")}</button>
          </div>
        </section>
      </>}
    </Page>
  );
}
