# Notion Toolkit

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
notion-toolkit/
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
