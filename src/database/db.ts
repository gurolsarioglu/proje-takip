import fs from 'fs';
import path from 'path';
import {
  Tenant,
  User,
  Project,
  ProjectPlanChange,
  ProjectMember,
  VisibilityRequest,
  Task,
  TaskAssignment,
  TaskPlanChange,
  TaskExtensionRequest,
  TaskDependency,
  DelayRecord,
  Notification,
  PushSubscriptionData,
  MicrosoftTodoItem,
  SmtpConfig,
  ScheduledReportJob,
  EmailOutboxItem,
  BackupMetadata,
  BackupScheduleConfig,
  BackupPayload,
  WorkflowStep,
  TaskDefinitionTemplate,
  Customer,
  MasterProject,
  UUID
} from '../core/types.js';
import crypto from 'crypto';
import { CryptoVault } from '../core/crypto-vault.js';

export interface DatabaseState {
  tenants: Tenant[];
  users: User[];
  projects: Project[];
  project_plan_changes: ProjectPlanChange[];
  project_members: ProjectMember[];
  visibility_requests: VisibilityRequest[];
  tasks: Task[];
  task_assignments: TaskAssignment[];
  task_plan_changes: TaskPlanChange[];
  task_extension_requests?: TaskExtensionRequest[];
  task_dependencies: TaskDependency[];
  delay_records: DelayRecord[];
  notifications: Notification[];
  push_subscriptions: PushSubscriptionData[];
  microsoft_todos: MicrosoftTodoItem[];
  smtp_configs: SmtpConfig[];
  scheduled_reports: ScheduledReportJob[];
  email_outbox: EmailOutboxItem[];
  backups: BackupMetadata[];
  backup_schedules: Record<string, BackupScheduleConfig>;
  workflow_steps: WorkflowStep[];
  task_definition_templates: TaskDefinitionTemplate[];
  customers?: Customer[];
  master_projects?: MasterProject[];
}

export class Database {
  private state: DatabaseState;
  private filePath?: string;
  private onSaveHook?: (state: DatabaseState) => void;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.state = this.getInitialState();
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = {
          ...this.getInitialState(),
          ...parsed
        };
        if (!Array.isArray(this.state.microsoft_todos)) {
          this.state.microsoft_todos = [];
        }
        if (!Array.isArray(this.state.smtp_configs)) {
          this.state.smtp_configs = [];
        }
        if (!Array.isArray(this.state.scheduled_reports)) {
          this.state.scheduled_reports = [];
        }
        if (!Array.isArray(this.state.email_outbox)) {
          this.state.email_outbox = [];
        }
        if (!Array.isArray(this.state.backups)) {
          this.state.backups = [];
        }
        if (!this.state.backup_schedules || typeof this.state.backup_schedules !== 'object') {
          this.state.backup_schedules = {};
        }
        if (!Array.isArray(this.state.workflow_steps)) {
          this.state.workflow_steps = [];
        }
        if (!Array.isArray(this.state.task_definition_templates)) {
          this.state.task_definition_templates = [];
        }
        if (!Array.isArray(this.state.customers)) {
          this.state.customers = [];
        }
        if (!Array.isArray(this.state.master_projects)) {
          this.state.master_projects = [];
        }
        // Düz metin kalmış SMTP şifresi varsa anında AES-256-GCM ile şifrele
        let smtpMigrated = false;
        this.state.smtp_configs = this.state.smtp_configs.map(c => {
          if (c.password && c.password.length > 0 && !CryptoVault.isEncrypted(c.password)) {
            smtpMigrated = true;
            return { ...c, password: CryptoVault.encrypt(c.password) };
          }
          return c;
        });
        if (Array.isArray(this.state.users)) {
          this.state.users = this.state.users.map(u => {
            let updated = false;
            let country = u.country;
            let language = u.language;
            if (country && (country.includes('\ufffd') || country.includes('Trkiye') || country.toLowerCase() === 'turkiye')) {
              country = 'Türkiye';
              updated = true;
            }
            if (country === 'Türkiye' && (!language || language === 'en')) {
              language = 'tr';
              updated = true;
            }
            return updated ? { ...u, country, language } : u;
          });
        }
        if (smtpMigrated) {
          this.save();
        }
      } catch (e) {
        console.warn('Failed to load DB file, initializing clean state.', e);
      }
    }
  }

  public setOnSaveHook(fn: (state: DatabaseState) => void): void {
    this.onSaveHook = fn;
  }

  public getRawState(): DatabaseState {
    return this.state;
  }

  private getSmtpVaultPath(): string | undefined {
    if (!this.filePath) return undefined;
    return path.join(path.dirname(this.filePath), 'smtp-vault.json');
  }

  public getInitialState(): DatabaseState {
    return {
      tenants: [],
      users: [],
      projects: [],
      project_plan_changes: [],
      project_members: [],
      visibility_requests: [],
      tasks: [],
      task_assignments: [],
      task_plan_changes: [],
      task_extension_requests: [],
      task_dependencies: [],
      delay_records: [],
      notifications: [],
      push_subscriptions: [],
      microsoft_todos: [],
      smtp_configs: [],
      scheduled_reports: [],
      email_outbox: [],
      backups: [],
      backup_schedules: {},
      workflow_steps: [],
      task_definition_templates: [],
      customers: [],
      master_projects: []
    };
  }

  public reset(): void {
    // Reset çağrılsa bile şifrelenmiş SMTP kasasını koru
    const preservedSmtp = Array.isArray(this.state.smtp_configs)
      ? this.state.smtp_configs.filter(c => c.password && c.password.length > 0)
      : [];
    this.state = this.getInitialState();
    if (preservedSmtp.length > 0) {
      this.state.smtp_configs = preservedSmtp;
    }
    this.save();
  }

  private save(): void {
    if (this.filePath) {
      try {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to save db state:', err);
      }
    }
    if (this.onSaveHook) {
      this.onSaveHook(this.state);
    }
  }

  // --- Tenants ---
  public getTenants(): Tenant[] {
    return [...this.state.tenants];
  }
  public getTenantById(id: UUID): Tenant | undefined {
    return this.state.tenants.find(t => t.id === id);
  }
  public insertTenant(tenant: Tenant): Tenant {
    this.state.tenants.push(tenant);
    this.save();
    return tenant;
  }

  // --- Users ---
  public getUsers(tenant_id: UUID): User[] {
    return this.state.users.filter(u => u.tenant_id === tenant_id);
  }
  public getUserById(tenant_id: UUID, id: UUID): User | undefined {
    return this.state.users.find(u => u.tenant_id === tenant_id && u.id === id);
  }
  public getUserByEntraOid(tenant_id: UUID, entra_oid: string): User | undefined {
    return this.state.users.find(u => u.tenant_id === tenant_id && u.entra_oid === entra_oid);
  }
  public getUserByEmail(email: string): User | undefined {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }
  public insertUser(user: User): User {
    this.state.users.push(user);
    this.save();
    return user;
  }
  public updateUser(tenant_id: UUID, id: UUID, update: Partial<User>): User | undefined {
    const user = this.getUserById(tenant_id, id);
    if (!user) return undefined;
    Object.assign(user, update);
    this.save();
    return user;
  }

  // --- Projects ---
  public getProjects(tenant_id: UUID): Project[] {
    return this.state.projects.filter(p => p.tenant_id === tenant_id);
  }
  public getProjectById(tenant_id: UUID, id?: UUID | null): Project | undefined {
    if (!id) return undefined;
    return this.state.projects.find(p => p.tenant_id === tenant_id && p.id === id);
  }
  public insertProject(project: Project): Project {
    this.state.projects.push(project);
    this.save();
    return project;
  }
  public updateProject(tenant_id: UUID, id: UUID, update: Partial<Project>): Project | undefined {
    const p = this.getProjectById(tenant_id, id);
    if (!p) return undefined;
    Object.assign(p, update);
    this.save();
    return p;
  }

  // --- Customers ---
  public getCustomers(tenant_id: UUID): Customer[] {
    this.ensureDefaultCustomers(tenant_id);
    return (this.state.customers || []).filter(c => c.tenant_id === tenant_id);
  }

  public getCustomerById(tenant_id: UUID, id?: UUID | null): Customer | undefined {
    if (!id) return undefined;
    return (this.state.customers || []).find(c => c.tenant_id === tenant_id && c.id === id);
  }

  public insertCustomer(customer: Customer): Customer {
    if (!Array.isArray(this.state.customers)) {
      this.state.customers = [];
    }
    this.state.customers.push(customer);
    this.save();
    return customer;
  }

  public updateCustomer(tenant_id: UUID, id: UUID, update: Partial<Customer>): Customer | undefined {
    const c = this.getCustomerById(tenant_id, id);
    if (!c) return undefined;
    Object.assign(c, update);
    this.save();
    return c;
  }

  public ensureDefaultCustomers(tenant_id: UUID, created_by_user_id?: UUID): Customer[] {
    if (!Array.isArray(this.state.customers)) {
      this.state.customers = [];
    }
    const tenantCustomers = this.state.customers.filter(c => c.tenant_id === tenant_id);
    if (tenantCustomers.length > 0) return tenantCustomers;

    const defaultNames = [
      { name: 'NEWYORKER', code: 'NY', desc: 'Newyorker tekstil ve koleksiyon projeleri' },
      { name: 'JULES', code: 'JLS', desc: 'Jules hazır giyim ve modelhane projeleri' },
      { name: 'PEPE JEANS', code: 'PJ', desc: 'Pepe Jeans denim ve koleksiyon projeleri' },
      { name: 'BESTSELLER ONLY & SONS', code: 'BOS', desc: 'Bestseller Only & Sons sipariş ve üretim projeleri' }
    ];

    const admin = this.getUsers(tenant_id).find(u => u.system_role === 'ADMIN');
    const authorId = created_by_user_id || admin?.id || this.getUsers(tenant_id)[0]?.id || 'system-admin';

    for (const d of defaultNames) {
      const cust: Customer = {
        id: crypto.randomUUID(),
        tenant_id,
        name: d.name,
        code: d.code,
        description: d.desc,
        is_active: true,
        created_by_user_id: authorId,
        created_at: new Date().toISOString()
      };
      this.state.customers.push(cust);
    }

    // Mevcut projelere varsa otomatik müşteri eşleştirmesi yap
    const projects = this.getProjects(tenant_id);
    for (const proj of projects) {
      if (!proj.customer_id) {
        const titleUpper = (proj.title || '').toUpperCase();
        const matched = this.state.customers.find(c => c.tenant_id === tenant_id && titleUpper.includes(c.name.toUpperCase()));
        if (matched) {
          proj.customer_id = matched.id;
          proj.customer_name = matched.name;
        }
      }
    }

    this.save();
    return this.state.customers.filter(c => c.tenant_id === tenant_id);
  }

  // --- Ana Proje / Çatı Program (Master Projects) ---
  public getMasterProjects(tenant_id: UUID): MasterProject[] {
    this.ensureDefaultMasterProject(tenant_id);
    return (this.state.master_projects || []).filter(m => m.tenant_id === tenant_id && m.is_active !== false);
  }

  public getMasterProjectById(tenant_id: UUID, id?: UUID | null): MasterProject | undefined {
    if (!id) return undefined;
    return (this.state.master_projects || []).find(m => m.tenant_id === tenant_id && m.id === id);
  }

  public insertMasterProject(masterProject: MasterProject): MasterProject {
    if (!Array.isArray(this.state.master_projects)) {
      this.state.master_projects = [];
    }
    this.state.master_projects.push(masterProject);
    this.save();
    return masterProject;
  }

  public updateMasterProject(tenant_id: UUID, id: UUID, update: Partial<MasterProject>): MasterProject | undefined {
    const m = this.getMasterProjectById(tenant_id, id);
    if (!m) return undefined;
    Object.assign(m, update);
    this.save();
    return m;
  }

  public ensureDefaultMasterProject(tenant_id: UUID, created_by_user_id?: UUID): MasterProject {
    if (!Array.isArray(this.state.master_projects)) {
      this.state.master_projects = [];
    }
    const existing = this.state.master_projects.find(m => m.tenant_id === tenant_id && m.year === 2026);
    if (existing) return existing;

    const admin = this.getUsers(tenant_id).find(u => u.system_role === 'ADMIN');
    const authorId = created_by_user_id || admin?.id || this.getUsers(tenant_id)[0]?.id || 'system-admin';

    const defaultMaster: MasterProject = {
      id: crypto.randomUUID(),
      tenant_id,
      title: 'FG COLLECTION TIMELINE 2026',
      year: 2026,
      description: 'FG Group 2026 Yıllık Koleksiyon ve Müşteri Portföy Çatı Programı',
      start_date: '2026-01-01',
      due_date: '2026-12-31',
      is_active: true,
      created_by_user_id: authorId,
      created_at: new Date().toISOString()
    };
    this.state.master_projects.push(defaultMaster);
    this.save();
    return defaultMaster;
  }

  /**
   * Kullanıcının talebi üzerine eski deneme projelerini ve bağlı görevlerini temizler
   */
  public wipeTrialProjects(tenant_id: UUID): void {
    const deletedProjectIds = new Set(this.state.projects.filter(p => p.tenant_id === tenant_id).map(p => p.id));
    this.state.projects = this.state.projects.filter(p => p.tenant_id !== tenant_id);
    this.state.tasks = this.state.tasks.filter(t => !t.project_id || !deletedProjectIds.has(t.project_id));
    this.state.task_assignments = this.state.task_assignments.filter(a => a.tenant_id !== tenant_id);
    this.state.task_dependencies = this.state.task_dependencies.filter(d => d.tenant_id !== tenant_id);
    this.state.task_plan_changes = this.state.task_plan_changes.filter(c => c.tenant_id !== tenant_id);
    this.state.project_plan_changes = this.state.project_plan_changes.filter(c => c.tenant_id !== tenant_id);
    this.state.project_members = this.state.project_members.filter(m => m.tenant_id !== tenant_id);
    this.state.delay_records = this.state.delay_records.filter(r => r.tenant_id !== tenant_id);
    this.state.visibility_requests = this.state.visibility_requests.filter(v => v.tenant_id !== tenant_id);
    this.save();
  }

  // --- Project Plan Changes ---
  public getProjectPlanChanges(tenant_id: UUID, project_id: UUID): ProjectPlanChange[] {
    return this.state.project_plan_changes.filter(c => c.tenant_id === tenant_id && c.project_id === project_id);
  }
  public insertProjectPlanChange(change: ProjectPlanChange): ProjectPlanChange {
    this.state.project_plan_changes.push(change);
    this.save();
    return change;
  }

  // --- Project Members ---
  public getProjectMembers(tenant_id: UUID, project_id?: UUID | null): ProjectMember[] {
    if (!project_id) return [];
    return this.state.project_members.filter(m => m.tenant_id === tenant_id && m.project_id === project_id);
  }
  public getProjectMember(tenant_id: UUID, project_id?: UUID | null, user_id?: UUID | null): ProjectMember | undefined {
    if (!project_id || !user_id) return undefined;
    return this.state.project_members.find(m => m.tenant_id === tenant_id && m.project_id === project_id && m.user_id === user_id);
  }
  public insertProjectMember(member: ProjectMember): ProjectMember {
    this.state.project_members.push(member);
    this.save();
    return member;
  }
  public updateProjectMember(tenant_id: UUID, project_id: UUID, user_id: UUID, role: ProjectMember['role']): ProjectMember | undefined {
    const m = this.getProjectMember(tenant_id, project_id, user_id);
    if (!m) return undefined;
    m.role = role;
    this.save();
    return m;
  }

  // --- Visibility Requests ---
  public getVisibilityRequests(tenant_id: UUID, project_id?: UUID): VisibilityRequest[] {
    return this.state.visibility_requests.filter(r => r.tenant_id === tenant_id && (!project_id || r.project_id === project_id));
  }
  public getVisibilityRequestById(tenant_id: UUID, id: UUID): VisibilityRequest | undefined {
    return this.state.visibility_requests.find(r => r.tenant_id === tenant_id && r.id === id);
  }
  public insertVisibilityRequest(req: VisibilityRequest): VisibilityRequest {
    this.state.visibility_requests.push(req);
    this.save();
    return req;
  }
  public updateVisibilityRequest(tenant_id: UUID, id: UUID, update: Partial<VisibilityRequest>): VisibilityRequest | undefined {
    const req = this.getVisibilityRequestById(tenant_id, id);
    if (!req) return undefined;
    Object.assign(req, update);
    this.save();
    return req;
  }

  // --- Tasks ---
  public getTasks(tenant_id: UUID, project_id?: UUID): Task[] {
    return this.state.tasks.filter(t => t.tenant_id === tenant_id && (!project_id || t.project_id === project_id));
  }
  public getTaskById(tenant_id: UUID, id: UUID): Task | undefined {
    return this.state.tasks.find(t => t.tenant_id === tenant_id && t.id === id);
  }
  public insertTask(task: Task): Task {
    this.state.tasks.push(task);
    this.save();
    return task;
  }
  public updateTask(tenant_id: UUID, id: UUID, update: Partial<Task>): Task | undefined {
    const task = this.getTaskById(tenant_id, id);
    if (!task) return undefined;
    Object.assign(task, update);
    this.save();
    return task;
  }

  // --- Task Assignments ---
  public getTaskAssignments(tenant_id: UUID, task_id?: UUID): TaskAssignment[] {
    return this.state.task_assignments.filter(a => a.tenant_id === tenant_id && (!task_id || a.task_id === task_id));
  }
  public insertTaskAssignment(assignment: TaskAssignment): TaskAssignment {
    this.state.task_assignments.push(assignment);
    this.save();
    return assignment;
  }
  public updateTaskAssignment(tenant_id: UUID, id: UUID, update: Partial<TaskAssignment>): TaskAssignment | undefined {
    const a = this.state.task_assignments.find(item => item.tenant_id === tenant_id && item.id === id);
    if (!a) return undefined;
    Object.assign(a, update);
    this.save();
    return a;
  }

  // --- Task Plan Changes ---
  public getTaskPlanChanges(tenant_id: UUID, task_id: UUID): TaskPlanChange[] {
    return this.state.task_plan_changes.filter(c => c.tenant_id === tenant_id && c.task_id === task_id);
  }
  public insertTaskPlanChange(change: TaskPlanChange): TaskPlanChange {
    this.state.task_plan_changes.push(change);
    this.save();
    return change;
  }

  // --- Task Extension Requests ---
  public getTaskExtensionRequests(tenant_id: UUID, task_id?: UUID): TaskExtensionRequest[] {
    if (!this.state.task_extension_requests) this.state.task_extension_requests = [];
    return this.state.task_extension_requests.filter(
      r => r.tenant_id === tenant_id && (!task_id || r.task_id === task_id)
    );
  }
  public getTaskExtensionRequestById(tenant_id: UUID, id: UUID): TaskExtensionRequest | undefined {
    if (!this.state.task_extension_requests) this.state.task_extension_requests = [];
    return this.state.task_extension_requests.find(r => r.tenant_id === tenant_id && r.id === id);
  }
  public insertTaskExtensionRequest(req: TaskExtensionRequest): TaskExtensionRequest {
    if (!this.state.task_extension_requests) this.state.task_extension_requests = [];
    this.state.task_extension_requests.push(req);
    this.save();
    return req;
  }
  public updateTaskExtensionRequest(tenant_id: UUID, id: UUID, update: Partial<TaskExtensionRequest>): TaskExtensionRequest | undefined {
    const req = this.getTaskExtensionRequestById(tenant_id, id);
    if (!req) return undefined;
    Object.assign(req, update);
    this.save();
    return req;
  }

  // --- Task Dependencies ---
  public getDependencies(tenant_id: UUID): TaskDependency[] {
    return this.state.task_dependencies.filter(d => d.tenant_id === tenant_id);
  }
  public getPredecessors(tenant_id: UUID, successor_id: UUID): TaskDependency[] {
    return this.state.task_dependencies.filter(d => d.tenant_id === tenant_id && d.successor_id === successor_id);
  }
  public getSuccessors(tenant_id: UUID, predecessor_id: UUID): TaskDependency[] {
    return this.state.task_dependencies.filter(d => d.tenant_id === tenant_id && d.predecessor_id === predecessor_id);
  }
  public insertDependency(dependency: TaskDependency): TaskDependency {
    this.state.task_dependencies.push(dependency);
    this.save();
    return dependency;
  }
  public removeDependency(tenant_id: UUID, predecessor_id: UUID, successor_id: UUID): boolean {
    const idx = this.state.task_dependencies.findIndex(
      d => d.tenant_id === tenant_id && d.predecessor_id === predecessor_id && d.successor_id === successor_id
    );
    if (idx !== -1) {
      this.state.task_dependencies.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- Delay Records ---
  public getDelayRecords(tenant_id: UUID, task_id?: UUID): DelayRecord[] {
    return this.state.delay_records.filter(r => r.tenant_id === tenant_id && (!task_id || r.task_id === task_id));
  }
  public insertDelayRecord(record: DelayRecord): DelayRecord {
    this.state.delay_records.push(record);
    this.save();
    return record;
  }
  public updateDelayRecord(tenant_id: UUID, id: UUID, update: Partial<DelayRecord>): DelayRecord | undefined {
    const r = this.state.delay_records.find(item => item.tenant_id === tenant_id && item.id === id);
    if (!r) return undefined;
    Object.assign(r, update);
    this.save();
    return r;
  }

  // --- Notifications ---
  public getNotifications(tenant_id: UUID, recipient_id?: UUID): Notification[] {
    return this.state.notifications.filter(
      n => n.tenant_id === tenant_id && (!recipient_id || n.recipient_id === recipient_id)
    );
  }
  public insertNotification(notification: Notification): Notification {
    this.state.notifications.push(notification);
    this.save();
    return notification;
  }
  public updateNotification(tenant_id: UUID, id: UUID, update: Partial<Notification>): Notification | undefined {
    const n = this.state.notifications.find(item => item.tenant_id === tenant_id && item.id === id);
    if (!n) return undefined;
    Object.assign(n, update);
    this.save();
    return n;
  }
  public markAllNotificationsAsRead(tenant_id: UUID, recipient_id: UUID): void {
    const now = new Date().toISOString();
    let changed = false;
    for (const n of this.state.notifications) {
      if (n.tenant_id === tenant_id && n.recipient_id === recipient_id && !n.is_read) {
        n.is_read = true;
        n.read_at = now;
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }
  public clearNotifications(tenant_id: UUID, recipient_id: UUID): void {
    const initialLen = this.state.notifications.length;
    this.state.notifications = this.state.notifications.filter(
      n => !(n.tenant_id === tenant_id && n.recipient_id === recipient_id)
    );
    if (this.state.notifications.length !== initialLen) {
      this.save();
    }
  }

  // --- Workflow Steps & Task Definition Templates ---
  public getWorkflowSteps(tenant_id: UUID): WorkflowStep[] {
    return this.state.workflow_steps
      .filter(s => s.tenant_id === tenant_id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public insertWorkflowStep(step: WorkflowStep): WorkflowStep {
    const finalStep: WorkflowStep = {
      ...step,
      id: step.id || crypto.randomUUID(),
      created_at: step.created_at || new Date().toISOString()
    };
    const existing = this.state.workflow_steps.find(
      s => s.tenant_id === finalStep.tenant_id && s.name.trim().toLowerCase() === finalStep.name.trim().toLowerCase()
    );
    if (existing) return existing;
    this.state.workflow_steps.push(finalStep);
    this.save();
    return finalStep;
  }

  public getTaskDefinitionTemplates(tenant_id: UUID, step_name?: string): TaskDefinitionTemplate[] {
    return this.state.task_definition_templates.filter(
      t => t.tenant_id === tenant_id && (!step_name || t.step_name.trim().toLowerCase() === step_name.trim().toLowerCase())
    );
  }

  public insertTaskDefinitionTemplate(tpl: TaskDefinitionTemplate): TaskDefinitionTemplate {
    const finalTpl: TaskDefinitionTemplate = {
      ...tpl,
      id: tpl.id || crypto.randomUUID(),
      created_at: tpl.created_at || new Date().toISOString()
    };
    const existing = this.state.task_definition_templates.find(
      t => t.tenant_id === finalTpl.tenant_id &&
           t.step_name.trim().toLowerCase() === finalTpl.step_name.trim().toLowerCase() &&
           t.title.trim().toLowerCase() === finalTpl.title.trim().toLowerCase()
    );
    if (existing) return existing;
    this.state.task_definition_templates.push(finalTpl);
    this.save();
    return finalTpl;
  }

  // --- Push Subscriptions ---
  public getPushSubscriptions(tenant_id: UUID, user_id?: UUID): PushSubscriptionData[] {
    return this.state.push_subscriptions.filter(
      s => s.tenant_id === tenant_id && s.is_active && (!user_id || s.user_id === user_id)
    );
  }
  public insertPushSubscription(sub: PushSubscriptionData): PushSubscriptionData {
    this.state.push_subscriptions.push(sub);
    this.save();
    return sub;
  }
  public deactivatePushSubscription(tenant_id: UUID, endpoint: string): void {
    const subs = this.state.push_subscriptions.filter(s => s.tenant_id === tenant_id && s.endpoint === endpoint);
    subs.forEach(s => s.is_active = false);
    this.save();
  }

  // --- Microsoft To Do Items ---
  public getTodoItems(tenant_id: UUID, user_id?: UUID): MicrosoftTodoItem[] {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    return this.state.microsoft_todos.filter(
      t => t.tenant_id === tenant_id && (!user_id || t.user_id === user_id)
    );
  }

  public getTodoItemById(tenant_id: UUID, id: string): MicrosoftTodoItem | undefined {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    return this.state.microsoft_todos.find(t => t.tenant_id === tenant_id && t.id === id);
  }

  public getTodoItemByLinkedTaskId(tenant_id: UUID, task_id: UUID): MicrosoftTodoItem | undefined {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    return this.state.microsoft_todos.find(t => t.tenant_id === tenant_id && t.linked_task_id === task_id);
  }

  public insertTodoItem(item: MicrosoftTodoItem): MicrosoftTodoItem {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    this.state.microsoft_todos.push(item);
    this.save();
    return item;
  }

  public updateTodoItem(tenant_id: UUID, id: string, updates: Partial<MicrosoftTodoItem>): MicrosoftTodoItem | undefined {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    const item = this.state.microsoft_todos.find(t => t.tenant_id === tenant_id && t.id === id);
    if (!item) return undefined;
    Object.assign(item, updates);
    this.save();
    return item;
  }

  public deleteTodoItem(tenant_id: UUID, id: string): boolean {
    if (!Array.isArray(this.state.microsoft_todos)) this.state.microsoft_todos = [];
    const idx = this.state.microsoft_todos.findIndex(t => t.tenant_id === tenant_id && t.id === id);
    if (idx === -1) return false;
    this.state.microsoft_todos.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Exchange Online / SMTP Config (AES-256-GCM Encrypted Vault) ---
  public getStoredRawSmtpPassword(tenant_id: UUID): string {
    if (!Array.isArray(this.state.smtp_configs)) return '';
    const found = this.state.smtp_configs.find(c => c.tenant_id === tenant_id) || this.state.smtp_configs[0];
    return found?.password || '';
  }

  public getSmtpConfig(tenant_id: UUID): SmtpConfig | undefined {
    if (!Array.isArray(this.state.smtp_configs)) this.state.smtp_configs = [];
    let found = this.state.smtp_configs.find(c => c.tenant_id === tenant_id);

    // Eğer aktif tenant için şifre boşsa ama kasada (veya önceki tenant kaydında) şifreli kayıt varsa otomatik bağla
    if ((!found || !found.password) && this.filePath) {
      const withPass = this.state.smtp_configs.find(c => c.password && c.password.length > 0);
      if (withPass) {
        found = { ...withPass, tenant_id };
        const idx = this.state.smtp_configs.findIndex(c => c.tenant_id === tenant_id);
        if (idx === -1) this.state.smtp_configs.push(found);
        else this.state.smtp_configs[idx] = found;
        this.save();
      } else {
        const vaultPath = this.getSmtpVaultPath();
        if (vaultPath && fs.existsSync(vaultPath)) {
          try {
            const vaultData = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
            if (vaultData && vaultData.username) {
              found = {
                ...vaultData,
                tenant_id,
                password: CryptoVault.encrypt(vaultData.encrypted_password || vaultData.password || '')
              };
              this.state.smtp_configs.push(found!);
              this.save();
            }
          } catch { }
        }
      }
    }

    if (!found) return undefined;
    return {
      ...found,
      password: CryptoVault.decrypt(found.password)
    };
  }

  public upsertSmtpConfig(config: SmtpConfig): SmtpConfig {
    if (!Array.isArray(this.state.smtp_configs)) this.state.smtp_configs = [];
    const encryptedPassword = config.password ? CryptoVault.encrypt(config.password) : '';
    const toStore: SmtpConfig = {
      ...config,
      password: encryptedPassword
    };

    const idx = this.state.smtp_configs.findIndex(c => c.tenant_id === config.tenant_id);
    if (idx === -1) {
      this.state.smtp_configs.push(toStore);
    } else {
      const existingPass = this.state.smtp_configs[idx].password;
      this.state.smtp_configs[idx] = {
        ...this.state.smtp_configs[idx],
        ...toStore,
        password: encryptedPassword || existingPass || ''
      };
    }

    // Şifre girilmişse kalıcı şifreli kasaya (.work/smtp-vault.json) da yedekle
    const finalStored = this.state.smtp_configs.find(c => c.tenant_id === config.tenant_id)!;
    if (this.filePath && finalStored.password && finalStored.password.length > 0) {
      const vaultPath = this.getSmtpVaultPath();
      if (vaultPath) {
        try {
          fs.writeFileSync(vaultPath, JSON.stringify({
            ...finalStored,
            encrypted_password: finalStored.password
          }, null, 2), 'utf-8');
        } catch { }
      }
    }

    this.save();
    return this.getSmtpConfig(config.tenant_id)!;
  }

  // --- Scheduled Reports ---
  public getScheduledReports(tenant_id: UUID): ScheduledReportJob[] {
    if (!Array.isArray(this.state.scheduled_reports)) this.state.scheduled_reports = [];
    return this.state.scheduled_reports.filter(j => j.tenant_id === tenant_id);
  }

  public getScheduledReportById(tenant_id: UUID, id: UUID): ScheduledReportJob | undefined {
    if (!Array.isArray(this.state.scheduled_reports)) this.state.scheduled_reports = [];
    return this.state.scheduled_reports.find(j => j.tenant_id === tenant_id && j.id === id);
  }

  public insertScheduledReport(job: ScheduledReportJob): ScheduledReportJob {
    if (!Array.isArray(this.state.scheduled_reports)) this.state.scheduled_reports = [];
    this.state.scheduled_reports.push(job);
    this.save();
    return job;
  }

  public updateScheduledReport(tenant_id: UUID, id: UUID, updates: Partial<ScheduledReportJob>): ScheduledReportJob | undefined {
    if (!Array.isArray(this.state.scheduled_reports)) this.state.scheduled_reports = [];
    const job = this.state.scheduled_reports.find(j => j.tenant_id === tenant_id && j.id === id);
    if (!job) return undefined;
    Object.assign(job, updates);
    this.save();
    return job;
  }

  public deleteScheduledReport(tenant_id: UUID, id: UUID): boolean {
    if (!Array.isArray(this.state.scheduled_reports)) this.state.scheduled_reports = [];
    const idx = this.state.scheduled_reports.findIndex(j => j.tenant_id === tenant_id && j.id === id);
    if (idx === -1) return false;
    this.state.scheduled_reports.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Email Outbox & Actionable Cards Log ---
  public getEmailOutbox(tenant_id: UUID, limit = 50): EmailOutboxItem[] {
    if (!Array.isArray(this.state.email_outbox)) this.state.email_outbox = [];
    return this.state.email_outbox
      .filter(e => e.tenant_id === tenant_id)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .slice(0, limit);
  }

  public getEmailOutboxById(tenant_id: UUID, id: UUID): EmailOutboxItem | undefined {
    if (!Array.isArray(this.state.email_outbox)) this.state.email_outbox = [];
    return this.state.email_outbox.find(e => e.tenant_id === tenant_id && e.id === id);
  }

  public insertEmailOutbox(item: EmailOutboxItem): EmailOutboxItem {
    if (!Array.isArray(this.state.email_outbox)) this.state.email_outbox = [];
    this.state.email_outbox.push(item);
    this.save();
    return item;
  }

  public updateEmailOutbox(tenant_id: UUID, id: UUID, updates: Partial<EmailOutboxItem>): EmailOutboxItem | undefined {
    if (!Array.isArray(this.state.email_outbox)) this.state.email_outbox = [];
    const item = this.state.email_outbox.find(e => e.tenant_id === tenant_id && e.id === id);
    if (!item) return undefined;
    Object.assign(item, updates);
    this.save();
    return item;
  }

  // --- Backups & Disaster Recovery ---
  public getBackupScheduleConfig(tenant_id: UUID): BackupScheduleConfig {
    return this.state.backup_schedules?.[tenant_id] || {
      daily_enabled: true,
      daily_time: '23:00',
      daily_retention_days: 14,
      weekly_enabled: true,
      weekly_day: 0, // Sunday
      weekly_time: '22:00',
      weekly_retention_weeks: 8,
      notify_email: ''
    };
  }

  public saveBackupScheduleConfig(tenant_id: UUID, cfg: BackupScheduleConfig): void {
    if (!this.state.backup_schedules) this.state.backup_schedules = {};
    this.state.backup_schedules[tenant_id] = cfg;
    this.save();
  }

  public getBackupList(tenant_id: UUID): BackupMetadata[] {
    return (this.state.backups || [])
      .filter(b => b.tenant_id === tenant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getBackupById(tenant_id: UUID, id: UUID): BackupMetadata | undefined {
    return (this.state.backups || []).find(b => b.tenant_id === tenant_id && b.id === id);
  }

  public addBackupRecord(meta: BackupMetadata): void {
    if (!this.state.backups) this.state.backups = [];
    this.state.backups.push(meta);
    this.save();
  }

  public deleteBackupRecord(tenant_id: UUID, id: UUID): void {
    if (!this.state.backups) return;
    this.state.backups = this.state.backups.filter(b => !(b.tenant_id === tenant_id && b.id === id));
    this.save();
  }

  /**
   * Tam Sistem Geri Yükleme: Tenant'a ait tüm verileri yedek paketindeki verilerle değiştirir
   */
  public restoreFullState(tenant_id: UUID, payload: BackupPayload): void {
    this.state.projects = this.state.projects.filter(p => p.tenant_id !== tenant_id).concat(payload.projects || []);
    this.state.tasks = this.state.tasks.filter(t => t.tenant_id !== tenant_id).concat(payload.tasks || []);
    this.state.task_assignments = this.state.task_assignments.filter(a => a.tenant_id !== tenant_id).concat(payload.task_assignments || []);
    this.state.task_dependencies = this.state.task_dependencies.filter(d => d.tenant_id !== tenant_id).concat(payload.task_dependencies || []);
    this.state.task_plan_changes = this.state.task_plan_changes.filter(c => c.tenant_id !== tenant_id).concat(payload.task_plan_changes || []);
    this.state.delay_records = this.state.delay_records.filter(r => r.tenant_id !== tenant_id).concat(payload.delay_records || []);
    this.state.project_members = this.state.project_members.filter(m => m.tenant_id !== tenant_id).concat(payload.project_members || []);
    this.state.project_plan_changes = this.state.project_plan_changes.filter(c => c.tenant_id !== tenant_id).concat(payload.project_plan_changes || []);
    this.state.visibility_requests = this.state.visibility_requests.filter(v => v.tenant_id !== tenant_id).concat(payload.visibility_requests || []);

    if (payload.users && payload.users.length > 0) {
      const existingUserMap = new Map(this.state.users.map(u => [u.id, u]));
      for (const u of payload.users) {
        if (existingUserMap.has(u.id)) {
          const current = existingUserMap.get(u.id)!;
          Object.assign(current, u);
        } else {
          this.state.users.push(u);
        }
      }
    }

    this.save();
  }

  /**
   * Tekil Proje Kurtarma: Diğer projelere dokunmadan yalnızca hedef projeyi ve bağlı verilerini geri yükler
   */
  public restoreSingleProject(tenant_id: UUID, projectId: UUID, payload: BackupPayload): boolean {
    const backupProject = (payload.projects || []).find(p => p.id === projectId);
    if (!backupProject) return false;

    // 1. Mevcut projeyi ve bağlı verilerini temizle
    this.state.projects = this.state.projects.filter(p => !(p.tenant_id === tenant_id && p.id === projectId));
    const oldProjectTaskIds = new Set(
      this.state.tasks.filter(t => t.tenant_id === tenant_id && t.project_id === projectId).map(t => t.id)
    );
    this.state.tasks = this.state.tasks.filter(t => !(t.tenant_id === tenant_id && t.project_id === projectId));
    this.state.task_assignments = this.state.task_assignments.filter(a => !(a.tenant_id === tenant_id && oldProjectTaskIds.has(a.task_id)));
    this.state.task_dependencies = this.state.task_dependencies.filter(d => !(d.tenant_id === tenant_id && (oldProjectTaskIds.has(d.predecessor_id) || oldProjectTaskIds.has(d.successor_id))));
    this.state.task_plan_changes = this.state.task_plan_changes.filter(c => !(c.tenant_id === tenant_id && oldProjectTaskIds.has(c.task_id)));
    this.state.delay_records = this.state.delay_records.filter(r => !(r.tenant_id === tenant_id && oldProjectTaskIds.has(r.task_id)));
    this.state.project_members = this.state.project_members.filter(m => !(m.tenant_id === tenant_id && m.project_id === projectId));
    this.state.project_plan_changes = this.state.project_plan_changes.filter(c => !(c.tenant_id === tenant_id && c.project_id === projectId));
    this.state.visibility_requests = this.state.visibility_requests.filter(v => !(v.tenant_id === tenant_id && v.project_id === projectId));

    // 2. Yedekten hedef projeyi ve bağlı verilerini yükle
    this.state.projects.push(backupProject);
    const backupTasks = (payload.tasks || []).filter(t => t.project_id === projectId);
    const backupTaskIds = new Set(backupTasks.map(t => t.id));
    this.state.tasks.push(...backupTasks);

    const backupAssignments = (payload.task_assignments || []).filter(a => backupTaskIds.has(a.task_id));
    this.state.task_assignments.push(...backupAssignments);

    const backupDeps = (payload.task_dependencies || []).filter(d => backupTaskIds.has(d.predecessor_id) || backupTaskIds.has(d.successor_id));
    this.state.task_dependencies.push(...backupDeps);

    const backupPlanChanges = (payload.task_plan_changes || []).filter(c => backupTaskIds.has(c.task_id));
    this.state.task_plan_changes.push(...backupPlanChanges);

    const backupDelays = (payload.delay_records || []).filter(r => backupTaskIds.has(r.task_id));
    this.state.delay_records.push(...backupDelays);

    const backupMembers = (payload.project_members || []).filter(m => m.project_id === projectId);
    this.state.project_members.push(...backupMembers);

    const backupProjPlanChanges = (payload.project_plan_changes || []).filter(c => c.project_id === projectId);
    this.state.project_plan_changes.push(...backupProjPlanChanges);

    const backupVis = (payload.visibility_requests || []).filter(v => v.project_id === projectId);
    this.state.visibility_requests.push(...backupVis);

    this.save();
    return true;
  }
}
