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
    project_id: UUID,
    title: string,
    initial_start_date: string,
    initial_due_date: string,
    assignee_id?: UUID,
    description?: string,
    extra?: { type?: 'TASK' | 'MILESTONE' | 'BUG'; priority?: 'LOW' | 'NORMAL' | 'HIGH'; progress?: number }
  ): Task {
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      tenant_id: auth.tenant_id,
      project_id,
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

  public getTask(auth: AuthContext, task_id: UUID): Task | undefined {
    return this.db.getTaskById(auth.tenant_id, task_id);
  }

  public listTasks(auth: AuthContext, project_id: UUID): Task[] {
    return this.db.getTasks(auth.tenant_id, project_id);
  }
}
