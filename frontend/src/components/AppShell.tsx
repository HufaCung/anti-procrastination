import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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

export function AppShell() {
  const ui = useUI();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="shell-side">
        <Sidebar onNewTask={() => ui.openQuickTask(loc.pathname.startsWith('/projects/') ? loc.pathname.split('/')[2] : undefined)} />
      </div>
      <Outlet />
      <WelcomeTour />
    </div>
  );
}

/** Main content wrapper with page enter animation keyed by route. */
export function Page({ children, narrow, label }: { children: ReactNode; narrow?: boolean; label?: string }) {
  const loc = useLocation();
  return (
    <main id="main" tabIndex={-1} aria-label={label} key={loc.pathname} className={`shell-main page-enter ${narrow ? 'narrow' : ''}`}>
      {children}
    </main>
  );
}
