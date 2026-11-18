# Deploy TinyDo to Render

**For durable shared data on Free plans, follow [Render + Supabase](DEPLOY_SUPABASE.md). The SQLite instructions below describe the older local/temporary or paid-disk option.**

This deploys React and Express together as one public web service. SQLite stays on
a persistent disk attached to that service. No local users or database files are
uploaded automatically. Database migration/import and seeding can be done after
the first successful deployment.

## Render Free: create admin without Shell

Deploy the commit containing `bootstrapAdmin` before setting these variables. In
Render **Environment**, set:

| Variable | Value |
| --- | --- |
| BOOTSTRAP_ADMIN | true |
| ADMIN_USERNAME | admin |
| ADMIN_PASSWORD | Your private password (8–1024 characters) |

Save and redeploy. Before accepting requests, the backend creates the admin if the
username is unused. Logs contain only `Admin bootstrap: created` or `existing`, not
credentials. Sign in at `/login`; the admin account skips onboarding.

An existing admin is left unchanged, even if the environment password differs.
An existing regular account is never promoted; choose another ADMIN_USERNAME if
that username was already registered publicly. This does not add a public setup
or password-reset endpoint.

With Free compute, use writable **temporary** SQLite paths:

```text
DATA_DIR=/opt/render/project/src/backend/data
DATABASE_PATH=/opt/render/project/src/backend/data/tinydo.db
```

Free services cannot attach persistent disks. SQLite users and work can disappear
on idle shutdown, restart or redeploy. Keeping bootstrap enabled and its private
password in Render Environment recreates the admin on an empty database, but does
not restore other users or data. For durable free shared data, use the supported Supabase PostgreSQL adapter and guide above; this SQLite setup is temporary.
With persistent storage, bootstrap can be disabled after creating the account.

## 1. Publish the prepared branch

Review `git status`, commit the intended changes and push `huudat` to a
repository you can access from Render. If you cannot push to the original repo,
use your own fork. Render builds committed GitHub files, not uncommitted local files.

```powershell
git status
git add .
git commit -m "feat: improve features and prepare shared test deployment"
git push -u origin huudat
```

After pushing, open a pull request from `huudat` into `main`, review and merge it.
Render deploys `main`; ongoing development remains on `huudat`.

## 2. Create one web service

Open https://dashboard.render.com, connect GitHub, choose **New > Web Service**, then
select the repository containing the pushed changes.

| Setting | Value |
| --- | --- |
| Name | A unique service name, e.g. tinydo-test |
| Region | Singapore, if available |
| Branch | main |
| Runtime | Node |
| Root Directory | Leave blank (repository root) |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instance | Free for temporary SQLite; paid with disk for persistent SQLite |
| Auto-Deploy | Off while initially testing |

The repository's `.node-version` selects Node 22, matching the tested runtime major.
Do not create a separate Static Site for this deployment.

## 3. Configure environment and storage before creating the service

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| DATA_DIR | /var/data |
| DATABASE_PATH | /var/data/tinydo.db |
| JWT_SECRET | A randomly generated secret; keep it stable across deployments |

Generate JWT_SECRET on your local machine, then copy it directly into the Render
secret field (do not put it into a source file or commit):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Render supplies PORT; no manual value is required.

For the paid persistent option, attach a Persistent Disk with mount path **/var/data** and size **1 GB** to start.
Check the current paid plan and disk charges in the dashboard before creating the
service. Free web services do not support the persistent disk needed for SQLite.
Only files under the mount path survive restarts and redeployments.

## 4. Deploy and verify

Click **Create Web Service**, then watch build and application logs until the service
is **Live**. Use the actual HTTPS URL displayed by Render.

Check:

1. `/api/health` returns JSON with `status: ok`.
2. `/login` displays the login screen.
3. Refreshing `/admin` or `/calendar` loads the app (or redirects to login), rather
   than returning a hosting 404.
4. Create a disposable test account and project, log out and sign back in.
5. Restart the service from Render and confirm that test account/project remain.

All testers must use this Render URL to share the same server/database. Their
separate local backends will still have separate databases.

## 5. Alternative: create the server admin using Shell (paid service)

The admin created on your local machine does not exist on the new server.
Free services should use the startup bootstrap above. If your plan provides Shell,
use Render Shell at the repository root:

```bash
read -rsp 'Admin password: ' ADMIN_PASSWORD; echo
export ADMIN_PASSWORD
npm run admin:create:prod
unset ADMIN_PASSWORD
```

The default username is admin. This creates an admin only if that username is
unused. It does not reset passwords or promote an existing normal account.
Do not register the admin username through the public signup screen beforehand.
Sign in through `/login`, then open `/admin` for read-only user statistics.

## Query the server database later

Use Render Shell to query the deployed SQLite database read-only, without returning
password fields:

```bash
node --input-type=module -e "import Database from 'better-sqlite3'; const db = new Database(process.env.DATABASE_PATH, { readonly: true }); console.table(db.prepare('SELECT id, name, username, role, created_at FROM users').all()); db.close();"
```

Do not share the SQLite file over a network folder or place it in the frontend's
public directory. Keep one backend instance attached to this disk. For backups of
a running SQLite WAL database, use the SQLite backup API rather than copying only
the main `.db` file.

## Troubleshooting

- `tsc` or `vite` missing: use the exact build command including `--include=dev`.
- Frontend build missing: build from the repository root, not backend only.
- JWT_SECRET required: set the secret in Render Environment and redeploy.
- Empty database after deploy: verify both DB paths and the disk mount match
  `/var/data`; local database contents are not transferred by Git.
- Account exists but is not admin: provisioning refuses to elevate a public account.
  Use a different unused ADMIN_USERNAME or resolve the account explicitly.

Official references: https://render.com/docs/web-services,
https://render.com/docs/disks, https://render.com/docs/node-version.

## Authentication rollout

Startup adds `users.auth_version` (default 0) without changing existing usernames
or passwords. New passwords use scrypt; legacy SHA-256 hashes are upgraded only
when the correct password is supplied at login. A wrong password never upgrades a
hash. Admin provisioning uses the same verifier and never resets existing passwords.

Password changes revoke previously issued JWTs immediately, including old-format
JWTs, and return a replacement token to the initiating browser. Legacy JWTs without
a version are accepted only while the account's version is still 0. Deploy backend
and frontend together. Old clients sending password hashes must reload/update.
Do not roll back to the SHA-256-only application after accounts have been upgraded:
it cannot authenticate scrypt hashes. Back up SQLite before rollout.

Legacy focus-session records retain their duration/history but startup detaches
missing, foreign-user or mismatched resource references. New writes reject such
references. Deleting a task/project detaches historical session references without
deleting logged focus time.
