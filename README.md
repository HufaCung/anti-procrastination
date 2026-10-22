# Notion Toolkit

A productivity web app with three core features: **Deadline Manager**, **Task breakdown with Focus Mode** and **Progress Tracker**. Built from the designs in `design/` and the spec in `HANDOFF.md`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Create an account. Onboarding has 2 steps (daily focus goal, then your first project); step 2 can be skipped. The app ships with no sample or mock data: a new account starts empty.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run test` | Vitest unit tests for all business logic (`src/logic`) |
| `npx playwright test` | End-to-end tests for the 12 acceptance criteria (builds and serves automatically) |

The first time you run Playwright on a new machine, install its browser once: `npx playwright install chromium`.

## Structure

```
src/
  data/        types, localStorage repository (storage.ts), client-side auth (auth.ts), project colors
  logic/       pure, unit-tested functions: progress & risk, scheduling & replan, timer, analytics, alerts
  store/       AppStore context (single reducer) + toasts
  components/  Sidebar, AppShell, Modal, form controls, icons, project & quick-task modals
  pages/       one file per route
  styles/      tokens.css (theme tokens, verbatim from the design) + app.css
tests/e2e/     Playwright flows
tests/fixtures/ realistic workspace used only by tests (never bundled into the app)
```

## Notes

- **No backend.** Everything persists in `localStorage` under `nt:v1:*` keys through `src/data/storage.ts`, so a real API (for example Supabase) can replace it without touching the UI. `src/data/auth.ts` is the only module that knows about users and sessions.
- **No AI.** Tasks are written by you; the app only schedules, times and tracks them.
- **Time.** All logic takes `now` as a parameter and works in the browser's local time.
- **Focus timer.** Remaining time is derived from the stored end time, so it survives reloads, tab switches and a sleeping laptop. A session that ends while the app is closed is completed the next time it opens.
- **Accessibility.** Real buttons and labels, `role="switch"`/`role="radio"` controls, visible focus rings, focus-trapped modals that close on Esc, and `prefers-reduced-motion` support. Every screen passes an axe WCAG 2 AA audit in both themes.
