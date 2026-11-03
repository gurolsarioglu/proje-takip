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
    const recipientIds = this.getProjectAuthorityUserIds(tenant_id, project_id);
    const event_id = `exp_submitted_${task_id}_${Date.now()}`;

    for (const managerId of recipientIds) {
      const title = 'Gecikme Açıklaması Girildi';
      const message = `${assignee_name}, "${task_title}" görevi için açıklama girdi: "${explanation_text}"`;
      this.createNotification(tenant_id, managerId, event_id, 'IN_APP', title, message, task_id, project_id);
      this.createNotification(tenant_id, managerId, event_id, 'EMAIL', title, message, task_id, project_id);
      this.createNotification(tenant_id, managerId, event_id, 'WEB_PUSH', title, message, task_id, project_id);
    }
  }

  /**
   * Projedeki yetkili kişilerin (PROJECT_MANAGER, EDITOR, Proje Kurucusu ve ADMIN) kullanıcı ID listesini döndürür
   */
  public getProjectAuthorityUserIds(tenant_id: UUID, project_id: UUID, exclude_user_id?: UUID): UUID[] {
    const ids = new Set<UUID>();
    const project = this.db.getProjectById(tenant_id, project_id);
    if (project?.created_by_user_id) {
      ids.add(project.created_by_user_id);
    }
    const members = this.db.getProjectMembers(tenant_id, project_id);
    for (const m of members) {
      if (m.role === 'PROJECT_MANAGER' || m.role === 'EDITOR') {
        ids.add(m.user_id);
      }
    }
    const admins = this.db.getUsers(tenant_id).filter(u => u.system_role === 'ADMIN');
    for (const adm of admins) {
      ids.add(adm.id);
    }
    if (exclude_user_id && ids.size > 1) {
      ids.delete(exclude_user_id);
    }
    return Array.from(ids);
  }

  /**
   * Kullanıcı projeye dahil edildiğinde bildirim
   */
  public notifyProjectMemberAdded(
    tenant_id: UUID,
    project_id: UUID,
    user_id: UUID,
    project_title: string,
    role: string,
    added_by_name: string
  ): void {
    const roleLabels: Record<string, string> = {
      PROJECT_MANAGER: 'Proje Yöneticisi',
      EDITOR: 'Düzenleyici (Editör)',
      VIEWER: 'Tam Görüntüleyici'
    };
    const roleLabel = roleLabels[role] || role;
    const event_id = `proj_member_added_${project_id}_${user_id}_${role}`;
    const title = `📁 Projeye Dahil Edildiniz: ${project_title}`;
    const message = `${added_by_name} sizi "${project_title}" projesine "${roleLabel}" rolüyle dahil etti.`;

    this.createNotification(tenant_id, user_id, event_id, 'IN_APP', title, message, undefined, project_id);
    this.createNotification(tenant_id, user_id, event_id, 'EMAIL', title, message, undefined, project_id);
    this.createNotification(tenant_id, user_id, event_id, 'WEB_PUSH', title, message, undefined, project_id);
  }

  /**
   * Kullanıcıya görev atandığında bildirim
   */
  public notifyTaskAssigned(
    tenant_id: UUID,
    project_id: UUID,
    task_id: UUID,
    assignee_id: UUID,
    task_title: string,
    assigned_by_name: string
  ): void {
    const event_id = `task_assigned_${task_id}_${assignee_id}`;
    const title = `📌 Yeni Görev Atandı: ${task_title}`;
    const message = `${assigned_by_name} tarafından "${task_title}" görevi size atandı.`;

    this.createNotification(tenant_id, assignee_id, event_id, 'IN_APP', title, message, task_id, project_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'EMAIL', title, message, task_id, project_id);
    this.createNotification(tenant_id, assignee_id, event_id, 'WEB_PUSH', title, message, task_id, project_id);
  }

  /**
   * Görev tamamlandığında projedeki yetkili kişilere bildirim
   */
  public notifyTaskCompletedToManagers(
    tenant_id: UUID,
    project_id: UUID,
    task_id: UUID,
    completed_by_name: string,
    task_title: string,
    note_text?: string
  ): void {
    const recipientIds = this.getProjectAuthorityUserIds(tenant_id, project_id);
    const event_id = `task_completed_mgr_${task_id}`;
    const title = `✅ Görev Tamamlandı: ${task_title}`;
    const noteSuffix = note_text ? ` | Not: "${note_text}"` : '';
    const message = `${completed_by_name}, "${task_title}" görevini %100 tamamladı.${noteSuffix}`;

    for (const uid of recipientIds) {
      this.createNotification(tenant_id, uid, event_id, 'IN_APP', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'EMAIL', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'WEB_PUSH', title, message, task_id, project_id);
    }
  }

  /**
   * Görev ilerleme oranı (%40, %50, %60 vb.) ve zorunlu açıklama notu girildiğinde yetkililere bildirim
   */
  public notifyTaskProgressToManagers(
    tenant_id: UUID,
    project_id: UUID,
    task_id: UUID,
    user_name: string,
    task_title: string,
    progress: number,
    note_text: string
  ): void {
    const recipientIds = this.getProjectAuthorityUserIds(tenant_id, project_id);
    const event_id = `task_progress_${task_id}_${progress}_${Date.now()}`;
    const title = `📊 İlerleme Güncellendi (%${progress}): ${task_title}`;
    const message = `${user_name}, "${task_title}" görevini %${progress} seviyesine getirdi. Açıklama: "${note_text}"`;

    for (const uid of recipientIds) {
      this.createNotification(tenant_id, uid, event_id, 'IN_APP', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'EMAIL', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'WEB_PUSH', title, message, task_id, project_id);
    }
  }

  /**
   * Görev zamanında yapılmadığında (Overdue) projedeki yetkili kişilere uyarı bildirimi
   */
  public notifyOverdueTaskToManagers(
    tenant_id: UUID,
    project_id: UUID,
    task_id: UUID,
    assignee_name: string,
    task_title: string,
    due_date: string
  ): void {
    const today = new Date().toISOString().slice(0, 10);
    const recipientIds = this.getProjectAuthorityUserIds(tenant_id, project_id);
    const event_id = `overdue_mgr_${task_id}_${today}`;
    const title = `🚨 Geciken Görev Uyarısı: ${task_title}`;
    const message = `${assignee_name} sorumluluğundaki "${task_title}" görevi zamanında (${due_date.slice(0, 10)}) tamamlanmadı!`;

    for (const uid of recipientIds) {
      this.createNotification(tenant_id, uid, event_id, 'IN_APP', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'EMAIL', title, message, task_id, project_id);
      this.createNotification(tenant_id, uid, event_id, 'WEB_PUSH', title, message, task_id, project_id);
    }
  }

  /**
   * Sisteme yeni bir kullanıcı (personel) eklendiğinde karşılama bildirimi
   */
  public notifyUserWelcome(
    tenant_id: UUID,
    new_user_id: UUID,
    user_name: string,
    email: string
  ): void {
    const event_id = `welcome_user_${new_user_id}`;
    const title = `🎉 FG Group Sistemine Hoş Geldiniz, ${user_name}!`;
    const message = `Hesabınız (${email}) aktif edildi. Sol alttaki profil menüsünden kendi şifrenizi oluşturabilir/değiştirebilir ve profil fotoğrafınızı yükleyebilirsiniz.`;
    this.createNotification(tenant_id, new_user_id, event_id, 'IN_APP', title, message);
    this.createNotification(tenant_id, new_user_id, event_id, 'EMAIL', title, message);
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
