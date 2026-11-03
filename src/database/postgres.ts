import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { DatabaseState, Database } from './db.js';
import { CryptoVault } from '../core/crypto-vault.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PostgresStatusInfo {
  engine: 'PGLITE_EMBEDDED' | 'EXTERNAL_POSTGRES';
  connected: boolean;
  version: string;
  data_location: string;
  vault_encryption: 'AES-256-GCM';
  smtp_password_encrypted: boolean;
  table_counts: Record<string, number>;
  last_synced_at: string | null;
}

/**
 * Çift Modlu PostgreSQL Motoru (Seçenek 1: Yerel Gömülü PGlite + Harici PostgreSQL Sunucu Desteği)
 * - Varsayılan olarak kurulum gerektirmeyen gerçek PostgreSQL motorunu (.work/pgdata) çalıştırır.
 * - DATABASE_URL ortam değişkeni veya harici sunucu ayarı verildiğinde doğrudan harici PostgreSQL sunucusuna (pg.Pool) bağlanır.
 */
export class PostgresEngine {
  private pglite: PGlite | null = null;
  private pool: pg.Pool | null = null;
  private mode: 'PGLITE_EMBEDDED' | 'EXTERNAL_POSTGRES' = 'PGLITE_EMBEDDED';
  private pgVersion = 'PostgreSQL 16 (PGlite WASM)';
  private dataLocation = '';
  private lastSyncedAt: string | null = null;
  private initialized = false;
  private syncInProgress = false;
  private pendingState: DatabaseState | null = null;

  constructor(private db: Database, private customDataDir?: string) {}

  private async execSql(sql: string): Promise<void> {
    if (this.mode === 'EXTERNAL_POSTGRES' && this.pool) {
      await this.pool.query(sql);
    } else if (this.pglite) {
      await this.pglite.exec(sql);
    }
  }

  private async querySql<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.mode === 'EXTERNAL_POSTGRES' && this.pool) {
      const res = await this.pool.query(sql, params);
      return res.rows as T[];
    } else if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return res.rows;
    }
    return [];
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    const workDir = path.resolve(__dirname, '../../.work');
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    const externalConfigPath = path.join(workDir, 'pg-external.json');
    let externalUrl = process.env.DATABASE_URL || '';
    if (!externalUrl && fs.existsSync(externalConfigPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(externalConfigPath, 'utf-8'));
        if (parsed.database_url && parsed.enabled) {
          externalUrl = parsed.database_url;
        }
      } catch { }
    }

    if (externalUrl) {
      try {
        this.pool = new Pool({
          connectionString: externalUrl,
          connectionTimeoutMillis: 6000
        });
        const verRes = await this.pool.query('SELECT version() AS v');
        this.pgVersion = verRes.rows[0]?.v?.split(',')[0] || 'PostgreSQL (External)';
        this.mode = 'EXTERNAL_POSTGRES';
        this.dataLocation = externalUrl.replace(/:([^:@]+)@/, ':••••••@');
      } catch (err: any) {
        console.warn('⚠️ Harici PostgreSQL sunucusuna bağlanılamadı, yerel PGlite motoruna geçiliyor:', err.message);
        this.pool = null;
      }
    }

    if (!this.pool) {
      const pgDataDir = this.customDataDir || path.join(workDir, 'pgdata');
      this.dataLocation = pgDataDir;
      this.pglite = new PGlite(pgDataDir);
      await this.pglite.waitReady;
      const verRes = await this.pglite.query<{ v: string }>('SELECT version() AS v');
      this.pgVersion = verRes.rows[0]?.v?.split(' on ')[0] || 'PostgreSQL 16 (PGlite)';
      this.mode = 'PGLITE_EMBEDDED';
    }

    // 1. İlişkisel Şemayı Oluştur (src/database/schema.sql)
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const fallbackSchemaPath = path.resolve(__dirname, '../../src/database/schema.sql');
    const activeSchemaPath = fs.existsSync(schemaPath) ? schemaPath : fallbackSchemaPath;

    if (fs.existsSync(activeSchemaPath)) {
      const ddl = fs.readFileSync(activeSchemaPath, 'utf-8');
      await this.execSql(ddl);
    }

    // 2. Eğer PostgreSQL içinde daha önceden kaydedilmiş smtp_configs varsa belleğe geri yükle
    await this.restoreFromPostgresIfAvailable();

    // 3. Mevcut durumu PostgreSQL ilişkisel tablolarına senkronize et
    await this.syncStateToPostgres(this.db.getRawState());

    // 4. Bundan sonraki tüm db değişikliklerini otomatik PostgreSQL'e yaz (Write-Through Hook)
    this.db.setOnSaveHook((state) => {
      void this.scheduleSync(state);
    });

    this.initialized = true;
    console.log(`🐘 PostgreSQL Motoru Aktif: [${this.mode}] (${this.pgVersion}) | AES-256-GCM Şifre Kasası Devrede`);
  }

  private async restoreFromPostgresIfAvailable(): Promise<void> {
    try {
      const smtpRows = await this.querySql<any>('SELECT * FROM smtp_configs');
      if (smtpRows.length > 0) {
        const currentTenants = this.db.getTenants();
        const activeTenantId = currentTenants[0]?.id;

        for (const row of smtpRows) {
          const targetTenantId = activeTenantId || row.tenant_id;
          const encryptedPass = row.encrypted_password || '';
          const plainPass = CryptoVault.decrypt(encryptedPass);

          this.db.upsertSmtpConfig({
            tenant_id: targetTenantId,
            host: row.host,
            port: Number(row.port) || 587,
            secure: !!row.secure,
            username: row.username,
            password: CryptoVault.encrypt(plainPass),
            from_name: row.from_name,
            from_email: row.from_email,
            public_base_url: row.public_base_url,
            enable_actionable_cards: row.enable_actionable_cards !== false,
            updated_at: row.updated_at
          });
        }
      }
    } catch (err) {
      console.warn('PostgreSQL başlangıç geri yükleme uyarısı:', err);
    }
  }

  public async scheduleSync(state: DatabaseState): Promise<void> {
    this.pendingState = state;
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      while (this.pendingState) {
        const snapshot = this.pendingState;
        this.pendingState = null;
        await this.syncStateToPostgres(snapshot);
      }
    } catch (err) {
      console.warn('PostgreSQL senkronizasyon uyarısı:', err);
    } finally {
      this.syncInProgress = false;
    }
  }

  public async syncStateToPostgres(state: DatabaseState): Promise<void> {
    if (!this.pglite && !this.pool) return;

    // 1. Tenants
    for (const t of state.tenants) {
      await this.querySql(
        `INSERT INTO tenants (id, name, entra_tenant_id, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, entra_tenant_id = EXCLUDED.entra_tenant_id`,
        [t.id, t.name, t.entra_tenant_id, t.created_at]
      );
    }

    // 2. Users (Şifreler AES-256-GCM ile şifrelenerek saklanır)
    for (const u of state.users) {
      const encUserPass = u.password ? CryptoVault.encrypt(u.password) : null;
      await this.querySql(
        `INSERT INTO users (id, tenant_id, entra_oid, name, email, phone, country, language, password, system_role, can_create_project, can_build_reports, department, theme, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
           country = EXCLUDED.country, language = EXCLUDED.language, password = EXCLUDED.password,
           system_role = EXCLUDED.system_role, can_create_project = EXCLUDED.can_create_project,
           can_build_reports = EXCLUDED.can_build_reports, department = EXCLUDED.department, theme = EXCLUDED.theme`,
        [
          u.id, u.tenant_id, u.entra_oid, u.name, u.email, u.phone || null,
          u.country, u.language, encUserPass, u.system_role,
          !!u.can_create_project, !!u.can_build_reports, u.department || null,
          u.theme || 'light', u.created_at
        ]
      );
    }

    // 3. Projects
    for (const p of state.projects) {
      await this.querySql(
        `INSERT INTO projects (id, tenant_id, title, description, initial_start_date, initial_due_date, current_start_date, current_due_date, created_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description,
           current_start_date = EXCLUDED.current_start_date, current_due_date = EXCLUDED.current_due_date`,
        [
          p.id, p.tenant_id, p.title, p.description, p.initial_start_date,
          p.initial_due_date, p.current_start_date, p.current_due_date,
          p.created_by_user_id, p.created_at
        ]
      );
    }

    // 4. Project Members
    for (const pm of state.project_members) {
      await this.querySql(
        `INSERT INTO project_members (id, tenant_id, project_id, user_id, role, assigned_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
        [pm.id, pm.tenant_id, pm.project_id, pm.user_id, pm.role, pm.assigned_at]
      );
    }

    // 5. Tasks
    for (const t of state.tasks) {
      await this.querySql(
        `INSERT INTO tasks (id, tenant_id, project_id, assignee_id, title, description, type, priority, progress, work_status, initial_start_date, initial_due_date, current_start_date, current_due_date, actual_start_date, actual_completion_date, completed_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO UPDATE SET
           assignee_id = EXCLUDED.assignee_id, title = EXCLUDED.title, description = EXCLUDED.description,
           type = EXCLUDED.type, priority = EXCLUDED.priority, progress = EXCLUDED.progress,
           work_status = EXCLUDED.work_status, current_start_date = EXCLUDED.current_start_date,
           current_due_date = EXCLUDED.current_due_date, actual_start_date = EXCLUDED.actual_start_date,
           actual_completion_date = EXCLUDED.actual_completion_date, completed_by_user_id = EXCLUDED.completed_by_user_id`,
        [
          t.id, t.tenant_id, t.project_id, t.assignee_id || null, t.title, t.description || null,
          t.type || 'TASK', t.priority || 'NORMAL', t.progress ?? 0, t.work_status,
          t.initial_start_date, t.initial_due_date, t.current_start_date, t.current_due_date,
          t.actual_start_date || null, t.actual_completion_date || null, t.completed_by_user_id || null,
          t.created_at
        ]
      );
    }

    // 6. Task Dependencies
    for (const d of state.task_dependencies) {
      await this.querySql(
        `INSERT INTO task_dependencies (id, tenant_id, predecessor_id, successor_id, dependency_type, wait_start_time, wait_end_time, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET wait_start_time = EXCLUDED.wait_start_time, wait_end_time = EXCLUDED.wait_end_time`,
        [
          d.id, d.tenant_id, d.predecessor_id, d.successor_id,
          d.dependency_type, d.wait_start_time || null, d.wait_end_time || null, d.created_at
        ]
      );
    }

    // 7. Delay Records
    for (const dr of state.delay_records) {
      await this.querySql(
        `INSERT INTO delay_records (id, tenant_id, task_id, detected_at, explanation_status, explanation_source, reason, blocking_intervals, cause_class, reported_by_user_id, reported_at, explanation_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           explanation_status = EXCLUDED.explanation_status, explanation_source = EXCLUDED.explanation_source,
           reason = EXCLUDED.reason, reported_by_user_id = EXCLUDED.reported_by_user_id,
           reported_at = EXCLUDED.reported_at, explanation_text = EXCLUDED.explanation_text`,
        [
          dr.id, dr.tenant_id, dr.task_id, dr.detected_at, dr.explanation_status,
          dr.explanation_source, dr.reason, JSON.stringify(dr.blocking_intervals || []),
          dr.cause_class, dr.reported_by_user_id || null, dr.reported_at || null, dr.explanation_text || null
        ]
      );
    }

    // 8. SMTP Configs (Şifre AES-256-GCM ile şifrelenmiş olarak PostgreSQL'e yazılır!)
    for (const sc of state.smtp_configs) {
      const encryptedPass = CryptoVault.encrypt(sc.password || '');
      await this.querySql(
        `INSERT INTO smtp_configs (tenant_id, host, port, secure, username, encrypted_password, from_name, from_email, public_base_url, enable_actionable_cards, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (tenant_id) DO UPDATE SET
           host = EXCLUDED.host, port = EXCLUDED.port, secure = EXCLUDED.secure,
           username = EXCLUDED.username, encrypted_password = EXCLUDED.encrypted_password,
           from_name = EXCLUDED.from_name, from_email = EXCLUDED.from_email,
           public_base_url = EXCLUDED.public_base_url, enable_actionable_cards = EXCLUDED.enable_actionable_cards,
           updated_at = EXCLUDED.updated_at`,
        [
          sc.tenant_id, sc.host, sc.port, !!sc.secure, sc.username, encryptedPass,
          sc.from_name, sc.from_email, sc.public_base_url, sc.enable_actionable_cards !== false, sc.updated_at
        ]
      );
    }

    // 9. Scheduled Reports
    for (const sr of state.scheduled_reports) {
      await this.querySql(
        `INSERT INTO scheduled_reports (id, tenant_id, name, project_id, report_type, frequency, day_of_week, send_time, recipients, include_adaptive_card, is_active, last_sent_at, created_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, is_active = EXCLUDED.is_active, last_sent_at = EXCLUDED.last_sent_at,
           recipients = EXCLUDED.recipients, send_time = EXCLUDED.send_time`,
        [
          sr.id, sr.tenant_id, sr.name, sr.project_id || 'all', sr.report_type,
          sr.frequency, sr.day_of_week ?? null, sr.send_time,
          JSON.stringify(sr.recipients || []), !!sr.include_adaptive_card,
          !!sr.is_active, sr.last_sent_at || null, sr.created_by_user_id, sr.created_at
        ]
      );
    }

    // 10. Email Outbox
    for (const eo of state.email_outbox) {
      await this.querySql(
        `INSERT INTO email_outbox (id, tenant_id, recipients, subject, category, delivery_mode, status, error_message, adaptive_card_json, html_preview, linked_task_id, linked_project_id, linked_request_id, action_taken, sent_at)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status, action_taken = EXCLUDED.action_taken,
           adaptive_card_json = EXCLUDED.adaptive_card_json`,
        [
          eo.id, eo.tenant_id, JSON.stringify(eo.to || []), eo.subject, eo.category,
          eo.delivery_mode, eo.status, eo.error_message || null,
          eo.adaptive_card_json ? JSON.stringify(eo.adaptive_card_json) : null,
          eo.html_preview, eo.linked_task_id || null, eo.linked_project_id || null,
          eo.linked_request_id || null, eo.action_taken || null, eo.sent_at
        ]
      );
    }

    this.lastSyncedAt = new Date().toISOString();
  }

  public async getStatus(): Promise<PostgresStatusInfo> {
    const tables = ['tenants', 'users', 'projects', 'tasks', 'task_dependencies', 'delay_records', 'smtp_configs', 'scheduled_reports', 'email_outbox'];
    const counts: Record<string, number> = {};

    for (const tbl of tables) {
      try {
        const rows = await this.querySql<{ cnt: number | string }>(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
        counts[tbl] = Number(rows[0]?.cnt || 0);
      } catch {
        counts[tbl] = 0;
      }
    }

    let smtpEncrypted = false;
    try {
      const smtpRows = await this.querySql<{ encrypted_password: string }>(`SELECT encrypted_password FROM smtp_configs LIMIT 1`);
      const ep = smtpRows[0]?.encrypted_password || '';
      smtpEncrypted = ep.length === 0 || CryptoVault.isEncrypted(ep);
    } catch { }

    return {
      engine: this.mode,
      connected: !!(this.pglite || this.pool),
      version: this.pgVersion,
      data_location: this.dataLocation,
      vault_encryption: 'AES-256-GCM',
      smtp_password_encrypted: smtpEncrypted,
      table_counts: counts,
      last_synced_at: this.lastSyncedAt
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
    this.initialized = false;
  }
}
