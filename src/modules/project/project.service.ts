import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  Project,
  ProjectMember,
  ProjectPlanChange,
  ProjectRole,
  VisibilityRequest,
  UUID
} from '../../core/types.js';

export class ProjectService {
  constructor(private db: Database) {}

  public createProject(
    auth: AuthContext,
    title: string,
    description: string,
    initial_start_date: string,
    initial_due_date: string
  ): Project {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (user && user.system_role !== 'ADMIN' && !user.can_create_project) {
      throw new Error('Yetkisiz İşlem: Yeni proje oluşturma yetkiniz bulunmamaktadır. Lütfen Sistem Yöneticisi (Admin) ile iletişime geçiniz.');
    }

    const project: Project = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      title,
      description,
      initial_start_date,
      initial_due_date,
      current_start_date: initial_start_date,
      current_due_date: initial_due_date,
      created_by_user_id: auth.user_id,
      created_at: new Date().toISOString()
    };

    this.db.insertProject(project);

    // Projeyi oluşturan kullanıcı otomatik olarak PROJECT_MANAGER olur
    this.db.insertProjectMember({
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      project_id: project.id,
      user_id: auth.user_id,
      role: 'PROJECT_MANAGER',
      assigned_at: new Date().toISOString()
    });

    return project;
  }

  public getProject(auth: AuthContext, project_id: UUID): Project | undefined {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) return undefined;
    return project;
  }

  public listProjects(auth: AuthContext): Project[] {
    // Kullanıcının yetkili olduğu projeler
    const all = this.db.getProjects(auth.tenant_id);
    return all.filter(p => this.canViewProject(auth, p.id));
  }

  public updateProjectPlan(
    auth: AuthContext,
    project_id: UUID,
    new_start_date: string,
    new_due_date: string,
    reason?: string
  ): Project {
    if (!this.canManageProject(auth, project_id)) {
      throw new Error('Yetersiz Yetki: Proje planını yalnızca Proje Yöneticisi güncelleyebilir.');
    }

    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) {
      throw new Error(`Proje bulunamadı: ${project_id}`);
    }

    // Plan değişiklik geçmişini kaydet (Şartname v0.3: İlk plan korunur!)
    const change: ProjectPlanChange = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      project_id,
      previous_start_date: project.current_start_date,
      previous_due_date: project.current_due_date,
      new_start_date,
      new_due_date,
      changed_by_user_id: auth.user_id,
      changed_at: new Date().toISOString(),
      reason
    };
    this.db.insertProjectPlanChange(change);

    // Güncel planı güncelle, ilk plan değişmez!
    const updated = this.db.updateProject(auth.tenant_id, project_id, {
      current_start_date: new_start_date,
      current_due_date: new_due_date
    });

    return updated!;
  }

  public addOrUpdateMember(
    auth: AuthContext,
    project_id: UUID,
    target_user_id: UUID,
    role: ProjectRole
  ): ProjectMember {
    if (!this.canManageProject(auth, project_id)) {
      throw new Error('Yetersiz Yetki: Üyelik ve rol yönetimi Proje Yöneticisi yetkisindedir.');
    }

    const existing = this.db.getProjectMember(auth.tenant_id, project_id, target_user_id);
    if (existing) {
      return this.db.updateProjectMember(auth.tenant_id, project_id, target_user_id, role)!;
    }

    const member: ProjectMember = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      project_id,
      user_id: target_user_id,
      role,
      assigned_at: new Date().toISOString()
    };
    return this.db.insertProjectMember(member);
  }

  public getMembers(auth: AuthContext, project_id: UUID): ProjectMember[] {
    // Sorumlu üye listesine doğrudan erişemez (KAB02)
    const member = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    if (!member) {
      throw new Error('[KAB02] Yetersiz Yetki: Proje üye listesini yalnızca proje üyeleri görebilir.');
    }
    return this.db.getProjectMembers(auth.tenant_id, project_id);
  }

  // --- Görünürlük Talepleri (KAB03) ---
  public requestVisibility(auth: AuthContext, project_id: UUID): VisibilityRequest {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) throw new Error('Proje bulunamadı.');

    const req: VisibilityRequest = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      project_id,
      user_id: auth.user_id,
      request_time: new Date().toISOString(),
      status: 'PENDING'
    };
    return this.db.insertVisibilityRequest(req);
  }

  public decideVisibilityRequest(
    auth: AuthContext,
    request_id: UUID,
    approve: boolean
  ): VisibilityRequest {
    const req = this.db.getVisibilityRequestById(auth.tenant_id, request_id);
    if (!req) throw new Error('Talep bulunamadı.');

    if (!this.canManageProject(auth, req.project_id)) {
      throw new Error('Yetersiz Yetki: Görünürlük talebini yalnızca Proje Yöneticisi onaylayabilir.');
    }

    const updated = this.db.updateVisibilityRequest(auth.tenant_id, request_id, {
      status: approve ? 'APPROVED' : 'REJECTED',
      decided_by_user_id: auth.user_id,
      decided_at: new Date().toISOString()
    });

    if (approve) {
      // Onaylanınca kullanıcı VIEWER rolü kazanır
      this.addOrUpdateMember(auth, req.project_id, req.user_id, 'VIEWER');
    }

    return updated!;
  }

  public getVisibilityRequests(auth: AuthContext, project_id: UUID): VisibilityRequest[] {
    if (!this.canManageProject(auth, project_id)) {
      return this.db.getVisibilityRequests(auth.tenant_id, project_id).filter(r => r.user_id === auth.user_id);
    }
    return this.db.getVisibilityRequests(auth.tenant_id, project_id);
  }

  // --- Yetki Kontrol Metotları ---
  public canManageProject(auth: AuthContext, project_id: UUID): boolean {
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return m?.role === 'PROJECT_MANAGER';
  }

  public canEditTasks(auth: AuthContext, project_id: UUID): boolean {
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return m?.role === 'PROJECT_MANAGER' || m?.role === 'EDITOR';
  }

  public canViewProject(auth: AuthContext, project_id: UUID): boolean {
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    if (m) return true;

    // Sorumlu olduğu en az 1 görev varsa görebilir (ancak sadece kendi görevini ve sınırlı bağımlılık özetini KAB02)
    const tasks = this.db.getTasks(auth.tenant_id, project_id);
    const hasAssignedTask = tasks.some(t => t.assignee_id === auth.user_id);
    return hasAssignedTask;
  }

  public isFullProjectViewer(auth: AuthContext, project_id: UUID): boolean {
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return !!m; // PROJECT_MANAGER, EDITOR, or VIEWER
  }
}
