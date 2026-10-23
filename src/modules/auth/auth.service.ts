import crypto from 'crypto';
import { Database } from '../../database/db.js';
import { AuthContext, Tenant, User, UUID } from '../../core/types.js';

export class AuthService {
  constructor(private db: Database) {}

  public createTenant(name: string, entra_tenant_id: string): Tenant {
    const tenant: Tenant = {
      id: crypto.randomUUID(),
      name,
      entra_tenant_id,
      created_at: new Date().toISOString()
    };
    return this.db.insertTenant(tenant);
  }

  public createUser(tenant_id: UUID, name: string, email: string, entra_oid?: string): User {
    const tenant = this.db.getTenantById(tenant_id);
    if (!tenant) {
      throw new Error(`Kiracı bulunamadı: ${tenant_id}`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      tenant_id,
      entra_oid: entra_oid || crypto.randomUUID(),
      name,
      email,
      created_at: new Date().toISOString()
    };
    return this.db.insertUser(user);
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

  public listUsers(tenant_id: UUID): User[] {
    return this.db.getUsers(tenant_id);
  }
}
