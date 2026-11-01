# TinyDo

A productivity web app with three core features: **Deadline Manager**, **Task breakdown with Focus Mode** and **Progress Tracker**.

This repository is organized as a monorepo containing:
- **`frontend/`**: React 18, TypeScript, Vite, Tailwind/tokens CSS.
- **`backend/`**: Node.js, Express, TypeScript, SQLite (`better-sqlite3`), JWT authentication.

## Quick Start

```bash
# 1. Install all dependencies (npm workspaces)
npm install

# 2. Run both Backend (http://localhost:3001) & Frontend (http://localhost:5173)
npm run dev
```

You can also run them individually:
```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs both backend and frontend concurrently |
| `npm run dev:frontend` | Runs the Vite development server (`http://localhost:5173`) |
| `npm run dev:backend` | Runs the Express + SQLite backend with tsx watch (`http://localhost:3001`) |
| `npm run build` | Compiles both backend and frontend |
| `npm test` | Runs unit tests for both frontend and backend |

## Project Structure

```
tinydo/
├── frontend/                     # React + Vite client
│   ├── src/
│   │   ├── components/           # UI components, modals, sidebar, icons
│   │   ├── data/                 # API client, auth, storage, types
│   │   ├── logic/                # Business logic (scheduling, timer, analytics)
│   │   ├── pages/                # Routes (Dashboard, Focus, Calendar, Project, etc.)
│   │   ├── store/                # AppStore context & state reducer
│   │   └── styles/               # Tokens & CSS
│   ├── tests/                    # Playwright e2e & fixtures
│   └── package.json
│
├── backend/                      # Express + SQLite API server
│   ├── src/
│   │   ├── db/                   # SQLite database connection & schema (better-sqlite3)
│   │   ├── middleware/           # Auth & JWT verification middleware
│   │   ├── routes/               # REST API endpoints (auth, projects, tasks, sessions, data)
│   │   ├── server.ts             # Express app setup
│   │   └── types.ts              # TypeScript domain types
│   ├── data/                     # SQLite database storage (.db files, gitignored)
│   └── package.json
│
├── design/                       # UI design specifications & HTML prototypes
├── package.json                  # Root workspace config
└── README.md
```

## Backend API Endpoints (SQLite)

- **Auth**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/profile`, `/api/auth/change-password`, `/api/auth/account`
- **Data Sync**: `/api/data` (GET all user data, PUT sync/replace data)
- **Projects**: `/api/projects` (GET, POST, DELETE `/:id`)
- **Tasks**: `/api/tasks` (GET, POST, DELETE `/:id`)
- **Sessions**: `/api/sessions` (GET, POST)
- **Settings**: `/api/settings` (GET, PATCH)

## Automated feature checks

From the repository root (PowerShell, macOS or Linux):

```bash
npm run test:features
# Show the browser while the tests run:
npm run test:features:headed
```

The script runs frontend/backend unit tests, builds both workspaces, installs the
Playwright Chromium browser if needed, and runs eight browser feature scenarios.
The first browser installation needs internet access. Existing dependencies must
already be installed with `npm install`.

Feature tests use a new temporary SQLite database on every run and separate ports
3002 (API) and 4174 (UI). They do not reuse your development server or local app
database. Keep those two test ports free. A failed stage stops the script with a
nonzero exit code. The temporary database is removed after the run.

Open `frontend/playwright-report/features/index.html` for the HTML report.
Failed browser tests include screenshots and traces under `frontend/test-results`.
To open the report interactively:

```bash
npx playwright show-report frontend/playwright-report/features
```

Coverage: onboarding, task/subtask editing and persistence, project completion and
reopening, timer expiry versus explicit task completion, pause/reload/resume,
manual session logging, gap-aware scheduling and daily capacity, Calendar,
replan/undo, and deadline alert batching and deadline changes.

## Feature behavior

- Timer expiry and **Log session** record focus time without completing the task.
  **Mark done** explicitly completes the task; subtask checkboxes stay independent.
- **Plan tasks** schedules from today onward, using the existing daily goal and
  09:00–22:00 device-local window. It fills available gaps with five-minute buffers.
  Custom working hours and days off are not implemented.
- Progress is completed task count, not effort-weighted completion. Forecasts use
  remaining task estimates and a seven-day average of logged focus time. Without
  focus history, daily goal is split across active projects.
- Deadline reminders are delivered in batches; a changed deadline gets fresh
  reminders. Auto-replan runs after 22:00 while the app is open, or when you return;
  it is not a server-side background job.

## Persistent demo data (100 records)

Unlike browser test fixtures, this command keeps demo records in the running app's
SQLite database so you can explore them manually. Start the app in one terminal:

```powershell
npm run dev
```

In a second terminal at the repository root, choose a password for the demo account
(the prompt hides your input), then seed the workspace:

```powershell
$demoPassword = Read-Host "Demo account password (at least 8 characters)" -AsSecureString
$env:TINYDO_SEED_PASSWORD = [System.Net.NetworkCredential]::new('', $demoPassword).Password
npm run seed:demo
Remove-Item Env:TINYDO_SEED_PASSWORD
```

Open http://localhost:5173 and log in as **tinydo-demo** with your chosen password.
The default dataset contains exactly **10 projects + 70 tasks + 20 focus sessions**
(100 domain records). Each task also has two nested subtasks; the user, settings,
metadata and nested subtasks are not included in that count. Data includes overdue
and upcoming projects, completed work, tasks scheduled today, slipped work,
unscheduled work, and historical focus sessions.

The script uses signup/login and revision-guarded `/api/data`, then reads records
back to verify the persisted content. It accepts only local HTTP API origins,
does not print passwords/tokens, and never overwrites existing project/task/session
IDs. Repeating the same command for the same account adds only missing records and
preserves your edits and unrelated data. Keep the count unchanged for a stable
fixture. A fresh account starts with auto-replan disabled so slipped tasks remain
available for manual Replan testing; enable it in Profile when desired.

Optional settings (set these before running the seed command):

```powershell
$env:TINYDO_SEED_USERNAME = 'tinydo-demo-2'
$env:TINYDO_SEED_URL = 'http://localhost:3001'
npm run seed:demo -- --count 100
```

Log out and back in if that demo account was already open. Existing unsynced local
changes can otherwise trigger the app's normal revision conflict protection.
For a fresh fixture, use a new demo username rather than deleting your current work.

Validate the seeder against a real API with an isolated in-memory database:

```powershell
npm run test:seed
```

## Read-only admin users screen

Administrators can open `/admin` to search and paginate all accounts (25 per page)
and view per-user project/task counts, completed tasks, focus sessions and minutes.
Global totals are shown separately from the search results. The response excludes
passwords/hashes, tokens, avatars, project/task content and personal notes.

The `users.role` column is added automatically when the backend starts. Existing
accounts and public signups have role `user`. Admin checks use the current database
role and require a valid Bearer JWT; the development `x-user-id` shortcut cannot
access admin APIs. This screen has no cross-user edit/delete actions.

Provision an administrator locally with a password supplied through the environment:

```powershell
$adminPassword = Read-Host "Admin password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPassword).Password
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

The default username is `admin`; set `ADMIN_USERNAME` to provision a different name.
The command shares the backend database configuration (`DATABASE_PATH`/`DATA_DIR`)
and refuses to promote an existing normal user or reset an existing admin password.
No default admin account or password is embedded in the application or repository.
Restart `npm run dev` after pulling these changes, then sign in normally; admin
accounts are redirected to `/admin` and get an **Admin users** sidebar entry.

`npm run test:features` also creates a temporary admin in the isolated test database
and verifies admin login/search plus denial of regular-user access.

## Deploy frontend + backend together

See [Render deployment guide](docs/DEPLOY_RENDER.md) for the exact dashboard
settings, persistent SQLite disk, environment variables and post-deploy checks.

```bash
npm run test:deploy
```

This builds the app and runs an isolated production smoke test, including SPA deep
links, static assets, API routing and SQLite/JWT persistence across a server restart.
It does not create any hosting resources or deploy the app.
