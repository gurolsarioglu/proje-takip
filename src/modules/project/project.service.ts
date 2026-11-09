import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  Project,
  ProjectMember,
  ProjectPlanChange,
  ProjectRole,
  VisibilityRequest,
  Customer,
  CustomerStatsDTO,
  MasterProject,
  UUID
} from '../../core/types.js';

export class ProjectService {
  constructor(private db: Database) {}

  public createProject(
    auth: AuthContext,
    title: string,
    description: string,
    initial_start_date: string,
    initial_due_date: string,
    customer_id?: UUID,
    customer_name?: string,
    master_project_id?: UUID,
    master_project_title?: string,
    timeline_period?: string,
    parent_project_id?: UUID
  ): Project {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (user && user.system_role !== 'ADMIN' && !user.can_create_project) {
      throw new Error('Yetkisiz İşlem: Yeni proje oluşturma yetkiniz bulunmamaktadır. Lütfen Sistem Yöneticisi (Admin) ile iletişime geçiniz.');
    }

    let resolvedParentTitle: string | undefined = undefined;
    let resolvedCustomerId = customer_id;
    let resolvedCustomerName = customer_name;
    let resolvedMasterId = master_project_id;
    let resolvedMasterTitle = master_project_title;

    if (parent_project_id) {
      const parentProj = this.db.getProjectById(auth.tenant_id, parent_project_id);
      if (parentProj) {
        resolvedParentTitle = parentProj.title;
        if (!resolvedCustomerId) resolvedCustomerId = parentProj.customer_id;
        if (!resolvedCustomerName) resolvedCustomerName = parentProj.customer_name;
        if (!resolvedMasterId) resolvedMasterId = parentProj.master_project_id;
        if (!resolvedMasterTitle) resolvedMasterTitle = parentProj.master_project_title;
      }
    }

    if (resolvedCustomerId && !resolvedCustomerName) {
      const cust = this.db.getCustomerById(auth.tenant_id, resolvedCustomerId);
      if (cust) resolvedCustomerName = cust.name;
    }

    if (resolvedMasterId && !resolvedMasterTitle) {
      const mp = this.db.getMasterProjectById(auth.tenant_id, resolvedMasterId);
      if (mp) resolvedMasterTitle = mp.title;
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
      created_at: new Date().toISOString(),
      customer_id: resolvedCustomerId || undefined,
      customer_name: resolvedCustomerName || undefined,
      master_project_id: resolvedMasterId || undefined,
      master_project_title: resolvedMasterTitle || undefined,
      parent_project_id: parent_project_id || undefined,
      parent_project_title: resolvedParentTitle || undefined,
      is_main_project: !parent_project_id,
      timeline_period: timeline_period || undefined
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

  public getProject(auth: AuthContext, project_id: UUID, allowDeleted = false): Project | undefined {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) return undefined;
    if (project.is_deleted && !allowDeleted && !this.isTenantAdmin(auth)) {
      return undefined;
    }
    return project;
  }

  public listProjects(auth: AuthContext, includeDeleted = false): Project[] {
    // Kullanıcının yetkili olduğu projeler (varsayılan olarak silinmemiş olanlar)
    const all = this.db.getProjects(auth.tenant_id);
    const filtered = all.filter(p => includeDeleted ? true : !p.is_deleted);
    const visible = filtered.filter(p => this.canViewProject(auth, p.id));
    return visible.map(p => {
      const subCount = all.filter(sub => !sub.is_deleted && sub.parent_project_id === p.id).length;
      return {
        ...p,
        is_main_project: !p.parent_project_id,
        sub_projects_count: subCount
      };
    });
  }

  public listDeletedProjects(auth: AuthContext): Project[] {
    if (!this.isTenantAdmin(auth)) {
      throw new Error('Yetersiz Yetki: Silinen projeleri yalnızca Sistem Yöneticisi (Admin) görüntüleyebilir.');
    }
    const all = this.db.getProjects(auth.tenant_id);
    return all.filter(p => p.is_deleted === true);
  }

  public deleteProject(auth: AuthContext, project_id: UUID): Project {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) {
      throw new Error(`Proje bulunamadı: ${project_id}`);
    }
    if (!this.canManageProject(auth, project_id)) {
      throw new Error('Yetersiz Yetki: Projeyi yalnızca Proje Yöneticisi veya Sistem Yöneticisi silebilir.');
    }
    if (project.is_deleted) {
      return project;
    }

    const updated = this.db.updateProject(auth.tenant_id, project_id, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: auth.user_id
    });
    return updated!;
  }

  public restoreProject(auth: AuthContext, project_id: UUID): Project {
    if (!this.isTenantAdmin(auth)) {
      throw new Error('Yetersiz Yetki: Silinen bir projeyi yalnızca Sistem Yöneticisi (Admin) geri getirebilir.');
    }
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) {
      throw new Error(`Proje bulunamadı: ${project_id}`);
    }

    const updated = this.db.updateProject(auth.tenant_id, project_id, {
      is_deleted: false,
      deleted_at: undefined,
      deleted_by_user_id: undefined
    });
    return updated!;
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

    const targetUser = this.db.getUserById(auth.tenant_id, target_user_id);
    if (targetUser && targetUser.is_active === false) {
      throw new Error(`Seçilen personel (${targetUser.name}) devre dışı bırakıldığı için projeye eklenemez.`);
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
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (user?.system_role === 'ADMIN') {
      return this.db.getProjectMembers(auth.tenant_id, project_id);
    }
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
  private isTenantAdmin(auth: AuthContext): boolean {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    return user?.system_role === 'ADMIN';
  }

  public canManageProject(auth: AuthContext, project_id: UUID): boolean {
    if (this.isTenantAdmin(auth)) return true;
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (project && project.created_by_user_id === auth.user_id) return true;
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return m?.role === 'PROJECT_MANAGER';
  }

  public canEditTasks(auth: AuthContext, project_id: UUID): boolean {
    if (this.isTenantAdmin(auth)) return true;
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return m?.role === 'PROJECT_MANAGER' || m?.role === 'EDITOR';
  }

  public canViewProject(auth: AuthContext, project_id: UUID): boolean {
    if (this.isTenantAdmin(auth)) return true;
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    if (m) return true;

    // Sorumlu olduğu en az 1 görev varsa görebilir (ancak sadece kendi görevini ve sınırlı bağımlılık özetini KAB02)
    const tasks = this.db.getTasks(auth.tenant_id, project_id);
    const hasAssignedTask = tasks.some(t => t.assignee_id === auth.user_id);
    return hasAssignedTask;
  }

  public isFullProjectViewer(auth: AuthContext, project_id: UUID): boolean {
    if (this.isTenantAdmin(auth)) return true;
    const m = this.db.getProjectMember(auth.tenant_id, project_id, auth.user_id);
    return !!m; // PROJECT_MANAGER, EDITOR, or VIEWER
  }

  // ================= MÜŞTERİ YÖNETİMİ & PERFORMANS ANALİZİ =================

  public listCustomers(auth: AuthContext): Customer[] {
    return this.db.getCustomers(auth.tenant_id);
  }

  public getCustomer(auth: AuthContext, customer_id: UUID): Customer | undefined {
    return this.db.getCustomerById(auth.tenant_id, customer_id);
  }

  public createCustomer(
    auth: AuthContext,
    name: string,
    code?: string,
    description?: string,
    contact_person?: string,
    contact_email?: string
  ): Customer {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    const isManagerOrAdmin = user?.system_role === 'ADMIN' || !!user?.can_create_project;
    if (!isManagerOrAdmin) {
      throw new Error('Yetkisiz İşlem: Müşteri tanımlama yetkisi yalnızca Proje Yöneticisi ve Sistem Yöneticisi (Admin) rollerine aittir.');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Müşteri adı zorunludur.');
    }

    const trimmedName = name.trim();
    const existing = this.db.getCustomers(auth.tenant_id).find(
      c => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      throw new Error(`"${trimmedName}" isimli müşteri zaten sistemde kayıtlıdır.`);
    }

    const customer: Customer = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      name: trimmedName,
      code: code ? code.trim().toUpperCase() : undefined,
      description: description ? description.trim() : undefined,
      contact_person: contact_person ? contact_person.trim() : undefined,
      contact_email: contact_email ? contact_email.trim() : undefined,
      is_active: true,
      created_by_user_id: auth.user_id,
      created_at: new Date().toISOString()
    };

    return this.db.insertCustomer(customer);
  }

  public updateCustomer(
    auth: AuthContext,
    customer_id: UUID,
    updates: Partial<Customer>
  ): Customer {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    const isManagerOrAdmin = user?.system_role === 'ADMIN' || !!user?.can_create_project;
    if (!isManagerOrAdmin) {
      throw new Error('Yetkisiz İşlem: Müşteri güncelleme yetkisi yalnızca Proje Yöneticisi ve Sistem Yöneticisi (Admin) rollerine aittir.');
    }

    const existing = this.db.getCustomerById(auth.tenant_id, customer_id);
    if (!existing) {
      throw new Error(`Müşteri bulunamadı: ${customer_id}`);
    }

    const updated = this.db.updateCustomer(auth.tenant_id, customer_id, updates);
    return updated!;
  }

  public updateProjectCustomer(
    auth: AuthContext,
    project_id: UUID,
    customer_id?: UUID
  ): Project {
    if (!this.canManageProject(auth, project_id)) {
      throw new Error('Yetkisiz İşlem: Projenin müşterisini yalnızca Proje Yöneticisi veya Sistem Yöneticisi değiştirebilir.');
    }

    let customer_name: string | undefined = undefined;
    if (customer_id) {
      const cust = this.db.getCustomerById(auth.tenant_id, customer_id);
      if (cust) customer_name = cust.name;
    }

    const updated = this.db.updateProject(auth.tenant_id, project_id, {
      customer_id: customer_id || undefined,
      customer_name: customer_name || undefined
    });

    if (!updated) {
      throw new Error(`Proje bulunamadı: ${project_id}`);
    }
    return updated;
  }

  public getCustomerStats(auth: AuthContext): CustomerStatsDTO[] {
    const customers = this.db.getCustomers(auth.tenant_id);
    const allProjects = this.db.getProjects(auth.tenant_id).filter(p => !p.is_deleted);
    const allTasks = this.db.getTasks(auth.tenant_id);
    const now = new Date();

    return customers.map(c => {
      // Müşteriye ait projeler (customer_id eşleşmesi veya başlıkta müşteri adı geçmesi)
      const cProjects = allProjects.filter(p =>
        p.customer_id === c.id ||
        (!p.customer_id && p.title.toUpperCase().includes(c.name.toUpperCase()))
      );
      const total_projects = cProjects.length;

      let total_tasks = 0;
      let completed_tasks = 0;
      let delayed_tasks = 0;
      let completed_projects = 0;
      let total_progress_sum = 0;

      for (const p of cProjects) {
        const pTasks = allTasks.filter(t => t.project_id === p.id);
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter(t => t.work_status === 'COMPLETED').length;
        const pDelayed = pTasks.filter(t => t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < now).length;

        total_tasks += pTotal;
        completed_tasks += pCompleted;
        delayed_tasks += pDelayed;

        const pProgress = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
        total_progress_sum += pProgress;

        if (pTotal > 0 && pCompleted === pTotal) {
          completed_projects++;
        }
      }

      const active_projects = total_projects - completed_projects;
      const avg_progress = total_projects > 0 ? Math.round(total_progress_sum / total_projects) : 0;

      // Başarı Oranı: Zamanında teslim edilen ve tamamlanan işlerin ağırlıklı yüzdesi
      let success_rate = 0;
      if (total_tasks > 0) {
        const completionComponent = (completed_tasks / total_tasks) * 70;
        const onTimeRatio = Math.max(0, 1 - (delayed_tasks / total_tasks));
        const onTimeComponent = onTimeRatio * 30;
        success_rate = Math.round(Math.max(0, Math.min(100, completionComponent + onTimeComponent)));
      } else if (total_projects > 0) {
        success_rate = 100;
      }

      return {
        ...c,
        total_projects,
        active_projects,
        completed_projects,
        total_tasks,
        completed_tasks,
        delayed_tasks,
        avg_progress,
        success_rate
      };
    });
  }

  // --- Ana Proje / Çatı Program (Master Projects) ---
  public listMasterProjects(auth: AuthContext): MasterProject[] {
    return this.db.getMasterProjects(auth.tenant_id);
  }

  public getMasterProject(auth: AuthContext, id: UUID): MasterProject | undefined {
    return this.db.getMasterProjectById(auth.tenant_id, id);
  }

  public createMasterProject(
    auth: AuthContext,
    title: string,
    year: number,
    description?: string,
    start_date?: string,
    due_date?: string
  ): MasterProject {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    const isProjManager = this.db.getProjectMembers(auth.tenant_id).some(m => m.user_id === auth.user_id && m.role === 'PROJECT_MANAGER');
    if (user && user.system_role !== 'ADMIN' && !user.can_create_project && !isProjManager) {
      throw new Error('Yetkisiz İşlem: Çatı Yılı / Program oluşturma yetkiniz bulunmamaktadır. Yalnızca Proje Yöneticisi veya Sistem Yöneticisi ekleyebilir.');
    }

    const trimmed = (title || '').trim();
    if (!trimmed) throw new Error('Ana proje başlığı zorunludur.');

    const mp: MasterProject = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      title: trimmed,
      year: year || 2026,
      description: description?.trim() || undefined,
      start_date: start_date || `${year || 2026}-01-01`,
      due_date: due_date || `${year || 2026}-12-31`,
      is_active: true,
      created_by_user_id: auth.user_id,
      created_at: new Date().toISOString()
    };

    return this.db.insertMasterProject(mp);
  }
}
