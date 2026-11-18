CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, created_at TEXT NOT NULL, avatar TEXT, password_changed_at TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  auth_version INTEGER NOT NULL DEFAULT 0 CHECK(auth_version >= 0),
  CHECK(username = lower(trim(username)))
);
CREATE UNIQUE INDEX users_username_lower ON users(lower(username));
CREATE TABLE projects (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT NOT NULL, description TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')), due_date TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT, UNIQUE(id,user_id)
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL, section TEXT NOT NULL, title TEXT NOT NULL,
  estimate_min DOUBLE PRECISION NOT NULL CHECK(estimate_min > 0),
  status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')), task_order INTEGER NOT NULL,
  scheduled_for TEXT, completed_at TEXT, created_at TEXT NOT NULL, replanned_from TEXT,
  subtasks JSONB, due_date TEXT, UNIQUE(id,user_id),
  FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id) ON DELETE CASCADE,
  CHECK(subtasks IS NULL OR jsonb_typeof(subtasks) = 'array')
);
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT, project_id TEXT, started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
  minutes DOUBLE PRECISION NOT NULL CHECK(minutes >= 0), completed_task BOOLEAN NOT NULL DEFAULT false,
  FOREIGN KEY(task_id,user_id) REFERENCES tasks(id,user_id) ON DELETE SET NULL (task_id),
  FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id) ON DELETE SET NULL (project_id)
);
CREATE FUNCTION validate_session_project() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_id IS NOT NULL AND NEW.project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM tasks WHERE id = NEW.task_id AND user_id = NEW.user_id AND project_id <> NEW.project_id
  ) THEN RAISE EXCEPTION 'Session task/project mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_project_guard BEFORE INSERT OR UPDATE ON focus_sessions FOR EACH ROW EXECUTE FUNCTION validate_session_project();
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark')),
  daily_goal_min INTEGER NOT NULL DEFAULT 180, default_task_min INTEGER NOT NULL DEFAULT 15,
  time_zone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', week_start TEXT NOT NULL DEFAULT 'mon',
  auto_replan BOOLEAN NOT NULL DEFAULT true, deadline_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT false, focus_sound BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE meta (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_auto_replan_at TEXT, shown_alerts JSONB, snoozed_alerts JSONB, timer JSONB,
  parking JSONB, last_replan JSONB, onboarded BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE data_revisions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_sessions_user ON focus_sessions(user_id);
CREATE FUNCTION bump_data_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN owner_id := OLD.user_id; ELSE owner_id := NEW.user_id; END IF;
  IF EXISTS(SELECT 1 FROM users WHERE id = owner_id) THEN
    INSERT INTO data_revisions(user_id,revision) VALUES(owner_id,1)
      ON CONFLICT(user_id) DO UPDATE SET revision = data_revisions.revision + 1;
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects','tasks','focus_sessions','settings','meta'] LOOP
    EXECUTE format('CREATE TRIGGER revision_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION bump_data_revision()', table_name);
  END LOOP;
END $$;

-- Supabase exposes public-schema tables via its Data API. No browser role is
-- allowed to query these backend-owned tables; authorization stays in Express.
DO $$ DECLARE table_name TEXT; role_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','projects','tasks','focus_sessions','settings','meta','data_revisions','tinydo_schema_migrations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name,role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
