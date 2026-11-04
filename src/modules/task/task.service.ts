import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  Task,
  TaskAssignment,
  TaskPlanChange,
  WorkStatus,
  UUID
} from '../../core/types.js';
import { DependencyService } from '../dependency/dependency.service.js';
import { DelayService } from '../delay/delay.service.js';

export class TaskService {
  constructor(
    private db: Database,
    private dependencyService: DependencyService,
    private delayService: DelayService
  ) {}

  /**
   * Yeni Görev Oluşturma
   * Şartname v0.3: Yeni görev öncüllerine göre BLOCKED veya READY oluşturulur.
   */
  public createTask(
    auth: AuthContext,
    project_id: UUID | null | undefined,
    title: string,
    initial_start_date: string,
    initial_due_date: string,
    assignee_id?: UUID,
    description?: string,
    extra?: { type?: 'TASK' | 'MILESTONE' | 'BUG'; priority?: 'LOW' | 'NORMAL' | 'HIGH'; progress?: number }
  ): Task {
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    const normalizedProjectId = (project_id && project_id.trim() !== '') ? project_id : null;

    if (normalizedProjectId) {
      // Proje varlığı ve yetki kontrolü
      const proj = this.db.getProjectById(auth.tenant_id, normalizedProjectId);
      if (!proj) throw new Error('Belirtilen proje bulunamadı.');

      const currentUser = this.db.getUserById(auth.tenant_id, auth.user_id);
      const isFullAdmin = currentUser?.system_role === 'ADMIN';
      const isCreator = proj.created_by_user_id === auth.user_id;
      const canCreateProj = !!currentUser?.can_create_project;
      const member = this.db.getProjectMembers(auth.tenant_id, normalizedProjectId).find(m => m.user_id === auth.user_id);
      const isEditorOrManager = member && (member.role === 'PROJECT_MANAGER' || member.role === 'EDITOR');

      if (!isFullAdmin && !isCreator && !canCreateProj && !isEditorOrManager) {
        throw new Error('Bu projede görev oluşturma yetkiniz bulunmamaktadır. Standart kullanıcılar yalnızca bireysel görev / kişisel to-do açabilir.');
      }

      if (assignee_id) {
        const targetUser = this.db.getUserById(auth.tenant_id, assignee_id);
        if (targetUser && targetUser.is_active === false) {
          throw new Error(`Seçilen personel (${targetUser.name}) devre dışı bırakıldığı için kendisine görev atanamaz.`);
        }
      }
    } else {
      // Bireysel Görev / Kişisel To-Do: Sorumlu kişi daima görevi oluşturan personelin kendisidir
      assignee_id = auth.user_id;
    }

    const task: Task = {
      id: taskId,
      tenant_id: auth.tenant_id,
      project_id: normalizedProjectId,
      assignee_id,
      title,
      description,
      type: extra?.type || 'TASK',
      priority: extra?.priority || 'NORMAL',
      progress: extra?.progress ?? 0,
      work_status: 'READY', // Başlangıçta öncülü yoksa READY
      initial_start_date,
      initial_due_date,
      current_start_date: initial_start_date,
      current_due_date: initial_due_date,
      created_at: now
    };

    this.db.insertTask(task);

    if (assignee_id) {
      this.db.insertTaskAssignment({
        id: crypto.randomUUID(),
        tenant_id: auth.tenant_id,
        task_id: taskId,
        user_id: assignee_id,
        assigned_at: now,
        assigned_by_user_id: auth.user_id
      });
    }

    return task;
  }

  /**
   * Görev Atama (Geçmiş Atama Kayıtlarını Korur)
   */
  public assignTask(
    auth: AuthContext,
    task_id: UUID,
    new_assignee_id: UUID
  ): Task {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    if (new_assignee_id) {
      const targetUser = this.db.getUserById(auth.tenant_id, new_assignee_id);
      if (targetUser && targetUser.is_active === false) {
        throw new Error(`Seçilen personel (${targetUser.name}) devre dışı bırakıldığı için kendisine görev atanamaz.`);
      }
    }

    const now = new Date().toISOString();

    // Önceki açık atamayı kapat
    const currentAssignments = this.db.getTaskAssignments(auth.tenant_id, task_id);
    for (const a of currentAssignments) {
      if (!a.unassigned_at) {
        this.db.updateTaskAssignment(auth.tenant_id, a.id, { unassigned_at: now });
      }
    }

    // Yeni atama kaydı aç
    this.db.insertTaskAssignment({
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      task_id,
      user_id: new_assignee_id,
      assigned_at: now,
      assigned_by_user_id: auth.user_id
    });

    const updated = this.db.updateTask(auth.tenant_id, task_id, {
      assignee_id: new_assignee_id
    });

    return updated!;
  }

  /**
   * Görev Planı Değişikliği (İlk Plan Korunur!)
   */
  public updateTaskPlan(
    auth: AuthContext,
    task_id: UUID,
    new_start_date: string,
    new_due_date: string,
    reason?: string
  ): Task {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    const change: TaskPlanChange = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      task_id,
      previous_start_date: task.current_start_date,
      previous_due_date: task.current_due_date,
      new_start_date,
      new_due_date,
      changed_by_user_id: auth.user_id,
      changed_at: new Date().toISOString(),
      reason
    };
    this.db.insertTaskPlanChange(change);

    const updated = this.db.updateTask(auth.tenant_id, task_id, {
      current_start_date: new_start_date,
      current_due_date: new_due_date
    });

    return updated!;
  }

  /**
   * Görevi Başlatma (READY -> IN_PROGRESS)
   */
  public startTask(auth: AuthContext, task_id: UUID): Task {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    if (task.work_status === 'BLOCKED') {
      throw new Error('Görev Başlatılamaz: Öncül görevler tamamlanmadığı için görev BLOCKED durumundadır.');
    }

    if (task.work_status === 'COMPLETED') {
      throw new Error('Görev zaten tamamlanmıştır.');
    }

    const updated = this.db.updateTask(auth.tenant_id, task_id, {
      work_status: 'IN_PROGRESS',
      progress: task.progress && task.progress > 0 ? task.progress : 25,
      actual_start_date: task.actual_start_date || new Date().toISOString()
    });

    return updated!;
  }

  /**
   * Görevi Tamamlama (-> COMPLETED)
   * KAB10: Tamamlama sırasında güncel bitiş hedefi kontrol edilir; gecikme kaydı eksikse oluşturulur.
   * KAB05: Doğrudan ardıllar değerlendirilir, tüm öncülleri biten BLOCKED görev READY olur.
   */
  public completeTask(auth: AuthContext, task_id: UUID): { task: Task; newlyReadyTaskIds: UUID[] } {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    if (task.work_status === 'BLOCKED') {
      throw new Error('Öncülleri tamamlanmamış BLOCKED görev doğrudan tamamlanamaz.');
    }

    const completionTime = new Date().toISOString();

    const updatedTask = this.db.updateTask(auth.tenant_id, task_id, {
      work_status: 'COMPLETED',
      progress: 100,
      actual_completion_date: completionTime,
      completed_by_user_id: auth.user_id,
      actual_start_date: task.actual_start_date || completionTime
    })!;

    // KAB10: Güncel bitiş aşılmışsa gecikme kaydını doğrula / oluştur
    this.delayService.evaluateTaskDelay(auth.tenant_id, task_id, completionTime);

    // KAB05: Doğrudan ardılları tetikle
    const newlyReadyTaskIds = this.dependencyService.cascadeOnTaskCompleted(auth.tenant_id, task_id);

    return {
      task: updatedTask,
      newlyReadyTaskIds
    };
  }

  /**
   * Görev İlerleme Yüzdesi (%20, %40, %50, %60, %80, %100 vb.) ve ZORUNLU Açıklama Notu Güncellemesi
   */
  public updateTaskProgressWithNote(
    auth: AuthContext,
    task_id: UUID,
    progress: number,
    note_text: string
  ): { task: Task; record: any; newlyReadyTaskIds?: UUID[] } {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    const cleanedNote = (note_text || '').trim();
    if (cleanedNote.length < 2) {
      throw new Error('İlerleme yüzdesi güncellenirken yapılan çalışmayı veya durumu açıklayan bir not yazılması zorunludur!');
    }

    const safeProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));

    if (safeProgress >= 100) {
      const comp = this.completeTask(auth, task_id);
      const formattedNote = cleanedNote.startsWith('[%') ? cleanedNote : `[%100 Tamamlandı Notu]: ${cleanedNote}`;
      const record = this.delayService.submitExplanation(auth, task_id, formattedNote);
      return {
        task: comp.task,
        record,
        newlyReadyTaskIds: comp.newlyReadyTaskIds
      };
    }

    if (task.work_status === 'BLOCKED') {
      throw new Error('Öncül görevler tamamlanmadığı için BLOCKED durumundaki görevde ilerleme kaydedilemez.');
    }

    const newStatus: WorkStatus = safeProgress > 0 ? 'IN_PROGRESS' : 'READY';
    const updated = this.db.updateTask(auth.tenant_id, task_id, {
      work_status: newStatus,
      progress: safeProgress,
      actual_start_date: safeProgress > 0 ? (task.actual_start_date || new Date().toISOString()) : task.actual_start_date,
      actual_completion_date: undefined
    })!;

    const formattedNote = cleanedNote.startsWith('[%') ? cleanedNote : `[%${safeProgress} İlerleme Notu]: ${cleanedNote}`;
    const record = this.delayService.submitExplanation(auth, task_id, formattedNote);

    return {
      task: updated,
      record
    };
  }

  public getTask(auth: AuthContext, task_id: UUID): Task | undefined {
    return this.db.getTaskById(auth.tenant_id, task_id);
  }

  public updateStatus(
    auth: AuthContext,
    task_id: UUID,
    targetStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  ): { task: Task; newlyReadyTaskIds?: UUID[] } {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    if (targetStatus === 'COMPLETED') {
      return this.completeTask(auth, task_id);
    }

    if (targetStatus === 'IN_PROGRESS') {
      const readiness = this.dependencyService.checkReadiness(auth.tenant_id, task_id);
      if (!readiness.is_ready) {
        throw new Error('Görev Başlatılamaz: Öncül görevler tamamlanmadığı için görev BLOCKED durumundadır.');
      }
      const updated = this.db.updateTask(auth.tenant_id, task_id, {
        work_status: 'IN_PROGRESS',
        progress: task.progress && task.progress > 0 ? (task.progress === 100 ? 50 : task.progress) : 25,
        actual_start_date: task.actual_start_date || new Date().toISOString(),
        actual_completion_date: undefined
      });
      return { task: updated! };
    }

    if (targetStatus === 'TODO') {
      // Öncüller kontrol edilir: Eğer öncülü varsa ve bitmemişse BLOCKED, yoksa READY olur
      const readiness = this.dependencyService.checkReadiness(auth.tenant_id, task_id);
      const newWorkStatus = readiness.is_ready ? 'READY' : 'BLOCKED';
      const updated = this.db.updateTask(auth.tenant_id, task_id, {
        work_status: newWorkStatus,
        progress: 0,
        actual_completion_date: undefined
      });
      return { task: updated! };
    }

    throw new Error('Geçersiz hedef durum.');
  }

  public bulkCreateTasks(
    auth: AuthContext,
    project_id: UUID,
    tasksData: Array<{
      title: string;
      initial_start_date?: string;
      initial_due_date?: string;
      assignee_email_or_name?: string;
      description?: string;
      type?: Task['type'];
      priority?: Task['priority'];
    }>
  ): { createdTasks: Task[]; count: number } {
    const project = this.db.getProjectById(auth.tenant_id, project_id);
    if (!project) throw new Error('Proje bulunamadı.');

    const users = this.db.getUsers(auth.tenant_id);
    const createdTasks: Task[] = [];
    const now = new Date();

    for (const item of tasksData) {
      if (!item.title || !item.title.trim()) continue;

      let assignee_id: UUID | undefined = undefined;
      if (item.assignee_email_or_name) {
        const query = item.assignee_email_or_name.toLowerCase().trim();
        const matched = users.find(
          u => u.email.toLowerCase() === query || u.name.toLowerCase() === query || u.name.toLowerCase().includes(query)
        );
        if (matched) assignee_id = matched.id;
      }

      const startDate = item.initial_start_date ? new Date(item.initial_start_date).toISOString() : now.toISOString();
      const dueDate = item.initial_due_date
        ? new Date(item.initial_due_date).toISOString()
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const task = this.createTask(
        auth,
        project_id,
        item.title.trim(),
        startDate,
        dueDate,
        assignee_id,
        item.description,
        {
          type: item.type || 'TASK',
          priority: item.priority || 'NORMAL'
        }
      );
      createdTasks.push(task);
    }

    return { createdTasks, count: createdTasks.length };
  }

  public listTasks(auth: AuthContext, project_id: UUID): Task[] {
    return this.db.getTasks(auth.tenant_id, project_id);
  }

  /**
   * Görevleri başlık, açıklama veya atanan personele göre filtreler
   */
  public searchTasks(auth: AuthContext, query: string, project_id?: UUID): Task[] {
    const tasks = this.db.getTasks(auth.tenant_id, project_id);
    const trimmed = (query || '').trim();
    if (!trimmed) return tasks;

    const users = this.db.getUsers(auth.tenant_id);
    const userMap = new Map(users.map(u => [u.id, u]));

    return tasks.filter(task => {
      const assignee = task.assignee_id ? userMap.get(task.assignee_id) : undefined;
      return matchesTaskSearch(task, trimmed, assignee);
    });
  }
}

function normalizeForSearch(value?: string | null): string {
  if (!value) return '';
  return String(value).toLocaleLowerCase('tr-TR').trim();
}

export function matchesTaskSearch(
  task: Pick<Task, 'title' | 'description' | 'assignee_id'>,
  query: string,
  assignee?: { name?: string; email?: string; department?: string; country?: string } | null
): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;

  const titleNorm = normalizeForSearch(task.title);
  const descNorm = normalizeForSearch(task.description);
  const assigneeNameNorm = normalizeForSearch(assignee?.name);
  const assigneeEmailNorm = normalizeForSearch(assignee?.email);
  const assigneeDeptNorm = normalizeForSearch(assignee?.department);
  const assigneeCountryNorm = normalizeForSearch(assignee?.country);
  const unassignedNorm = !task.assignee_id ? 'atanmamış atanmadı unassigned' : '';

  return (
    titleNorm.includes(q) ||
    descNorm.includes(q) ||
    assigneeNameNorm.includes(q) ||
    assigneeEmailNorm.includes(q) ||
    assigneeDeptNorm.includes(q) ||
    assigneeCountryNorm.includes(q) ||
    unassignedNorm.includes(q)
  );
}

