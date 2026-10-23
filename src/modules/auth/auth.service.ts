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

  public static resolveLanguageByCountry(country?: string): AppLanguage {
    if (!country) return 'tr';
    const c = country.trim().toLowerCase();
    if (c === 'tr' || c.includes('türk') || c.includes('turk') || c.includes('t?rk') || c === 'turkey') {
      return 'tr';
    }
    if (c === 'de' || c.includes('alman') || c.includes('german') || c.includes('deutsch')) {
      return 'de';
    }
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

    const country = options?.country || 'Türkiye';
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
      department: options?.department || 'Genel',
      created_at: new Date().toISOString()
    };
    return this.db.insertUser(user);
  }

  public login(email: string, password?: string): LoginResponse {
    const user = this.db.getUserByEmail(email);
    if (!user) {
      throw new Error('Geçersiz kullanıcı adı veya e-posta.');
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
      patch.language = AuthService.resolveLanguageByCountry(updates.country);
    }

    const updated = this.db.updateUser(auth.tenant_id, user_id, patch);
    const { password: _, ...safeUser } = updated!;
    return safeUser;
  }

  public authenticateEntraUser(entra_tenant_id: string, entra_oid: string, name: string, email: string): AuthContext {
    let tenant = this.db.getTenants().find(t => t.entra_tenant_id === entra_tenant_id);
    if (!tenant) {
      tenant = this.createTenant(`M365 Kurumu (${entra_tenant_id.slice(0, 8)})`, entra_tenant_id);
    }

    let user = this.db.getUserByEntraOid(tenant.id, entra_oid);
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
