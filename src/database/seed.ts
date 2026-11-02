import { Database } from './db.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';

export function seedDatabase(db: Database) {
  // Always initialize fresh 5-person team & solo projects on server boot
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
      can_build_reports: true,
      department: 'Yönetim'
    }
  );

  // 3. 5 Kişilik Ekip Kartları (Farklı ülkeler, departmanlar ve solo proje yetkileri)
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
      can_build_reports: true,  // Rapor oluşturma yetkili
      department: 'Yazılım & Teknoloji'
    }
  );

  const zeynep = authService.createUser(
    tenantFG.id,
    'Zeynep Kaya',
    'zeynep@fggroup.com.tr',
    'entra-oid-zeynep',
    {
      phone: '+90 535 444 5566',
      country: 'Türkiye',
      password: '123',
      system_role: 'USER',
      can_create_project: true, // Kendi solo projesini tek başına yürütebilir
      can_build_reports: true,
      department: 'Ürün & UX Tasarım'
    }
  );

  const emre = authService.createUser(
    tenantFG.id,
    'Emre Demir',
    'emre@fggroup.com.tr',
    'entra-oid-emre',
    {
      phone: '+90 536 777 8899',
      country: 'Türkiye',
      password: '123',
      system_role: 'USER',
      can_create_project: true, // Kendi solo siber güvenlik projesini yürütebilir
      can_build_reports: false,
      department: 'Siber Güvenlik & DevOps'
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
      can_build_reports: false,
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
      can_build_reports: false,
      department: 'Operasyon & QA'
    }
  );

  const authAdmin = { tenant_id: tenantFG.id, user_id: admin.id, email: admin.email, name: admin.name };
  const authAhmet = { tenant_id: tenantFG.id, user_id: ahmet.id, email: ahmet.email, name: ahmet.name };
  const authZeynep = { tenant_id: tenantFG.id, user_id: zeynep.id, email: zeynep.email, name: zeynep.name };
  const authEmre = { tenant_id: tenantFG.id, user_id: emre.id, email: emre.email, name: emre.name };

  // 4. ORTAK EKİP PROJESİ (5 Kişinin Birlikte Çalıştığı Ana Proje): Dijital Dönüşüm & ERP Entegrasyonu
  const proj = projectService.createProject(
    authAdmin,
    'Dijital Dönüşüm & ERP Entegrasyonu',
    'FG Group global operasyonlarının 5 kişilik çekirdek ekiple merkezileştirilmesi',
    '2026-10-01T09:00:00Z',
    '2026-11-15T18:00:00Z'
  );

  projectService.addOrUpdateMember(authAdmin, proj.id, ahmet.id, 'PROJECT_MANAGER');
  projectService.addOrUpdateMember(authAdmin, proj.id, zeynep.id, 'EDITOR');
  projectService.addOrUpdateMember(authAdmin, proj.id, hans.id, 'VIEWER');
  projectService.addOrUpdateMember(authAdmin, proj.id, sarah.id, 'VIEWER');
  // Not: Emre bu ortak projede sadece kendine atanan görevden sorumlu (KAB02 kısıtlı görünüm & KAB03 görünürlük talebi testi için)

  // Ortak Proje Görevleri (5 Kişiye Dağıtılmış DAG Zinciri)
  const t1 = taskService.createTask(
    authAdmin,
    proj.id,
    'Gereksinim Analizi ve Süreç Haritası',
    '2026-10-01T09:00:00Z',
    '2026-10-10T18:00:00Z',
    ahmet.id,
    'İş akışlarının incelenmesi ve FG Group departman ihtiyaçlarının belirlenmesi',
    { type: 'TASK', priority: 'NORMAL' }
  );
  const t2 = taskService.createTask(
    authAdmin,
    proj.id,
    'Sunucu & Veritabanı Kümesi Kurulumu',
    '2026-10-11T09:00:00Z',
    '2026-10-30T18:00:00Z',
    hans.id,
    'PostgreSQL ve bulut altyapısının yüksek erişilebilirlikle yapılandırılması',
    { type: 'TASK', priority: 'HIGH' }
  );
  const t3 = taskService.createTask(
    authAdmin,
    proj.id,
    'ERP Ekranları UX/UI Arayüz Tasarımı',
    '2026-10-15T09:00:00Z',
    '2026-11-08T18:00:00Z',
    zeynep.id,
    'Kullanıcı dostu yönetim panelleri ve mobil uyumlu ekran şablonlarının hazırlanması',
    { type: 'TASK', priority: 'HIGH' }
  );
  const t4 = taskService.createTask(
    authAdmin,
    proj.id,
    'API Güvenlik Katmanı & Kimlik Doğrulama (OAuth2)',
    '2026-11-01T09:00:00Z',
    '2026-11-12T18:00:00Z',
    emre.id,
    'Penetrasyon kontrolleri, JWT ve rol tabanlı erişim güvenliğinin devreye alınması',
    { type: 'TASK', priority: 'HIGH' }
  );
  const t5 = taskService.createTask(
    authAdmin,
    proj.id,
    'API Entegrasyonu ve Test Senaryoları',
    '2026-11-09T09:00:00Z',
    '2026-11-18T18:00:00Z',
    sarah.id,
    'Harici sistem bağlantıları ve uç nokta testlerinin yürütülmesi',
    { type: 'TASK', priority: 'NORMAL' }
  );
  const t6 = taskService.createTask(
    authAdmin,
    proj.id,
    'Son Kullanıcı Kabul Testleri (UAT)',
    '2026-11-19T09:00:00Z',
    '2026-11-25T18:00:00Z',
    ahmet.id,
    'Canlıya geçiş öncesi anahtar kullanıcılarla doğrulama ve onay',
    { type: 'MILESTONE', priority: 'HIGH' }
  );

  // Bağımlılıklar (Finish-to-Start DAG)
  dependencyService.addDependency(authAdmin, t1.id, t2.id);
  dependencyService.addDependency(authAdmin, t1.id, t3.id);
  dependencyService.addDependency(authAdmin, t2.id, t4.id);
  dependencyService.addDependency(authAdmin, t3.id, t5.id);
  dependencyService.addDependency(authAdmin, t4.id, t5.id);
  dependencyService.addDependency(authAdmin, t5.id, t6.id);

  // t1 zamanında tamamlandı -> t2 (Hans) ve t3 (Zeynep) otomatik READY oldu!
  taskService.startTask(authAhmet, t1.id);
  taskService.completeTask(authAhmet, t1.id);
  db.updateTask(tenantFG.id, t1.id, {
    actual_start_date: '2026-10-02T09:00:00Z',
    actual_completion_date: '2026-10-09T16:00:00Z'
  });

  // t2 başladı (Hans) ve %60 ilerledi, vadesi (2026-10-30) geçtiği için gecikme açıklaması girdi
  taskService.startTask(authAdmin, t2.id);
  db.updateTask(tenantFG.id, t2.id, { progress: 60, actual_start_date: '2026-10-12T09:00:00Z' });
  delayService.submitExplanation(authAdmin, t2.id, 'Veritabanı replikasyon testleri sırasında ek güvenlik yaması uygulandı.');

  // t3 başladı (Zeynep) ve %80 ilerledi (takvimde)
  taskService.startTask(authZeynep, t3.id);
  db.updateTask(tenantFG.id, t3.id, { progress: 80, actual_start_date: '2026-10-16T09:00:00Z' });

  // 5. SOLO PROJE 1 (Zeynep Kaya Tek Başına Yürütüyor): FG Kurumsal Tasarım Sistemi
  const soloProjZeynep = projectService.createProject(
    authZeynep,
    'FG Kurumsal Tasarım Sistemi (Design System v2)',
    'Zeynep Kaya tarafından bağımsız yürütülen kurumsal UI bileşen ve tasarım standardizasyonu projesi',
    '2026-10-05T09:00:00Z',
    '2026-11-20T18:00:00Z'
  );

  const zt1 = taskService.createTask(
    authZeynep,
    soloProjZeynep.id,
    'Renk Paleti ve Tipografi Tokenlarının Belirlenmesi',
    '2026-10-05T09:00:00Z',
    '2026-10-12T18:00:00Z',
    zeynep.id,
    'Executive White ve Koyu Tema kontrast standartlarının dokümantasyonu',
    { type: 'TASK', priority: 'HIGH' }
  );
  const zt2 = taskService.createTask(
    authZeynep,
    soloProjZeynep.id,
    'Figma Ortak Bileşen Kütüphanesi (Buton, Tablo, Drawer)',
    '2026-10-13T09:00:00Z',
    '2026-11-12T18:00:00Z',
    zeynep.id,
    'Tüm FG Group ürünlerinde ürünlerde kullanılacak atomik bileşen setinin inşası',
    { type: 'TASK', priority: 'NORMAL' }
  );
  const zt3 = taskService.createTask(
    authZeynep,
    soloProjZeynep.id,
    'Tasarım Sistemi v2.0 Yayın Kilometre Taşı',
    '2026-11-13T09:00:00Z',
    '2026-11-20T18:00:00Z',
    zeynep.id,
    'Yazılım ekiplerine tasarım kütüphanesinin teslimi',
    { type: 'MILESTONE', priority: 'HIGH' }
  );
  dependencyService.addDependency(authZeynep, zt1.id, zt2.id);
  dependencyService.addDependency(authZeynep, zt2.id, zt3.id);

  taskService.startTask(authZeynep, zt1.id);
  taskService.completeTask(authZeynep, zt1.id);
  db.updateTask(tenantFG.id, zt1.id, {
    actual_start_date: '2026-10-05T10:00:00Z',
    actual_completion_date: '2026-10-11T15:00:00Z'
  });
  taskService.startTask(authZeynep, zt2.id);
  db.updateTask(tenantFG.id, zt2.id, { progress: 65, actual_start_date: '2026-10-13T10:00:00Z' });

  // 6. SOLO PROJE 2 (Emre Demir Tek Başına Yürütüyor): ISO 27001 & Zero-Trust Siber Denetimi
  const soloProjEmre = projectService.createProject(
    authEmre,
    'ISO 27001 & Sıfır Güven (Zero-Trust) Siber Denetimi',
    'Emre Demir tarafından tek başına yürütülen altyapı güvenlik sıkılaştırma ve sızma testi projesi',
    '2026-10-08T09:00:00Z',
    '2026-11-25T18:00:00Z'
  );

  const et1 = taskService.createTask(
    authEmre,
    soloProjEmre.id,
    'Güvenlik Duvarı ve VPN Erişim Politikalarının Sıkılaştırılması',
    '2026-10-08T09:00:00Z',
    '2026-10-16T18:00:00Z',
    emre.id,
    'Zero-Trust ağ segmentasyonu ve MFA zorunluluğunun uygulanması',
    { type: 'TASK', priority: 'HIGH' }
  );
  const et2 = taskService.createTask(
    authEmre,
    soloProjEmre.id,
    'Uygulama Sızma Testi (Pentest) ve Zafiyet Taraması',
    '2026-10-17T09:00:00Z',
    '2026-11-14T18:00:00Z',
    emre.id,
    'OWASP Top 10 kriterlerine göre iç ve dış sızma testlerinin tamamlanması',
    { type: 'BUG', priority: 'HIGH' }
  );
  const et3 = taskService.createTask(
    authEmre,
    soloProjEmre.id,
    'ISO 27001 Denetim Raporu & Sertifikasyon Onayı',
    '2026-11-15T09:00:00Z',
    '2026-11-25T18:00:00Z',
    emre.id,
    'Bağımsız denetim öncesi nihai uygunluk kontrolü',
    { type: 'MILESTONE', priority: 'HIGH' }
  );
  dependencyService.addDependency(authEmre, et1.id, et2.id);
  dependencyService.addDependency(authEmre, et2.id, et3.id);

  taskService.startTask(authEmre, et1.id);
  taskService.completeTask(authEmre, et1.id);
  db.updateTask(tenantFG.id, et1.id, {
    actual_start_date: '2026-10-08T10:00:00Z',
    actual_completion_date: '2026-10-15T15:00:00Z'
  });
  taskService.startTask(authEmre, et2.id);
  db.updateTask(tenantFG.id, et2.id, { progress: 45, actual_start_date: '2026-10-17T10:00:00Z' });

  // 7. Microsoft To Do & Outlook Başlangıç Eşitlemesi
  db.insertTodoItem({
    id: 'ms_todo_sample_01',
    tenant_id: tenantFG.id,
    user_id: admin.id,
    title: 'Deneme Görev',
    body_content: 'Outlook To Do üzerinden senkronize edilen kişisel kontrol maddesi',
    is_completed: false,
    due_date: '2025-07-24T18:00:00Z',
    importance: 'high',
    is_starred: true,
    source: 'OUTLOOK_TODO',
    synced_at: new Date().toISOString(),
    created_at: new Date('2025-07-20T09:00:00Z').toISOString()
  });

  // Atanan FG Group görevlerinin To Do listesine otomatik aktarılması
  const allTasks = db.getTasks(tenantFG.id);
  for (const t of allTasks) {
    if (t.assignee_id) {
      db.insertTodoItem({
        id: `ms_todo_${t.id.slice(0, 8)}`,
        tenant_id: tenantFG.id,
        user_id: t.assignee_id,
        title: t.title,
        body_content: t.description || 'FG Group Projesi',
        is_completed: t.work_status === 'COMPLETED',
        due_date: t.current_due_date,
        importance: t.priority === 'HIGH' ? 'high' : (t.priority === 'LOW' ? 'low' : 'normal'),
        is_starred: t.priority === 'HIGH',
        linked_task_id: t.id,
        source: 'FG_SYSTEM',
        synced_at: new Date().toISOString(),
        created_at: t.created_at
      });
    }
  }

  console.log('FG Group 5 kişilik ekip, ortak proje ve solo projeler başarıyla yüklendi.');
}
