-- =============================================================================
-- FG Group Görev & Bağımlılık Yönetim Sistemi (Şartname v0.3)
-- İlişkisel PostgreSQL Veritabanı Şeması (PGlite & Harici PostgreSQL 14/15/16+ Uyumlu)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entra_tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entra_oid TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL DEFAULT 'Türkiye',
  language TEXT NOT NULL DEFAULT 'tr',
  password TEXT,
  system_role TEXT NOT NULL DEFAULT 'USER',
  can_create_project BOOLEAN NOT NULL DEFAULT FALSE,
  can_build_reports BOOLEAN NOT NULL DEFAULT FALSE,
  department TEXT,
  theme TEXT DEFAULT 'light',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TEXT,
  deactivation_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  initial_start_date TEXT NOT NULL,
  initial_due_date TEXT NOT NULL,
  current_start_date TEXT NOT NULL,
  current_due_date TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);

CREATE TABLE IF NOT EXISTS project_plan_changes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  previous_start_date TEXT NOT NULL,
  previous_due_date TEXT NOT NULL,
  new_start_date TEXT NOT NULL,
  new_due_date TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_members_proj ON project_members(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS visibility_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_time TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_by_user_id TEXT,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'TASK',
  priority TEXT DEFAULT 'NORMAL',
  progress INTEGER DEFAULT 0,
  work_status TEXT NOT NULL,
  initial_start_date TEXT NOT NULL,
  initial_due_date TEXT NOT NULL,
  current_start_date TEXT NOT NULL,
  current_due_date TEXT NOT NULL,
  actual_start_date TEXT,
  actual_completion_date TEXT,
  completed_by_user_id TEXT,
  workflow_step TEXT,
  task_definition TEXT,
  assigned_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  department TEXT,
  display_order INTEGER DEFAULT 0,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_definition_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  title TEXT NOT NULL,
  default_duration_days INTEGER DEFAULT 7,
  suggested_department TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(tenant_id, assignee_id);

CREATE TABLE IF NOT EXISTS task_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  unassigned_at TEXT,
  assigned_by_user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_plan_changes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  previous_start_date TEXT NOT NULL,
  previous_due_date TEXT NOT NULL,
  new_start_date TEXT NOT NULL,
  new_due_date TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'FINISH_TO_START',
  wait_start_time TEXT,
  wait_end_time TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deps_pred ON task_dependencies(tenant_id, predecessor_id);
CREATE INDEX IF NOT EXISTS idx_deps_succ ON task_dependencies(tenant_id, successor_id);

CREATE TABLE IF NOT EXISTS delay_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  detected_at TEXT NOT NULL,
  explanation_status TEXT NOT NULL,
  explanation_source TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocking_intervals JSONB NOT NULL DEFAULT '[]'::jsonb,
  cause_class TEXT NOT NULL,
  reported_by_user_id TEXT,
  reported_at TEXT,
  explanation_text TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_task_id TEXT,
  link_project_id TEXT,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS microsoft_todos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  entra_oid TEXT,
  title TEXT NOT NULL,
  body_content TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_date TEXT,
  importance TEXT NOT NULL DEFAULT 'normal',
  is_starred BOOLEAN DEFAULT FALSE,
  linked_task_id TEXT,
  source TEXT NOT NULL DEFAULT 'FG_SYSTEM',
  synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smtp_configs (
  tenant_id TEXT PRIMARY KEY,
  host TEXT NOT NULL DEFAULT 'smtp.office365.com',
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT FALSE,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  public_base_url TEXT NOT NULL,
  enable_actionable_cards BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_id TEXT,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  day_of_week INTEGER,
  send_time TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_adaptive_card BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  delivery_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  adaptive_card_json JSONB,
  html_preview TEXT NOT NULL,
  linked_task_id TEXT,
  linked_project_id TEXT,
  linked_request_id TEXT,
  action_taken TEXT,
  sent_at TEXT NOT NULL
);
