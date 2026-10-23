import { Database } from '../../database/db.js';
import {
  AuthContext,
  ProjectReport,
  UserPerformanceReport,
  UUID
} from '../../core/types.js';
import { ProjectService } from '../project/project.service.js';

export class ReportingService {
  constructor(
    private db: Database,
    private projectService: ProjectService
  ) {}

  /**
   * Proje Raporu (RAP01 & RAP06)
   * İlk planı, güncel planı ve gerçekleşeni yan yana gösterir.
   */
  public getProjectReport(
    auth: AuthContext,
    project_id: UUID,
    cutoffTimeIso?: string
  ): ProjectReport {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) throw new Error('Proje bulunamadı.');

    if (!this.projectService.canViewProject(auth, project_id)) {
      throw new Error('[KAB01] Yetkisiz Erişim: Bu projenin raporunu görüntüleme hakkınız yok.');
    }

    const cutoff = cutoffTimeIso ? new Date(cutoffTimeIso) : new Date();
    const tasks = this.db.getTasks(auth.tenant_id, project_id);

    // Gerçekleşen Başlangıç: İlk başlayan görevin başlangıcı (yoksa null)
    let actualStart: Date | null = null;
    for (const t of tasks) {
      if (t.actual_start_date) {
        const d = new Date(t.actual_start_date);
        if (!actualStart || d < actualStart) {
          actualStart = d;
        }
      }
    }

    // Gerçekleşen Bitiş: Bütün görevler tamamlandıysa son tamamlanma zamanı (RAP06)
    let actualFinish: Date | null = null;
    const allCompleted = tasks.length > 0 && tasks.every(t => t.work_status === 'COMPLETED');

    if (allCompleted) {
      for (const t of tasks) {
        if (t.actual_completion_date) {
          const d = new Date(t.actual_completion_date);
          if (!actualFinish || d > actualFinish) {
            actualFinish = d;
          }
        }
      }
    }

    const completedTasks = tasks.filter(t => t.work_status === 'COMPLETED').length;
    const openTasks = tasks.filter(t => t.work_status !== 'COMPLETED').length;
    const delayedTasks = tasks.filter(t => {
      if (t.work_status === 'COMPLETED') {
        return t.actual_completion_date ? new Date(t.actual_completion_date) > new Date(t.current_due_date) : false;
      }
      return new Date(t.current_due_date) < cutoff;
    }).length;

    const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    return {
      project_id: project.id,
      title: project.title,
      initial_start_date: project.initial_start_date,
      initial_due_date: project.initial_due_date,
      current_start_date: project.current_start_date,
      current_due_date: project.current_due_date,
      actual_start_date: actualStart ? actualStart.toISOString() : null,
      actual_finish_date: actualFinish ? actualFinish.toISOString() : null,
      total_tasks: tasks.length,
      completed_tasks: completedTasks,
      open_tasks: openTasks,
      delayed_tasks: delayedTasks,
      completion_rate: completionRate,
      cutoff_time: cutoff.toISOString()
    };
  }

  /**
   * Kullanıcı Performans Puanı ve Raporu (RAP01-RAP07 & Şartname v0.3)
   * Toplam performans puanı = 100 * (0.70 * Z + 0.30 * T)
   */
  public getUserPerformanceReport(
    auth: AuthContext,
    target_user_id: UUID,
    periodStartIso: string,
    periodEndIso: string,
    cutoffTimeIso?: string,
    project_id?: UUID
  ): UserPerformanceReport {
    // RAP07: Yönetici yalnız yönettiği projelerdeki kullanıcıları, kullanıcı kendisini görür
    if (auth.user_id !== target_user_id) {
      const managedProjects = this.db.getProjects(auth.tenant_id).filter(p => this.projectService.canManageProject(auth, p.id));
      const hasSharedManagement = managedProjects.some(p => {
        const members = this.db.getProjectMembers(auth.tenant_id, p.id);
        const tasks = this.db.getTasks(auth.tenant_id, p.id);
        return members.some(m => m.user_id === target_user_id) || tasks.some(t => t.assignee_id === target_user_id);
      });
      if (!hasSharedManagement) {
        throw new Error('[RAP07] Yetkisiz Erişim: Başka bir kullanıcının performans raporunu yalnızca ilgili proje yöneticisi görebilir.');
      }
    }

    const targetUser = this.db.getUserById(auth.tenant_id, target_user_id);
    if (!targetUser) throw new Error('Kullanıcı bulunamadı.');

    const pStart = new Date(periodStartIso);
    const pEnd = new Date(periodEndIso);
    const cutoff = cutoffTimeIso ? new Date(cutoffTimeIso) : new Date();

    const allTasks = this.db.getTasks(auth.tenant_id, project_id);
    const allAssignments = this.db.getTaskAssignments(auth.tenant_id);

    // 1. Atanan Görev Sayısı (Dönemde bu kullanıcıya atanan benzersiz görevler)
    const assignedTaskIds = new Set<UUID>();
    for (const a of allAssignments) {
      if (a.user_id === target_user_id) {
        const assignDate = new Date(a.assigned_at);
        if (assignDate >= pStart && assignDate < pEnd) {
          assignedTaskIds.add(a.task_id);
        }
      }
    }

    // 2. Tamamlanan İş Hacmi (Dönemde biten görevler; bitiş anındaki görev sorumlusuna yazılır - RAP02)
    let completedInPeriodCount = 0;
    for (const t of allTasks) {
      if (t.work_status === 'COMPLETED' && t.actual_completion_date) {
        const compDate = new Date(t.actual_completion_date);
        if (compDate >= pStart && compDate < pEnd) {
          // Bitiş anındaki sorumlu kim?
          const assigneeAtCompletion = this.getAssigneeAtTime(auth.tenant_id, t.id, compDate) || t.assignee_id;
          if (assigneeAtCompletion === target_user_id) {
            completedInPeriodCount++;
          }
        }
      }
    }

    // 3. Hedef Kümesi H: İlk plan vadesi seçilen dönemde [pStart, pEnd) bulunan ve kesim anında vadesi gelmiş görevler
    // Vade anındaki sorumlu esas alınır (RAP02)
    const eligibleHTasks: typeof allTasks = [];
    for (const t of allTasks) {
      const initDue = new Date(t.initial_due_date);
      // İlk plan vadesi dönemde mi ve kesim anına kadar vadesi gelmiş mi?
      if (initDue >= pStart && initDue < pEnd && initDue <= cutoff) {
        const assigneeAtDue = this.getAssigneeAtTime(auth.tenant_id, t.id, initDue) || t.assignee_id;
        if (assigneeAtDue === target_user_id) {
          eligibleHTasks.push(t);
        }
      }
    }

    // 4. S Kümesi: H içinden, gecikmesinin bütünüyle bağımlılıktan kaynaklandığı kanıtlanan görevler çıkarılır (RAP04)
    let excludedDependencyCount = 0;
    const eligibleSTasks: typeof allTasks = [];

    for (const t of eligibleHTasks) {
      const delays = this.db.getDelayRecords(auth.tenant_id, t.id);
      const isPurelyDependencyBlocked = delays.some(d => d.cause_class === 'DEPENDENCY_BLOCKED');

      if (isPurelyDependencyBlocked) {
        excludedDependencyCount++;
      } else {
        eligibleSTasks.push(t);
      }
    }

    // 5. Puanlama Formülü: 100 * (0.70 * Z + 0.30 * T)
    let zRatio: number | null = null;
    let tRatio: number | null = null;
    let score: number | null = null;
    let scoreDisplay = 'Hesaplanamıyor';

    let onTimeCompletedCount = 0;

    if (eligibleSTasks.length > 0) {
      let onTimeInS = 0;
      let completedInS = 0;

      for (const t of eligibleSTasks) {
        const initDue = new Date(t.initial_due_date);
        const isCompleted = t.work_status === 'COMPLETED' && t.actual_completion_date;

        if (isCompleted) {
          const compDate = new Date(t.actual_completion_date!);
          if (compDate <= cutoff) {
            completedInS++;
          }
          if (compDate <= initDue) {
            onTimeInS++;
            onTimeCompletedCount++;
          }
        }
      }

      zRatio = onTimeInS / eligibleSTasks.length;
      tRatio = completedInS / eligibleSTasks.length;
      score = Math.round(100 * (0.70 * zRatio + 0.30 * tRatio));
      scoreDisplay = `${score} / 100`;
    }

    // Açık ve gecikmiş işler (güncel sorumluya ait)
    const openAndDelayed = allTasks.filter(t => {
      return t.assignee_id === target_user_id &&
        t.work_status !== 'COMPLETED' &&
        new Date(t.initial_due_date) < cutoff;
    }).length;

    return {
      user_id: target_user_id,
      user_name: targetUser.name,
      assigned_tasks_count: assignedTaskIds.size,
      completed_tasks_count: completedInPeriodCount,
      on_time_completed_count: onTimeCompletedCount,
      open_and_delayed_count: openAndDelayed,
      total_date_deviation_days: 0,
      dependency_waiting_hours: 0,
      eligible_h_count: eligibleHTasks.length,
      excluded_dependency_count: excludedDependencyCount,
      eligible_s_count: eligibleSTasks.length,
      z_ratio: zRatio !== null ? Math.round(zRatio * 100) / 100 : null,
      t_ratio: tRatio !== null ? Math.round(tRatio * 100) / 100 : null,
      performance_score: score,
      score_display: scoreDisplay
    };
  }

  private getAssigneeAtTime(tenant_id: UUID, task_id: UUID, targetTime: Date): UUID | undefined {
    const assignments = this.db.getTaskAssignments(tenant_id, task_id);
    for (const a of assignments) {
      const assigned = new Date(a.assigned_at);
      const unassigned = a.unassigned_at ? new Date(a.unassigned_at) : null;
      if (assigned <= targetTime && (!unassigned || targetTime <= unassigned)) {
        return a.user_id;
      }
    }
    return undefined;
  }
}
