import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/AppStore';
import { AppShell, UIProvider } from './components/AppShell';
import { LoginPage } from './pages/Login';
import { SignUpPage } from './pages/SignUp';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { OnboardingPage } from './pages/Onboarding';
import { DashboardPage } from './pages/Dashboard';
import { ProjectsPage } from './pages/Projects';
import { ProjectPage } from './pages/Project';
import { CalendarPage } from './pages/Calendar';
import { FocusPage } from './pages/Focus';
import { ProgressPage } from './pages/Progress';
import { ProfilePage } from './pages/Profile';
import { NotFoundPage } from './pages/NotFound';

function RequireAuth() {
  const s = useStore();
  const loc = useLocation();
  if (!s.ready) return <main>Loading your workspace...</main>;
  if (!s.user || !s.data) {
    let deleted = false;
    try {
      deleted = sessionStorage.getItem('nt-after-delete') === '1';
    } catch {
      /* ignore */
    }
    if (deleted) return <Navigate to="/signup" replace state={{ deleted: true }} />;
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }
  return <Outlet />;
}

function PublicOnly() {
  const s = useStore();
  const loc = useLocation();
  if (!s.ready) return <main>Loading your workspace...</main>;
  if (s.user && s.data) {
    const from = (loc.state as { from?: string } | null)?.from;
    const to = s.data.meta.onboarded === false ? '/onboarding' : from && from !== '/login' ? from : '/';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route
          element={
            <UIProvider>
              <AppShell />
            </UIProvider>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
