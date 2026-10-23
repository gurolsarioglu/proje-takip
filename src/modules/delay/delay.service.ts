import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  BlockingInterval,
  DelayCauseClass,
  DelayRecord,
  ExplanationSource,
  ExplanationStatus,
  UUID
} from '../../core/types.js';

export class DelayService {
  constructor(private db: Database) {}

  /**
   * Görevin gecikmesini değerlendirir.
   * Şartname v0.3: Günlük gecikme takibi güncel plan bitişine göre çalışır.
   */
  public evaluateTaskDelay(tenant_id: UUID, task_id: UUID, nowIso?: string): DelayRecord | null {
    const now = nowIso ? new Date(nowIso) : new Date();
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task) return null;

    const currentDue = new Date(task.current_due_date);

    // Henüz tamamlanmamış ve güncel plan bitişi geçmiş mi?
    const isOverdue = task.work_status !== 'COMPLETED' && currentDue < now;
    // Ya da geç tamamlanmış mı? (KAB10: worker taramasından önce geç tamamlanan görev kaçırılmaz)
    const isCompletedLate = task.work_status === 'COMPLETED' && task.actual_completion_date
      ? new Date(task.actual_completion_date) > currentDue
      : false;

    if (!isOverdue && !isCompletedLate) {
      return null;
    }

    // Mevcut aktif gecikme kaydı var mı kontrol et
    const existing = this.db.getDelayRecords(tenant_id, task_id);
    if (existing.length > 0) {
      return existing[existing.length - 1];
    }

    // Bağımlılık nedeniyle mi bekliyor? (KAB06)
    // Öncülleri kontrol et
    const deps = this.db.getPredecessors(tenant_id, task_id);
    const blockingIntervals: BlockingInterval[] = [];
    const blockingPredTitles: string[] = [];

    for (const dep of deps) {
      const pred = this.db.getTaskById(tenant_id, dep.predecessor_id);
      if (pred && pred.work_status !== 'COMPLETED') {
        blockingIntervals.push({
          predecessor_id: pred.id,
          start: dep.wait_start_time || task.created_at,
          end: undefined
        });
        blockingPredTitles.push(`"${pred.title}"`);
      }
    }

    let explanation_status: ExplanationStatus = 'REQUIRED';
    let explanation_source: ExplanationSource = 'USER';
    let cause_class: DelayCauseClass = 'USER_DELAY';
    let reason = 'Görev güncel plan bitiş tarihini aştı, gecikme açıklaması bekleniyor.';

    // Eğer tamamlanmamış öncüller nedeniyle BLOCKED ise:
    if (task.work_status === 'BLOCKED' || blockingIntervals.length > 0) {
      explanation_status = 'RECORDED';
      explanation_source = 'SYSTEM';
      cause_class = 'DEPENDENCY_BLOCKED';
      reason = `Sistem Gerekçesi: Görev, tamamlanmamış öncül görevler (${blockingPredTitles.join(', ')}) nedeniyle beklemededir. Otomatik gerekçe karşılanmıştır.`;
    }

    const record: DelayRecord = {
      id: crypto.randomUUID(),
      tenant_id,
      task_id,
      detected_at: now.toISOString(),
      explanation_status,
      explanation_source,
      reason,
      blocking_intervals: blockingIntervals,
      cause_class
    };

    return this.db.insertDelayRecord(record);
  }

  /**
   * Sorumlu tarafından açıklama / mazeret girilmesi (KAB07 & KAB10)
   * Açıklama girmek çalışma durumunu değiştirmez, engeli kaldırmaz!
   */
  public submitExplanation(
    auth: AuthContext,
    task_id: UUID,
    explanation_text: string
  ): DelayRecord {
    const task = this.db.getTaskById(auth.tenant_id, task_id);
    if (!task) throw new Error('Görev bulunamadı.');

    // Sorumlu veya yönetici girebilir
    if (task.assignee_id !== auth.user_id) {
      const member = this.db.getProjectMember(auth.tenant_id, task.project_id, auth.user_id);
      if (member?.role !== 'PROJECT_MANAGER') {
        throw new Error('Yalnızca görev sorumlusu veya proje yöneticisi açıklama girebilir.');
      }
    }

    const records = this.db.getDelayRecords(auth.tenant_id, task_id);
    let record: DelayRecord;

    if (records.length > 0) {
      record = records[records.length - 1];
      this.db.updateDelayRecord(auth.tenant_id, record.id, {
        explanation_status: 'RECORDED',
        explanation_source: 'USER',
        explanation_text,
        reported_by_user_id: auth.user_id,
        reported_at: new Date().toISOString(),
        reason: explanation_text
      });
      record = this.db.getDelayRecords(auth.tenant_id, task_id).find(r => r.id === record.id)!;
    } else {
      record = {
        id: crypto.randomUUID(),
        tenant_id: auth.tenant_id,
        task_id,
        detected_at: new Date().toISOString(),
        explanation_status: 'RECORDED',
        explanation_source: 'USER',
        reason: explanation_text,
        explanation_text,
        blocking_intervals: [],
        cause_class: 'USER_DELAY',
        reported_by_user_id: auth.user_id,
        reported_at: new Date().toISOString()
      };
      this.db.insertDelayRecord(record);
    }

    return record;
  }

  /**
   * Darboğaz ve Kök Neden Teşhisi (Bottleneck Analysis)
   * A geciktiği için B başlayamıyorsa sistem A'yı gecikme kaynağı,
   * B'yi bağımlılıktan etkilenen görev olarak gösterir.
   */
  public diagnoseBottlenecks(tenant_id: UUID, project_id: UUID): Array<{
    bottleneck_task_id: UUID;
    bottleneck_title: string;
    affected_tasks: Array<{ task_id: UUID; title: string }>;
  }> {
    const tasks = this.db.getTasks(tenant_id, project_id);
    const now = new Date();
    const bottlenecks: Map<UUID, { bottleneck_task_id: UUID; bottleneck_title: string; affected_tasks: Array<{ task_id: UUID; title: string }> }> = new Map();

    for (const task of tasks) {
      // Gecikmiş veya tamamlanmamış bir öncül mü?
      const isDelayedOrBlocking = task.work_status !== 'COMPLETED' && new Date(task.current_due_date) < now;
      if (isDelayedOrBlocking) {
        const successors = this.db.getSuccessors(tenant_id, task.id);
        const affected: Array<{ task_id: UUID; title: string }> = [];
        for (const dep of successors) {
          const succ = this.db.getTaskById(tenant_id, dep.successor_id);
          if (succ && succ.work_status === 'BLOCKED') {
            affected.push({ task_id: succ.id, title: succ.title });
          }
        }
        if (affected.length > 0) {
          bottlenecks.set(task.id, {
            bottleneck_task_id: task.id,
            bottleneck_title: task.title,
            affected_tasks: affected
          });
        }
      }
    }

    return Array.from(bottlenecks.values());
  }

  public getDelayRecords(tenant_id: UUID, task_id?: UUID): DelayRecord[] {
    return this.db.getDelayRecords(tenant_id, task_id);
  }
}
