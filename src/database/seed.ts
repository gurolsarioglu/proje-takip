import { Database } from './db.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';

export function seedDatabase(db: Database) {
  if (db.getTenants().length > 0) {
    return; // Already seeded
  }

  const authService = new AuthService(db);
  const projectService = new ProjectService(db);
  const dependencyService = new DependencyService(db);
  const delayService = new DelayService(db);
  const taskService = new TaskService(db, dependencyService, delayService);

  // Tenant 1: Acme Teknoloji
  const tenantAcme = authService.createTenant('Acme Teknoloji A.Ş.', 'entra-acme-prod-001');

  const ali = authService.createUser(tenantAcme.id, 'Ali Yılmaz', 'ali.yilmaz@acme.com', 'entra-oid-ali');
  const ayse = authService.createUser(tenantAcme.id, 'Ayşe Kaya', 'ayse.kaya@acme.com', 'entra-oid-ayse');
  const mehmet = authService.createUser(tenantAcme.id, 'Mehmet Demir', 'mehmet.demir@acme.com', 'entra-oid-mehmet');
  const zeynep = authService.createUser(tenantAcme.id, 'Zeynep Aydın', 'zeynep.aydin@acme.com', 'entra-oid-zeynep');
  const can = authService.createUser(tenantAcme.id, 'Can Öztürk', 'can.ozturk@acme.com', 'entra-oid-can');

  const authAli = { tenant_id: tenantAcme.id, user_id: ali.id, email: ali.email, name: ali.name };
  const authAyse = { tenant_id: tenantAcme.id, user_id: ayse.id, email: ayse.email, name: ayse.name };

  // Project 1
  const proj1 = projectService.createProject(
    authAli,
    'Bulut Altyapı Modernizasyonu',
    'PostgreSQL RLS, DAG Bağımlılık Motoru ve PWA Entegrasyonu',
    '2026-10-01T09:00:00Z',
    '2026-10-31T18:00:00Z'
  );

  projectService.addOrUpdateMember(authAli, proj1.id, ayse.id, 'EDITOR');
  projectService.addOrUpdateMember(authAli, proj1.id, can.id, 'VIEWER');

  // Tasks for Project 1
  const t1 = taskService.createTask(authAli, proj1.id, 'Gereksinim Analizi & Mimari Tasarım', '2026-10-01T09:00:00Z', '2026-10-05T18:00:00Z', ali.id);
  const t2 = taskService.createTask(authAli, proj1.id, 'Veritabanı Şeması & RLS Güvenlik Politikaları', '2026-10-06T09:00:00Z', '2026-10-12T18:00:00Z', ayse.id);
  const t3 = taskService.createTask(authAli, proj1.id, 'DAG Bağımlılık Motoru & Döngü Kontrolü', '2026-10-13T09:00:00Z', '2026-10-18T18:00:00Z', mehmet.id);
  const t4 = taskService.createTask(authAli, proj1.id, 'Gecikme Teşhisi & Açıklama Modülü', '2026-10-19T09:00:00Z', '2026-10-23T18:00:00Z', mehmet.id);
  const t5 = taskService.createTask(authAli, proj1.id, 'PWA & Web Push Bildirim Servisleri', '2026-10-24T09:00:00Z', '2026-10-28T18:00:00Z', zeynep.id);
  const t6 = taskService.createTask(authAli, proj1.id, 'Kapsamlı Kabul Testleri & Canlıya Geçiş', '2026-10-29T09:00:00Z', '2026-10-31T18:00:00Z', ali.id);

  // Dependencies
  dependencyService.addDependency(authAli, t1.id, t2.id); // t2 depends on t1
  dependencyService.addDependency(authAli, t2.id, t3.id); // t3 depends on t2
  dependencyService.addDependency(authAli, t3.id, t4.id); // t4 depends on t3
  dependencyService.addDependency(authAli, t4.id, t5.id); // t5 depends on t4
  dependencyService.addDependency(authAli, t5.id, t6.id); // t6 depends on t5

  // Complete t1 and t2
  taskService.startTask(authAli, t1.id);
  taskService.completeTask(authAli, t1.id);

  taskService.startTask(authAyse, t2.id);
  taskService.completeTask(authAyse, t2.id);

  // Start t3 (Mehmet)
  taskService.startTask(authAli, t3.id);

  // Evaluate delay on t3 (simulate current due date passed, requiring explanation)
  delayService.evaluateTaskDelay(tenantAcme.id, t3.id, '2026-10-20T00:00:00Z');

  // Tenant 2: Beta Lojistik Ltd. (For multi-tenant isolation testing)
  const tenantBeta = authService.createTenant('Beta Lojistik Ltd.', 'entra-beta-prod-002');
  const burak = authService.createUser(tenantBeta.id, 'Burak Demir', 'burak.demir@beta.com', 'entra-oid-burak');
  const authBurak = { tenant_id: tenantBeta.id, user_id: burak.id, email: burak.email, name: burak.name };

  projectService.createProject(
    authBurak,
    'Filo Takip & Telemetri Portalı',
    'Beta Lojistik filo yönetim sistemi',
    '2026-10-15T00:00:00Z',
    '2026-11-15T00:00:00Z'
  );

  console.log('Sample enterprise data seeded successfully.');
}
