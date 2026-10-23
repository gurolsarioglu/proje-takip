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
}

export interface CustomReportLayout {
  id: string;
  name: string;
  widgets: Array<{ id: string; widgetType: string; width: 'full' | 'half'; noteText?: string }>;
  project_id?: string;
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
  project_id: UUID;
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
