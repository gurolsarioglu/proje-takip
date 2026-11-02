import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  EmailOutboxCategory,
  EmailOutboxItem,
  ScheduledReportJob,
  ScheduledReportType,
  SmtpConfig,
  Task,
  UUID
} from '../../core/types.js';
import { TaskService } from '../task/task.service.js';
import { DelayService } from '../delay/delay.service.js';
import { ProjectService } from '../project/project.service.js';
import { NotificationService } from '../notification/notification.service.js';

export class EmailAndAutomationService {
  constructor(
    private db: Database,
    private taskService: TaskService,
    private delayService: DelayService,
    private projectService: ProjectService,
    private notificationService: NotificationService
  ) { }

  public getSmtpConfig(tenant_id: UUID): SmtpConfig {
    const existing = this.db.getSmtpConfig(tenant_id);
    if (existing) return existing;

    const defaultConfig: SmtpConfig = {
      tenant_id,
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // Exchange Online Plan 1 STARTTLS (Port 587)
      username: 'bildirim@fggroup.com.tr',
      password: '',
      from_name: 'FG Group Proje Sistemi',
      from_email: 'bildirim@fggroup.com.tr',
      public_base_url: 'http://10.1.0.45:3000',
      enable_actionable_cards: true,
      updated_at: new Date().toISOString()
    };
    return this.db.upsertSmtpConfig(defaultConfig);
  }

  public saveSmtpConfig(auth: AuthContext, input: Partial<SmtpConfig>): SmtpConfig {
    const caller = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN') {
      throw new Error('Yetkisiz İşlem: Exchange Online / SMTP ayarlarını yalnızca Sistem Yöneticisi (Admin) güncelleyebilir.');
    }

    const current = this.getSmtpConfig(auth.tenant_id);
    const updated: SmtpConfig = {
      ...current,
      host: (input.host ?? current.host).trim(),
      port: Number(input.port ?? current.port) || 587,
      secure: input.secure !== undefined ? !!input.secure : current.secure,
      username: (input.username ?? current.username).trim(),
      password: input.password !== undefined && input.password !== '••••••••' ? input.password : current.password,
      from_name: (input.from_name ?? current.from_name).trim(),
      from_email: (input.from_email ?? input.username ?? current.from_email).trim(),
      public_base_url: (input.public_base_url ?? current.public_base_url).trim().replace(/\/+$/, ''),
      enable_actionable_cards: input.enable_actionable_cards !== undefined ? !!input.enable_actionable_cards : current.enable_actionable_cards,
      updated_at: new Date().toISOString()
    };

    return this.db.upsertSmtpConfig(updated);
  }

  /**
   * Exchange Online Plan 1 (SMTP) bağlantısını ve kimlik bilgilerini canlı doğrular (transporter.verify)
   * ve başarılıysa gerçek bir test e-postası (Adaptive Card gömülü) gönderir.
   */
  public async verifyAndTestSmtpConnection(
    auth: AuthContext,
    input: Partial<SmtpConfig> & { test_recipient?: string }
  ): Promise<{
    verified: boolean;
    mail_sent: boolean;
    mode: 'SMTP_LIVE' | 'SIMULATED';
    duration_ms: number;
    host: string;
    port: number;
    username: string;
    recipient: string;
    smtp_response?: string;
    error_message?: string;
    troubleshooting_hint?: string;
    outbox_item?: EmailOutboxItem;
  }> {
    const startTime = Date.now();
    // Önce formdan gelen güncel ayarları kaydet
    const config = this.saveSmtpConfig(auth, input);
    const recipient = (input.test_recipient || config.username || auth.email).trim();

    if (!config.password || config.password.trim().length === 0) {
      const simItem = await this.dispatchEmail({
        tenant_id: auth.tenant_id,
        to: [recipient],
        subject: `🧪 [Simülasyon Testi] Exchange Online & Adaptive Card Kontrolü`,
        category: 'SMTP_TEST',
        htmlBody: `<div style="padding:18px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;">
          <h3 style="margin-top:0;color:#0f172a;">🟡 Yerel Outbox Simülasyon Testi</h3>
          <p>Şifre alanı boş bırakıldığı için bu e-posta gerçek Exchange Online yerine yerel Giden Kutusu Simülatörüne kaydedildi.</p>
        </div>`
      });

      return {
        verified: false,
        mail_sent: false,
        mode: 'SIMULATED',
        duration_ms: Date.now() - startTime,
        host: config.host,
        port: config.port,
        username: config.username,
        recipient,
        error_message: 'Mail şifresi girilmediği için gerçek Exchange Online (SMTP) sunucusuna bağlanılmadı.',
        troubleshooting_hint: 'Gerçek e-posta gönderimini test etmek için "Mail Şifresi / Uygulama Şifresi" kutusuna Exchange Online şifrenizi yazıp tekrar "🔌 Bağlantıyı Test Et" butonuna basın.',
        outbox_item: simItem
      };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465 ? true : config.secure,
      auth: {
        user: config.username,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    try {
      // 1. Adım: SMTP Sunucusu ve Kimlik Doğrulama (Handshake + STARTTLS + AUTH LOGIN)
      await transporter.verify();

      // 2. Adım: Gerçek Test E-postasını (Adaptive Card ile) Gönder
      const tasks = this.db.getTasks(auth.tenant_id);
      const sampleTask = tasks.find(t => t.work_status === 'READY' && t.assignee_id) || tasks[0];
      const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

      const adaptiveCard = {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        originator: 'fg-group-proje-sistemi',
        body: [
          { type: 'TextBlock', text: '✅ EXCHANGE ONLINE PLAN 1 • BAĞLANTI DOĞRULANDI', weight: 'Bolder', color: 'Good', size: 'Small' },
          { type: 'TextBlock', text: sampleTask ? sampleTask.title : 'Exchange Online SMTP Canlı Test Görevi', weight: 'Bolder', size: 'Large', wrap: true },
          {
            type: 'FactSet',
            facts: [
              { title: 'SMTP Sunucusu:', value: `${config.host}:${config.port} (STARTTLS)` },
              { title: 'Gönderici Hesap:', value: config.username },
              { title: 'Test Alıcısı:', value: recipient },
              { title: 'Doğrulama Zamanı:', value: new Date().toLocaleString('tr-TR') }
            ]
          },
          { type: 'Input.Text', id: 'explanationText', placeholder: 'Outlook içinden test notu göndermek için yazın...', isMultiline: true }
        ],
        actions: sampleTask ? [
          {
            type: 'Action.Http',
            title: '▶️ Görevi Başlat',
            method: 'POST',
            url: `${baseUrl}/api/outlook/action`,
            body: JSON.stringify({ tenant_id: auth.tenant_id, task_id: sampleTask.id, user_id: auth.user_id, action: 'START_TASK' })
          },
          {
            type: 'Action.Http',
            title: '✅ Tamamlandı İşaretle',
            method: 'POST',
            url: `${baseUrl}/api/outlook/action`,
            body: JSON.stringify({ tenant_id: auth.tenant_id, task_id: sampleTask.id, user_id: auth.user_id, action: 'COMPLETE_TASK' })
          }
        ] : []
      };

      const htmlBody = `
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #10b981;border-radius:12px;padding:24px;">
          <div style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px;">
            ✅ Exchange Online Plan 1 (SMTP) Doğrulama Başarılı
          </div>
          <h2 style="margin:0 0 10px 0;font-size:18px;color:#0f172a;">FG Group Proje Sistemi - Canlı SMTP Test E-postası</h2>
          <p style="margin:0 0 14px 0;font-size:14px;color:#334155;">
            Tebrikler! <strong>${config.username}</strong> hesabınız üzerinden <strong>${config.host}:${config.port}</strong> sunucusuna bağlantı ve kimlik doğrulama başarıyla tamamlandı.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;font-size:13px;color:#166534;">
            <div><strong>Sunucu:</strong> ${config.host}:${config.port} (STARTTLS)</div>
            <div><strong>Gönderici:</strong> ${config.from_name} &lt;${config.username}&gt;</div>
            <div><strong>Alıcı:</strong> ${recipient}</div>
            <div><strong>Callback Adresi:</strong> ${baseUrl}</div>
          </div>
        </div>
      `;

      const outboxItem = await this.dispatchEmail({
        tenant_id: auth.tenant_id,
        to: [recipient],
        subject: `✅ [SMTP Doğrulandı] FG Group Exchange Online Test E-postası`,
        category: 'SMTP_TEST',
        htmlBody,
        adaptiveCardJson: adaptiveCard,
        linked_task_id: sampleTask?.id
      });

      const duration_ms = Date.now() - startTime;
      if (outboxItem.status === 'SENT') {
        return {
          verified: true,
          mail_sent: true,
          mode: 'SMTP_LIVE',
          duration_ms,
          host: config.host,
          port: config.port,
          username: config.username,
          recipient,
          smtp_response: `250 2.0.0 OK (${config.host}:${config.port} üzerinden canlı teslim edildi)`,
          outbox_item: outboxItem
        };
      } else {
        return {
          verified: true,
          mail_sent: false,
          mode: 'SMTP_LIVE',
          duration_ms,
          host: config.host,
          port: config.port,
          username: config.username,
          recipient,
          error_message: outboxItem.error_message || 'E-posta gönderimi sırasında hata oluştu.',
          troubleshooting_hint: this.buildSmtpTroubleshootingHint(outboxItem.error_message || '', config),
          outbox_item: outboxItem
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Exchange Online SMTP bağlantı hatası';
      const duration_ms = Date.now() - startTime;

      // Hata durumunu Outbox'a da kaydet ki kullanıcı geçmişte görsün
      const failedItem = this.db.insertEmailOutbox({
        id: crypto.randomUUID(),
        tenant_id: auth.tenant_id,
        to: [recipient],
        subject: `❌ [SMTP Bağlantı Hatası] ${config.host}:${config.port}`,
        category: 'SMTP_TEST',
        delivery_mode: 'SMTP_LIVE',
        status: 'FAILED',
        error_message: errMsg,
        html_preview: `<div style="padding:16px;color:#dc2626;"><strong>SMTP Hatası:</strong> ${errMsg}</div>`,
        sent_at: new Date().toISOString()
      });

      return {
        verified: false,
        mail_sent: false,
        mode: 'SMTP_LIVE',
        duration_ms,
        host: config.host,
        port: config.port,
        username: config.username,
        recipient,
        error_message: errMsg,
        troubleshooting_hint: this.buildSmtpTroubleshootingHint(errMsg, config),
        outbox_item: failedItem
      };
    }
  }

  private buildSmtpTroubleshootingHint(errMsg: string, config: SmtpConfig): string {
    const lower = errMsg.toLowerCase();
    if (lower.includes('5.7.139') || lower.includes('smtpclientauthentication is disabled')) {
      return `Microsoft 365 üzerinde bu hesap veya Tenant için "Authenticated SMTP (Kimliği Doğrulanmış SMTP)" kapalı. Çözüm: Microsoft 365 Admin Center (admin.microsoft.com) ➔ Kullanıcılar ➔ Aktif Kullanıcılar ➔ ${config.username} ➔ Posta (Mail) sekmesi ➔ "E-posta uygulamalarını yönet (Manage email apps)" ➔ "Kimliği doğrulanmış SMTP (Authenticated SMTP)" seçeneğini işaretleyip kaydedin.`;
    }
    if (lower.includes('535') || lower.includes('authentication unsuccessful') || lower.includes('invalid login') || lower.includes('5.7.3')) {
      return `Kullanıcı adı (${config.username}) veya şifre Microsoft Exchange Online tarafından reddedildi. 1) Şifrenizi doğru yazdığınızdan emin olun (👁️ ikonuna basarak kontrol edebilirsiniz). 2) Hesapta Çok Faktörlü Kimlik Doğrulama (MFA) aktifse normal şifre yerine Microsoft 365 Güvenlik sayfasından bir "Uygulama Şifresi (App Password)" oluşturup girin. 3) Microsoft 365 Admin Center'dan bu kullanıcı için "Authenticated SMTP" izninin açık olduğunu doğrulayın.`;
    }
    if (lower.includes('timed out') || lower.includes('etimedout') || lower.includes('econnrefused') || lower.includes('enotfound')) {
      return `${config.host}:${config.port} adresine ağ üzerinden ulaşılamadı. Sunucu adresini, Port numarasını (587) ve güvenlik duvarınızın (Firewall) 587 numaralı TCP portuna çıkış izni verdiğini kontrol edin.`;
    }
    return `Exchange Online (${config.host}:${config.port}) ayarlarınızı, kullanıcı e-posta adresinizi ve şifrenizi kontrol edip tekrar deneyin.`;
  }

  /**
   * Hem gerçek Exchange Online Plan 1 (SMTP) gönderimi yapar
   * hem de Outbox günlüğüne (canlı Adaptive Card önizlemesiyle) kaydeder.
   */
  public async dispatchEmail(params: {
    tenant_id: UUID;
    to: string[];
    subject: string;
    category: EmailOutboxCategory;
    htmlBody: string;
    adaptiveCardJson?: any;
    linked_task_id?: UUID;
    linked_project_id?: UUID;
    linked_request_id?: UUID;
  }): Promise<EmailOutboxItem> {
    const config = this.getSmtpConfig(params.tenant_id);
    const outboxId = crypto.randomUUID();

    // Adaptive Card'a outboxId bilgisini de gömelim ki aksiyon alındığında kart güncellensin
    if (params.adaptiveCardJson && Array.isArray(params.adaptiveCardJson.actions)) {
      params.adaptiveCardJson.actions = params.adaptiveCardJson.actions.map((act: any) => {
        if (act.type === 'Action.Http' && act.body) {
          try {
            const parsed = JSON.parse(act.body);
            parsed.outboxId = outboxId;
            act.body = JSON.stringify(parsed);
          } catch { }
        }
        return act;
      });
    }

    const fullHtml = this.wrapHtmlWithAdaptiveCard(params.subject, params.htmlBody, params.adaptiveCardJson);

    let delivery_mode: 'SMTP_LIVE' | 'LOCAL_OUTBOX' = 'LOCAL_OUTBOX';
    let status: 'SENT' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
    let error_message: string | undefined;

    // Eğer şifre girilmişse gerçek Exchange Online SMTP üzerinden gönder
    if (config.host && config.username && config.password && config.password.trim().length > 0) {
      delivery_mode = 'SMTP_LIVE';
      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure, // false for 587 (STARTTLS)
          auth: {
            user: config.username,
            pass: config.password
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000
        });

        await transporter.sendMail({
          from: `"${config.from_name}" <${config.from_email || config.username}>`,
          to: params.to.join(', '),
          subject: params.subject,
          html: fullHtml
        });

        status = 'SENT';
      } catch (err: any) {
        status = 'FAILED';
        error_message = err.message || 'Exchange Online SMTP bağlantı hatası';
      }
    }

    const item: EmailOutboxItem = {
      id: outboxId,
      tenant_id: params.tenant_id,
      to: params.to,
      subject: params.subject,
      category: params.category,
      delivery_mode,
      status,
      error_message,
      adaptive_card_json: params.adaptiveCardJson,
      html_preview: params.htmlBody,
      linked_task_id: params.linked_task_id,
      linked_project_id: params.linked_project_id,
      linked_request_id: params.linked_request_id,
      sent_at: new Date().toISOString()
    };

    return this.db.insertEmailOutbox(item);
  }

  private wrapHtmlWithAdaptiveCard(subject: string, bodyHtml: string, adaptiveCardJson?: any): string {
    const cardScript = adaptiveCardJson
      ? `<script type="application/adaptivecard+json">\n${JSON.stringify(adaptiveCardJson, null, 2)}\n</script>`
      : '';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  ${cardScript}
</head>
<body style="margin:0;padding:20px;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
  ${bodyHtml}
</body>
</html>`;
  }

  /**
   * 1. Görev HAZIR (READY) Olduğunda veya Atandığında Gönderilen Canlı Outlook Adaptive Card
   */
  public async sendTaskReadyActionableCard(tenant_id: UUID, task_id: UUID): Promise<EmailOutboxItem | null> {
    const config = this.getSmtpConfig(tenant_id);
    if (!config.enable_actionable_cards) return null;

    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.assignee_id) return null;

    const assignee = this.db.getUserById(tenant_id, task.assignee_id);
    if (!assignee) return null;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const preds = this.db.getPredecessors(tenant_id, task.id);
    const predFacts = preds.map((d, idx) => {
      const pt = this.db.getTaskById(tenant_id, d.predecessor_id);
      const pa = pt?.assignee_id ? this.db.getUserById(tenant_id, pt.assignee_id) : null;
      return {
        title: `Öncül ${idx + 1}:`,
        value: pt ? `${pt.title} (${pa?.name || 'Tamamlandı'} ✓)` : 'Tamamlandı ✓'
      };
    });

    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const dueStr = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      originator: 'fg-group-proje-sistemi',
      hideOriginalBody: true,
      body: [
        {
          type: 'TextBlock',
          text: `📁 ${project?.title || 'FG Group Projesi'}`,
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: task.title,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'TextBlock',
          text: task.description || 'Öncül görevler tamamlandı. Görevinize hemen başlayabilirsiniz.',
          isSubtle: true,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Durum:', value: `HAZIR (${task.work_status})` },
            { title: 'Sorumlu:', value: `${assignee.name} (${assignee.department || 'Ekip'})` },
            { title: 'Hedef Teslim:', value: dueStr },
            ...predFacts
          ]
        },
        {
          type: 'Input.Text',
          id: 'explanationText',
          placeholder: 'Atölye / durum notu veya gecikme açıklaması yazın (opsiyonel)...',
          isMultiline: true
        }
      ],
      actions: [
        {
          type: 'Action.Http',
          title: '▶️ Görevi Başlat',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'START_TASK'
          })
        },
        {
          type: 'Action.Http',
          title: '✅ Tamamlandı İşaretle',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'COMPLETE_TASK'
          })
        },
        {
          type: 'Action.Http',
          title: '📝 Not / Gecikme Ekle',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'SUBMIT_EXPLANATION',
            explanation_text: '{{explanationText.value}}'
          })
        }
      ]
    };

    const htmlBody = `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;margin-bottom:6px;">
          ${project?.title || 'FG Group'} • Outlook Actionable Message
        </div>
        <h2 style="margin:0 0 8px 0;font-size:18px;color:#0f172a;">🔔 Sıra Sizde: ${task.title}</h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;">${task.description || 'Bu görevin öncülleri tamamlandı ve başlamaya hazır.'}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px;">
          <div><strong>Sorumlu:</strong> ${assignee.name}</div>
          <div><strong>Hedef Bitiş:</strong> ${dueStr}</div>
          <div><strong>Durum:</strong> <span style="color:#059669;font-weight:700;">HAZIR (Öncüller Tamamlandı ✓)</span></div>
        </div>
        <a href="${baseUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;">Proje Paneline Git</a>
      </div>
    `;

    return this.dispatchEmail({
      tenant_id,
      to: [assignee.email],
      subject: `🔔 Sıra Sizde: ${task.title} Hazır`,
      category: 'ACTIONABLE_TASK_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id
    });
  }

  /**
   * 2. Görev Geciktiğinde (KAB07) Gönderilen Zorunlu Mazeret Giriş Kartı
   */
  public async sendDelayExplanationActionableCard(tenant_id: UUID, task_id: UUID): Promise<EmailOutboxItem | null> {
    const config = this.getSmtpConfig(tenant_id);
    if (!config.enable_actionable_cards) return null;

    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.assignee_id) return null;

    const assignee = this.db.getUserById(tenant_id, task.assignee_id);
    if (!assignee) return null;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const succs = this.db.getSuccessors(tenant_id, task.id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const dueStr = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      originator: 'fg-group-proje-sistemi',
      hideOriginalBody: true,
      body: [
        {
          type: 'TextBlock',
          text: `⚠️ TERMİN AŞILDI (KAB07 Gecikme Açıklaması Gerekli)`,
          weight: 'Bolder',
          color: 'Warning',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: task.title,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project?.title || 'FG Group' },
            { title: 'Sorumlu:', value: assignee.name },
            { title: 'Aşılan Termin:', value: dueStr },
            { title: 'Bekleyen Ardıl İş:', value: `${succs.length} görev sizi bekliyor` }
          ]
        },
        {
          type: 'Input.Text',
          id: 'explanationText',
          placeholder: 'Gecikme nedenini ve alınan önlemi doğrudan buraya yazınız...',
          isMultiline: true,
          isRequired: true
        }
      ],
      actions: [
        {
          type: 'Action.Http',
          title: '📝 Mazereti Kaydet ve Yöneticiye Bildir',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'SUBMIT_EXPLANATION',
            explanation_text: '{{explanationText.value}}'
          })
        },
        {
          type: 'Action.Http',
          title: '✅ Görevi Şimdi Tamamla',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'COMPLETE_TASK'
          })
        }
      ]
    };

    const htmlBody = `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #f59e0b;border-radius:12px;padding:24px;">
        <div style="font-size:12px;font-weight:700;color:#d97706;text-transform:uppercase;margin-bottom:6px;">
          ⚠️ Gecikme Açıklaması Bekleniyor (KAB07)
        </div>
        <h2 style="margin:0 0 8px 0;font-size:18px;color:#0f172a;">${task.title}</h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;">Bu görevin teslim tarihi (${dueStr}) aşılmıştır ve <strong>${succs.length} ardıl görev</strong> tamamlanmasını beklemektedir.</p>
      </div>
    `;

    return this.dispatchEmail({
      tenant_id,
      to: [assignee.email],
      subject: `⚠️ Gecikme Açıklaması Gerekli: ${task.title}`,
      category: 'DELAY_EXPLANATION_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id
    });
  }

  /**
   * 3. Görünürlük Talebi (KAB03) Onay Kartı (Proje Yöneticisine Gider)
   */
  public async sendVisibilityRequestActionableCard(tenant_id: UUID, request_id: UUID): Promise<EmailOutboxItem | null> {
    const config = this.getSmtpConfig(tenant_id);
    if (!config.enable_actionable_cards) return null;

    const req = this.db.getVisibilityRequestById(tenant_id, request_id);
    if (!req) return null;

    const project = this.db.getProjectById(tenant_id, req.project_id);
    const requester = this.db.getUserById(tenant_id, req.user_id);
    if (!project || !requester) return null;

    const members = this.db.getProjectMembers(tenant_id, project.id).filter(m => m.role === 'PROJECT_MANAGER');
    const managerUsers = members.map(m => this.db.getUserById(tenant_id, m.user_id)).filter(Boolean);
    const managerEmails = managerUsers.map(u => u!.email);
    const managerId = managerUsers[0]?.id || project.created_by_user_id;

    if (managerEmails.length === 0) {
      const admin = this.db.getUsers(tenant_id).find(u => u.system_role === 'ADMIN');
      if (admin) managerEmails.push(admin.email);
    }

    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      originator: 'fg-group-proje-sistemi',
      hideOriginalBody: true,
      body: [
        {
          type: 'TextBlock',
          text: `🔐 Proje Görünürlük Onay Talebi (KAB03)`,
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: `${requester.name} tüm proje akışını görüntülemek istiyor`,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project.title },
            { title: 'Talep Eden:', value: `${requester.name} (${requester.department || 'Personel'})` },
            { title: 'E-posta:', value: requester.email },
            { title: 'Verilecek Rol:', value: 'Tam Görüntüleyici (VIEWER)' }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.Http',
          title: '✅ Talebi Onayla (VIEWER Yap)',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            request_id: req.id,
            user_id: managerId,
            action: 'DECIDE_VISIBILITY',
            approve: true
          })
        },
        {
          type: 'Action.Http',
          title: '❌ Reddet',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            request_id: req.id,
            user_id: managerId,
            action: 'DECIDE_VISIBILITY',
            approve: false
          })
        }
      ]
    };

    const htmlBody = `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <h2 style="margin:0 0 8px 0;font-size:18px;color:#0f172a;">👁️ Görünürlük Talebi: ${requester.name}</h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;"><strong>${project.title}</strong> projesindeki tüm görevleri ve Gantt takvimini görebilmek için yetki talep edildi.</p>
      </div>
    `;

    return this.dispatchEmail({
      tenant_id,
      to: managerEmails,
      subject: `👁️ Görünürlük Onayı Bekliyor: ${requester.name} (${project.title})`,
      category: 'APPROVAL_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_project_id: project.id,
      linked_request_id: req.id
    });
  }

  /**
   * 4. Outlook Actionable Message HTTP Callback İşleyicisi (/api/outlook/action)
   * E-postanın içindeki butonlara tıklandığında çalışır ve kartı anında günceller!
   */
  public async handleOutlookCardAction(payload: {
    tenant_id?: UUID;
    task_id?: UUID;
    request_id?: UUID;
    user_id?: UUID;
    outboxId?: UUID;
    action: 'START_TASK' | 'COMPLETE_TASK' | 'SUBMIT_EXPLANATION' | 'DECIDE_VISIBILITY';
    explanation_text?: string;
    approve?: boolean;
  }): Promise<{ message: string; updatedCard: any; resultData?: any }> {
    const tenant_id = payload.tenant_id || this.db.getTenants()[0]?.id;
    const callerUser = (payload.user_id && this.db.getUserById(tenant_id, payload.user_id)) || this.db.getUsers(tenant_id)[0];
    const auth: AuthContext = {
      tenant_id,
      user_id: callerUser.id,
      email: callerUser.email,
      name: callerUser.name
    };

    let statusMessage = 'İşlem tamamlandı.';
    let resultData: any = null;

    if (payload.action === 'START_TASK' && payload.task_id) {
      const updated = this.taskService.startTask(auth, payload.task_id);
      statusMessage = `▶️ "${updated.title}" görevi Outlook üzerinden BAŞLATILDI (%${updated.progress || 25}).`;
      resultData = updated;
    } else if (payload.action === 'COMPLETE_TASK' && payload.task_id) {
      const res = this.taskService.completeTask(auth, payload.task_id);
      resultData = res;
      const unlockedNames: string[] = [];
      for (const readyId of res.newlyReadyTaskIds) {
        const rt = this.db.getTaskById(tenant_id, readyId);
        if (rt) {
          unlockedNames.push(rt.title);
          if (rt.assignee_id) {
            this.notificationService.notifyTaskReady(tenant_id, rt.id, rt.assignee_id, rt.title);
            await this.sendTaskReadyActionableCard(tenant_id, rt.id);
          }
        }
      }
      statusMessage = unlockedNames.length > 0
        ? `✅ "${res.task.title}" tamamlandı! Sıradaki görev(ler) otomatik açıldı ve e-postası gönderildi: ${unlockedNames.join(', ')}`
        : `✅ "${res.task.title}" görevi Outlook üzerinden %100 TAMAMLANDI.`;
    } else if (payload.action === 'SUBMIT_EXPLANATION' && payload.task_id) {
      const text = (payload.explanation_text || '').trim() || 'Outlook Actionable Card üzerinden durum/gecikme notu girildi.';
      const rec = this.delayService.submitExplanation(auth, payload.task_id, text);
      const task = this.db.getTaskById(tenant_id, payload.task_id);
      if (task) {
        this.notificationService.notifyExplanationSubmitted(tenant_id, task.project_id, task.id, auth.name, task.title, text);
      }
      statusMessage = `📝 Gecikme / durum açıklamanız kaydedildi ve proje yöneticisine bildirildi: "${text}"`;
      resultData = rec;
    } else if (payload.action === 'DECIDE_VISIBILITY' && payload.request_id) {
      const approve = payload.approve !== false;
      const decided = this.projectService.decideVisibilityRequest(auth, payload.request_id, approve);
      statusMessage = approve
        ? `✅ Görünürlük talebi onaylandı. Personel artık projeyi (VIEWER) olarak görüntüleyebilir.`
        : `❌ Görünürlük talebi reddedildi.`;
      resultData = decided;
    }

    const updatedCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '✅ FG Group Proje Sistemi - Outlook Aksiyonu Uygulandı',
          weight: 'Bolder',
          color: 'Good',
          size: 'Medium'
        },
        {
          type: 'TextBlock',
          text: statusMessage,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'İşlemi Yapan:', value: `${auth.name} (${auth.email})` },
            { title: 'Zaman:', value: new Date().toLocaleString('tr-TR') }
          ]
        }
      ]
    };

    if (payload.outboxId) {
      this.db.updateEmailOutbox(tenant_id, payload.outboxId, {
        action_taken: statusMessage
      });
    }

    return { message: statusMessage, updatedCard, resultData };
  }

  // ==========================================================
  // 5. ZAMANLANMIŞ OTOMATİK RAPORLAR (SCHEDULED REPORTS ENGINE)
  // ==========================================================
  public listScheduledReports(tenant_id: UUID): ScheduledReportJob[] {
    return this.db.getScheduledReports(tenant_id);
  }

  public createScheduledReport(
    auth: AuthContext,
    input: {
      name: string;
      project_id?: string;
      report_type: ScheduledReportType;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      day_of_week?: number;
      send_time: string;
      recipients: string[];
      include_adaptive_card?: boolean;
    }
  ): ScheduledReportJob {
    const caller = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN' && !caller?.can_build_reports) {
      throw new Error('Yetkisiz İşlem: Zamanlanmış rapor oluşturma yetkiniz bulunmamaktadır.');
    }

    if (!input.name || !input.name.trim()) {
      throw new Error('Rapor adı zorunludur.');
    }

    const cleanRecipients = (input.recipients || []).map(r => r.trim()).filter(Boolean);
    if (cleanRecipients.length === 0) {
      throw new Error('En az bir alıcı e-posta adresi belirtilmelidir.');
    }

    const job: ScheduledReportJob = {
      id: crypto.randomUUID(),
      tenant_id: auth.tenant_id,
      name: input.name.trim(),
      project_id: input.project_id || 'all',
      report_type: input.report_type || 'EXECUTIVE_SUMMARY',
      frequency: input.frequency || 'DAILY',
      day_of_week: input.day_of_week || 1,
      send_time: input.send_time || '09:00',
      recipients: cleanRecipients,
      include_adaptive_card: input.include_adaptive_card !== false,
      is_active: true,
      created_by_user_id: auth.user_id,
      created_at: new Date().toISOString()
    };

    return this.db.insertScheduledReport(job);
  }

  public toggleScheduledReport(auth: AuthContext, id: UUID, is_active: boolean): ScheduledReportJob {
    const updated = this.db.updateScheduledReport(auth.tenant_id, id, { is_active });
    if (!updated) throw new Error('Zamanlanmış rapor kuralı bulunamadı.');
    return updated;
  }

  public deleteScheduledReport(auth: AuthContext, id: UUID): boolean {
    return this.db.deleteScheduledReport(auth.tenant_id, id);
  }

  /**
   * Zamanlanmış raporu anında üretir ve Exchange Online (SMTP) / Outbox üzerinden gönderir.
   */
  public async executeScheduledReportJob(tenant_id: UUID, job_id: UUID): Promise<EmailOutboxItem> {
    const job = this.db.getScheduledReportById(tenant_id, job_id);
    if (!job) throw new Error('Zamanlanmış rapor bulunamadı.');

    const projectFilter = job.project_id && job.project_id !== 'all' ? job.project_id : undefined;
    const projectObj = projectFilter ? this.db.getProjectById(tenant_id, projectFilter) : undefined;
    const scopeTitle = projectObj ? projectObj.title : 'Tüm Şirket Projeleri (Konsolide)';

    const tasks = this.db.getTasks(tenant_id, projectFilter);
    const users = this.db.getUsers(tenant_id);
    const delays = this.db.getDelayRecords(tenant_id);
    const now = new Date();

    const total = tasks.length;
    const completed = tasks.filter(t => t.work_status === 'COMPLETED').length;
    const inProgress = tasks.filter(t => t.work_status === 'IN_PROGRESS').length;
    const ready = tasks.filter(t => t.work_status === 'READY').length;
    const blocked = tasks.filter(t => t.work_status === 'BLOCKED').length;
    const delayed = tasks.filter(t => t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < now).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Ekip Performans Özeti (Şartname v0.3: 100 * (0.70*Z + 0.30*T))
    const userRows = users.map(u => {
      const uTasks = tasks.filter(t => t.assignee_id === u.id);
      const uDone = uTasks.filter(t => t.work_status === 'COMPLETED');
      const uOnTime = uDone.filter(t => t.actual_completion_date && new Date(t.actual_completion_date) <= new Date(t.initial_due_date));
      const z = uTasks.length > 0 ? uOnTime.length / uTasks.length : null;
      const tr = uTasks.length > 0 ? uDone.length / uTasks.length : null;
      const score = z !== null && tr !== null ? Math.round(100 * (0.7 * z + 0.3 * tr)) : null;
      return {
        name: u.name,
        dept: u.department || 'Genel',
        assigned: uTasks.length,
        completed: uDone.length,
        score: score !== null ? `${score} / 100` : '-'
      };
    }).filter(r => r.assigned > 0);

    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = job.include_adaptive_card ? {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      originator: 'fg-group-proje-sistemi',
      body: [
        {
          type: 'TextBlock',
          text: `📊 OTOMATİK RAPOR • ${job.frequency === 'DAILY' ? 'GÜNLÜK' : job.frequency === 'WEEKLY' ? 'HAFTALIK' : 'AYLIK'}`,
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: job.name,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'TextBlock',
          text: `Kapsam: ${scopeTitle}`,
          isSubtle: true,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Genel İlerleme:', value: `%${completionRate} (${completed}/${total} Görev Tamamlandı)` },
            { title: 'Devam Eden / Hazır:', value: `${inProgress} Sürüyor, ${ready} Hazır` },
            { title: 'Öncül Bekleyen (BLOCKED):', value: `${blocked} Görev` },
            { title: 'Geciken Açık Görev:', value: `${delayed} Görev` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '📈 Canlı Rapor Paneline Git',
          url: baseUrl
        }
      ]
    } : undefined;

    const perfTableHtml = userRows.map(r => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${r.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${r.dept}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${r.completed} / ${r.assigned}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#2563eb;">${r.score}</td>
      </tr>
    `).join('');

    const recentDelaysHtml = delays.slice(-4).map(d => {
      const dt = this.db.getTaskById(tenant_id, d.task_id);
      return `<li style="margin-bottom:6px;"><strong>${dt?.title || 'Görev'}:</strong> ${d.explanation_text || d.reason}</li>`;
    }).join('');

    const htmlBody = `
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:16px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;">FG Group • Zamanlanmış Otomatik Rapor</div>
            <h2 style="margin:4px 0 0 0;font-size:20px;color:#0f172a;">${job.name}</h2>
            <div style="font-size:13px;color:#64748b;margin-top:2px;">Kapsam: <strong>${scopeTitle}</strong> • Gönderim: ${new Date().toLocaleString('tr-TR')}</div>
          </div>
        </div>

        <!-- KPI Kutuları -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#059669;">%${completionRate}</div>
            <div style="font-size:11px;color:#64748b;">Tamamlanma (${completed}/${total})</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#2563eb;">${inProgress}</div>
            <div style="font-size:11px;color:#64748b;">Devam Eden</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#dc2626;">${blocked}</div>
            <div style="font-size:11px;color:#64748b;">Öncül Bekleyen</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#d97706;">${delayed}</div>
            <div style="font-size:11px;color:#64748b;">Geciken İş</div>
          </div>
        </div>

        <h3 style="font-size:14px;color:#0f172a;margin:0 0 8px 0;">👥 Ekip Performans Karnesi (Şartname v0.3 Puanı)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:8px 10px;">Personel</th>
              <th style="padding:8px 10px;">Departman</th>
              <th style="padding:8px 10px;text-align:center;">Tamamlanan</th>
              <th style="padding:8px 10px;text-align:right;">Performans Puanı</th>
            </tr>
          </thead>
          <tbody>${perfTableHtml}</tbody>
        </table>

        ${recentDelaysHtml ? `
          <h3 style="font-size:14px;color:#0f172a;margin:0 0 8px 0;">📝 Son Kaydedilen Gecikme Gerekçeleri</h3>
          <ul style="font-size:13px;color:#334155;padding-left:18px;margin:0 0 16px 0;">${recentDelaysHtml}</ul>
        ` : ''}

        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;display:flex;justify-content:space-between;">
          <span>Exchange Online Plan 1 (${config.host}:${config.port}) üzerinden oluşturuldu</span>
          <a href="${baseUrl}" style="color:#2563eb;font-weight:600;text-decoration:none;">Sistemi Aç ➔</a>
        </div>
      </div>
    `;

    const sentItem = await this.dispatchEmail({
      tenant_id,
      to: job.recipients,
      subject: `📊 [Otomatik Rapor] ${job.name} (%${completionRate} Tamamlandı)`,
      category: 'SCHEDULED_REPORT',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_project_id: projectFilter
    });

    this.db.updateScheduledReport(tenant_id, job.id, {
      last_sent_at: new Date().toISOString()
    });

    return sentItem;
  }
}

