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
   * Microsoft Entra ID (Azure AD) üzerinden 535 hatasının gerçek kök nedenini (AADSTS50055 geçici şifre, MFA, yanlış şifre vb.) sorgular.
   */
  private async diagnoseEntraAccount(username: string, password: string): Promise<{
    code?: string;
    suberror?: string;
    accessToken?: string;
    turkishReason?: string;
  }> {
    try {
      const domain = username.includes('@') ? username.split('@')[1].trim() : 'common';
      const resp = await fetch(`https://login.microsoftonline.com/${domain}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
          scope: 'https://outlook.office365.com/.default',
          grant_type: 'password',
          username,
          password
        })
      });
      const data: any = await resp.json();
      if (data.access_token) {
        return { accessToken: data.access_token };
      }
      const desc = String(data.error_description || '');
      const sub = String(data.suberror || '');
      if (desc.includes('AADSTS50055') || sub === 'user_password_expired') {
        return {
          code: 'AADSTS50055 (Geçici Şifre / İlk Giriş Şifre Değiştirme Zorunluluğu)',
          suberror: sub,
          turkishReason: `🎯 KESİN KÖK NEDEN TESPİT EDİLDİ (AADSTS50055 - İlk Oturumda Şifre Değiştirme Zorunluluğu): "${username}" hesabını Microsoft 365 panelinden yeni açtığınız için girdiğiniz şifre "İlk oturum açmada değiştirilmesi gereken geçici şifre" durumunda bekliyor. Microsoft Exchange Online, geçici şifre değiştirilene kadar Port 587 (SMTP) girişini reddeder. ÇÖZÜM: 1) Yeni bir sekmede https://outlook.office.com adresine gidip "${username}" ve mevcut şifrenizle bir kez giriş yaparak kalıcı şifrenizi belirleyin (veya Microsoft 365 Admin Center'da şifre sıfırlarken "Kullanıcının ilk oturum açmada parolasını değiştirmesini iste" kutucuğunun işaretini kaldırın). 2) Ayrıca Microsoft 365 Admin Center ➔ Aktif Kullanıcılar ➔ ${username} ➔ Posta ➔ "E-posta uygulamalarını yönet" altından "Kimliği doğrulanmış SMTP (Authenticated SMTP)" seçeneğinin açık olduğundan emin olun.`
        };
      }
      if (desc.includes('AADSTS50126')) {
        return {
          code: 'AADSTS50126 (Hatalı Kullanıcı Adı veya Şifre)',
          suberror: sub,
          turkishReason: `🎯 KESİN KÖK NEDEN (AADSTS50126): "${username}" için girdiğiniz şifre Microsoft 365 üzerindeki şifreyle eşleşmiyor. Şifre kutusunun yanındaki 👁️ ikonuna basarak şifrenizi kontrol edin.`
        };
      }
      if (desc.includes('AADSTS50076') || desc.includes('AADSTS50079')) {
        return {
          code: 'AADSTS50076 (Çok Faktörlü Kimlik Doğrulama / MFA Zorunlu)',
          suberror: sub,
          turkishReason: `🎯 KESİN KÖK NEDEN (AADSTS50076 - MFA Aktif): "${username}" hesabında Çok Faktörlü Kimlik Doğrulama (MFA) açık olduğu için normal şifre ile SMTP girişi yapılamaz. Microsoft 365 Güvenlik sayfasından bir "Uygulama Şifresi (App Password)" oluşturup girin veya bu bildirim hesabı için MFA'yı kapatın.`
        };
      }
      return {};
    } catch {
      return {};
    }
  }

  private getDirectSendMxHost(emailOrUsername: string): string {
    const domain = (emailOrUsername.split('@')[1] || 'fggroup.com.tr').trim().toLowerCase();
    return `${domain.replace(/\./g, '-')}.mail.protection.outlook.com`;
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
    direct_send_used?: boolean;
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

    const tasks = this.db.getTasks(auth.tenant_id);
    const sampleTask = tasks.find(t => t.work_status === 'READY' && t.assignee_id) || tasks[0];
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const buildSampleAdaptiveCard = (headerText: string, headerColor: 'Good' | 'Accent' | 'Warning', serverLabel: string) => ({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: headerText, weight: 'Bolder', color: headerColor, size: 'Small' },
        { type: 'TextBlock', text: sampleTask ? sampleTask.title : 'Exchange Online SMTP Canlı Test Görevi', weight: 'Bolder', size: 'Large', wrap: true },
        {
          type: 'FactSet',
          facts: [
            { title: 'SMTP Sunucusu:', value: serverLabel },
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
    });

    const buildSampleHtmlBody = (serverLabel: string) => `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #10b981;border-radius:12px;padding:24px;">
        <div style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px;">
          ✅ Exchange Online Plan 1 • Canlı Test E-postası
        </div>
        <h2 style="margin:0 0 10px 0;font-size:18px;color:#0f172a;">FG Group Proje Sistemi - Outlook Actionable Card Testi</h2>
        <p style="margin:0 0 14px 0;font-size:14px;color:#334155;">
          Bu e-posta <strong>${config.username}</strong> gönderici adresiyle <strong>${serverLabel}</strong> üzerinden canlı olarak iletilmiştir.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;font-size:13px;color:#166534;">
          <div><strong>Sunucu:</strong> ${serverLabel}</div>
          <div><strong>Gönderici:</strong> ${config.from_name} &lt;${config.username}&gt;</div>
          <div><strong>Alıcı:</strong> ${recipient}</div>
          <div><strong>Callback Adresi:</strong> ${baseUrl}</div>
        </div>
      </div>
    `;

    const isDirectSendConfig = config.port === 25 || config.host.includes('.mail.protection.outlook.com');

    if (!isDirectSendConfig && (!config.password || config.password.trim().length === 0)) {
      const simCard = buildSampleAdaptiveCard('🟡 SİMÜLASYON TESTİ • OUTLOOK ADAPTIVE CARD', 'Warning', `${config.host}:${config.port}`);
      const simHtml = buildSampleHtmlBody(`${config.host}:${config.port} (Yerel Simülasyon)`);
      const simItem = await this.dispatchEmail({
        tenant_id: auth.tenant_id,
        to: [recipient],
        subject: `🧪 [Simülasyon Testi] Exchange Online & Adaptive Card Kontrolü`,
        category: 'SMTP_TEST',
        htmlBody: simHtml,
        adaptiveCardJson: simCard,
        linked_task_id: sampleTask?.id
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
        error_message: 'Mail şifresi girilmediği için Port 587 üzerinden şifreli bağlantı kurulmadı.',
        troubleshooting_hint: 'Gerçek e-posta göndermek için "Mail Şifresi" kutusuna Exchange Online şifrenizi yazın VEYA şirket içi (@fggroup.com.tr) şifresiz gönderim için üstteki "⚡ Direct Send (Port 25 - Şifresiz Kurum İçi)" modunu seçin.',
        outbox_item: simItem
      };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465 ? true : config.secure,
      ...(isDirectSendConfig ? {} : {
        auth: {
          user: config.username,
          pass: config.password
        }
      }),
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    try {
      // 1. Adım: SMTP Sunucusu ve Kimlik Doğrulama (Handshake + STARTTLS)
      await transporter.verify();

      // 2. Adım: Gerçek Test E-postasını (Adaptive Card ile) Gönder
      const serverLabel = `${config.host}:${config.port} (${isDirectSendConfig ? 'Exchange Online Direct Send' : 'STARTTLS'})`;
      const adaptiveCard = buildSampleAdaptiveCard('✅ EXCHANGE ONLINE PLAN 1 • BAĞLANTI DOĞRULANDI', 'Good', serverLabel);
      const htmlBody = buildSampleHtmlBody(serverLabel);

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
          direct_send_used: isDirectSendConfig,
          mode: 'SMTP_LIVE',
          duration_ms,
          host: config.host,
          port: config.port,
          username: config.username,
          recipient,
          smtp_response: `250 2.6.0 OK (${config.host}:${config.port} üzerinden gerçek posta kutusuna teslim edildi)`,
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
      // Microsoft Entra ID üzerinden 535 hatasının kesin kök nedenini sorgula (örn: AADSTS50055 Geçici Şifre) veya OAuth2 token al
      const entraDiag = (!isDirectSendConfig && config.username && config.password)
        ? await this.diagnoseEntraAccount(config.username, config.password)
        : {};

      // Eğer kullanıcı adı ve şifre doğruysa (Entra ID accessToken döndürdüyse) OAuth2 (XOAUTH2) veya EWS üzerinden gönder!
      if (entraDiag.accessToken) {
        try {
          const oauthCard = buildSampleAdaptiveCard('✅ EXCHANGE ONLINE OAUTH2 • BAĞLANTI DOĞRULANDI', 'Good', `${config.host}:${config.port} (OAuth2 Modern Auth)`);
          const oauthHtml = buildSampleHtmlBody(`${config.host}:${config.port} (OAuth2 Modern Auth)`);
          const fullOauthHtml = this.wrapHtmlWithAdaptiveCard(`✅ [OAuth2 Doğrulandı] FG Group Exchange Online Test E-postası`, oauthHtml, oauthCard);

          const oauthTransporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465 ? true : config.secure,
            auth: {
              type: 'OAuth2',
              user: config.username,
              accessToken: entraDiag.accessToken
            },
            tls: { rejectUnauthorized: false }
          });

          const info = await oauthTransporter.sendMail({
            from: `"${config.from_name}" <${config.from_email || config.username}>`,
            to: recipient,
            subject: `✅ [OAuth2 Doğrulandı] FG Group Exchange Online Test E-postası`,
            html: fullOauthHtml
          });

          const sentOauthItem = this.db.insertEmailOutbox({
            id: crypto.randomUUID(),
            tenant_id: auth.tenant_id,
            to: [recipient],
            subject: `✅ [OAuth2 Doğrulandı] FG Group Exchange Online Test E-postası`,
            category: 'SMTP_TEST',
            delivery_mode: 'SMTP_LIVE',
            status: 'SENT',
            adaptive_card_json: oauthCard,
            html_preview: oauthHtml,
            linked_task_id: sampleTask?.id,
            sent_at: new Date().toISOString()
          });

          return {
            verified: true,
            mail_sent: true,
            mode: 'SMTP_LIVE',
            duration_ms: Date.now() - startTime,
            host: config.host,
            port: config.port,
            username: config.username,
            recipient,
            smtp_response: `${info.response || '250 2.0.0 OK'} (Modern Auth OAuth2 ile doğrulandı)`,
            outbox_item: sentOauthItem
          };
        } catch {
          // OAuth2 SMTP başarısız olursa aşağıda Direct Send / Tanılama devam eder
        }
      }

      const detailedError = entraDiag.code ? `${errMsg} — [${entraDiag.code}]` : errMsg;
      const detailedHint = entraDiag.turkishReason || this.buildSmtpTroubleshootingHint(errMsg, config);

      // Eğer alıcı şirket içi (@fggroup.com.tr) ise Exchange Online Direct Send (Port 25 MX) ile gerçek maili yine de ulaştır!
      const mxHost = this.getDirectSendMxHost(config.username);
      const senderDomain = (config.username.split('@')[1] || '').toLowerCase();
      const recipDomain = (recipient.split('@')[1] || '').toLowerCase();

      if (senderDomain && senderDomain === recipDomain) {
        try {
          const directCard = buildSampleAdaptiveCard('⚡ EXCHANGE ONLINE DIRECT SEND • CANLI TEST KARTI', 'Accent', `${mxHost}:25 (Direct Send)`);
          const directHtml = buildSampleHtmlBody(`${mxHost}:25 (Exchange Online Direct Send)`);
          const fullHtml = this.wrapHtmlWithAdaptiveCard(`✅ [Direct Send] FG Group Exchange Online Test E-postası`, directHtml, directCard);

          const directTransporter = nodemailer.createTransport({
            host: mxHost,
            port: 25,
            secure: false,
            tls: { rejectUnauthorized: false },
            connectionTimeout: 8000,
            greetingTimeout: 8000
          });

          const info = await directTransporter.sendMail({
            from: `"${config.from_name}" <${config.from_email || config.username}>`,
            to: recipient,
            subject: `✅ [Direct Send] FG Group Exchange Online Test E-postası`,
            html: fullHtml
          });

          const sentItem = this.db.insertEmailOutbox({
            id: crypto.randomUUID(),
            tenant_id: auth.tenant_id,
            to: [recipient],
            subject: `✅ [Direct Send İletildi] FG Group Exchange Online Test E-postası`,
            category: 'SMTP_TEST',
            delivery_mode: 'SMTP_LIVE',
            status: 'SENT',
            adaptive_card_json: directCard,
            html_preview: directHtml,
            linked_task_id: sampleTask?.id,
            sent_at: new Date().toISOString()
          });

          return {
            verified: false,
            mail_sent: true,
            direct_send_used: true,
            mode: 'SMTP_LIVE',
            duration_ms: Date.now() - startTime,
            host: config.host,
            port: config.port,
            username: config.username,
            recipient,
            smtp_response: `${info.response || '250 2.6.0 Queued mail for delivery'} (${mxHost}:25 üzerinden gerçek posta kutusuna iletildi!)`,
            error_message: detailedError,
            troubleshooting_hint: detailedHint,
            outbox_item: sentItem
          };
        } catch {
          // Direct send de başarısız olursa standart hata dön
        }
      }

      const duration_ms = Date.now() - startTime;
      const failCard = buildSampleAdaptiveCard('⚠️ SMTP BAĞLANTI TANILAMA KARTI', 'Warning', `${config.host}:${config.port}`);
      const failHtml = buildSampleHtmlBody(`${config.host}:${config.port}`);

      const failedItem = this.db.insertEmailOutbox({
        id: crypto.randomUUID(),
        tenant_id: auth.tenant_id,
        to: [recipient],
        subject: `⚠️ [SMTP Tanılama] ${config.host}:${config.port}`,
        category: 'SMTP_TEST',
        delivery_mode: 'SMTP_LIVE',
        status: 'FAILED',
        error_message: detailedError,
        adaptive_card_json: failCard,
        html_preview: failHtml,
        linked_task_id: sampleTask?.id,
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
        error_message: detailedError,
        troubleshooting_hint: detailedHint,
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
      return `Kullanıcı adı (${config.username}) veya şifre Microsoft Exchange Online tarafından reddedildi. 1) Hesabı yeni açtıysanız ilk girişte geçici şifreyi değiştirmek için https://outlook.office.com adresinden bir kez giriş yapın. 2) Hesapta Çok Faktörlü Kimlik Doğrulama (MFA) aktifse Microsoft 365 Güvenlik sayfasından bir "Uygulama Şifresi (App Password)" oluşturup girin. 3) Microsoft 365 Admin Center'dan bu kullanıcı için "Authenticated SMTP" izninin açık olduğunu doğrulayın.`;
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
    linked_project_id?: UUID | null;
    linked_request_id?: UUID;
    icalEvent?: {
      filename?: string;
      content: string;
    };
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

    const isDirectSendConfig = config.port === 25 || config.host.includes('.mail.protection.outlook.com');

    // Eğer Direct Send seçiliyse veya şifre girilmişse gerçek Exchange Online üzerinden gönder
    if (isDirectSendConfig || (config.host && config.username && config.password && config.password.trim().length > 0)) {
      delivery_mode = 'SMTP_LIVE';
      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465 ? true : config.secure,
          ...(isDirectSendConfig ? {} : {
            auth: {
              user: config.username,
              pass: config.password
            }
          }),
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000
        });

        const mailOptions: any = {
          from: `"${config.from_name}" <${config.from_email || config.username}>`,
          to: params.to.join(', '),
          subject: params.subject,
          html: fullHtml
        };

        if (params.icalEvent) {
          const fn = params.icalEvent.filename || 'gorev-takvimi.ics';
          mailOptions.icalEvent = {
            filename: fn,
            method: 'PUBLISH',
            content: params.icalEvent.content
          };
          mailOptions.attachments = [
            {
              filename: fn,
              content: params.icalEvent.content,
              contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
            }
          ];
        }

        await transporter.sendMail(mailOptions);

        status = 'SENT';
      } catch (err: any) {
        // Eğer Port 587'de geçici şifre / Basic Auth hatası alındıysa ve alıcılar şirket içi (@fggroup.com.tr) ise Direct Send (Port 25) ile otomatik ilet
        const senderDomain = (config.username.split('@')[1] || '').toLowerCase();
        const allSameDomain = senderDomain && params.to.every(addr => addr.toLowerCase().endsWith(`@${senderDomain}`));

        if (!isDirectSendConfig && allSameDomain) {
          try {
            const mxHost = this.getDirectSendMxHost(config.username);
            const directTransporter = nodemailer.createTransport({
              host: mxHost,
              port: 25,
              secure: false,
              tls: { rejectUnauthorized: false },
              connectionTimeout: 8000,
              greetingTimeout: 8000
            });

            const directMailOptions: any = {
              from: `"${config.from_name}" <${config.from_email || config.username}>`,
              to: params.to.join(', '),
              subject: params.subject,
              html: fullHtml
            };

            if (params.icalEvent) {
              const fn = params.icalEvent.filename || 'gorev-takvimi.ics';
              directMailOptions.icalEvent = {
                filename: fn,
                method: 'PUBLISH',
                content: params.icalEvent.content
              };
              directMailOptions.attachments = [
                {
                  filename: fn,
                  content: params.icalEvent.content,
                  contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
                }
              ];
            }

            await directTransporter.sendMail(directMailOptions);
            status = 'SENT';
            error_message = undefined;
          } catch {
            status = 'FAILED';
            error_message = err.message || 'Exchange Online SMTP bağlantı hatası';
          }
        } else {
          status = 'FAILED';
          error_message = err.message || 'Exchange Online SMTP bağlantı hatası';
        }
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

    const hasCard = params.adaptiveCardJson ? 'AdaptiveCard:v1.4' : 'HTML-Only';
    if (status === 'FAILED') {
      console.error(`❌ [EMAIL-MONITOR] [${params.category}] (${hasCard}) GÖNDERİM HATASI -> Alıcı: ${params.to.join(', ')} | Konu: "${params.subject}" | Hata: ${error_message}`);
    } else {
      console.log(`📧 [EMAIL-MONITOR] [${params.category}] (${hasCard}) Durum: ${status} (${delivery_mode}) -> Alıcı: ${params.to.join(', ')} | Konu: "${params.subject}"`);
    }

    return this.db.insertEmailOutbox(item);
  }

  private wrapHtmlWithAdaptiveCard(subject: string, bodyHtml: string, adaptiveCardJson?: any): string {
    let cleanJson = adaptiveCardJson;
    if (cleanJson) {
      cleanJson = JSON.parse(JSON.stringify(adaptiveCardJson));
      if (cleanJson.originator === 'fg-group-proje-sistemi') {
        delete cleanJson.originator;
      }
      delete cleanJson.hideOriginalBody;
    }
    const cardScript = cleanJson
      ? `<script type="application/adaptivecard+json">\n${JSON.stringify(cleanJson, null, 2)}\n</script>`
      : '';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  ${cardScript}
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  ${bodyHtml}
</body>
</html>`;
  }

  /**
   * RFC 5545 uyumlu iCalendar (.ics) metni üretir.
   * Outlook Masaüstü, Outlook Web, Google Calendar, Apple/iOS ve Android takvimleri ile %100 uyumludur.
   */
  public generateTaskIcsContent(params: {
    task: Task;
    projectTitle?: string;
    assigneeName?: string;
    assigneeEmail?: string;
    baseUrl: string;
    sequence?: number;
  }): string {
    const { task, projectTitle, assigneeName, baseUrl, sequence = 0 } = params;

    const startDate = task.current_start_date ? new Date(task.current_start_date) : new Date(task.created_at);
    const dueDate = task.current_due_date ? new Date(task.current_due_date) : new Date(startDate.getTime() + 3600000);

    const formatIcsDate = (d: Date): string => {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const dtStart = formatIcsDate(startDate);
    const dtEnd = formatIcsDate(dueDate);
    const dtStamp = formatIcsDate(new Date());

    const safeTitle = (task.title || 'FG Group Görevi').replace(/\r?\n/g, ' ').replace(/[;,]/g, ' ');
    const proj = projectTitle || 'FG Group Projesi';
    const summary = `[${proj}] 📌 ${safeTitle}`;
    const descLines = [
      `Proje: ${proj}`,
      `Sorumlu: ${assigneeName || 'Atanmamış'}`,
      `Öncelik: ${task.priority || 'NORMAL'}`,
      `Durum: ${task.work_status} (%${task.progress || 0})`,
      task.description ? `Açıklama: ${task.description.replace(/\r?\n/g, ' ')}` : '',
      `Görev Detay Bağlantısı: ${baseUrl}/?task_id=${task.id}`
    ].filter(Boolean).join('\\n');

    const uid = `task-${task.id}@fggroup.com.tr`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FG Group//Proje ve Gorev Yonetim Sistemi v0.3//TR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SEQUENCE:${sequence}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${descLines}`,
      `LOCATION:${proj}`,
      'STATUS:CONFIRMED',
      task.priority === 'HIGH' ? 'PRIORITY:1' : (task.priority === 'LOW' ? 'PRIORITY:9' : 'PRIORITY:5'),
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:🔔 Hatırlatma: Yarın "${safeTitle}" görevinin teslim tarihi!`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:⏰ Dikkat: "${safeTitle}" görevinin teslimine 2 saat kaldı!`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  /**
   * E-posta ve web arayüzü için tek tıkla takvime ekleme bağlantıları üretir:
   * 1. .ics indirme linki (Tüm cihazlar ve masaüstü Outlook)
   * 2. Microsoft 365 / Outlook Web Deeplink
   * 3. Google Calendar Deeplink
   */
  public buildCalendarLinks(params: {
    task: Task;
    projectTitle?: string;
    baseUrl: string;
  }): {
    icsDownloadUrl: string;
    outlookWebUrl: string;
    googleCalendarUrl: string;
  } {
    const { task, projectTitle, baseUrl } = params;
    const proj = projectTitle || 'FG Group Projesi';
    const title = `[${proj}] 📌 ${task.title}`;
    const desc = `Proje: ${proj}\nDurum: ${task.work_status} (%${task.progress || 0})\nDetay: ${baseUrl}/?task_id=${task.id}\n${task.description || ''}`;

    const startDate = task.current_start_date ? new Date(task.current_start_date) : new Date(task.created_at);
    const dueDate = task.current_due_date ? new Date(task.current_due_date) : new Date(startDate.getTime() + 3600000);

    const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startStr = fmtUtc(startDate);
    const dueStr = fmtUtc(dueDate);

    // 1. .ics indirme linki
    const icsDownloadUrl = `${baseUrl}/api/tasks/${task.id}/calendar.ics`;

    // 2. Outlook Web Deeplink
    const outlookWebUrl = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(startDate.toISOString())}&enddt=${encodeURIComponent(dueDate.toISOString())}&body=${encodeURIComponent(desc)}&location=${encodeURIComponent(proj)}`;

    // 3. Google Calendar Deeplink
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${dueStr}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(proj)}`;

    return { icsDownloadUrl, outlookWebUrl, googleCalendarUrl };
  }

  /**
   * Outlook ve tüm e-posta istemcilerinde Adaptive Cards rehberindeki (outlook_adaptive_cards_rehberi.md)
   * kart tasarımını birebir oluşturan görsel kart şablonu
   */
  public renderAdaptiveCardHtmlFrame(options: {
    categoryTag: string;
    categoryColor?: string;
    badgeText: string;
    badgeType?: 'ready' | 'progress' | 'done' | 'blocked' | 'delay';
    projectTitle: string;
    taskTitle: string;
    subtitleText?: string;
    facts: Array<{ label: string; value: string }>;
    progress?: number;
    noteSection?: {
      title: string;
      content: string;
      isWarning?: boolean;
    };
    unlockedTasks?: string[];
    calendarBox?: {
      startDateStr: string;
      dueDateStr: string;
      icsDownloadUrl: string;
      outlookWebUrl: string;
      googleCalendarUrl: string;
    };
    actionButtons?: Array<{
      title: string;
      url: string;
      style?: 'primary' | 'success' | 'warning' | 'secondary';
    }>;
    quickProgressPillUrlPattern?: string;
    baseUrl: string;
  }): string {
    const badgeColors = {
      ready: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
      progress: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      done: { bg: '#ecfdf5', border: '#10b981', text: '#047857' },
      blocked: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
      delay: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    };
    const bColor = badgeColors[options.badgeType || 'ready'];

    const factsHtml = options.facts.map(f => `
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600; width: 145px; vertical-align: top;">${f.label}</td>
        <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; vertical-align: top;">${f.value}</td>
      </tr>
    `).join('');

    const progressHtml = options.progress !== undefined ? `
      <div style="margin: 14px 0 10px 0; padding: 12px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 700;">
          <span style="color: #475569;">İlerleme Oranı</span>
          <span style="color: #2563eb; font-size: 13px;">%${options.progress}</span>
        </div>
        <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.max(4, Math.min(100, options.progress))}%; background: linear-gradient(90deg, #2563eb, #3b82f6); border-radius: 999px;"></div>
        </div>
      </div>
    ` : '';

    const quickChipsHtml = options.quickProgressPillUrlPattern ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px;">
          ⚡ Hızlı İlerleme Bildirimi (%40 / %50 / %60) — E-postadan Tek Tıkla Bildir:
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <a href="${options.quickProgressPillUrlPattern}20" style="display: inline-block; padding: 5px 10px; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">%20</a>
          <a href="${options.quickProgressPillUrlPattern}40" style="display: inline-block; padding: 5px 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">%40 Bildir</a>
          <a href="${options.quickProgressPillUrlPattern}50" style="display: inline-block; padding: 5px 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">%50 Yarılandı</a>
          <a href="${options.quickProgressPillUrlPattern}60" style="display: inline-block; padding: 5px 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">%60 Bildir</a>
          <a href="${options.quickProgressPillUrlPattern}80" style="display: inline-block; padding: 5px 10px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">%80 Son Aşama</a>
        </div>
      </div>
    ` : '';

    const noteHtml = options.noteSection ? `
      <div style="margin: 14px 0; padding: 12px 14px; background: ${options.noteSection.isWarning ? '#fffbeb' : '#f0fdf4'}; border-left: 4px solid ${options.noteSection.isWarning ? '#f59e0b' : '#10b981'}; border-radius: 8px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${options.noteSection.isWarning ? '#b45309' : '#166534'}; margin-bottom: 4px;">
          ${options.noteSection.title}
        </div>
        <div style="font-size: 13px; color: ${options.noteSection.isWarning ? '#78350f' : '#14532d'}; font-weight: 600; line-height: 1.45;">
          "${options.noteSection.content}"
        </div>
      </div>
    ` : '';

    const unlockedHtml = (options.unlockedTasks && options.unlockedTasks.length > 0) ? `
      <div style="margin: 14px 0; padding: 12px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
        <div style="font-size: 12px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">
          🔓 Kilidi Açılan ve Sıraya Giren Ardıl Görevler:
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e3a8a; font-weight: 600;">
          ${options.unlockedTasks.map(t => `<li style="margin: 2px 0;">${t}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const calendarHtml = options.calendarBox ? `
      <div style="margin: 16px 0; padding: 14px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.3px;">
            📅 KİŞİSEL TAKVİMİNİZE EKLEYİN (HATIRLATICI ALARMLI)
          </span>
          <span style="font-size: 11px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 999px;">
            🔔 1 Gün & 2 Saat Kala Alarm
          </span>
        </div>
        <div style="font-size: 12px; color: #14532d; line-height: 1.45; margin-bottom: 10px;">
          Planlanan Termin: <strong>${options.calendarBox.startDateStr} ➔ ${options.calendarBox.dueDateStr}</strong>. Görevi unutmamak için tek tıkla kendi takviminize işleyebilirsiniz:
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <a href="${options.calendarBox.icsDownloadUrl}" style="display: inline-block; padding: 7px 13px; background: #16a34a; color: #ffffff; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
            📅 Outlook / Telefon (.ics)
          </a>
          <a href="${options.calendarBox.outlookWebUrl}" target="_blank" style="display: inline-block; padding: 7px 13px; background: #0284c7; color: #ffffff; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">
            🌐 Outlook Web (M365)
          </a>
          <a href="${options.calendarBox.googleCalendarUrl}" target="_blank" style="display: inline-block; padding: 7px 13px; background: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">
            📆 Google Takvim
          </a>
        </div>
      </div>
    ` : '';

    const buttonsHtml = (options.actionButtons && options.actionButtons.length > 0) ? `
      <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        ${options.actionButtons.map(b => {
      let bg = '#2563eb';
      let color = '#ffffff';
      let border = '#2563eb';
      if (b.style === 'success') { bg = '#059669'; color = '#ffffff'; border = '#059669'; }
      else if (b.style === 'warning') { bg = '#d97706'; color = '#ffffff'; border = '#d97706'; }
      else if (b.style === 'secondary') { bg = '#ffffff'; color = '#1e293b'; border = '#cbd5e1'; }
      return `<a href="${b.url}" style="display: inline-block; padding: 10px 18px; background: ${bg}; color: ${color}; border: 1px solid ${border}; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">${b.title}</a>`;
    }).join('')}
      </div>
    ` : '';

    return `
      <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Header Ribbon -->
        <div style="background: #0f172a; padding: 14px 20px; border-bottom: 2px solid #3b82f6;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${options.categoryTag}
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #94a3b8; margin-top: 2px;">
                  📁 ${options.projectTitle}
                </div>
              </td>
              <td style="vertical-align: middle; text-align: right;">
                <span style="display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; background: ${bColor.bg}; color: ${bColor.text}; border: 1px solid ${bColor.border};">
                  ${options.badgeText}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Main Card Body -->
        <div style="padding: 22px 24px;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            ${options.taskTitle}
          </h2>
          ${options.subtitleText ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">${options.subtitleText}</p>` : ''}

          <!-- FactSet Container -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              ${factsHtml}
            </table>
          </div>

          ${progressHtml}
          ${noteHtml}
          ${unlockedHtml}
          ${calendarHtml}
          ${quickChipsHtml}
          ${buttonsHtml}
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
          <span>FG Group Proje ve Görev Takip Sistemi</span>
          <a href="${options.baseUrl}" style="color: #2563eb; font-weight: 700; text-decoration: none;">Sistemi Aç ➔</a>
        </div>
      </div>
    `;
  }

  /**
   * Yardımcı: Projedeki yetkili kişilerin (PROJECT_MANAGER, EDITOR, Proje Kurucusu ve ADMIN) e-posta adreslerini döndürür
   */
  public getProjectAuthorityEmails(tenant_id: UUID, project_id: UUID, exclude_user_id?: UUID): string[] {
    const authUserIds = this.notificationService.getProjectAuthorityUserIds(tenant_id, project_id, exclude_user_id);
    const emails = new Set<string>();
    for (const uid of authUserIds) {
      const u = this.db.getUserById(tenant_id, uid);
      if (u?.email) emails.add(u.email);
    }
    if (emails.size === 0) {
      const admin = this.db.getUsers(tenant_id).find(u => u.system_role === 'ADMIN');
      if (admin?.email) emails.add(admin.email);
    }
    return Array.from(emails);
  }

  /**
   * Adaptive Card ortak İlerleme Yüzdesi (%20, %40, %50, %60, %80, %100) ChoiceSet bloğu
   */
  private buildProgressChoiceSet(currentProgress = 40) {
    const defaultVal = [20, 40, 50, 60, 80, 100].includes(currentProgress) ? String(currentProgress) : '50';
    return {
      type: 'Input.ChoiceSet',
      id: 'progressValue',
      label: '📊 Tamamlanma / İlerleme Oranı Seçin (%40, %50, %60 vb.):',
      style: 'compact',
      value: defaultVal,
      choices: [
        { title: '%20 — Başlangıç & Hazırlık Yapıldı', value: '20' },
        { title: '%40 — İlk Aşama Tamamlandı (%40)', value: '40' },
        { title: '%50 — İş Yarılandı (%50)', value: '50' },
        { title: '%60 — Kritik Kısım Tamamlandı (%60)', value: '60' },
        { title: '%80 — Son Kontroller Yapılıyor (%80)', value: '80' },
        { title: '%100 — Tamamlandı Olarak Kapat (%100)', value: '100' }
      ]
    };
  }

  /**
   * 1. Görev HAZIR (READY) Olduğunda Gönderilen Canlı Outlook Adaptive Card (Rehber Örnek A)
   */
  public async sendTaskReadyActionableCard(tenant_id: UUID, task_id: UUID): Promise<EmailOutboxItem | null> {
    const config = this.getSmtpConfig(tenant_id);
    if (!config.enable_actionable_cards) return null;

    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.assignee_id || !task.project_id) return null;

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
      body: [
        {
          type: 'TextBlock',
          text: `📁 ${project?.title || 'FG Group Projesi'} • SIRA SİZDE`,
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
          text: task.description || 'Öncül görevler tamamlandı. Görevinize hemen başlayabilir, %40/%50/%60 ilerleme bildirebilir veya tamamlayabilirsiniz.',
          isSubtle: true,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Durum:', value: `HAZIR (${task.work_status}) • Mevcut İlerleme: %${task.progress || 0}` },
            { title: 'Sorumlu:', value: `${assignee.name} (${assignee.department || 'Ekip'})` },
            { title: 'Hedef Teslim:', value: dueStr },
            ...predFacts
          ]
        },
        this.buildProgressChoiceSet(task.progress || 50),
        {
          type: 'Input.Text',
          id: 'explanationText',
          label: '📝 Yapılan İş / İlerleme veya Gecikme Notu (Zorunlu):',
          placeholder: 'Örn: %50 numune dikimi tamamlandı, yarın ütü ve kalite kontrole geçilecek (İlerleme/Açıklama için zorunludur)...',
          isMultiline: true,
          isRequired: true
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
            action: 'START_TASK',
            explanation_text: '{{explanationText.value}}'
          })
        },
        {
          type: 'Action.Http',
          title: '📊 İlerleme (%40-%60) & Not Kaydet',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'UPDATE_PROGRESS',
            progress_value: '{{progressValue.value}}',
            explanation_text: '{{explanationText.value}}'
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
            action: 'COMPLETE_TASK',
            explanation_text: '{{explanationText.value}}'
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

    const icsContent = this.generateTaskIcsContent({
      task,
      projectTitle: project?.title,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      baseUrl
    });
    const calLinks = this.buildCalendarLinks({
      task,
      projectTitle: project?.title,
      baseUrl
    });

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: `📁 ${project?.title || 'FG Group Projesi'} • SIRA SİZDE`,
      badgeText: '🟢 Başlamaya Hazır (READY)',
      badgeType: 'ready',
      projectTitle: project?.title || 'FG Group Projesi',
      taskTitle: task.title,
      subtitleText: task.description || 'Öncül görevler tamamlandı. Görevinize hemen başlayabilir, %40/%50/%60 ilerleme bildirebilir veya tamamlayabilirsiniz.',
      facts: [
        { label: 'Durum:', value: `🟢 HAZIR (${task.work_status})` },
        { label: 'Sorumlu:', value: `${assignee.name} (${assignee.department || 'Ekip'})` },
        { label: 'Hedef Teslim:', value: dueStr },
        ...(predFacts.map(pf => ({ label: pf.title, value: pf.value })))
      ],
      progress: task.progress || 0,
      calendarBox: {
        startDateStr: task.current_start_date ? task.current_start_date.slice(0, 10) : '-',
        dueDateStr: dueStr,
        ...calLinks
      },
      quickProgressPillUrlPattern: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=UPDATE_PROGRESS&progress=`,
      actionButtons: [
        {
          title: '▶️ Görevi Başlat (%25)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=START_TASK`,
          style: 'primary'
        },
        {
          title: '✅ Tamamlandı İşaretle (%100)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=COMPLETE_TASK`,
          style: 'success'
        },
        {
          title: '🔗 Görev Detayını Aç & Yönet ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'secondary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: [assignee.email],
      subject: `🔔 Sıra Sizde: ${task.title} Hazır`,
      category: 'ACTIONABLE_TASK_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id,
      icalEvent: {
        filename: `gorev_${task.id.slice(0, 8)}.ics`,
        content: icsContent
      }
    });
  }

  /**
   * 1.B. Kullanıcıya Yeni Görev Atandığında Gönderilen Bilgilendirme & Canlı Aksiyon Kartı
   */
  public async sendTaskAssignedActionableCard(
    tenant_id: UUID,
    task_id: UUID,
    assigned_by_name = 'Proje Yönetimi'
  ): Promise<EmailOutboxItem | null> {
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.assignee_id || !task.project_id) return null;

    const assignee = this.db.getUserById(tenant_id, task.assignee_id);
    if (!assignee) return null;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    this.notificationService.notifyTaskAssigned(
      tenant_id,
      task.project_id,
      task.id,
      assignee.id,
      task.title,
      assigned_by_name
    );

    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const startStr = task.current_start_date ? task.current_start_date.slice(0, 10) : '-';
    const dueStr = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    const preds = this.db.getPredecessors(tenant_id, task.id);
    const predTitles = preds.map(d => {
      const pt = this.db.getTaskById(tenant_id, d.predecessor_id);
      return pt ? `${pt.title} (${pt.work_status === 'COMPLETED' ? 'Tamamlandı ✓' : 'Bekleniyor ⏳'})` : '';
    }).filter(Boolean);

    const isBlocked = task.work_status === 'BLOCKED';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📌 YENİ GÖREV ATANDI • ${project?.title || 'FG Group Projesi'}`,
          weight: 'Bolder',
          color: isBlocked ? 'Warning' : 'Accent',
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
          text: task.description || `${assigned_by_name} tarafından bu görev sizin sorumluluğunuza atandı.`,
          isSubtle: true,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project?.title || 'FG Group' },
            { title: 'Atayan Yetkili:', value: assigned_by_name },
            { title: 'Sorumlu:', value: `${assignee.name} (${assignee.department || 'Ekip'})` },
            { title: 'Planlanan Takvim:', value: `${startStr} ➔ ${dueStr}` },
            { title: 'Başlangıç Durumu:', value: isBlocked ? '⏳ ÖNCÜL BEKLİYOR (BLOCKED)' : '🟢 BAŞLAMAYA HAZIR (READY)' },
            ...(predTitles.length > 0 ? [{ title: 'Öncül Görevler:', value: predTitles.join(' | ') }] : [])
          ]
        },
        ...(!isBlocked ? [this.buildProgressChoiceSet(task.progress || 40)] : []),
        {
          type: 'Input.Text',
          id: 'explanationText',
          label: '📝 Görev / İlerleme Notu veya Açıklama (Zorunlu):',
          placeholder: 'Yaptığınız çalışmayı, %40/%50/%60 ilerleme detayını veya hazırlık notunuzu yazınız...',
          isMultiline: true,
          isRequired: true
        }
      ],
      actions: isBlocked ? [
        {
          type: 'Action.Http',
          title: '📝 Hazırlık / Durum Notu Kaydet',
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
          type: 'Action.OpenUrl',
          title: '🔗 Proje Paneline Git',
          url: baseUrl
        }
      ] : [
        {
          type: 'Action.Http',
          title: '▶️ Görevi Başlat',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'START_TASK',
            explanation_text: '{{explanationText.value}}'
          })
        },
        {
          type: 'Action.Http',
          title: '📊 İlerleme (%40-%60) & Not Kaydet',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'UPDATE_PROGRESS',
            progress_value: '{{progressValue.value}}',
            explanation_text: '{{explanationText.value}}'
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
            action: 'COMPLETE_TASK',
            explanation_text: '{{explanationText.value}}'
          })
        },
        {
          type: 'Action.Http',
          title: '📝 Not / Açıklama Gönder',
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

    const icsContent = this.generateTaskIcsContent({
      task,
      projectTitle: project?.title,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      baseUrl
    });
    const calLinks = this.buildCalendarLinks({
      task,
      projectTitle: project?.title,
      baseUrl
    });

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: `📌 YENİ GÖREV ATAMA BİLDİRİMİ • ${project?.title || 'FG GROUP'}`,
      badgeText: isBlocked ? '⏳ Öncül Bekliyor (BLOCKED)' : '🟢 Başlamaya Hazır (READY)',
      badgeType: isBlocked ? 'blocked' : 'ready',
      projectTitle: project?.title || 'FG Group Projesi',
      taskTitle: task.title,
      subtitleText: `Merhaba <strong>${assignee.name}</strong>, <strong>${assigned_by_name}</strong> tarafından <strong>${project?.title || 'Proje'}</strong> kapsamında bu görev size atandı.`,
      facts: [
        { label: 'Proje:', value: project?.title || 'FG Group' },
        { label: 'Atayan Yetkili:', value: assigned_by_name },
        { label: 'Sorumlu:', value: `${assignee.name} (${assignee.department || 'Ekip'})` },
        { label: 'Planlanan Takvim:', value: `${startStr} ➔ ${dueStr}` },
        { label: 'Başlangıç Durumu:', value: isBlocked ? '⏳ Öncül Görev Bekliyor (BLOCKED)' : '🟢 Başlamaya Hazır (READY)' },
        ...(predTitles.length > 0 ? [{ label: 'Öncül Görevler:', value: predTitles.join(', ') }] : [])
      ],
      progress: task.progress || 0,
      calendarBox: {
        startDateStr: startStr,
        dueDateStr: dueStr,
        ...calLinks
      },
      quickProgressPillUrlPattern: !isBlocked
        ? `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=UPDATE_PROGRESS&progress=`
        : undefined,
      actionButtons: !isBlocked ? [
        {
          title: '▶️ Görevi Başlat (%25)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=START_TASK`,
          style: 'primary'
        },
        {
          title: '✅ Tamamlandı İşaretle (%100)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=COMPLETE_TASK`,
          style: 'success'
        },
        {
          title: '🔗 Görev Detayını Aç & Yönet ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'secondary'
        }
      ] : [
        {
          title: '🔗 Görev Detayını Aç & Yönet ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: [assignee.email],
      subject: `📌 Yeni Görev Atandı: ${task.title} (${project?.title || 'Proje'})`,
      category: 'TASK_ASSIGNED_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id,
      icalEvent: {
        filename: `gorev_${task.id.slice(0, 8)}.ics`,
        content: icsContent
      }
    });
  }

  /**
   * 1.C. Kullanıcı Projeye Dahil Edildiğinde Gönderilen Bilgilendirme E-postası & Adaptive Card
   */
  public async sendProjectMemberAddedCard(
    tenant_id: UUID,
    project_id: UUID,
    user_id: UUID,
    role: string,
    added_by_name = 'Proje Yöneticisi'
  ): Promise<EmailOutboxItem | null> {
    const project = this.db.getProjectById(tenant_id, project_id);
    const user = this.db.getUserById(tenant_id, user_id);
    if (!project || !user) return null;

    this.notificationService.notifyProjectMemberAdded(
      tenant_id,
      project.id,
      user.id,
      project.title,
      role,
      added_by_name
    );

    const roleMap: Record<string, string> = {
      PROJECT_MANAGER: '👑 Proje Yöneticisi (Tam Yetki)',
      EDITOR: '✏️ Proje Editörü (Görev & Plan Düzenleme)',
      VIEWER: '👁️ Tam Görüntüleyici (Tüm Proje Akışı & Gantt)'
    };
    const roleLabel = roleMap[role] || role;
    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const tasksCount = this.db.getTasks(tenant_id, project.id).length;
    const startStr = project.current_start_date ? project.current_start_date.slice(0, 10) : '-';
    const dueStr = project.current_due_date ? project.current_due_date.slice(0, 10) : '-';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📁 PROJEYE DAHİL EDİLDİNİZ • FG GROUP`,
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: project.title,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'TextBlock',
          text: project.description || `${added_by_name} sizi bu proje ekibine dahil etti.`,
          isSubtle: true,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Personel:', value: `${user.name} (${user.department || 'Ekip'})` },
            { title: 'Projedeki Rolünüz:', value: roleLabel },
            { title: 'Ekleyen Yetkili:', value: added_by_name },
            { title: 'Proje Takvimi:', value: `${startStr} ➔ ${dueStr}` },
            { title: 'Toplam İş Paketi:', value: `${tasksCount} Görev` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '🚀 Projeyi ve Görevleri Görüntüle',
          url: baseUrl
        }
      ]
    };

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '📁 PROJEYE DAHİL EDİLDİNİZ • FG GROUP',
      badgeText: roleLabel,
      badgeType: 'progress',
      projectTitle: project.title,
      taskTitle: `Projeye Dahil Edildiniz: ${project.title}`,
      subtitleText: `Merhaba <strong>${user.name}</strong>, <strong>${added_by_name}</strong> sizi <strong>${project.title}</strong> projesine <strong>${roleLabel}</strong> rolüyle dahil etti.`,
      facts: [
        { label: 'Personel:', value: `${user.name} (${user.department || 'Ekip'})` },
        { label: 'Projedeki Rolünüz:', value: roleLabel },
        { label: 'Ekleyen Yetkili:', value: added_by_name },
        { label: 'Proje Takvimi:', value: `${startStr} ➔ ${dueStr}` },
        { label: 'Toplam İş Paketi:', value: `${tasksCount} Görev` }
      ],
      actionButtons: [
        {
          title: '🚀 Projeyi ve Görevleri Görüntüle ➔',
          url: `${baseUrl}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: [user.email],
      subject: `📁 Projeye Dahil Edildiniz: ${project.title} (${roleLabel})`,
      category: 'PROJECT_MEMBER_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_project_id: project.id
    });
  }

  /**
   * 1.D. Proje Adımlarında Bir İş Tamamlandığında Projedeki Yetkili Kişilere Giden Bilgilendirme Maili & Kartı
   */
  public async sendTaskCompletedToManagersCard(
    tenant_id: UUID,
    task_id: UUID,
    completed_by_user_id: UUID,
    completion_note?: string,
    newlyReadyTaskIds: UUID[] = []
  ): Promise<EmailOutboxItem | null> {
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.project_id) return null;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const completedBy = this.db.getUserById(tenant_id, completed_by_user_id)
      || (task.assignee_id ? this.db.getUserById(tenant_id, task.assignee_id) : undefined);
    const performerName = completedBy?.name || 'Görev Sorumlusu';

    this.notificationService.notifyTaskCompletedToManagers(
      tenant_id,
      task.project_id,
      task.id,
      performerName,
      task.title,
      completion_note
    );

    const managerEmails = this.getProjectAuthorityEmails(tenant_id, task.project_id);
    if (managerEmails.length === 0) return null;

    const projectTasks = this.db.getTasks(tenant_id, task.project_id);
    const doneCount = projectTasks.filter(t => t.work_status === 'COMPLETED').length;
    const totalCount = projectTasks.length;
    const projectRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

    const unlockedDetails = newlyReadyTaskIds.map(rid => {
      const rt = this.db.getTaskById(tenant_id, rid);
      if (!rt) return '';
      const ra = rt.assignee_id ? this.db.getUserById(tenant_id, rt.assignee_id) : null;
      return `${rt.title} (Sorumlu: ${ra?.name || 'Atanmamış'})`;
    }).filter(Boolean);

    const isLate = task.actual_completion_date && task.current_due_date
      ? new Date(task.actual_completion_date) > new Date(task.current_due_date)
      : false;

    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `✅ PROJE ADIMI TAMAMLANDI • YETKİLİ BİLGİLENDİRME`,
          weight: 'Bolder',
          color: 'Good',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: `${performerName}, "${task.title}" görevini tamamladı!`,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project?.title || 'FG Group Projesi' },
            { title: 'Tamamlanan Görev:', value: task.title },
            { title: 'Tamamlayan Kişi:', value: `${performerName} (${completedBy?.department || 'Ekip'})` },
            { title: 'Teslim Durumu:', value: isLate ? '⚠️ Gecikmeli Tamamlandı' : '🟢 Zamanında Tamamlandı ✓' },
            { title: 'Proje İlerlemesi:', value: `%${projectRate} (${doneCount}/${totalCount} Görev Tamamlandı)` },
            ...(completion_note ? [{ title: 'Personel Notu:', value: completion_note }] : []),
            ...(unlockedDetails.length > 0 ? [{ title: 'Yeni Açılan Adım:', value: unlockedDetails.join(' | ') }] : [])
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '📊 Proje Durumunu ve Gantt Takvimini Gör',
          url: baseUrl
        }
      ]
    };

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '✅ PROJE ADIMI TAMAMLANDI • YÖNETİCİ BİLGİLENDİRMESİ',
      badgeText: isLate ? '⚠️ Gecikmeli Tamamlandı' : '✓ Tamamlandı (%100)',
      badgeType: 'done',
      projectTitle: project?.title || 'FG Group Projesi',
      taskTitle: `${performerName}, "${task.title}" Görevini Tamamladı!`,
      subtitleText: `<strong>${project?.title || 'Proje'}</strong> kapsamında yürütülen <strong>${task.title}</strong> görevi <strong>%100 tamamlandı</strong> olarak işaretlendi.`,
      facts: [
        { label: 'Proje:', value: project?.title || 'FG Group Projesi' },
        { label: 'Tamamlanan Görev:', value: task.title },
        { label: 'Tamamlayan Kişi:', value: `${performerName} (${completedBy?.department || 'Ekip'})` },
        { label: 'Teslim Durumu:', value: isLate ? '⚠️ Gecikmeli Tamamlandı' : '🟢 Zamanında Tamamlandı ✓' },
        { label: 'Proje İlerlemesi:', value: `%${projectRate} (${doneCount}/${totalCount} Görev Tamamlandı)` }
      ],
      progress: 100,
      noteSection: completion_note ? {
        title: 'Personel Tamamlama / Açıklama Notu',
        content: completion_note,
        isWarning: false
      } : undefined,
      unlockedTasks: unlockedDetails,
      actionButtons: [
        {
          title: '📊 Proje Durumunu ve Gantt Takvimini Gör ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: managerEmails,
      subject: `✅ Görev Tamamlandı: ${performerName} — ${task.title} (${project?.title || 'Proje'})`,
      category: 'TASK_COMPLETED_MANAGER_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id
    });
  }

  /**
   * 1.E. Personel %40, %50, %60 İlerleme + Zorunlu Not Girdiğinde Proje Yetkililerine Giden Mail & Kart
   */
  public async sendTaskProgressUpdateToManagersCard(
    tenant_id: UUID,
    task_id: UUID,
    updated_by_user_id: UUID,
    progress: number,
    note_text: string
  ): Promise<EmailOutboxItem | null> {
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.project_id) return null;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const user = this.db.getUserById(tenant_id, updated_by_user_id)
      || (task.assignee_id ? this.db.getUserById(tenant_id, task.assignee_id) : undefined);
    const userName = user?.name || 'Görev Sorumlusu';

    this.notificationService.notifyTaskProgressToManagers(
      tenant_id,
      task.project_id,
      task.id,
      userName,
      task.title,
      progress,
      note_text
    );

    const managerEmails = this.getProjectAuthorityEmails(tenant_id, task.project_id);
    if (managerEmails.length === 0) return null;

    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📊 GÖREV İLERLEME BİLDİRİMİ (%${progress}) • YETKİLİ BİLGİSİ`,
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: `${userName}: "${task.title}" görevini %${progress} seviyesine güncelledi`,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project?.title || 'FG Group Projesi' },
            { title: 'Görev:', value: task.title },
            { title: 'Güncelleyen Kişi:', value: `${userName} (${user?.department || 'Ekip'})` },
            { title: 'Yeni İlerleme Oranı:', value: `%${progress} (DEVAM EDİYOR)` },
            { title: 'Zorunlu Açıklama Notu:', value: note_text }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '🔍 Görev Detayını ve Notları Görüntüle',
          url: baseUrl
        }
      ]
    };

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: `📊 GÖREV İLERLEME BİLDİRİMİ • YETKİLİ BİLGİSİ`,
      badgeText: `⚡ Devam Ediyor (%${progress})`,
      badgeType: 'progress',
      projectTitle: project?.title || 'FG Group Projesi',
      taskTitle: `${userName}: "${task.title}" Görevinde %${progress} İlerleme Bildirdi`,
      subtitleText: `<strong>${project?.title || 'Proje'}</strong> kapsamında yürütülen <strong>${task.title}</strong> görevinin ilerleme oranı güncellendi ve personel notu kaydedildi.`,
      facts: [
        { label: 'Proje:', value: project?.title || 'FG Group Projesi' },
        { label: 'Görev:', value: task.title },
        { label: 'Güncelleyen Kişi:', value: `${userName} (${user?.department || 'Ekip'})` },
        { label: 'Yeni İlerleme Oranı:', value: `%${progress} (DEVAM EDİYOR)` }
      ],
      progress,
      noteSection: {
        title: 'Personel Zorunlu Açıklama Notu',
        content: note_text,
        isWarning: false
      },
      actionButtons: [
        {
          title: '🔍 Görev Detayını ve Notları İncele ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: managerEmails,
      subject: `📊 İlerleme (%${progress}): ${userName} — ${task.title} (${project?.title || 'Proje'})`,
      category: 'TASK_PROGRESS_MANAGER_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id
    });
  }

  /**
   * 2. Görev Zamanında Yapılmadığında (KAB07) Sorumluya Giden Zorunlu Mazeret + İlerleme (%40-%60) Kartı
   *    ve Proje Yetkililerine Giden Gecikme Uyarısı Maili!
   */
  public async sendDelayExplanationActionableCard(tenant_id: UUID, task_id: UUID): Promise<EmailOutboxItem | null> {
    const config = this.getSmtpConfig(tenant_id);
    if (!config.enable_actionable_cards) return null;

    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.assignee_id || !task.project_id) return null;

    const assignee = this.db.getUserById(tenant_id, task.assignee_id);
    if (!assignee) return null;

    // Aynı görev için bekleyen mazeret kartı varsa mükerrer gönderme
    const existingCard = this.db.getEmailOutbox(tenant_id, 50).find(
      item => item.category === 'DELAY_EXPLANATION_CARD' && item.linked_task_id === task_id && !item.action_taken
    );
    if (existingCard) return existingCard;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const succs = this.db.getSuccessors(tenant_id, task.id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const dueStr = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `⚠️ GÖREV ZAMANINDA YAPILMADI • TERMİN AŞILDI (KAB07)`,
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
            { title: 'Mevcut İlerleme:', value: `%${task.progress || 0}` },
            { title: 'Bekleyen Ardıl İş:', value: `${succs.length} görev tamamlanmasını bekliyor` }
          ]
        },
        this.buildProgressChoiceSet(task.progress || 50),
        {
          type: 'Input.Text',
          id: 'explanationText',
          label: '📝 Gecikme Nedeni ve Mevcut İlerleme Açıklaması (Zorunlu):',
          placeholder: 'Görevin neden zamanında tamamlanmadığını ve yapılan kısmı (%40/%50/%60) buraya yazınız...',
          isMultiline: true,
          isRequired: true
        }
      ],
      actions: [
        {
          type: 'Action.Http',
          title: '📊 İlerleme (%40-%60) & Mazeret Kaydet',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'UPDATE_PROGRESS',
            progress_value: '{{progressValue.value}}',
            explanation_text: '{{explanationText.value}}'
          })
        },
        {
          type: 'Action.Http',
          title: '📝 Sadece Mazereti Kaydet ve Yöneticiye Bildir',
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
          title: '✅ Görevi Şimdi Tamamla (%100)',
          method: 'POST',
          url: `${baseUrl}/api/outlook/action`,
          body: JSON.stringify({
            tenant_id,
            task_id: task.id,
            user_id: assignee.id,
            action: 'COMPLETE_TASK',
            explanation_text: '{{explanationText.value}}'
          })
        }
      ]
    };

    const icsContent = this.generateTaskIcsContent({
      task,
      projectTitle: project?.title,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      baseUrl
    });
    const calLinks = this.buildCalendarLinks({
      task,
      projectTitle: project?.title,
      baseUrl
    });

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '⚠️ GÖREV ZAMANINDA YAPILMADI • TERMİN AŞILDI (KAB07)',
      badgeText: '🚨 Termin Aşıldı (Gecikme)',
      badgeType: 'delay',
      projectTitle: project?.title || 'FG Group',
      taskTitle: task.title,
      subtitleText: `Merhaba <strong>${assignee.name}</strong>, bu görevin teslim tarihi (<strong>${dueStr}</strong>) aşılmıştır ve <strong>${succs.length} ardıl görev</strong> sizin görevinizi beklemektedir. Lütfen e-postadan veya panelden ilerleme yüzdesini (%40, %50, %60) ve zorunlu gecikme açıklamanızı giriniz.`,
      facts: [
        { label: 'Proje:', value: project?.title || 'FG Group' },
        { label: 'Sorumlu:', value: assignee.name },
        { label: 'Aşılan Termin:', value: dueStr },
        { label: 'Mevcut İlerleme:', value: `%${task.progress || 0}` },
        { label: 'Bekleyen Ardıl İş:', value: `${succs.length} görev tamamlanmasını bekliyor` }
      ],
      progress: task.progress || 0,
      calendarBox: {
        startDateStr: task.current_start_date ? task.current_start_date.slice(0, 10) : '-',
        dueDateStr: dueStr,
        ...calLinks
      },
      quickProgressPillUrlPattern: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=UPDATE_PROGRESS&progress=`,
      actionButtons: [
        {
          title: '✅ Görevi Şimdi Tamamla (%100)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&task_id=${task.id}&user_id=${assignee.id}&action=COMPLETE_TASK`,
          style: 'success'
        },
        {
          title: '🔗 Görev Detayını Aç & Mazeret Yaz ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'warning'
        }
      ],
      baseUrl
    });

    const assigneeMail = await this.dispatchEmail({
      tenant_id,
      to: [assignee.email],
      subject: `⚠️ Gecikme Açıklaması Gerekli (Termin Aşıldı): ${task.title}`,
      category: 'DELAY_EXPLANATION_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: task.id,
      linked_project_id: task.project_id,
      icalEvent: {
        filename: `gorev_${task.id.slice(0, 8)}.ics`,
        content: icsContent
      }
    });

    // Aynı anda projedeki yetkili kişilere de "Bu kişi verilen görevi zamanında yapmadı" uyarısı gönder!
    await this.sendOverdueAlertToManagersCard(tenant_id, task.id);

    return assigneeMail;
  }

  /**
   * 2.B. Kullanıcı Verilen Görevi Zamanında Yapmadığında Proje Yetkililerine Giden Uyarı Maili
   */
  public async sendOverdueAlertToManagersCard(tenant_id: UUID, task_id: UUID): Promise<EmailOutboxItem | null> {
    const task = this.db.getTaskById(tenant_id, task_id);
    if (!task || !task.project_id) return null;

    const existingAlert = this.db.getEmailOutbox(tenant_id, 50).find(
      item => item.category === 'OVERDUE_MANAGER_ALERT' && item.linked_task_id === task_id
    );
    if (existingAlert) return existingAlert;

    const project = this.db.getProjectById(tenant_id, task.project_id);
    const assignee = task.assignee_id ? this.db.getUserById(tenant_id, task.assignee_id) : null;
    const assigneeName = assignee?.name || 'Atanmamış';
    const dueStr = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    this.notificationService.notifyOverdueTaskToManagers(
      tenant_id,
      task.project_id,
      task.id,
      assigneeName,
      task.title,
      dueStr
    );

    const managerEmails = this.getProjectAuthorityEmails(tenant_id, task.project_id, task.assignee_id);
    if (managerEmails.length === 0) return null;

    const succs = this.db.getSuccessors(tenant_id, task.id);
    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `🚨 GECİKEN GÖREV UYARISI • PROJE YETKİLİ BİLDİRİMİ`,
          weight: 'Bolder',
          color: 'Attention',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: `${assigneeName}, "${task.title}" görevini zamanında tamamlamadı!`,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Proje:', value: project?.title || 'FG Group Projesi' },
            { title: 'Geciken Görev:', value: task.title },
            { title: 'Sorumlu Personel:', value: `${assigneeName} (${assignee?.email || '-'})` },
            { title: 'Aşılan Teslim Tarihi:', value: dueStr },
            { title: 'Mevcut Durum / İlerleme:', value: `${task.work_status} (%${task.progress || 0})` },
            { title: 'Etkilenen Ardıl Görev:', value: `${succs.length} görev bekliyor` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '🚨 Darboğaz ve Gecikme Detayını İncele',
          url: baseUrl
        }
      ]
    };

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '🚨 GECİKEN GÖREV UYARISI • PROJE YETKİLİ BİLDİRİMİ',
      badgeText: '🚨 Termin Aşıldı',
      badgeType: 'delay',
      projectTitle: project?.title || 'FG Group Projesi',
      taskTitle: `${assigneeName}, "${task.title}" Görevini Zamanında Tamamlamadı!`,
      subtitleText: `<strong>${project?.title || 'Proje'}</strong> kapsamındaki <strong>${task.title}</strong> görevinin hedef teslim tarihi (<strong>${dueStr}</strong>) geçmiştir. Sorumlu personele zorunlu mazeret ve ilerleme (%40/%50/%60) bildirimi iletilmiştir.`,
      facts: [
        { label: 'Proje:', value: project?.title || 'FG Group Projesi' },
        { label: 'Geciken Görev:', value: task.title },
        { label: 'Sorumlu Personel:', value: `${assigneeName} (${assignee?.email || '-'})` },
        { label: 'Aşılan Teslim Tarihi:', value: dueStr },
        { label: 'Mevcut Durum / İlerleme:', value: `${task.work_status} (%${task.progress || 0})` },
        { label: 'Etkilenen Ardıl Görev:', value: `${succs.length} görev bekliyor` }
      ],
      progress: task.progress || 0,
      actionButtons: [
        {
          title: '🚨 Darboğaz ve Gecikme Detayını İncele ➔',
          url: `${baseUrl}/?task_id=${task.id}`,
          style: 'warning'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: managerEmails,
      subject: `🚨 Geciken Görev Uyarısı: ${assigneeName} — "${task.title}" zamanında tamamlanmadı!`,
      category: 'OVERDUE_MANAGER_ALERT',
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

    const managerEmails = this.getProjectAuthorityEmails(tenant_id, project.id);
    const members = this.db.getProjectMembers(tenant_id, project.id).filter(m => m.role === 'PROJECT_MANAGER');
    const managerId = members[0]?.user_id || project.created_by_user_id;

    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
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

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '🔐 PROJE GÖRÜNÜRLÜK ONAY TALEBİ (KAB03)',
      badgeText: '⏳ Onay Bekliyor',
      badgeType: 'blocked',
      projectTitle: project.title,
      taskTitle: `${requester.name} Proje Görünürlük Yetkisi İstiyor`,
      subtitleText: `<strong>${project.title}</strong> projesindeki tüm görevleri ve Gantt takvimini görebilmek için onayınız talep edildi.`,
      facts: [
        { label: 'Proje:', value: project.title },
        { label: 'Talep Eden:', value: `${requester.name} (${requester.department || 'Personel'})` },
        { label: 'E-posta:', value: requester.email },
        { label: 'Verilecek Rol:', value: 'Tam Görüntüleyici (VIEWER)' }
      ],
      actionButtons: [
        {
          title: '✅ Talebi Onayla (VIEWER Yap)',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&request_id=${req.id}&user_id=${managerId}&action=DECIDE_VISIBILITY&approve=true`,
          style: 'success'
        },
        {
          title: '❌ Talebi Reddet',
          url: `${baseUrl}/api/quick-action?tenant_id=${tenant_id}&request_id=${req.id}&user_id=${managerId}&action=DECIDE_VISIBILITY&approve=false`,
          style: 'secondary'
        },
        {
          title: '🔗 Projeyi Görüntüle ➔',
          url: `${baseUrl}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

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
   * 3.5. Yeni Kullanıcı (Personel) Eklendiğinde Otomatik Karşılama & Sistem Erişim Bilgisi Kartı (USER_WELCOME_CARD)
   */
  public async sendUserWelcomeCard(
    tenant_id: UUID,
    new_user_id: UUID,
    plain_password: string,
    created_by_user_id?: UUID
  ): Promise<EmailOutboxItem | null> {
    const newUser = this.db.getUserById(tenant_id, new_user_id);
    if (!newUser || !newUser.email) return null;

    const creator = created_by_user_id ? this.db.getUserById(tenant_id, created_by_user_id) : undefined;
    const config = this.getSmtpConfig(tenant_id);
    const baseUrl = config.public_base_url || 'http://10.1.0.45:3000';
    const initialPass = plain_password || newUser.password || '123';

    this.notificationService.notifyUserWelcome(tenant_id, newUser.id, newUser.name, newUser.email);

    const roleLabel = newUser.system_role === 'ADMIN' ? 'Sistem Yöneticisi (ADMIN)' : 'Personel / Kullanıcı (USER)';
    const permsLabel = [
      newUser.can_create_project ? 'Yeni Proje Açabilir' : null,
      newUser.can_build_reports ? 'Özel Rapor Oluşturabilir' : null
    ].filter(Boolean).join(', ') || 'Standart Görev & Proje Kullanımı';

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '🎉 FG GROUP PROJE & GÖREV SİSTEMİ • HOŞ GELDİNİZ',
          weight: 'Bolder',
          color: 'Accent',
          size: 'Small'
        },
        {
          type: 'TextBlock',
          text: `Merhaba ${newUser.name}, Sistem Hesabınız Oluşturuldu!`,
          weight: 'Bolder',
          size: 'Large',
          wrap: true
        },
        {
          type: 'TextBlock',
          text: 'FG Group Proje ve Görev Takip Sistemine erişim bilgileriniz aşağıda yer almaktadır. Giriş yaptıktan sonra kendi şifrenizi belirleyebilir ve profil fotoğrafınızı ekleyebilirsiniz.',
          wrap: true,
          isSubtle: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: '🌐 Sistem Giriş Adresi:', value: baseUrl },
            { title: '📧 Kullanıcı E-Posta:', value: newUser.email },
            { title: '🔑 İlk Giriş Şifreniz:', value: initialPass },
            { title: '🏢 Departman & Ülke:', value: `${newUser.department || 'Genel'} (${newUser.country})` },
            { title: '🛡️ Sistem Rolü:', value: roleLabel },
            { title: '⚡ Tanımlı Yetkiler:', value: permsLabel },
            { title: '👤 Kaydı Oluşturan:', value: creator ? `${creator.name} (${creator.email})` : 'Sistem Yöneticisi' }
          ]
        },
        {
          type: 'TextBlock',
          text: '🔐 Şifre Değiştirme & Profil Resmi: Sisteme giriş yaptıktan sonra sol alt köşedeki isminize tıklayarak açılan "👤 Kullanıcı Profili & Tercihler" penceresinden kendi şifrenizi oluşturabilir/değiştirebilir ve profil resminizi yükleyebilirsiniz.',
          wrap: true,
          size: 'Small',
          color: 'Good'
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '🚀 Sisteme Giriş Yap & Şifreni Belirle',
          url: baseUrl
        }
      ]
    };

    const htmlBody = this.renderAdaptiveCardHtmlFrame({
      categoryTag: '🎉 HOŞ GELDİNİZ • FG GROUP SİSTEM ERİŞİMİ',
      badgeText: '👤 Aktif Hesap',
      badgeType: 'ready',
      projectTitle: 'FG Group Proje & Görev Takip Portalı',
      taskTitle: `Merhaba ${newUser.name}, Sisteme Hoş Geldiniz!`,
      subtitleText: 'FG Group Proje ve Görev Takip Sistemine erişim bilgileriniz ve ilk giriş şifreniz aşağıda yer almaktadır.',
      facts: [
        { label: '🌐 Giriş Adresi:', value: baseUrl },
        { label: '📧 Kullanıcı E-Posta:', value: newUser.email },
        { label: '🔑 İlk Giriş Şifreniz:', value: initialPass },
        { label: '🏢 Departman & Ülke:', value: `${newUser.department || 'Genel'} (${newUser.country})` },
        { label: '🛡️ Sistem Rolü:', value: roleLabel },
        { label: '⚡ Tanımlı Yetkiler:', value: permsLabel }
      ],
      noteSection: {
        title: '🔐 Şifre Değiştirme ve Profil Resmi Bilgilendirmesi',
        content: 'Sisteme giriş yaptıktan sonra sol alt kısımdaki isminize tıklayarak şifrenizi dilediğiniz zaman değiştirebilir ve kendi profil fotoğrafınızı yükleyebilirsiniz.',
        isWarning: false
      },
      actionButtons: [
        {
          title: '🚀 FG Group Sistemine Giriş Yap ➔',
          url: `${baseUrl}`,
          style: 'primary'
        }
      ],
      baseUrl
    });

    return this.dispatchEmail({
      tenant_id,
      to: [newUser.email],
      subject: `🎉 [Hoş Geldiniz] FG Group Proje Sistemine Erişim Bilgileriniz (${newUser.name})`,
      category: 'USER_WELCOME_CARD',
      htmlBody,
      adaptiveCardJson: adaptiveCard
    });
  }

  /**
   * 4. Outlook Actionable Message HTTP Callback İşleyicisi (/api/outlook/action)
   * E-postanın içindeki butonlara tıklandığında çalışır, ZORUNLU NOT kuralını denetler,
   * yönetici bilgilendirme maillerini gönderir ve kartı anında günceller!
   */
  public async handleOutlookCardAction(payload: {
    tenant_id?: UUID;
    task_id?: UUID;
    request_id?: UUID;
    user_id?: UUID;
    outboxId?: UUID;
    action: 'START_TASK' | 'UPDATE_PROGRESS' | 'COMPLETE_TASK' | 'SUBMIT_EXPLANATION' | 'DECIDE_VISIBILITY';
    progress_value?: number | string;
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

    const rawNote = (payload.explanation_text || '').trim();
    const cleanNote = rawNote === '{{explanationText.value}}' ? '' : rawNote;

    let statusMessage = 'İşlem tamamlandı.';
    let resultData: any = null;

    if (payload.action === 'START_TASK' && payload.task_id) {
      const updated = this.taskService.startTask(auth, payload.task_id);
      if (cleanNote.length >= 2) {
        this.delayService.submitExplanation(auth, payload.task_id, `[Görev Başlatma Notu]: ${cleanNote}`);
      }
      statusMessage = `▶️ "${updated.title}" görevi Outlook üzerinden BAŞLATILDI (%${updated.progress || 25}).`;
      resultData = updated;
    } else if (payload.action === 'UPDATE_PROGRESS' && payload.task_id) {
      // KURAL: %40, %50, %60 ilerleme bildirirken açıklama notu MUTLAKA yazılmalıdır!
      if (cleanNote.length < 2) {
        throw new Error('İlerleme yüzdesi (%40, %50, %60 vb.) güncellerken yapılan çalışmayı açıklayan bir not yazılması zorunludur!');
      }
      const rawProg = String(payload.progress_value || '50').replace(/[^0-9]/g, '');
      const progNum = Math.max(10, Math.min(100, Number(rawProg) || 50));

      const updRes = this.taskService.updateTaskProgressWithNote(auth, payload.task_id, progNum, cleanNote);
      resultData = updRes;

      if (progNum >= 100) {
        const unlockedNames: string[] = [];
        for (const readyId of updRes.newlyReadyTaskIds || []) {
          const rt = this.db.getTaskById(tenant_id, readyId);
          if (rt) {
            unlockedNames.push(rt.title);
            if (rt.assignee_id) {
              this.notificationService.notifyTaskReady(tenant_id, rt.id, rt.assignee_id, rt.title);
              await this.sendTaskReadyActionableCard(tenant_id, rt.id);
            }
          }
        }
        await this.sendTaskCompletedToManagersCard(tenant_id, updRes.task.id, auth.user_id, cleanNote, updRes.newlyReadyTaskIds || []);
        statusMessage = `✅ "${updRes.task.title}" %100 tamamlandı, notunuz kaydedildi ve proje yetkililerine bilgi e-postası gönderildi!`;
      } else {
        await this.sendTaskProgressUpdateToManagersCard(tenant_id, updRes.task.id, auth.user_id, progNum, cleanNote);
        statusMessage = `📊 "${updRes.task.title}" ilerleme oranı %${progNum} olarak güncellendi, notunuz ("${cleanNote}") kaydedildi ve proje yetkililerine bildirildi!`;
      }
    } else if (payload.action === 'COMPLETE_TASK' && payload.task_id) {
      const res = this.taskService.completeTask(auth, payload.task_id);
      if (cleanNote.length >= 2) {
        this.delayService.submitExplanation(auth, payload.task_id, `[%100 Tamamlandı Notu]: ${cleanNote}`);
      }
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
      // Proje yetkililerine "bu kişi bu işi tamamladı" mailini gönder
      await this.sendTaskCompletedToManagersCard(tenant_id, res.task.id, auth.user_id, cleanNote || undefined, res.newlyReadyTaskIds);

      statusMessage = unlockedNames.length > 0
        ? `✅ "${res.task.title}" tamamlandı! Proje yetkililerine bilgi verildi ve sıradaki görev(ler) açıldı: ${unlockedNames.join(', ')}`
        : `✅ "${res.task.title}" görevi %100 TAMAMLANDI ve proje yetkililerine bilgi e-postası gönderildi.`;
    } else if (payload.action === 'SUBMIT_EXPLANATION' && payload.task_id) {
      if (cleanNote.length < 2) {
        throw new Error('Lütfen yapılan çalışmayı veya gecikme/durum nedenini açıklayan bir not yazınız (Not alanı zorunludur)!');
      }
      const rec = this.delayService.submitExplanation(auth, payload.task_id, cleanNote);
      const task = this.db.getTaskById(tenant_id, payload.task_id);
      if (task && task.project_id) {
        this.notificationService.notifyExplanationSubmitted(tenant_id, task.project_id, task.id, auth.name, task.title, cleanNote);
        await this.sendTaskProgressUpdateToManagersCard(tenant_id, task.id, auth.user_id, task.progress || 0, cleanNote);
      }
      statusMessage = `📝 Açıklama / durum notunuz kaydedildi ve proje yetkililerine e-posta ile bildirildi: "${cleanNote}"`;
      resultData = rec;
    } else if (payload.action === 'DECIDE_VISIBILITY' && payload.request_id) {
      const approve = payload.approve !== false;
      const decided = this.projectService.decideVisibilityRequest(auth, payload.request_id, approve);
      if (approve) {
        await this.sendProjectMemberAddedCard(tenant_id, decided.project_id, decided.user_id, 'VIEWER', auth.name);
      }
      statusMessage = approve
        ? `✅ Görünürlük talebi onaylandı ve personele projeye dahil edilme e-postası gönderildi.`
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

