/**
 * Görev ve Bağımlılık Yönetim Sistemi - Domain Tipleri
 * Şartname v0.3 (23 Ekim 2026)
 */

export type UUID = string;

// Çalışma Durumları (Work Status)
// Şartname v0.3: EXPLANATION_REQUIRED bir çalışma durumu DEĞİLDİR.
export type WorkStatus = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED';

// Proje Rolleri
export type ProjectRole = 'PROJECT_MANAGER' | 'EDITOR' | 'VIEWER';

// Görünürlük Talep Durumları
export type VisibilityRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Bağımlılık Türü
export type DependencyType = 'FINISH_TO_START';

// Açıklama Durumu ve Kaynağı
export type ExplanationStatus = 'REQUIRED' | 'RECORDED';
export type ExplanationSource = 'SYSTEM' | 'USER';
export type DelayCauseClass = 'DEPENDENCY_BLOCKED' | 'USER_DELAY' | 'OTHER';

// Bildirim Kanalı ve Durumu
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WEB_PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

// 1. Kimlik ve Şirket
export interface Tenant {
  id: UUID;
  name: string;
  entra_tenant_id: string;
  created_at: string;
}

export type SystemRole = 'ADMIN' | 'USER';
export type AppLanguage = 'tr' | 'en' | 'de';

export interface User {
  id: UUID;
  tenant_id: UUID;
  entra_oid: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  language: AppLanguage;
  password?: string;
  system_role: SystemRole;
  can_create_project: boolean;
  can_build_reports: boolean;
  department?: string;
  theme?: 'light' | 'dark';
  avatar_url?: string;
  is_active?: boolean;
  deactivated_at?: string;
  deactivation_reason?: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  tenant: Tenant;
  token: string;
}

export interface PersonnelCardDTO {
  name: string;
  email: string;
  phone?: string;
  country: string;
  password?: string;
  system_role?: SystemRole;
  can_create_project?: boolean;
  can_build_reports?: boolean;
  department?: string;
  theme?: 'light' | 'dark';
  avatar_url?: string;
  is_active?: boolean;
  deactivation_reason?: string;
}

export interface CustomReportLayout {
  id: string;
  name: string;
  widgets: Array<{ id: string; widgetType: string; width: 'full' | 'half'; noteText?: string }>;
  project_id?: string;
  created_at: string;
}

// 1.B. Müşteri (Customer / Client)
export interface Customer {
  id: UUID;
  tenant_id: UUID;
  name: string;
  code?: string;
  description?: string;
  contact_person?: string;
  contact_email?: string;
  is_active?: boolean;
  created_by_user_id?: UUID;
  created_at: string;
}

export interface CustomerStatsDTO extends Customer {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_tasks: number;
  completed_tasks: number;
  delayed_tasks: number;
  avg_progress: number;
  success_rate: number;
}

// 1.C. Ana Proje / Çatı Program (Master Project / Program)
export interface MasterProject {
  id: UUID;
  tenant_id: UUID;
  title: string;
  year: number;
  description?: string;
  start_date?: string;
  due_date?: string;
  is_active?: boolean;
  created_by_user_id?: UUID;
  created_at: string;
}

// 2. Proje ve Yetki
export interface Project {
  id: UUID;
  tenant_id: UUID;
  title: string;
  description: string;
  initial_start_date: string; // ISO 8601
  initial_due_date: string;   // ISO 8601
  current_start_date: string;
  current_due_date: string;
  created_by_user_id: UUID;
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by_user_id?: UUID;
  customer_id?: UUID;
  customer_name?: string;
  master_project_id?: UUID;
  master_project_title?: string;
  parent_project_id?: UUID; // Doluysa bu bir Alt Projedir ve belirtilen Ana Projeye bağlıdır
  parent_project_title?: string;
  is_main_project?: boolean;
  sub_projects_count?: number;
  timeline_period?: string; // örn: "EKİM/KASIM", "ARALIK", "ŞUBAT", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ/AĞUSTOS", "EYLÜL"
}

export interface ProjectPlanChange {
  id: UUID;
  tenant_id: UUID;
  project_id: UUID;
  previous_start_date: string;
  previous_due_date: string;
  new_start_date: string;
  new_due_date: string;
  changed_by_user_id: UUID;
  changed_at: string;
  reason?: string;
}

export interface ProjectMember {
  id: UUID;
  tenant_id: UUID;
  project_id: UUID;
  user_id: UUID;
  role: ProjectRole;
  assigned_at: string;
}

export interface VisibilityRequest {
  id: UUID;
  tenant_id: UUID;
  project_id: UUID;
  user_id: UUID;
  request_time: string;
  status: VisibilityRequestStatus;
  decided_by_user_id?: UUID;
  decided_at?: string;
}

// 3. Görev
export type TaskType = 'TASK' | 'MILESTONE' | 'BUG';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface Task {
  id: UUID;
  tenant_id: UUID;
  project_id: UUID | null;
  assignee_id?: UUID;
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  progress?: number; // 0 - 100
  work_status: WorkStatus;
  initial_start_date: string;
  initial_due_date: string;
  current_start_date: string;
  current_due_date: string;
  actual_start_date?: string;
  actual_completion_date?: string;
  completed_by_user_id?: UUID;
  workflow_step?: string;
  task_definition?: string;
  assigned_by_user_id?: UUID;
  created_at: string;
}

// Kurumsal İş Adımları Kataloğu
export interface WorkflowStep {
  id: UUID;
  tenant_id: UUID;
  name: string;
  color: string;
  department?: string;
  display_order?: number;
  created_by_user_id?: UUID;
  created_at: string;
}

// Standart Görev Tanımları Kataloğu
export interface TaskDefinitionTemplate {
  id: UUID;
  tenant_id: UUID;
  step_name: string;
  title: string;
  default_duration_days?: number;
  suggested_department?: string;
  created_by_user_id?: UUID;
  created_at: string;
}

export interface TaskAssignment {
  id: UUID;
  tenant_id: UUID;
  task_id: UUID;
  user_id: UUID;
  assigned_at: string;
  unassigned_at?: string;
  assigned_by_user_id: UUID;
}

export interface TaskPlanChange {
  id: UUID;
  tenant_id: UUID;
  task_id: UUID;
  previous_start_date: string;
  previous_due_date: string;
  new_start_date: string;
  new_due_date: string;
  changed_by_user_id: UUID;
  changed_at: string;
  reason?: string;
}

// Görev Ek Süre ve Plan Revizyon Talebi (Task Extension Request)
export type TaskExtensionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TaskExtensionRequest {
  id: UUID;
  tenant_id: UUID;
  project_id: UUID;
  task_id: UUID;
  user_id: UUID;
  requested_start_date?: string;
  requested_due_date: string;
  reason: string;
  status: TaskExtensionRequestStatus;
  created_at: string;
  decided_by_user_id?: UUID;
  decided_at?: string;
  rejection_reason?: string;
}

// 4. Bağımlılık
export interface TaskDependency {
  id: UUID;
  tenant_id: UUID;
  predecessor_id: UUID; // Öncül
  successor_id: UUID;   // Ardıl
  dependency_type: DependencyType;
  wait_start_time?: string;
  wait_end_time?: string;
  created_at: string;
}

// 5. Gecikme ve Açıklama
export interface BlockingInterval {
  predecessor_id: UUID;
  start: string;
  end?: string;
}

export interface DelayRecord {
  id: UUID;
  tenant_id: UUID;
  task_id: UUID;
  detected_at: string;
  explanation_status: ExplanationStatus;
  explanation_source: ExplanationSource;
  reason: string;
  blocking_intervals: BlockingInterval[];
  cause_class: DelayCauseClass;
  reported_by_user_id?: UUID;
  reported_at?: string;
  explanation_text?: string;
}

// 6. Bildirim
export interface Notification {
  id: UUID;
  tenant_id: UUID;
  recipient_id: UUID;
  event_id: string; // Mükerrerlik engeli için
  channel: NotificationChannel;
  title: string;
  message: string;
  link_task_id?: UUID;
  link_project_id?: UUID;
  status: NotificationStatus;
  retry_count: number;
  is_read?: boolean;
  read_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface PushSubscriptionData {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  is_active: boolean;
}

// 7. Raporlama
export interface ProjectReport {
  project_id: UUID;
  title: string;
  initial_start_date: string;
  initial_due_date: string;
  current_start_date: string;
  current_due_date: string;
  actual_start_date: string | null;  // İlk başlayan görevin başlangıcı (yoksa null)
  actual_finish_date: string | null; // Tüm görevler bitmişse son bitiş, yoksa null
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  delayed_tasks: number;
  completion_rate: number; // completed_tasks / total_tasks (0 - 100)
  cutoff_time: string;
}

export interface UserPerformanceReport {
  user_id: UUID;
  user_name: string;
  assigned_tasks_count: number; // Dönemde atanan benzersiz görev sayısı
  completed_tasks_count: number; // Dönemde biten görev sayısı (bitiş anındaki sorumluya)
  on_time_completed_count: number; // İlk plan vadesinde zamanında biten
  open_and_delayed_count: number;
  total_date_deviation_days: number;
  dependency_waiting_hours: number;
  // Puanlama Detayları (Şartname v0.3: 100 * (0.70 * Z + 0.30 * T))
  eligible_h_count: number; // Vadesi gelmiş ve ilk planı dönemde olan
  excluded_dependency_count: number; // Bütünüyle bağımlılıktan gecikenler
  eligible_s_count: number; // S kümesi büyüklüğü
  z_ratio: number | null; // S içindeki zamanında tamamlama oranı
  t_ratio: number | null; // S içindeki kesim anına kadar tamamlama oranı
  performance_score: number | null; // null => "Hesaplanamıyor" (S boş ise)
  score_display: string; // Sayı veya "Hesaplanamıyor"
}

// Güvenli Kullanıcı Bağlamı (Security Context)
export interface AuthContext {
  tenant_id: UUID;
  user_id: UUID;
  email: string;
  name: string;
}

// Sınırlı Bağımlılık Özeti (Şartname K06 & KAB02)
export interface LimitedDependencySummary {
  task_id: UUID;
  title: string;
  work_status: WorkStatus;
  assignee_name?: string;
  due_date: string;
  relation: 'PREDECESSOR' | 'SUCCESSOR';
  is_blocking: boolean;
}

// 8. Microsoft To Do & Outlook Entegrasyonu
export interface MicrosoftTodoItem {
  id: string; // MS Graph ID veya iç UUID
  tenant_id: UUID;
  user_id: UUID;
  entra_oid?: string;
  title: string;
  body_content?: string;
  is_completed: boolean;
  due_date?: string;
  importance: 'low' | 'normal' | 'high';
  is_starred?: boolean;
  linked_task_id?: UUID; // Proje görevine bağlıysa görev ID'si
  source: 'FG_SYSTEM' | 'OUTLOOK_TODO';
  synced_at: string;
  created_at: string;
}


// 9. Exchange Online Plan 1 (SMTP), Outlook Actionable Messages (Adaptive Cards) & Zamanlanmış Raporlar
export interface SmtpConfig {
  tenant_id: UUID;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  from_name: string;
  from_email: string;
  public_base_url: string;
  enable_actionable_cards: boolean;
  updated_at: string;
}

export type ScheduledReportType =
  | 'EXECUTIVE_SUMMARY'
  | 'PERFORMANCE_SCORECARD'
  | 'BOTTLENECK_DELAY'
  | 'FULL_REPORT';

export type ScheduledReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ScheduledReportJob {
  id: UUID;
  tenant_id: UUID;
  name: string;
  project_id?: string; // 'all' veya proje UUID
  report_type: ScheduledReportType;
  frequency: ScheduledReportFrequency;
  day_of_week?: number; // 1 (Pzt) - 7 (Paz)
  send_time: string; // '09:00'
  recipients: string[];
  include_adaptive_card: boolean;
  is_active: boolean;
  last_sent_at?: string;
  created_by_user_id: UUID;
  created_at: string;
}

export type EmailOutboxCategory =
  | 'ACTIONABLE_TASK_CARD'
  | 'TASK_ASSIGNED_CARD'
  | 'PROJECT_MEMBER_CARD'
  | 'USER_WELCOME_CARD'
  | 'TASK_COMPLETED_MANAGER_CARD'
  | 'TASK_PROGRESS_MANAGER_CARD'
  | 'DELAY_EXPLANATION_CARD'
  | 'OVERDUE_MANAGER_ALERT'
  | 'APPROVAL_CARD'
  | 'SCHEDULED_REPORT'
  | 'SMTP_TEST';

export interface EmailOutboxItem {
  id: UUID;
  tenant_id: UUID;
  to: string[];
  subject: string;
  category: EmailOutboxCategory;
  delivery_mode: 'SMTP_LIVE' | 'LOCAL_OUTBOX';
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  error_message?: string;
  adaptive_card_json?: any;
  html_preview: string;
  linked_task_id?: UUID;
  linked_project_id?: UUID | null;
  linked_request_id?: UUID;
  action_taken?: string;
  sent_at: string;
}

// 10. Yedekleme & Kurtarma (Backup & Disaster Recovery)
export type BackupType = 'MANUAL' | 'SCHEDULED_DAILY' | 'SCHEDULED_WEEKLY' | 'PRE_RESTORE_SAFETY';

export interface BackupMetadata {
  id: UUID;
  tenant_id: UUID;
  name: string;
  note?: string;
  type: BackupType;
  created_at: string;
  created_by_name: string;
  size_bytes: number;
  sha256: string;
  summary: {
    project_count: number;
    task_count: number;
    user_count: number;
    member_count: number;
  };
  file_path: string;
}

export interface BackupScheduleConfig {
  daily_enabled: boolean;
  daily_time: string; // '23:00'
  daily_retention_days: number; // e.g. 14
  weekly_enabled: boolean;
  weekly_day: number; // 0: Sunday ... 6: Saturday
  weekly_time: string; // '22:00'
  weekly_retention_weeks: number; // e.g. 8
  notify_email?: string;
  last_daily_run?: string;
  last_weekly_run?: string;
}

export interface BackupPayload {
  version: string;
  exported_at: string;
  tenant_id: UUID;
  tenant?: Tenant;
  projects: Project[];
  tasks: Task[];
  task_assignments: TaskAssignment[];
  task_dependencies: TaskDependency[];
  task_plan_changes: TaskPlanChange[];
  delay_records: DelayRecord[];
  project_members: ProjectMember[];
  project_plan_changes: ProjectPlanChange[];
  visibility_requests: VisibilityRequest[];
  users: User[];
}
