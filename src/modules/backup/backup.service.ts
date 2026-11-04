import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AuthContext,
  BackupMetadata,
  BackupPayload,
  BackupScheduleConfig,
  BackupType,
  UUID
} from '../../core/types.js';

export class BackupAndRecoveryService {
  private baseBackupDir: string;
  private onPostgresSyncHook?: () => Promise<void>;

  constructor(private db: Database, customBackupDir?: string) {
    this.baseBackupDir = customBackupDir || path.resolve(process.cwd(), '.work', 'backups');
    if (!fs.existsSync(this.baseBackupDir)) {
      fs.mkdirSync(this.baseBackupDir, { recursive: true });
    }
  }

  public setPostgresSyncHook(hook: () => Promise<void>): void {
    this.onPostgresSyncHook = hook;
  }

  private getTenantBackupDir(tenant_id: UUID): string {
    const dir = path.join(this.baseBackupDir, tenant_id);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Yeni Yedek Paketi Oluştur (Manuel veya Zamanlanmış)
   */
  public async createBackup(
    auth: AuthContext,
    name?: string,
    type: BackupType = 'MANUAL',
    note?: string
  ): Promise<BackupMetadata> {
    const tenant_id = auth.tenant_id;
    const backupId = crypto.randomUUID();
    const now = new Date().toISOString();

    const raw = this.db.getRawState();
    const tenant = raw.tenants.find(t => t.id === tenant_id);
    const projects = raw.projects.filter(p => p.tenant_id === tenant_id);
    const tasks = raw.tasks.filter(t => t.tenant_id === tenant_id);
    const taskAssignments = raw.task_assignments.filter(a => a.tenant_id === tenant_id);
    const taskDependencies = raw.task_dependencies.filter(d => d.tenant_id === tenant_id);
    const taskPlanChanges = raw.task_plan_changes.filter(c => c.tenant_id === tenant_id);
    const delayRecords = raw.delay_records.filter(r => r.tenant_id === tenant_id);
    const projectMembers = raw.project_members.filter(m => m.tenant_id === tenant_id);
    const projectPlanChanges = raw.project_plan_changes.filter(c => c.tenant_id === tenant_id);
    const visibilityRequests = raw.visibility_requests.filter(v => v.tenant_id === tenant_id);
    const users = raw.users.filter(u => u.tenant_id === tenant_id);

    const payload: BackupPayload = {
      version: '1.0',
      exported_at: now,
      tenant_id,
      tenant,
      projects,
      tasks,
      task_assignments: taskAssignments,
      task_dependencies: taskDependencies,
      task_plan_changes: taskPlanChanges,
      delay_records: delayRecords,
      project_members: projectMembers,
      project_plan_changes: projectPlanChanges,
      visibility_requests: visibilityRequests,
      users
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const sha256 = crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
    const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');

    const fileName = `backup_${type.toLowerCase()}_${new Date().toISOString().replace(/[:.]/g, '-')}_${backupId.slice(0, 8)}.json`;
    const filePath = path.join(this.getTenantBackupDir(tenant_id), fileName);

    fs.writeFileSync(filePath, jsonStr, 'utf8');

    const defaultTitle = type === 'SCHEDULED_DAILY'
      ? `Günlük Otomatik Yedek (${new Date().toLocaleDateString('tr-TR')})`
      : (type === 'SCHEDULED_WEEKLY'
          ? `Haftalık Otomatik Arşiv (${new Date().toLocaleDateString('tr-TR')})`
          : (type === 'PRE_RESTORE_SAFETY'
              ? 'Geri Yükleme Öncesi Güvenlik Yedeği (Otomatik)'
              : (name || `Manuel Sistem Yedeği (${new Date().toLocaleDateString('tr-TR')})`)));

    const meta: BackupMetadata = {
      id: backupId,
      tenant_id,
      name: defaultTitle,
      note,
      type,
      created_at: now,
      created_by_name: auth.name || 'Sistem',
      size_bytes: sizeBytes,
      sha256,
      summary: {
        project_count: projects.length,
        task_count: tasks.length,
        user_count: users.length,
        member_count: projectMembers.length
      },
      file_path: filePath
    };

    this.db.addBackupRecord(meta);

    // Eski zamanlanmış yedekleri temizle (retention policy)
    await this.pruneOldBackups(tenant_id);

    return meta;
  }

  /**
   * Tam Sistem Geri Yükleme (Önce otomatik güvenlik yedeği alır)
   */
  public async restoreFull(
    auth: AuthContext,
    backup_id: UUID
  ): Promise<{ restored: boolean; safety_backup_id: UUID; backup_name: string }> {
    const meta = this.db.getBackupById(auth.tenant_id, backup_id);
    if (!meta) throw new Error('Yedek kaydı bulunamadı.');

    if (!fs.existsSync(meta.file_path)) {
      throw new Error('Yedek dosyası diskte bulunamadı.');
    }

    const fileContent = fs.readFileSync(meta.file_path, 'utf8');
    const currentHash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
    if (meta.sha256 && meta.sha256 !== currentHash) {
      throw new Error('Yedek dosyasının bütünlük doğrulaması (SHA-256) başarısız oldu; dosya değiştirilmiş veya bozulmuş.');
    }

    const payload: BackupPayload = JSON.parse(fileContent);

    // 1. Önce mevcut durumun güvenlik yedeğini (Can Simidi) al!
    const safetyMeta = await this.createBackup(
      auth,
      `Geri Yükleme Öncesi Güvenlik (${meta.name})`,
      'PRE_RESTORE_SAFETY',
      `"${meta.name}" geri yüklenmeden önceki anlık sistem durumu.`
    );

    // 2. Veritabanını geri yükle
    this.db.restoreFullState(auth.tenant_id, payload);

    // 3. PostgreSQL senkronizasyonunu tetikle
    if (this.onPostgresSyncHook) {
      try {
        await this.onPostgresSyncHook();
      } catch (e) {
        console.warn('Postgres sync hook error during full restore:', e);
      }
    }

    return {
      restored: true,
      safety_backup_id: safetyMeta.id,
      backup_name: meta.name
    };
  }

  /**
   * Tekil Proje Kurtarma (Diğer projelere dokunmadan yalnızca seçilen projeyi geri yükler)
   */
  public async restoreSingleProject(
    auth: AuthContext,
    backup_id: UUID,
    project_id: UUID
  ): Promise<{ restored: boolean; safety_backup_id: UUID; project_title: string }> {
    const meta = this.db.getBackupById(auth.tenant_id, backup_id);
    if (!meta) throw new Error('Yedek kaydı bulunamadı.');

    if (!fs.existsSync(meta.file_path)) {
      throw new Error('Yedek dosyası diskte bulunamadı.');
    }

    const fileContent = fs.readFileSync(meta.file_path, 'utf8');
    const payload: BackupPayload = JSON.parse(fileContent);

    const targetProject = (payload.projects || []).find(p => p.id === project_id);
    if (!targetProject) {
      throw new Error('Seçilen proje bu yedek paketinin içinde bulunamadı.');
    }

    // 1. Önce güvenlik yedeği al
    const safetyMeta = await this.createBackup(
      auth,
      `Proje Kurtarma Öncesi Güvenlik (${targetProject.title})`,
      'PRE_RESTORE_SAFETY',
      `"${targetProject.title}" projesi tekil olarak geri yüklenmeden önceki anlık sistem durumu.`
    );

    // 2. Yalnızca ilgili projeyi kurtar
    const success = this.db.restoreSingleProject(auth.tenant_id, project_id, payload);
    if (!success) {
      throw new Error('Proje geri yüklenirken bir hata oluştu.');
    }

    // 3. PostgreSQL senkronizasyonu
    if (this.onPostgresSyncHook) {
      try {
        await this.onPostgresSyncHook();
      } catch (e) {
        console.warn('Postgres sync hook error during single project restore:', e);
      }
    }

    return {
      restored: true,
      safety_backup_id: safetyMeta.id,
      project_title: targetProject.title
    };
  }

  /**
   * Dışarıdan Yedek Dosyası Yükleme (Import)
   */
  public async importBackupFile(
    auth: AuthContext,
    fileBuffer: Buffer | string,
    originalFileName = 'imported_backup.json'
  ): Promise<BackupMetadata> {
    const jsonStr = typeof fileBuffer === 'string' ? fileBuffer : fileBuffer.toString('utf8');
    let payload: BackupPayload;

    try {
      payload = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Yüklenen dosya geçerli bir JSON formatında değil.');
    }

    if (!Array.isArray(payload.projects) || !Array.isArray(payload.tasks)) {
      throw new Error('Yüklenen dosya geçerli bir Proje Yönetim Sistemi yedek paketi şemasına sahip değil.');
    }

    const backupId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sha256 = crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
    const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');

    const fileName = `backup_import_${new Date().toISOString().replace(/[:.]/g, '-')}_${backupId.slice(0, 8)}.json`;
    const filePath = path.join(this.getTenantBackupDir(auth.tenant_id), fileName);

    fs.writeFileSync(filePath, jsonStr, 'utf8');

    const meta: BackupMetadata = {
      id: backupId,
      tenant_id: auth.tenant_id,
      name: `İçe Aktarılan Yedek (${originalFileName})`,
      note: `Harici dosyadan yüklendi. Orijinal tarih: ${payload.exported_at ? new Date(payload.exported_at).toLocaleString('tr-TR') : 'Bilinmiyor'}`,
      type: 'MANUAL',
      created_at: now,
      created_by_name: auth.name,
      size_bytes: sizeBytes,
      sha256,
      summary: {
        project_count: payload.projects.length,
        task_count: payload.tasks.length,
        user_count: payload.users?.length || 0,
        member_count: payload.project_members?.length || 0
      },
      file_path: filePath
    };

    this.db.addBackupRecord(meta);
    return meta;
  }

  /**
   * Yedek İçeriği ve Proje Listesini İnceleme (Tekil kurtarma için proje listesi sunar)
   */
  public getBackupPayload(auth: AuthContext, backup_id: UUID): { meta: BackupMetadata; payload: BackupPayload } {
    const meta = this.db.getBackupById(auth.tenant_id, backup_id);
    if (!meta) throw new Error('Yedek kaydı bulunamadı.');

    if (!fs.existsSync(meta.file_path)) {
      throw new Error('Yedek dosyası diskte bulunamadı.');
    }

    const fileContent = fs.readFileSync(meta.file_path, 'utf8');
    const payload: BackupPayload = JSON.parse(fileContent);
    return { meta, payload };
  }

  /**
   * Yedek Dosyası Sil
   */
  public deleteBackup(auth: AuthContext, backup_id: UUID): boolean {
    const meta = this.db.getBackupById(auth.tenant_id, backup_id);
    if (!meta) return false;

    if (fs.existsSync(meta.file_path)) {
      try {
        fs.unlinkSync(meta.file_path);
      } catch (e) {
        console.warn('Backup file unlink error:', e);
      }
    }

    this.db.deleteBackupRecord(auth.tenant_id, backup_id);
    return true;
  }

  /**
   * Otomatik Zamanlama Kurallarını Getir / Güncelle
   */
  public getScheduleConfig(tenant_id: UUID): BackupScheduleConfig {
    return this.db.getBackupScheduleConfig(tenant_id);
  }

  public updateScheduleConfig(tenant_id: UUID, cfg: Partial<BackupScheduleConfig>): BackupScheduleConfig {
    const current = this.getScheduleConfig(tenant_id);
    const updated: BackupScheduleConfig = {
      ...current,
      ...cfg
    };
    this.db.saveBackupScheduleConfig(tenant_id, updated);
    return updated;
  }

  /**
   * Zamanlanmış Yedek Tetikleyici (Background Worker veya Cron tarafından çağrılır)
   */
  public async checkAndRunScheduledBackups(tenant_id: UUID): Promise<boolean> {
    const cfg = this.getScheduleConfig(tenant_id);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let executed = false;

    // 1. Günlük Yedek Kontrolü
    if (cfg.daily_enabled && cfg.daily_time) {
      const lastDaily = cfg.last_daily_run ? cfg.last_daily_run.slice(0, 10) : '';
      if (lastDaily !== todayStr && currentHourMin >= cfg.daily_time) {
        const systemAuth: AuthContext = {
          tenant_id,
          user_id: 'system',
          email: 'system@backup.local',
          name: 'Otomatik Zamanlayıcı (Günlük)'
        };
        await this.createBackup(systemAuth, undefined, 'SCHEDULED_DAILY', 'Günlük otomatik planlama kapsamında alındı.');
        cfg.last_daily_run = now.toISOString();
        this.db.saveBackupScheduleConfig(tenant_id, cfg);
        executed = true;
      }
    }

    // 2. Haftalık Yedek Kontrolü
    if (cfg.weekly_enabled && cfg.weekly_time) {
      const dayOfWeek = now.getDay(); // 0: Sunday, 1: Monday...
      const targetDay = Number(cfg.weekly_day ?? 0);
      const lastWeekly = cfg.last_weekly_run ? new Date(cfg.last_weekly_run) : null;
      const daysSinceLast = lastWeekly ? (now.getTime() - lastWeekly.getTime()) / (1000 * 60 * 60 * 24) : 999;

      if (dayOfWeek === targetDay && daysSinceLast >= 6 && currentHourMin >= cfg.weekly_time) {
        const systemAuth: AuthContext = {
          tenant_id,
          user_id: 'system',
          email: 'system@backup.local',
          name: 'Otomatik Zamanlayıcı (Haftalık)'
        };
        await this.createBackup(systemAuth, undefined, 'SCHEDULED_WEEKLY', 'Haftalık otomatik arşiv planı kapsamında alındı.');
        cfg.last_weekly_run = now.toISOString();
        this.db.saveBackupScheduleConfig(tenant_id, cfg);
        executed = true;
      }
    }

    return executed;
  }

  /**
   * Saklama Politikası (Retention Policy): Belirlenen adetten eski yedekleri otomatik temizler
   */
  public async pruneOldBackups(tenant_id: UUID): Promise<number> {
    const cfg = this.getScheduleConfig(tenant_id);
    const list = this.db.getBackupList(tenant_id);
    let deletedCount = 0;

    // Günlük yedekleri tarih sırasına göre filtrele
    const dailyBackups = list.filter(b => b.type === 'SCHEDULED_DAILY');
    const maxDaily = Math.max(1, cfg.daily_retention_days || 14);
    if (dailyBackups.length > maxDaily) {
      const toRemove = dailyBackups.slice(maxDaily);
      for (const b of toRemove) {
        this.deleteBackup({ tenant_id, user_id: 'system', email: '', name: 'System' }, b.id);
        deletedCount++;
      }
    }

    // Haftalık yedekler
    const weeklyBackups = list.filter(b => b.type === 'SCHEDULED_WEEKLY');
    const maxWeekly = Math.max(1, cfg.weekly_retention_weeks || 8);
    if (weeklyBackups.length > maxWeekly) {
      const toRemove = weeklyBackups.slice(maxWeekly);
      for (const b of toRemove) {
        this.deleteBackup({ tenant_id, user_id: 'system', email: '', name: 'System' }, b.id);
        deletedCount++;
      }
    }

    // Güvenlik yedekleri (en fazla 10 adet tut)
    const safetyBackups = list.filter(b => b.type === 'PRE_RESTORE_SAFETY');
    if (safetyBackups.length > 10) {
      const toRemove = safetyBackups.slice(10);
      for (const b of toRemove) {
        this.deleteBackup({ tenant_id, user_id: 'system', email: '', name: 'System' }, b.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

