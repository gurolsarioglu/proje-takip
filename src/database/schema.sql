-- ==============================================================================
-- Görev ve Bağımlılık Yönetim Sistemi - PostgreSQL Schema & Row-Level Security (RLS)
-- Şartname Sürüm 0.3 (23 Ekim 2026)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants (Kiracılar / Şirketler)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    entra_tenant_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Kullanıcılar)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entra_oid VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_tenant_entra UNIQUE (tenant_id, entra_oid)
);

-- 3. Projects (Projeler)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    initial_start_date TIMESTAMPTZ NOT NULL,
    initial_due_date TIMESTAMPTZ NOT NULL,
    current_start_date TIMESTAMPTZ NOT NULL,
    current_due_date TIMESTAMPTZ NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Project Plan Changes (Proje Plan Değişiklik Geçmişi)
CREATE TABLE IF NOT EXISTS project_plan_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    previous_start_date TIMESTAMPTZ NOT NULL,
    previous_due_date TIMESTAMPTZ NOT NULL,
    new_start_date TIMESTAMPTZ NOT NULL,
    new_due_date TIMESTAMPTZ NOT NULL,
    changed_by_user_id UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- 5. Project Members & Roles (Proje Üyeleri ve Yetkileri)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PROJECT_MANAGER', 'EDITOR', 'VIEWER')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_member UNIQUE (tenant_id, project_id, user_id)
);

-- 6. Visibility Requests (Görünürlük Talepleri)
CREATE TABLE IF NOT EXISTS visibility_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    decided_by_user_id UUID REFERENCES users(id),
    decided_at TIMESTAMPTZ
);

-- 7. Tasks (Görevler)
-- Şartname v0.3: EXPLANATION_REQUIRED çalışma durumu DEĞİLDİR!
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_status VARCHAR(50) NOT NULL CHECK (work_status IN ('BLOCKED', 'READY', 'IN_PROGRESS', 'COMPLETED')),
    initial_start_date TIMESTAMPTZ NOT NULL,
    initial_due_date TIMESTAMPTZ NOT NULL,
    current_start_date TIMESTAMPTZ NOT NULL,
    current_due_date TIMESTAMPTZ NOT NULL,
    actual_start_date TIMESTAMPTZ,
    actual_completion_date TIMESTAMPTZ,
    completed_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Task Assignments (Görev Atama Geçmişi)
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMPTZ,
    assigned_by_user_id UUID NOT NULL REFERENCES users(id)
);

-- 9. Task Plan Changes (Görev Plan Değişiklik Geçmişi)
CREATE TABLE IF NOT EXISTS task_plan_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    previous_start_date TIMESTAMPTZ NOT NULL,
    previous_due_date TIMESTAMPTZ NOT NULL,
    new_start_date TIMESTAMPTZ NOT NULL,
    new_due_date TIMESTAMPTZ NOT NULL,
    changed_by_user_id UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- 10. Task Dependencies (Bağımlılıklar)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL DEFAULT 'FINISH_TO_START' CHECK (dependency_type IN ('FINISH_TO_START')),
    wait_start_time TIMESTAMPTZ,
    wait_end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_task_dependency UNIQUE (tenant_id, predecessor_id, successor_id),
    CONSTRAINT chk_no_self_dependency CHECK (predecessor_id != successor_id)
);

-- 11. Delay Records (Gecikme ve Açıklama Kayıtları)
CREATE TABLE IF NOT EXISTS delay_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    explanation_status VARCHAR(50) NOT NULL CHECK (explanation_status IN ('REQUIRED', 'RECORDED')),
    explanation_source VARCHAR(50) NOT NULL CHECK (explanation_source IN ('SYSTEM', 'USER')),
    reason TEXT NOT NULL,
    blocking_intervals JSONB NOT NULL DEFAULT '[]'::jsonb,
    cause_class VARCHAR(50) NOT NULL CHECK (cause_class IN ('DEPENDENCY_BLOCKED', 'USER_DELAY', 'OTHER')),
    reported_by_user_id UUID REFERENCES users(id),
    reported_at TIMESTAMPTZ,
    explanation_text TEXT
);

-- 12. Notifications (Bildirimler)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WEB_PUSH')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    link_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_notification_dedup UNIQUE (tenant_id, recipient_id, event_id, channel)
);

-- 13. Push Subscriptions (Web Push Abonelikleri)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- RLS Etkinleştirme
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE delay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Oturumdan Kiracı Değişkenini Okuyan Fonksiyon
-- SET LOCAL app.current_tenant_id = 'uuid-here';
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS Politikaları: Her kayıt yalnızca aktif kiracıya aittir
CREATE POLICY tenant_isolation_users ON users
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_projects ON projects
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_project_plan_changes ON project_plan_changes
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_project_members ON project_members
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_visibility_requests ON visibility_requests
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_tasks ON tasks
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_task_assignments ON task_assignments
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_task_plan_changes ON task_plan_changes
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_task_dependencies ON task_dependencies
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delay_records ON delay_records
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_push_subscriptions ON push_subscriptions
    FOR ALL USING (tenant_id = get_current_tenant_id());
