# Notion Toolkit: Handoff to Claude Code

You are building the working MVP of **Notion Toolkit**, a productivity web app with three core features: Deadline Manager, Smart Task Breakdown (with Focus Mode) and Progress Tracker. The UI design is finished. It lives in `design/` as interactive prototype screens. Your job is to turn that design into a real, running app with persistent data, then test it and fix any errors.

Read this whole file before writing code. Open the `design/*.dc.html` files when you build each screen. They are the source of truth for layout, copy, spacing and colors.

---

## 1. What is in this folder

```
notion-toolkit/
├── HANDOFF.md              ← this file
└── design/
    ├── canvas.json         ← canvas index (board names and sizes; ignore x/y)
    ├── Sidebar.dc.html     ← shared app sidebar (nav, projects, theme toggle, profile, logout)
    ├── Dashboard.dc.html
    ├── Project.dc.html     ← project page + Smart Task Breakdown
    ├── Calendar.dc.html
    ├── Focus.dc.html       ← Focus Mode (timer)
    ├── Analytics.dc.html   ← Progress Tracker
    ├── Profile.dc.html     ← profile & settings
    ├── Login.dc.html
    ├── SignUp.dc.html
    ├── ForgotPassword.dc.html
    └── Onboarding.dc.html  ← 3-step setup after sign up
```

### How to read a `.dc.html` file

These are **not** runnable pages outside the design tool. They are templates in a small component format:

- Markup sits inside `<x-dc>…</x-dc>`. `<helmet>` holds the font link and the CSS theme tokens.
- `{{name}}` is a value from `renderVals()` in the `<script type="text/x-dc">` block at the bottom of the file.
- `<sc-for list="{{items}}" as="item">` is a loop and `<sc-if value="{{cond}}">` is a conditional.
- `<dc-import name="Sidebar" …>` mounts `Sidebar.dc.html` as a child component.
- `onClick="{{fn}}"` and `onChange="{{fn}}"` are event handlers defined in `renderVals()`.
- Each `renderVals()` builds its style strings and sample data in JS. **Copy the sample data from there**: it is realistic and internally consistent (today = Thu, Oct 22, 2026).

Translate each file into real React components. Do **not** try to load or parse `.dc.html` at runtime.

---

## 2. Stack and constraints

There is no existing codebase. Use:

- **React 18 + Vite + TypeScript**
- **React Router** for routes
- Plain CSS with CSS custom properties (copy the token block in §3), or CSS Modules. **No** Tailwind or UI kit; the design is custom and token-based.
- **No backend for the MVP.** Persist everything in `localStorage` behind a small repository layer (`src/data/storage.ts`), so a real API (e.g. Supabase) can replace it later without touching the UI.
- Font: **Inter** from Google Fonts (400/500/600/700).
- Icons: inline stroke SVGs as in the design (Lucide-style, 24px viewBox, stroke-width ≈ 2). `lucide-react` is fine if you want it; it's the only icon dependency allowed.
- Charts: plain divs/SVG as in the design. Don't add a chart library.
- Dates: native `Date`/`Intl`, or `date-fns` if needed. Nothing heavier.
- Tests: **Vitest** for the logic in §6, plus **Playwright** for the main flows in §8 (Chromium is preinstalled in the environment).

Avoid unnecessary dependencies and over-engineering. Prefer simple functions and React state/context over a state library. A single `AppStore` context plus reducer is enough.

---

## 3. Design system

### Theme tokens

Every screen shares the same token set. Light and dark are switched by `data-theme="dark"` on the root element. Copy this verbatim into `src/styles/tokens.css` (scope `.nt` → `:root`):

```css
:root{--bg:#FBFBFA;--surface:#FFFFFF;--subtle:#F7F7F5;--subtle2:#FCFCFB;--border:#E9E9E7;--border-strong:#E1E1DE;--control:#C9C9C5;--divider:#F0F0EE;--track:#EDEDEB;--text:#1F1F1E;--text2:#4A4A47;--muted:#6B6B68;--faint:#8A8A86;--accent:#5E5CE6;--accent-hover:#8E8CF0;--accent-text:#3E3CC0;--accent-soft:#EEEEFD;--accent-tint:#E4E3FB;--inverse:#1F1F1E;--inverse-text:#FFFFFF;--pill:#F1F1EF;--ok-bg:#E7F6EC;--ok-text:#1E6B3A;--ok-strong:#1E8A4C;--ok-border:#B7E4C7;--warn-bg:#FEF0C7;--warn-text:#93370D;--danger-bg:#FEF3F2;--danger-border:#FDD3CF;--danger-soft:#FEE4E2;--danger-text:#B42318;--danger-strong:#7A1A12;--danger-body:#8F2A20;--h0:#F1F1EF;--h1:#DCDBFA;--h2:#B9B8F4;--h3:#8E8CF0;--h4:#4F4DD6;--shadow:0 1px 2px rgba(0,0,0,0.06);color-scheme:light}
:root[data-theme="dark"]{--bg:#111113;--surface:#19191C;--subtle:#151518;--subtle2:#1C1C20;--border:#2A2A30;--border-strong:#34343B;--control:#4A4A52;--divider:#24242A;--track:#2A2A30;--text:#EDEDEC;--text2:#C4C4C8;--muted:#A1A1A6;--faint:#8E8E93;--accent:#5E5CE6;--accent-hover:#7C7AF0;--accent-text:#B9B8F4;--accent-soft:#26254A;--accent-tint:#2E2D5C;--inverse:#EDEDEC;--inverse-text:#131316;--pill:#26262C;--ok-bg:#10301F;--ok-text:#6EE7B7;--ok-strong:#34D399;--ok-border:#1F5A3E;--warn-bg:#3A2A0E;--warn-text:#FDB022;--danger-bg:#2A1514;--danger-border:#5A2420;--danger-soft:#3A1715;--danger-text:#F97066;--danger-strong:#FCA5A0;--danger-body:#F4B4AE;--h0:#24242A;--h1:#2E2D5C;--h2:#4341A0;--h3:#6563E0;--h4:#9C9AF5;--shadow:0 1px 2px rgba(0,0,0,0.5);color-scheme:dark}
```

Token meanings: `--bg` page, `--surface` cards, `--subtle` sidebar/inset areas, `--pill` neutral chips and segmented-control tracks, `--accent-*` the indigo brand, `--ok-*` / `--warn-*` / `--danger-*` status, `--h0…--h4` heatmap/chart ramp, `--inverse` the dark/black buttons (they flip to light in dark mode).

### Rules

- **Theme:** Light by default. The user switches it with the sidebar's Light/Dark segmented control, the Profile → Appearance setting, or the icon button on Focus / auth pages. Persist it in `localStorage` key `nt-theme` and apply it before first paint (inline script in `index.html`) to avoid a flash. **Focus Mode follows the global theme** (light-neutral in light mode, dark only in dark mode). Do not hardcode a dark background there.
- **Type:** Inter. Page title 26px/650, letter-spacing -0.02em. Section title 15px/600. Body 14px. Meta 12–13px using `--muted`. Use tabular numbers for times and counts.
- **Shape:** cards radius 12px with a 1px `--border`. Inputs and buttons radius 8–9px. Pills radius 99px. Spacing is a 4px grid; card padding is 16px and page gaps 16–22px.
- **Buttons:**
  - Primary: `--accent` with white text, 38–44px tall.
  - Secondary: `--surface` with a 1px `--border-strong` border.
  - Dark: `--inverse`.
  - Destructive: `#B42318` with white text.
- **Status pills:**

  | Status | Background | Text |
  |---|---|---|
  | To do | `--pill` | `--text2` |
  | In progress | `--accent-soft` | `--accent-text` |
  | Done | `--ok-bg` | `--ok-text` |
  | At risk | `--warn-bg` | `--warn-text` |
  | Overdue | `--danger-soft` | `--danger-text` |

- **Project colors:** fixed per project, the same in both themes. Palette: `#D92D20 #5E5CE6 #E07B00 #0E9384 #8A8A86`; add a few more of similar weight for new projects.
- **Motion:** subtle only. 150–300ms ease on progress-bar width, toggles and theme color changes. The timer ring animates `stroke-dashoffset`.
- **Responsive:** the app shell is a wrapping flex row. The sidebar is `flex: 1 1 232px` and the content `flex: 999 1 560px`, so the sidebar stacks above the content on a phone. Grids use `repeat(auto-fit, minmax(…))`. Wide tables and the month grid scroll horizontally inside their card. There should be no horizontal page scroll at 375px.
- **Accessibility:**
  - Use real `<button>`, `<a>` and `<label>` elements.
  - Icon-only buttons need an `aria-label`.
  - Mark switches with `role="switch"` + `aria-checked`, and segmented controls with `role="radio"`.
  - Add a visible focus ring (`2px solid var(--accent)`).
  - Keep text contrast at 4.5:1 or better (the tokens already meet this).

---

## 4. Routes and screens

| Route | Design file | Auth | Notes |
|---|---|---|---|
| `/login` | Login.dc.html | public | Email + password, show/hide, "Keep me logged in", "Forgot password?" link, "Create an account" link. |
| `/signup` | SignUp.dc.html | public | Full name, email, password with a 4-segment strength meter, terms checkbox, "Create account", link back to log in. Goes to `/onboarding` on success. |
| `/forgot-password` | ForgotPassword.dc.html | public | Email → "Check your inbox" state with Resend. Mock only: no email is actually sent. |
| `/onboarding` | Onboarding.dc.html | authed | 3 steps: daily focus goal + default task size → first project (name, deadline, priority, description) → generated plan preview → `/`. "Skip for now" goes to `/`. |
| `/` | Dashboard.dc.html | authed | Overdue alert (Snooze / Replan to today), 4 KPI cards, Today's tasks (check off), Upcoming deadlines with risk, Focus this week bars, Auto-replan suggestions. |
| `/projects` | Use Project's layout as a list | authed | Not designed. Build a simple list/grid of project cards (name, color, progress bar, due, risk pill), plus a "New project" button that opens a modal. Match the Dashboard's deadline list styling. |
| `/projects/:id` | Project.dc.html | authed | Header (due, priority, risk, work left), progress summary (needed/day, pace, projected finish, focus logged), task breakdown grouped by section, add/delete/cycle status, Smart breakdown panel, "Why it's at risk" list, Replan button. |
| `/calendar` | Calendar.dc.html | authed | Month grid (Mon-first) with deadline / scheduled / done / overdue chips. Clicking a day shows that day's agenda in the side panel. Prev/next month and "Today" must work. |
| `/focus` | Focus.dc.html | authed, **no sidebar** | Timer ring with 10/15/25 presets, Start/Pause/Resume, Reset, +5 min, Mark done. "Up next" queue, Parking lot input, theme toggle, Exit. `/focus?task=:id` starts on a specific task. |
| `/progress` | Analytics.dc.html | authed | 7d/30d toggle, KPIs, focus-per-day bars with goal line, 12-week activity heatmap, project progress & risk table, Replan unfinished tasks (Apply/Undo, nightly auto-replan switch). |
| `/profile` | Profile.dc.html | authed | Profile form (name, email, time zone, week start, avatar placeholder), Appearance, daily goal stepper, default task size, 4 notification/automation switches, change password, export data (JSON download), log out, delete account (with a confirm modal). |

Shared components: `AppShell` (sidebar + `<Outlet/>`), `Sidebar`, `Card`, `Button`, `Pill`, `ProgressBar`, `SegmentedControl`, `Switch`, `TextField`, `PasswordField`, `Modal`, `TaskRow`, `EmptyState`.

Sidebar behavior:

- Nav links highlight the active route.
- The "Projects" list shows real projects sorted by due date, with the due label in `--danger-text` when a project is overdue.
- The "Today's focus" card shows live minutes versus the daily goal.
- The Light/Dark control sets the theme.
- The bottom row links to `/profile`, and the Log out icon signs the user out and goes to `/login`.
- The search box filters tasks and projects (a simple client-side search popover is enough). ⌘K focuses it.
- The "+" button opens the quick "New task" modal.

Unauthenticated users hitting an authed route are redirected to `/login`. Authenticated users hitting `/login` or `/signup` are redirected to `/`.

---

## 5. Data model (TypeScript)

```ts
type ID = string;
type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type Risk = 'on_track' | 'at_risk' | 'overdue' | 'done';

interface User {
  id: ID; name: string; email: string; passwordHash: string; // mock auth: SHA-256 via SubtleCrypto
  createdAt: string;
}
interface Settings {
  userId: ID;
  theme: 'light' | 'dark';
  dailyGoalMin: number;        // default 180
  defaultTaskMin: 10 | 15;     // default 15
  timeZone: string;            // default 'Asia/Ho_Chi_Minh'
  weekStart: 'mon' | 'sun';    // default 'mon'
  autoReplan: boolean;         // nightly at 22:00 local
  deadlineAlerts: boolean; weeklyDigest: boolean; focusSound: boolean;
}
interface Project {
  id: ID; userId: ID; name: string; color: string;
  description?: string; priority: Priority;
  dueDate: string;             // ISO date, end of day local
  createdAt: string; completedAt?: string;
}
interface Task {
  id: ID; projectId: ID; section: string;    // e.g. "3.2 Participants"; "Inbox" default
  title: string; estimateMin: number;        // 10–15 typical, 5–30 allowed
  status: TaskStatus; order: number;
  scheduledFor?: string;       // ISO datetime (slot start)
  aiGenerated?: boolean;       // shows "AI draft" badge until edited/accepted
  completedAt?: string; createdAt: string;
  replannedFrom?: string;      // previous scheduledFor, for "replanned" labels
}
interface FocusSession {
  id: ID; taskId?: ID; projectId?: ID;
  startedAt: string; endedAt: string; minutes: number; completedTask: boolean;
}
```

Storage keys are `nt:v1:<collection>`. Include a schema `version` and a no-op migration hook.

**Seed data:** on first sign-up, or with a "Load sample data" action on an empty account, create the 5 projects, their tasks and about 30 days of focus sessions from the design's sample data:

| Project | Progress | Due | Status |
|---|---|---|---|
| Scholarship essay | 62% | Oct 21 | overdue |
| Obby Lesson Pack | 72% | Oct 27 | on track |
| Thesis · Chapter 3 | 34% | Oct 30 | at risk |
| Q4 Launch Site | 58% | Nov 6 | at risk |
| Portfolio redesign | 15% | Nov 20 | on track |

Seed dates relative to *today* (the design assumes today = Oct 22), so the demo stays meaningful on any date. The app must never show empty placeholder screens when seed data is loaded, but empty states must still exist and look good for new users who skip the sample data.

---

## 6. Business logic (put in `src/logic/`, pure functions, unit-tested)

All functions take `now: Date` as a parameter. Never call `new Date()` inside the logic, so tests stay deterministic.

1. **Project progress:** `done / total` tasks (show %). Remaining minutes = sum of `estimateMin` over tasks that are not done.
2. **Pace:** average focus minutes per day on the project over the last 7 days (count days with 0 too). If there's no history, fall back to `dailyGoalMin / activeProjectsCount`.
3. **Needed per day:** `remainingMin / max(1, daysLeftInclToday)`.
4. **Projected finish:** `today + ceil(remainingMin / max(pace, 1))` days.
5. **Risk:**
   - `done` if every task is done.
   - `overdue` if `now > dueDate` and not done.
   - `at_risk` if the projected finish is after `dueDate`, **or** needed-per-day > 1.2 × pace, **or** there are unfinished tasks scheduled in the past.
   - Otherwise `on_track`.

   "Why it's at risk" lists the specific triggered reasons (slipped task count, pace vs needed, days with no sessions scheduled).
6. **Status transitions:** `todo → in_progress → done → todo` when the status pill is clicked. A checkbox toggles `done ↔ todo`. Starting a focus session moves that task to `in_progress`. Set and clear `completedAt` accordingly.
7. **Smart Task Breakdown (AI plan):** `generatePlan(input: {projectName, description, dueDate, taskSize, dailyGoalMin}) → Task[]`.
   - **MVP:** a deterministic local generator. Split the description into clauses and sentences, map them to sections, then expand each section into 3–5 actionable verb-first tasks (e.g. "Outline…", "Draft…", "Review…", "Submit…"), each 10 or 15 minutes.
   - Mark generated tasks `aiGenerated: true` and show them as an **AI draft** group with "Accept all" and "Discard". Regenerating replaces only the un-accepted AI draft.
   - Put this behind an interface (`PlanGenerator`) so a real LLM call can be added later. Optionally call an API if `VITE_AI_API_URL` is set, and fall back to the local generator on error.
8. **Scheduling:** `schedule(tasks, settings, existing, now)` places unscheduled tasks into daily capacity (`dailyGoalMin` minus already-scheduled minutes) starting today. Order is earliest due date first, then priority, then section order. Never place a task after its project's due date. If it doesn't fit, leave it unscheduled and flag the project `at_risk`. Default slot times start at 09:00 and are packed back-to-back with 5-minute gaps.
9. **Auto-replan:** `replan(state, now)` takes unfinished tasks whose `scheduledFor` is before today and reschedules them with the algorithm above, setting `replannedFrom`. It returns a **preview** (task, from, to). The UI shows the preview, Apply commits it, and Undo restores the previous `scheduledFor` values.
   - With `autoReplan` on, apply it automatically on app load if the last run was before the most recent 22:00 local time.
   - The overdue banner's "Replan to today" schedules the overdue project's remaining tasks into today's free capacity.
10. **Focus timer:**
    - Derive the remaining time from `startedAt + duration − now`, not from interval ticks. It must survive tab switches, reloads and sleeping laptops. Persist the active timer in storage.
    - The presets are 10/15/25 minutes, and +5 min extends the timer.
    - On completion, or on "Mark done", save a `FocusSession`, mark the task done, play the chime if `focusSound` is on (a short WebAudio beep with no asset), and advance to the next task in the queue.
    - The queue is today's scheduled unfinished tasks in time order.
11. **Analytics:**
    - Focus minutes per day.
    - Tasks completed per day (heatmap levels 0–4 by quartile).
    - Streak = consecutive days with ≥ 1 completed task, ending today or yesterday.
    - Average session length.
    - On-time rate = projects completed on or before their due date ÷ projects due in the range.
    - Every KPI must recompute when the 7d/30d range changes.
12. **Deadline alerts:** in-app toasts and the dashboard banner at 3 days, 1 day and 2 hours before a due date, plus overdue. Track which alerts were shown so they don't repeat. Use the browser Notification API only if the user grants permission.

---

## 7. Auth (mock, client-side)

- Users live in localStorage. Hash passwords with SHA-256 (`crypto.subtle`), and keep the session in `nt:v1:session`. "Keep me logged in" means localStorage; without it, use sessionStorage.
- Validation:
  - Email matches `/^\S+@\S+\.\S+$/`.
  - Password is at least 8 characters.
  - Name is at least 2 characters.
  - Terms must be accepted.
  - Duplicate email shows "An account with this email already exists."
  - A wrong password shows "Email or password is incorrect."
- The password strength score (0–4) gets +1 each for: length ≥ 8; upper + lower case; a digit; a symbol or length ≥ 14.
- Forgot password: validate the email and show the "Check your inbox" state. No email is actually sent. Show a dev-only note in the console.
- Log out clears the session and returns to `/login`. Delete account removes the user and all their data after the confirm modal.
- Isolate data by `userId`.
- Make the boundary obvious (`src/data/auth.ts`) so a real auth provider can replace it.

---

## 8. Acceptance checklist (test these, then fix until all pass)

Run `npm run build`, `npm run test` (Vitest) and `npx playwright test`. All must pass with no console errors.

1. Sign up → onboarding (3 steps) → dashboard shows the new project and its generated tasks.
2. Log out → log in with the same credentials → data is still there after a page reload.
3. Project CRUD: create (modal), edit name/due/priority, delete (confirm). Task CRUD: add, rename inline, change estimate, delete, reorder within a section (drag or up/down buttons).
4. Clicking a status pill cycles todo → in progress → done. Progress %, "work left" and the dashboard and sidebar numbers update immediately.
5. Smart breakdown produces 10–15 minute tasks as an AI draft. Accept all, Discard and Regenerate behave as specified.
6. Focus: start a 15-minute session, reload the page mid-way, and the remaining time is still correct. Mark done saves a session, completes the task and advances the queue. Today's focus totals update.
7. Overdue project → dashboard banner shows; "Replan to today" moves its tasks into today; Calendar shows them.
8. Progress page: switching 7d/30d updates the KPIs and bars. Apply replan, then Undo, restores the previous schedule.
9. Calendar: prev/next month, Today, day selection and chips all reflect real data.
10. Theme: toggling in the sidebar, Profile or Focus applies everywhere, persists across reloads, causes no flash on load, and Focus Mode is light in light mode.
11. Responsive: no horizontal page scroll at 375px wide. The sidebar stacks, and tables and calendar scroll inside their cards.
12. Keyboard: every control is reachable with Tab and has a visible focus ring. Modals trap focus and close on Esc.

---

## 9. Suggested build order

1. Scaffold Vite + React + TS, tokens.css, Inter, theme bootstrap, router, AppShell + Sidebar.
2. Data layer (storage, repositories, seed) + `src/logic/*` with unit tests.
3. Auth pages + onboarding.
4. Dashboard → Project page (CRUD + breakdown) → Focus → Calendar → Progress → Profile → Projects list.
5. Alerts, auto-replan on load, search/⌘K, quick-add task modal.
6. Playwright flows from §8, then a responsive and accessibility pass, and fix everything that fails.

Keep the copy from the designs (English). When something isn't specified here, follow the closest designed pattern rather than inventing new styles.
