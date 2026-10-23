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
  TaskDependency,
  DelayRecord,
  Notification,
  PushSubscriptionData,
  UUID
} from '../core/types.js';

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
  task_dependencies: TaskDependency[];
  delay_records: DelayRecord[];
  notifications: Notification[];
  push_subscriptions: PushSubscriptionData[];
}

export class Database {
  private state: DatabaseState;
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.state = this.getInitialState();
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.state = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to load DB file, initializing clean state.', e);
      }
    }
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
      task_dependencies: [],
      delay_records: [],
      notifications: [],
      push_subscriptions: []
    };
  }

  public reset(): void {
    this.state = this.getInitialState();
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
  public insertUser(user: User): User {
    this.state.users.push(user);
    this.save();
    return user;
  }

  // --- Projects ---
  public getProjects(tenant_id: UUID): Project[] {
    return this.state.projects.filter(p => p.tenant_id === tenant_id);
  }
  public getProjectById(tenant_id: UUID, id: UUID): Project | undefined {
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
  public getProjectMembers(tenant_id: UUID, project_id: UUID): ProjectMember[] {
    return this.state.project_members.filter(m => m.tenant_id === tenant_id && m.project_id === project_id);
  }
  public getProjectMember(tenant_id: UUID, project_id: UUID, user_id: UUID): ProjectMember | undefined {
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
}
