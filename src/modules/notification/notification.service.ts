import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  Notification,
  NotificationChannel,
  PushSubscriptionData,
  UUID
} from '../../core/types.js';

export class NotificationService {
  constructor(private db: Database) {}

  /**
   * Bildirim Oluşturma (Mükerrerlik engeli KAB09 ile)
   */
  public createNotification(
    tenant_id: UUID,
    recipient_id: UUID,
    event_id: string,
    channel: NotificationChannel,
    title: string,
    message: string,
    link_task_id?: UUID,
    link_project_id?: UUID
  ): Notification | null {
    // Aynı olay + alıcı + kanal için mükerrer gönderimi engelle
    const existing = this.db.getNotifications(tenant_id, recipient_id).find(
      n => n.event_id === event_id && n.channel === channel
    );

    if (existing) {
      return existing; // Kontrolsüz çoğalma engellenir
    }

    const notification: Notification = {
      id: crypto.randomUUID(),
      tenant_id,
      recipient_id,
      event_id,
      channel,
      title,
      message,
      link_task_id,
      link_project_id,
      status: 'SENT',
      retry_count: 0,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    return this.db.insertNotification(notification);
  }

  /**
   * Görev READY olduğunda bildirim
   */
  public notifyTaskReady(tenant_id: UUID, task_id: UUID, assignee_id: UUID, task_title: string): void {
    const event_id = `task_ready_${task_id}`;
    const title = 'Görev Başlamaya Hazır!';
    const message = `"${task_title}" görevinin tüm öncül görevleri tamamlandı, göreve başlayabilirsiniz.`;

    // Site içi
    this.createNotification(tenant_id, assignee_id, event_id, 'IN_APP', title, message, task_id);
    // E-posta (Graph API simülasyonu)
    this.createNotification(tenant_id, assignee_id, event_id, 'EMAIL', title, message, task_id);
    // Web Push
    this.createNotification(tenant_id, assignee_id, event_id, 'WEB_PUSH', title, message, task_id);
  }

  /**
   * Son tarihe 24 saat kala bildirim
   */
  public notify24HourReminder(tenant_id: UUID, task_id: UUID, assignee_id: UUID, task_title: string, due_date: string): void {
    const event_id = `24h_reminder_${task_id}_${due_date.slice(0, 10)}`;
    const title = 'Görev Son Tarih Hatırlatması';
    const message = `"${task_title}" görevinin son teslim tarihine 24 saat kaldı (${new Date(due_date).toLocaleString('tr-TR')}).`;

    this.createNotification(tenant_id, assignee_id, event_id, 'IN_APP', title, message, task_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'EMAIL', title, message, task_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'WEB_PUSH', title, message, task_id);
  }

  /**
   * Günlük açıklama hatırlatması (yalnızca REQUIRED durumunda)
   */
  public notifyDailyExplanationReminder(tenant_id: UUID, task_id: UUID, assignee_id: UUID, task_title: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const event_id = `delay_exp_reminder_${task_id}_${today}`;
    const title = 'Gecikme Açıklaması Bekleniyor';
    const message = `"${task_title}" göreviniz planlanan bitiş tarihini aşmıştır. Lütfen gecikme gerekçesini sisteme giriniz.`;

    this.createNotification(tenant_id, assignee_id, event_id, 'IN_APP', title, message, task_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'EMAIL', title, message, task_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'WEB_PUSH', title, message, task_id);
  }

  /**
   * Açıklama girildiğinde yöneticilere bildirim
   */
  public notifyExplanationSubmitted(
    tenant_id: UUID,
    project_id: UUID,
    task_id: UUID,
    assignee_name: string,
    task_title: string,
    explanation_text: string
  ): void {
    const members = this.db.getProjectMembers(tenant_id, project_id);
    const managers = members.filter(m => m.role === 'PROJECT_MANAGER');
    const event_id = `exp_submitted_${task_id}_${Date.now()}`;

    for (const manager of managers) {
      const title = 'Gecikme Açıklaması Girildi';
      const message = `${assignee_name}, "${task_title}" görevi için gecikme gerekçesi girdi: "${explanation_text}"`;
      this.createNotification(tenant_id, manager.user_id, event_id, 'IN_APP', title, message, task_id, project_id);
      this.createNotification(tenant_id, manager.user_id, event_id, 'EMAIL', title, message, task_id, project_id);
      this.createNotification(tenant_id, manager.user_id, event_id, 'WEB_PUSH', title, message, task_id, project_id);
    }
  }

  // --- Push Subscription Yönetimi (WEB01-WEB05) ---
  public registerPushSubscription(
    auth: AuthContext,
    endpoint: string,
    p256dh: string,
    authKey: string
  ): PushSubscriptionData {
    // Mevcut varsa aktif et
    const existing = this.db.getPushSubscriptions(auth.tenant_id, auth.user_id).find(s => s.endpoint === endpoint);
    if (existing) {
      existing.is_active = true;
      return existing;
    }

    const sub: PushSubscriptionData = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      user_id: auth.user_id,
      endpoint,
      p256dh,
      auth: authKey,
      created_at: new Date().toISOString(),
      is_active: true
    };

    return this.db.insertPushSubscription(sub);
  }

  public deactivatePushSubscription(auth: AuthContext, endpoint: string): void {
    this.db.deactivatePushSubscription(auth.tenant_id, endpoint);
  }

  public getUserNotifications(auth: AuthContext): Notification[] {
    return this.db.getNotifications(auth.tenant_id, auth.user_id);
  }
}
