# Deploy free with Render + Supabase PostgreSQL

React and Express run together on Render Free. All users share PostgreSQL on
Supabase; Render restarts do not remove the database. Existing TinyDo authentication
and admin screens remain in use. Accounts live in public.users, not Supabase Auth.

## 1. Create Supabase

Create a **new Free project** at https://supabase.com/dashboard and keep its database
password private. Pick a region near your Render service. In **Connect**, choose
**Session pooler** (port **5432**), and copy its PostgreSQL URI. Use the exact host
and username shown there, replacing the password placeholder. Percent-encode
special characters in the password when putting it in a URI.

The session pooler supports IPv4; the default direct connection may require IPv6.
Do not put the URI or database password in frontend variables, Git, or screenshots.
No Supabase anon key or service-role API key is needed by this implementation.

## 2. Configure Render

Push/merge this implementation into the branch Render deploys (main in this project).
Keep a single **Web Service**, Free instance, repository root as Root Directory:

- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Set these in Render **Environment**:

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| DATABASE_URL | Private Session pooler URI from Supabase |
| REQUIRE_DATABASE_URL | true |
| JWT_SECRET | Strong random secret; keep stable between deploys |
| BOOTSTRAP_ADMIN | true |
| ADMIN_USERNAME | admin (or another unused username) |
| ADMIN_PASSWORD | Private password, 8-1024 characters |

Remove the old DATA_DIR and DATABASE_PATH variables; PostgreSQL does not use them.
If certificate validation requires Supabase's CA, download the certificate from
Supabase and set DATABASE_CA_CERT to its PEM content (real newlines or escaped
`\n`). Remote TLS certificate verification stays enabled.

Save and redeploy. Startup automatically applies the versioned schema migration,
then creates the admin only if absent, before accepting requests. No paid Shell,
persistent disk, or pre-deploy command is needed. Existing admin passwords are
never reset by bootstrap. REQUIRE_DATABASE_URL makes a missing URL fail startup
instead of silently using temporary SQLite. Logs identify the engine as postgres.

The migration requires the database owner connection from Connect and a fresh
public schema without conflicting TinyDo table names. It is transactional and
records a checksum; repeat starts do not recreate tables or accounts.

## 3. Verify and query

Open /login, sign in as admin, then register a normal user and create a project,
task and focus session. Restart the Render service and confirm the accounts and
records remain. Admin can inspect users through /admin without password hashes.

In Supabase **SQL Editor**, query only the fields you need:

```sql
select id, name, username, role, created_at
from public.users
order by created_at desc, id;

select
  (select count(*) from public.users) as users,
  (select count(*) from public.projects) as projects,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.focus_sessions) as focus_sessions;
```

RLS is enabled and anon/authenticated grants are revoked on TinyDo tables. There
are no browser Data API policies: requests go through Express authorization. Keep
RLS enabled. SQL Editor/database-owner access can inspect sensitive columns, so
avoid SELECT * from users and protect dashboard access.

## 4. Optional: import an existing local SQLite database

A fresh Supabase database starts empty. Existing SQLite files are **not** uploaded
automatically. To preserve local accounts, import **before the first Render startup
creates an admin**. Destination must contain no users; the script refuses to merge
or overwrite an existing installation.

Back up the SQLite file and stop local writers. From the repository root:

```powershell
npm ci
npm run build --workspace=backend
# Set DATABASE_URL privately in your ignored .env file first.
$env:SQLITE_IMPORT_PATH = 'D:\path\to\tinydo.db'
npm run db:import:sqlite
Remove-Item Env:SQLITE_IMPORT_PATH
```

The import reads SQLite without modifying it and writes one PostgreSQL transaction.
It preserves IDs, password hashes, roles, auth versions and history. Invalid orphaned
focus references are cleared while duration is retained; invalid task ownership
fails and rolls back. A successful import cannot be repeated against that target.
Legacy password hashes upgrade on the user's next successful login.

## 5. Local development and tests

Leave DATABASE_URL blank for ordinary local SQLite development. To use shared
Supabase data locally, set DATABASE_URL privately in .env and run npm run dev;
this writes to the same database as Render, so use a separate project for tests.

```powershell
npm run test:features
npm run test:postgres
npm run test:seed
npm run test:deploy
```

The PostgreSQL suite starts a temporary real PostgreSQL cluster using a development
binary dependency, checks API/ownership, migrations/RLS, concurrent sync, rollback,
password revocation, 100-record seed, SQLite import and process restart. It does
not require or contact your Supabase database. SQLite/browser tests also use
isolated databases. No live Supabase TLS connection is covered by these local tests.

## Free plan limits and troubleshooting

Supabase Free currently includes 500 MB database storage and can pause after a
week of inactivity; resume a paused project in its dashboard. Monitor quotas.
Render Free can sleep, causing a cold-start delay; database persistence is separate.
If startup fails, check the private URI, pooler username, password encoding, project
availability and CA certificate. Do not disable certificate verification.

Official references:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/pricing
- https://render.com/docs/free

### Startup database diagnostics

Startup errors include only a static safe explanation, never the driver message,
connection URI, SQL detail or password. Examples:

- Network unreachable: switch from Direct to Session pooler (IPv4).
- Authentication failed: verify pooler username and percent-encoded database password.
- TLS chain untrusted: set DATABASE_CA_CERT to the Supabase CA certificate PEM.
- Migration/table conflict: use a fresh project or inspect existing schema before proceeding.

If startup still fails, share the new static error text, not DATABASE_URL. Do not
set rejectUnauthorized=false or disable TLS verification to bypass certificate errors.
