import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  LimitedDependencySummary,
  TaskDependency,
  UUID
} from '../../core/types.js';

export class DependencyService {
  constructor(private db: Database) {}

  /**
   * Bağımlılık Ekleme (DAG Döngü Kontrolü ve Şirket Sınırı ile)
   * KAB04: A -> B -> C varken C -> A ve A -> A reddedilir.
   */
  public addDependency(
    auth: AuthContext,
    predecessor_id: UUID,
    successor_id: UUID
  ): TaskDependency {
    // 1. Kendine bağımlılık kontrolü (A -> A)
    if (predecessor_id === successor_id) {
      throw new Error('[KAB04] Geçersiz Bağımlılık: Bir görev kendisine bağlanamaz (A -> A reddedilir).');
    }

    // 2. Görevlerin varlığı ve kiracı doğrulaması
    const predTask = this.db.getTaskById(auth.tenant_id, predecessor_id);
    const succTask = this.db.getTaskById(auth.tenant_id, successor_id);

    if (!predTask || !succTask) {
      throw new Error('Öncül veya ardıl görev bulunamadı veya farklı kiracıya ait.');
    }

    // 3. Projeler arası kontrol (K05 kararı: v0.3'te yalnız aynı projede izin verilir)
    if (predTask.project_id !== succTask.project_id) {
      throw new Error('[K05] Geçersiz Bağımlılık: Bağımlılıklar yalnızca aynı projenin görevleri arasında kurulabilir.');
    }

    // 4. Mükerrer bağımlılık kontrolü
    const existing = this.db.getDependencies(auth.tenant_id).find(
      d => d.predecessor_id === predecessor_id && d.successor_id === successor_id
    );
    if (existing) {
      return existing;
    }

    // 5. DAG Döngü (Cycle) Tespiti:
    // Eğer successor_id'den predecessor_id'ye ulaşan bir yol varsa, predecessor_id -> successor_id eklemek döngü oluşturur!
    if (this.hasPath(auth.tenant_id, successor_id, predecessor_id)) {
      throw new Error(
        `[KAB04] Döngüsel Bağımlılık Reddedildi: ${predTask.title} -> ${succTask.title} bağımlılığı döngüye (cycle) yol açar!`
      );
    }

    const dependency: TaskDependency = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      predecessor_id,
      successor_id,
      dependency_type: 'FINISH_TO_START',
      created_at: new Date().toISOString()
    };

    // Eğer öncül henüz COMPLETED değilse, bekleme başlangıcı olarak şu anı kaydet
    if (predTask.work_status !== 'COMPLETED') {
      dependency.wait_start_time = new Date().toISOString();
      // Ardıl görevin durumu COMPLETED değilse BLOCKED yap
      if (succTask.work_status !== 'COMPLETED') {
        this.db.updateTask(auth.tenant_id, successor_id, { work_status: 'BLOCKED' });
      }
    }

    return this.db.insertDependency(dependency);
  }

  public removeDependency(
    auth: AuthContext,
    predecessor_id: UUID,
    successor_id: UUID
  ): boolean {
    const removed = this.db.removeDependency(auth.tenant_id, predecessor_id, successor_id);
    if (removed) {
      // Ardıl görevin kalan öncüllerini değerlendir
      this.evaluateAndUpdateTaskReadiness(auth.tenant_id, successor_id);
    }
    return removed;
  }

  /**
   * DAG üzerinde startNode'dan targetNode'a giden yönlü yol var mı kontrol eder (BFS).
   */
  public hasPath(tenant_id: UUID, startNode: UUID, targetNode: UUID): boolean {
    if (startNode === targetNode) return true;

    const visited = new Set<UUID>();
    const queue: UUID[] = [startNode];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetNode) return true;

      if (!visited.has(current)) {
        visited.add(current);
        const successors = this.db.getSuccessors(tenant_id, current);
        for (const dep of successors) {
          if (!visited.has(dep.successor_id)) {
            queue.push(dep.successor_id);
          }
        }
      }
    }

    return false;
  }

  /**
   * Görevin öncüllerini denetler.
   * Tüm öncüller COMPLETED ise true, aksi halde false ve engelleyici öncül listesi döner.
   */
  public checkReadiness(tenant_id: UUID, task_id: UUID): { is_ready: boolean; blocking_predecessors: UUID[] } {
    const deps = this.db.getPredecessors(tenant_id, task_id);
    if (deps.length === 0) {
      return { is_ready: true, blocking_predecessors: [] };
    }

    const blocking: UUID[] = [];
    for (const dep of deps) {
      const pred = this.db.getTaskById(tenant_id, dep.predecessor_id);
      if (!pred || pred.work_status !== 'COMPLETED') {
        blocking.push(dep.predecessor_id);
      }
    }

    return {
      is_ready: blocking.length === 0,
      blocking_predecessors: blocking
    };
  }

  /**
   * Görev BLOCKED ise ve tüm öncülleri bittiyse READY yapar.
   * Şartname v0.3: "Tüm öncülleri tamamlanan BLOCKED görev READY olur; diğer çalışma durumları körlemesine değiştirilmez."
   */
  public evaluateAndUpdateTaskReadiness(tenant_id: UUID, task_id: UUID): boolean {
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task) return false;

    const { is_ready } = this.checkReadiness(tenant_id, task_id);

    if (is_ready) {
      if (task.work_status === 'BLOCKED') {
        this.db.updateTask(tenant_id, task_id, { work_status: 'READY' });
        // Bekleme bitiş zamanını kaydet
        const preds = this.db.getPredecessors(tenant_id, task_id);
        const now = new Date().toISOString();
        preds.forEach(p => {
          if (!p.wait_end_time) {
            p.wait_end_time = now;
          }
        });
        return true;
      }
    } else {
      if (task.work_status === 'READY') {
        this.db.updateTask(tenant_id, task_id, { work_status: 'BLOCKED' });
        return true;
      }
    }

    return false;
  }

  /**
   * Bir görev COMPLETED olduğunda doğrudan ardıllarını değerlendirir. (KAB05)
   */
  public cascadeOnTaskCompleted(tenant_id: UUID, completed_task_id: UUID): UUID[] {
    const successors = this.db.getSuccessors(tenant_id, completed_task_id);
    const becameReadyTasks: UUID[] = [];

    for (const dep of successors) {
      const succ = this.db.getTaskById(tenant_id, dep.successor_id);
      if (succ && succ.work_status === 'BLOCKED') {
        const { is_ready } = this.checkReadiness(tenant_id, dep.successor_id);
        if (is_ready) {
          this.db.updateTask(tenant_id, dep.successor_id, { work_status: 'READY' });
          becameReadyTasks.push(dep.successor_id);
        }
      }
    }

    return becameReadyTasks;
  }

  /**
   * Sınırlı Bağımlılık Özeti (KAB02 & K06)
   * Görev sorumlusu yalnızca işini engelleyen ilişkinin ve tamamlanma durumunun
   * anlaşılmasını sağlayan sınırlı alanları görür.
   */
  public getLimitedDependencySummary(auth: AuthContext, task_id: UUID): LimitedDependencySummary[] {
    const summaries: LimitedDependencySummary[] = [];

    // Öncüller
    const preds = this.db.getPredecessors(auth.tenant_id, task_id);
    for (const dep of preds) {
      const pTask = this.db.getTaskById(auth.tenant_id, dep.predecessor_id);
      if (pTask) {
        let assigneeName: string | undefined;
        if (pTask.assignee_id) {
          const u = this.db.getUserById(auth.tenant_id, pTask.assignee_id);
          assigneeName = u?.name;
        }
        summaries.push({
          task_id: pTask.id,
          title: pTask.title,
          work_status: pTask.work_status,
          assignee_name: assigneeName,
          due_date: pTask.current_due_date,
          relation: 'PREDECESSOR',
          is_blocking: pTask.work_status !== 'COMPLETED'
        });
      }
    }

    // Ardıllar
    const succs = this.db.getSuccessors(auth.tenant_id, task_id);
    for (const dep of succs) {
      const sTask = this.db.getTaskById(auth.tenant_id, dep.successor_id);
      if (sTask) {
        summaries.push({
          task_id: sTask.id,
          title: sTask.title,
          work_status: sTask.work_status,
          due_date: sTask.current_due_date,
          relation: 'SUCCESSOR',
          is_blocking: false
        });
      }
    }

    return summaries;
  }
}
