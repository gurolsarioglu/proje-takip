import { Database } from './db.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';

export function seedDatabase(db: Database) {
  // Always ensure admin@fggroup.com.tr exists
  const existingAdmin = db.getUserByEmail('admin@fggroup.com.tr');
  if (existingAdmin) {
    return; // Already initialized
  }

  // Clear or initialize
  db.reset();

  const authService = new AuthService(db);
  const projectService = new ProjectService(db);
  const dependencyService = new DependencyService(db);
  const delayService = new DelayService(db);
  const taskService = new TaskService(db, dependencyService, delayService);

  // 1. Ana Şirket: FG Group
  const tenantFG = authService.createTenant('FG Group', 'entra-fggroup-prod-001');

  // 2. Sistem Yöneticisi (Admin) - admin@fggroup.com.tr / 123
  const admin = authService.createUser(
    tenantFG.id,
    'Sistem Yöneticisi (Admin)',
    'admin@fggroup.com.tr',
    'entra-oid-admin',
    {
      phone: '+90 532 000 0001',
      country: 'Türkiye',
      password: '123',
      system_role: 'ADMIN',
      can_create_project: true,
      department: 'Yönetim'
    }
  );

  // 3. Personel Kartları (Farklı ülkeler ve dil seçimi simülasyonu)
  const ahmet = authService.createUser(
    tenantFG.id,
    'Ahmet Yılmaz',
    'ahmet@fggroup.com.tr',
    'entra-oid-ahmet',
    {
      phone: '+90 533 111 2233',
      country: 'Türkiye',
      password: '123',
      system_role: 'USER',
      can_create_project: true, // Proje oluşturabilir
      department: 'Yazılım & Teknoloji'
    }
  );

  const hans = authService.createUser(
    tenantFG.id,
    'Hans Gruber',
    'hans@fggroup.com.tr',
    'entra-oid-hans',
    {
      phone: '+49 170 1234567',
      country: 'Almanya',
      password: '123',
      system_role: 'USER',
      can_create_project: false, // Standart çalışan
      department: 'Mühendislik'
    }
  );

  const sarah = authService.createUser(
    tenantFG.id,
    'Sarah Connor',
    'sarah@fggroup.com.tr',
    'entra-oid-sarah',
    {
      phone: '+44 7911 123456',
      country: 'İngiltere',
      password: '123',
      system_role: 'USER',
      can_create_project: false, // Standart çalışan
      department: 'Operasyon'
    }
  );

  const authAdmin = { tenant_id: tenantFG.id, user_id: admin.id, email: admin.email, name: admin.name };
  const authAhmet = { tenant_id: tenantFG.id, user_id: ahmet.id, email: ahmet.email, name: ahmet.name };

  // 4. Örnek Proje: Dijital Dönüşüm & ERP Entegrasyonu
  const proj = projectService.createProject(
    authAdmin,
    'Dijital Dönüşüm & ERP Entegrasyonu',
    'FG Group global operasyonlarının merkezileştirilmesi',
    '2026-10-01T09:00:00Z',
    '2026-11-15T18:00:00Z'
  );

  projectService.addOrUpdateMember(authAdmin, proj.id, ahmet.id, 'PROJECT_MANAGER');
  projectService.addOrUpdateMember(authAdmin, proj.id, hans.id, 'VIEWER');
  projectService.addOrUpdateMember(authAdmin, proj.id, sarah.id, 'VIEWER');

  // Görevler
  const t1 = taskService.createTask(authAdmin, proj.id, 'Gereksinim Analizi ve Süreç Haritası', '2026-10-01T09:00:00Z', '2026-10-10T18:00:00Z', ahmet.id);
  const t2 = taskService.createTask(authAdmin, proj.id, 'Sunucu & Veritabanı Kümesi Kurulumu', '2026-10-11T09:00:00Z', '2026-10-18T18:00:00Z', hans.id);
  const t3 = taskService.createTask(authAdmin, proj.id, 'API Entegrasyonu ve Test Senaryoları', '2026-10-19T09:00:00Z', '2026-10-25T18:00:00Z', sarah.id);
  const t4 = taskService.createTask(authAdmin, proj.id, 'Son Kullanıcı Kabul Testleri (UAT)', '2026-10-26T09:00:00Z', '2026-11-05T18:00:00Z', ahmet.id);

  // Bağımlılıklar (Finish-to-Start)
  dependencyService.addDependency(authAdmin, t1.id, t2.id);
  dependencyService.addDependency(authAdmin, t2.id, t3.id);
  dependencyService.addDependency(authAdmin, t3.id, t4.id);

  // t1 tamamlandı
  taskService.startTask(authAdmin, t1.id);
  taskService.completeTask(authAdmin, t1.id);

  // t2 başladı (Hans)
  taskService.startTask(authAdmin, t2.id);

  console.log('FG Group verileri ve admin@fggroup.com.tr hesabı başarıyla yüklendi.');
}
