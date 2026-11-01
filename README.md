# TinyDo

A productivity web app with three core features: **Deadline Manager**, **Task breakdown with Focus Mode** and **Progress Tracker**.

This repository is organized as a monorepo containing:
- **`frontend/`**: React 18, TypeScript, Vite, Tailwind/tokens CSS.
- **`backend/`**: Node.js, Express, TypeScript, PostgreSQL (`pg`) or local SQLite (`better-sqlite3`), JWT authentication.

## Free shared deployment

Use **Render Free + Supabase PostgreSQL Free**: [deployment guide](docs/DEPLOY_SUPABASE.md). Set DATABASE_URL on the backend; all users then share durable PostgreSQL data. Without it, local development uses SQLite.

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
| `npm run dev:backend` | Runs the Express backend (PostgreSQL or local SQLite) with tsx watch (`http://localhost:3001`) |
| `npm run build` | Compiles both backend and frontend |
| `npm test` | Runs unit tests for both frontend and backend |
| `npm run test:postgres` | Builds and tests a temporary real PostgreSQL database |
| `npm run db:migrate` | Applies migrations to the configured database after building |
| `npm run db:import:sqlite` | Imports a read-only SQLite source into an empty PostgreSQL database |

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
├── backend/                      # Express API server
│   ├── src/
│   │   ├── db/                   # PostgreSQL/SQLite adapters and schema migrations
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

## Backend API Endpoints

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
Playwright Chromium browser if needed, and runs fourteen browser feature scenarios.
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
configured backend database (SQLite locally by default, PostgreSQL when DATABASE_URL is set) so you can explore them manually. Start the app in one terminal:

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

## Authentication and sync contracts

- The browser stores profile fields and the session token, never a password or
  password hash. A local-storage migration removes old cached hashes while keeping
  profiles, tasks and settings.
- New signup/admin/password-change hashes use Node.js asynchronous scrypt with a
  random 16-byte salt (`N=32768`, `r=8`, `p=3`, 64-byte key). The stored format is
  `scrypt$32768$8$3$<salt-hex>$<key-hex>`.
- Correct login upgrades legacy user-ID-salted SHA-256 hashes in place. Passwords
  themselves do not change. Concurrent legacy logins are supported.
- `POST /api/auth/change-password` accepts only `oldPassword` and `newPassword`
  (new password: 8–1024 characters). `oldPasswordHash`/`newPasswordHash` are rejected
  with HTTP 400. Successful responses include `{ user, token }`; all previous JWTs
  become invalid immediately. The client preserves the chosen token storage mode.
- Focus sessions may be free sessions or reference owned tasks/projects. Unknown,
  cross-user and mismatched task/project references return HTTP 400 through both
  granular writes and bulk sync. Bulk failures roll back atomically. Historical
  duration is retained when related resources are deleted.
- Network errors, timeouts, HTTP 408/429 and 5xx sync failures get at most three
  automatic retries after 1, 2 and 4 seconds. Reconnecting or **Retry sync** starts
  a new attempt cycle. Initial data fetches also retry without discarding local work.
- HTTP 409 revision conflicts pause sync and preserve both local work and newer
  server data. Other 4xx responses do not trigger automatic retries. The sidebar
  displays sync status. A lost response after an accepted write can produce a 409
  on retry; it remains paused rather than guessing which copy should win.

Run `npm run test:features` for unit/API and browser regressions, `npm run test:seed`
for persistent demo-data compatibility, and `npm run test:deploy` for production
routing and database/JWT persistence across restarts.

Scrypt parameters follow the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).

## Admin creation on hosting without Shell

Set `BOOTSTRAP_ADMIN=true`, `ADMIN_USERNAME=admin`, and a private `ADMIN_PASSWORD`
(8–1024 characters) in the hosting environment, then redeploy the updated code.
The backend creates the account before listening for traffic. Existing admins keep
their passwords; existing regular users are never promoted automatically. With
Render Free's temporary SQLite filesystem, keep the bootstrap configuration so a
lost database can recreate the admin. Other lost users/data are not restored.
See [the Render Free instructions](docs/DEPLOY_RENDER.md#render-free-create-admin-without-shell).
