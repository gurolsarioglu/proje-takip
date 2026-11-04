import crypto from 'crypto';
import { Database } from '../../database/db.js';
import {
  AppLanguage,
  AuthContext,
  LoginResponse,
  PersonnelCardDTO,
  Tenant,
  User,
  UUID
} from '../../core/types.js';

export class AuthService {
  constructor(private db: Database) {}

  public static normalizeCountry(country?: string): string {
    if (!country) return 'Türkiye';
    const c = country.trim().toLowerCase();
    if (
      c === 'tr' ||
      c.includes('türk') ||
      c.includes('turk') ||
      c.includes('trk') ||
      c.includes('t\ufffdrk') ||
      c.includes('trkiye') ||
      c.includes('turkiye') ||
      c === 'turkey'
    ) {
      return 'Türkiye';
    }
    if (c === 'de' || c.includes('alman') || c.includes('german') || c.includes('deutsch')) {
      return 'Almanya';
    }
    if (c === 'en' || c === 'uk' || c === 'gb' || c.includes('ingil') || c.includes('england') || c.includes('britain')) {
      return 'İngiltere';
    }
    if (c === 'us' || c === 'usa' || c.includes('abd') || c.includes('america') || c.includes('united states')) {
      return 'USA';
    }
    return country.trim();
  }

  public static resolveLanguageByCountry(country?: string): AppLanguage {
    if (!country) return 'tr';
    const normalized = AuthService.normalizeCountry(country);
    if (normalized === 'Türkiye') return 'tr';
    if (normalized === 'Almanya') return 'de';
    return 'en';
  }

  public createTenant(name: string, entra_tenant_id: string): Tenant {
    const tenant: Tenant = {
      id: crypto.randomUUID(),
      name,
      entra_tenant_id,
      created_at: new Date().toISOString()
    };
    return this.db.insertTenant(tenant);
  }

  public createUser(
    tenant_id: UUID,
    name: string,
    email: string,
    entra_oid?: string,
    options?: Partial<PersonnelCardDTO>
  ): User {
    const tenant = this.db.getTenantById(tenant_id);
    if (!tenant) {
      throw new Error(`Kiracı bulunamadı: ${tenant_id}`);
    }

    const country = AuthService.normalizeCountry(options?.country);
    const language = AuthService.resolveLanguageByCountry(country);

    const user: User = {
      id: crypto.randomUUID(),
      tenant_id,
      entra_oid: entra_oid || crypto.randomUUID(),
      name,
      email,
      phone: options?.phone || '',
      country,
      language,
      password: options?.password || '123',
      system_role: options?.system_role || 'USER',
      can_create_project: options?.can_create_project ?? false,
      can_build_reports: options?.can_build_reports ?? (options?.system_role === 'ADMIN'),
      department: options?.department || 'Genel',
      avatar_url: options?.avatar_url || undefined,
      is_active: options?.is_active !== undefined ? !!options.is_active : true,
      deactivated_at: options?.is_active === false ? new Date().toISOString() : undefined,
      deactivation_reason: options?.is_active === false ? (options?.deactivation_reason || 'İşten ayrıldı / Erişim engellendi') : undefined,
      created_at: new Date().toISOString()
    };
    return this.db.insertUser(user);
  }

  public login(email: string, password?: string): LoginResponse {
    const user = this.db.getUserByEmail(email);
    if (!user) {
      throw new Error('Geçersiz kullanıcı adı veya e-posta.');
    }

    if (user.is_active === false) {
      throw new Error('Hesabınız dondurulmuş / devre dışı bırakılmıştır. Sistem erişim yetkiniz kapalıdır. Lütfen Sistem Yöneticisi ile iletişime geçiniz.');
    }

    if (password && user.password && user.password !== password) {
      throw new Error('Hatalı şifre girdiniz.');
    }

    const tenant = this.db.getTenantById(user.tenant_id);
    if (!tenant) {
      throw new Error('Kullanıcının bağlı olduğu şirket / kiracı bulunamadı.');
    }

    const token = `token_${user.id}_${Date.now()}`;
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tenant,
      token
    };
  }

  public updateUser(
    auth: AuthContext,
    user_id: UUID,
    updates: Partial<PersonnelCardDTO>
  ): Omit<User, 'password'> {
    const caller = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN' && auth.user_id !== user_id) {
      throw new Error('Yetkisiz İşlem: Personel bilgilerini yalnızca Sistem Yöneticisi (Admin) güncelleyebilir.');
    }

    const user = this.db.getUserById(auth.tenant_id, user_id);
    if (!user) {
      throw new Error('Personel bulunamadı.');
    }

    const patch: Partial<User> = { ...updates };
    if (updates.country) {
      patch.country = AuthService.normalizeCountry(updates.country);
      patch.language = AuthService.resolveLanguageByCountry(patch.country);
    }
    if (updates.is_active !== undefined) {
      if (auth.user_id === user_id && updates.is_active === false) {
        throw new Error('Güvenlik Kuralı: Sistem Yöneticisi kendi hesabını devre dışı bırakamaz.');
      }
      patch.is_active = !!updates.is_active;
      if (!updates.is_active) {
        patch.deactivated_at = new Date().toISOString();
        patch.deactivation_reason = (updates.deactivation_reason || '').trim() || 'İşten ayrıldı / Erişim engellendi';
      } else {
        patch.deactivated_at = undefined;
        patch.deactivation_reason = undefined;
      }
    }

    const updated = this.db.updateUser(auth.tenant_id, user_id, patch);
    const { password: _, ...safeUser } = updated!;
    return safeUser;
  }

  public changeOwnPassword(
    auth: AuthContext,
    current_password: string,
    new_password: string
  ): void {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı.');
    }
    const cleanNew = String(new_password || '').trim();
    if (cleanNew.length < 3) {
      throw new Error('Yeni şifreniz en az 3 karakter olmalıdır.');
    }
    if (user.password && user.password !== String(current_password || '')) {
      throw new Error('Mevcut şifrenizi hatalı girdiniz.');
    }
    this.db.updateUser(auth.tenant_id, auth.user_id, { password: cleanNew });
  }

  public updateOwnAvatar(
    auth: AuthContext,
    avatar_url?: string
  ): Omit<User, 'password'> {
    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı.');
    }
    const updated = this.db.updateUser(auth.tenant_id, auth.user_id, {
      avatar_url: avatar_url || undefined
    });
    const { password: _, ...safeUser } = updated!;
    return safeUser;
  }

  public authenticateEntraUser(entra_tenant_id: string, entra_oid: string, name: string, email: string): AuthContext {
    let tenant = this.db.getTenants().find(t => t.entra_tenant_id === entra_tenant_id);
    if (!tenant) {
      tenant = this.createTenant(`M365 Kurumu (${entra_tenant_id.slice(0, 8)})`, entra_tenant_id);
    }

    let user = this.db.getUserByEntraOid(tenant.id, entra_oid);
    if (user && user.is_active === false) {
      throw new Error('Hesabınız dondurulmuş / devre dışı bırakılmıştır. Sistem erişim yetkiniz kapalıdır. Lütfen Sistem Yöneticisi ile iletişime geçiniz.');
    }
    if (!user) {
      user = this.createUser(tenant.id, name, email, entra_oid);
    }

    return {
      tenant_id: tenant.id,
      user_id: user.id,
      email: user.email,
      name: user.name
    };
  }

  public validateTenantAccess(auth: AuthContext, target_tenant_id: UUID): void {
    if (auth.tenant_id !== target_tenant_id) {
      throw new Error(`[KAB01] Yetkisiz Kiracı Erişimi: Farklı kiracı verisine erişilemez! İstek: ${auth.tenant_id}, Hedef: ${target_tenant_id}`);
    }
  }

  public getTenant(id: UUID): Tenant | undefined {
    return this.db.getTenantById(id);
  }

  public getUser(tenant_id: UUID, user_id: UUID): User | undefined {
    return this.db.getUserById(tenant_id, user_id);
  }

  public listUsers(tenant_id: UUID): Omit<User, 'password'>[] {
    return this.db.getUsers(tenant_id).map(({ password, ...u }) => u);
  }
}
