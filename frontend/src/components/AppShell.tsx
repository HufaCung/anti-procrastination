import { useCopy } from '../i18n/LanguageContext';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { Sidebar } from './Sidebar';
import { QuickTaskModal } from './QuickTaskModal';
import { ProjectModal } from './ProjectModal';
import type { Project } from '../data/types';
import { WelcomeTour } from './WelcomeTour';

interface UIActions {
  openQuickTask: (projectId?: string) => void;
  openNewProject: () => void;
  openEditProject: (p: Project) => void;
}

const UICtx = createContext<UIActions>({ openQuickTask: () => {}, openNewProject: () => {}, openEditProject: () => {} });
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [quick, setQuick] = useState<{ open: boolean; projectId?: string }>({ open: false });
  const [proj, setProj] = useState<{ open: boolean; project?: Project }>({ open: false });
  const openQuickTask = useCallback((projectId?: string) => setQuick({ open: true, projectId }), []);
  const openNewProject = useCallback(() => setProj({ open: true }), []);
  const openEditProject = useCallback((p: Project) => setProj({ open: true, project: p }), []);
  const value = useMemo(() => ({ openQuickTask, openNewProject, openEditProject }), [openQuickTask, openNewProject, openEditProject]);
  return (
    <UICtx.Provider value={value}>
      {children}
      <QuickTaskModal open={quick.open} defaultProjectId={quick.projectId} onClose={() => setQuick((q) => ({ ...q, open: false }))} />
      <ProjectModal open={proj.open} project={proj.project} onClose={() => setProj((p) => ({ ...p, open: false }))} />
    </UICtx.Provider>
  );
}

const MOBILE_NAV = '(max-width: 820px)';

export function AppShell() {
  const copy = useCopy();
  const ui = useUI();
  const loc = useLocation();
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_NAV).matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV);
    const update = () => {
      setMobile(media.matches);
      setMenuOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    drawer.current?.close();
    setMenuOpen(false);
  }, [loc.key]);

  function openMenu() {
    drawer.current?.showModal();
    closeButton.current?.focus();
    setMenuOpen(true);
  }

  function openQuickTask() {
    drawer.current?.close();
    setMenuOpen(false);
    ui.openQuickTask(loc.pathname.startsWith('/projects/') ? loc.pathname.split('/')[2] : undefined);
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">{copy("Skip to content")}</a>
      {mobile ? (
        <>
          <header className="mobile-header">
            <button type="button" className="icon-btn plain" aria-label={copy("Open menu")} aria-haspopup="dialog"
              aria-controls="mobile-navigation" aria-expanded={menuOpen} onClick={(event) => { event.currentTarget.focus(); openMenu(); }}>
              <Icon name="menu" size={22} />
            </button>
            <span className="mobile-brand">TinyDo</span>
          </header>
          <dialog ref={drawer} id="mobile-navigation" className="shell-side mobile-drawer"
            aria-label={copy("Navigation menu")} onClose={() => setMenuOpen(false)}
            onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
            <Sidebar onNewTask={openQuickTask} modalContainer={drawer} closeControl={
              <button ref={closeButton} type="button" className="icon-btn plain" aria-label={copy("Close menu")} onClick={() => drawer.current?.close()}>
                <Icon name="x" size={21} />
              </button>
            } />
          </dialog>
        </>
      ) : (
        <div className="shell-side">
          <Sidebar onNewTask={openQuickTask} />
        </div>
      )}
      <Outlet />
      <WelcomeTour />
    </div>
  );
}

/** Main content wrapper with page enter animation keyed by route. */
export function Page({ children, narrow, label, className = '' }: { children: ReactNode; narrow?: boolean; label?: string; className?: string }) {
  const loc = useLocation();
  return (
    <main id="main" tabIndex={-1} aria-label={label} key={loc.pathname} className={`shell-main page-enter ${narrow ? 'narrow' : ''} ${className}`.trim()}>
      {children}
    </main>
  );
}
