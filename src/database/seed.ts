import { Database } from './db.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';
import { NotificationService } from '../modules/notification/notification.service.js';
import { EmailAndAutomationService } from '../modules/email/email.service.js';

export function seedDatabase(db: Database, forceReset = false) {
  const existingTenants = db.getTenants();
  const prevSmtp = existingTenants.length > 0 ? db.getSmtpConfig(existingTenants[0].id) : undefined;

  // Eğer veritabanında zaten aktif tenant ve projeler mevcutsa ve zorunlu sıfırlama istenmemişse, verileri ve SMTP şifresini koru!
  if (!forceReset && existingTenants.length > 0) {
    const tId = existingTenants[0].id;
    const existingProjects = db.getProjects(tId);
    if (existingProjects.length > 0) {
      db.getSmtpConfig(tId);
      console.log('Mevcut veritabanı kayıtları ve şifrelenmiş (AES-256-GCM) SMTP ayarları korundu.');
      return;
    }
  }

  db.reset();

  const authService = new AuthService(db);
  const projectService = new ProjectService(db);
  const dependencyService = new DependencyService(db);
  const delayService = new DelayService(db);
  const taskService = new TaskService(db, dependencyService, delayService);
  const notificationService = new NotificationService(db);
  const emailService = new EmailAndAutomationService(db, taskService, delayService, projectService, notificationService);

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
      can_create_project: true,
      can_build_reports: true,
      department: 'Koleksiyon & Proje Yönetimi'
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
      can_create_project: true,
      can_build_reports: true,
      department: 'Moda Tasarım & Modelhane'
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
      can_create_project: true,
      can_build_reports: false,
      department: 'Numune Dikim Atölyesi'
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
      can_create_project: false,
      can_build_reports: false,
      department: 'Kumaş & Tedarik Mühendisliği'
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
      can_create_project: false,
      can_build_reports: false,
      department: 'Kalite Kontrol & Showroom'
    }
  );

  const authAdmin = { tenant_id: tenantFG.id, user_id: admin.id, email: admin.email, name: admin.name };
  const authAhmet = { tenant_id: tenantFG.id, user_id: ahmet.id, email: ahmet.email, name: ahmet.name };
  const authZeynep = { tenant_id: tenantFG.id, user_id: zeynep.id, email: zeynep.email, name: zeynep.name };
  const authEmre = { tenant_id: tenantFG.id, user_id: emre.id, email: emre.email, name: emre.name };
  const authHans = { tenant_id: tenantFG.id, user_id: hans.id, email: hans.email, name: hans.name };
  const authSarah = { tenant_id: tenantFG.id, user_id: sarah.id, email: sarah.email, name: sarah.name };

  // 4. PROJE 1 (5 Kişilik Tekstil Ekibi - Müşteri Tasarım Onayı & Numune Sunumu)
  const textileProj = projectService.createProject(
    authAhmet,
    '2027 İlkbahar/Yaz Tekstil Koleksiyonu - Tasarım Onayı & Numune Sunumu',
    '5 kişilik tekstil ekibiyle müşteri sunumu için koleksiyon tasarımlarının beğeniye sunulması, kumaş/kalıp hazırlığı, prototip numune dikimi ve showroom final sunumu.',
    '2026-10-15T09:00:00Z',
    '2026-11-22T18:00:00Z'
  );
  projectService.addOrUpdateMember(authAhmet, textileProj.id, zeynep.id, 'EDITOR');
  projectService.addOrUpdateMember(authAhmet, textileProj.id, hans.id, 'VIEWER');
  projectService.addOrUpdateMember(authAhmet, textileProj.id, sarah.id, 'VIEWER');

  const tx1 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '1. Koleksiyon Moodboard, Renk Kartelası ve Eskiz Tasarımları',
    '2026-10-15T09:00:00Z',
    '2026-10-20T18:00:00Z',
    zeynep.id,
    'Müşteri beklentilerine uygun 12 parçalık kapsül koleksiyonun teknik çizim ve kumaş tuşe önerilerinin hazırlanması.',
    { type: 'TASK', priority: 'HIGH' }
  );
  const tx2 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '2. Müşteri Tasarım Sunumu ve Model Beğeni Onayı',
    '2026-10-21T09:00:00Z',
    '2026-10-24T18:00:00Z',
    ahmet.id,
    'Hazırlanan eskizlerin müşteriye sunulması, beğenilen modellerin seçilmesi ve numune üretimi için tasarım onayının alınması.',
    { type: 'MILESTONE', priority: 'HIGH' }
  );
  const tx3 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '3. Onaylanan Tasarımlar İçin Numune Kumaş ve Aksesuar Tedariki',
    '2026-10-25T09:00:00Z',
    '2026-10-29T18:00:00Z',
    hans.id,
    'Müşterinin beğendiği tasarımlar için organik pamuklu/ipek kumaşların, düğme ve fermuarların tedarik edilmesi.',
    { type: 'TASK', priority: 'HIGH' }
  );
  const tx4 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '4. Baz Kalıp Çıkarma, Serileme ve Pastal Planı Hazırlığı',
    '2026-10-25T09:00:00Z',
    '2026-10-28T18:00:00Z',
    zeynep.id,
    'Beğenilen modellerin Gerber/Lectra sisteminde 38 beden baz kalıplarının çıkarılması ve kesim planının hazırlanması.',
    { type: 'TASK', priority: 'NORMAL' }
  );
  const tx5 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '5. Prototip Numunelerin Kesim ve Dikimi (Atölye)',
    '2026-10-30T09:00:00Z',
    '2026-11-04T18:00:00Z',
    emre.id,
    'Gelen kumaşların kalıplara göre kesilmesi ve 5 kombin prototip numunenin müşteri sunumu için atölyede dikilmesi.',
    { type: 'TASK', priority: 'HIGH' }
  );
  const tx6 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '6. Numune Kalite Kontrol, Ölçü Provası ve Ütü/Askı Hazırlığı',
    '2026-11-05T09:00:00Z',
    '2026-11-08T18:00:00Z',
    sarah.id,
    'Dikilen numunelerin canlı manken üzerinde ölçü/duruş provası, dikiş hata kontrolü ve sunum askı hazırlığı.',
    { type: 'BUG', priority: 'HIGH' }
  );
  const tx7 = taskService.createTask(
    authAhmet,
    textileProj.id,
    '7. Hazırlanan Numunelerin Müşteriye Showroom Sunumu',
    '2026-11-09T09:00:00Z',
    '2026-11-12T18:00:00Z',
    ahmet.id,
    'Beğenilen tasarımların fiziksel numunelerinin müşteriye canlı sunumu ve nihai koleksiyon onayı.',
    { type: 'MILESTONE', priority: 'HIGH' }
  );

  dependencyService.addDependency(authAhmet, tx1.id, tx2.id);
  dependencyService.addDependency(authAhmet, tx2.id, tx3.id);
  dependencyService.addDependency(authAhmet, tx2.id, tx4.id);
  dependencyService.addDependency(authAhmet, tx3.id, tx5.id);
  dependencyService.addDependency(authAhmet, tx4.id, tx5.id);
  dependencyService.addDependency(authAhmet, tx5.id, tx6.id);
  dependencyService.addDependency(authAhmet, tx6.id, tx7.id);

  // tx1 (Eskiz), tx2 (Tasarım Beğenisi), tx3 (Kumaş) ve tx4 (Kalıp) tamamlandı -> tx5 (Numune Dikimi - Emre) şu an READY!
  taskService.startTask(authZeynep, tx1.id);
  taskService.completeTask(authZeynep, tx1.id);
  taskService.startTask(authAhmet, tx2.id);
  taskService.updateTaskPlan(authAhmet, tx2.id, '2026-10-21T09:00:00Z', '2026-10-25T18:00:00Z', 'Müşteri ön sunumda keten ceket modelinde yaka revizyonu talep etti.');
  taskService.completeTask(authAhmet, tx2.id);
  taskService.startTask(authZeynep, tx4.id);
  taskService.completeTask(authZeynep, tx4.id);
  taskService.startTask(authHans, tx3.id);
  delayService.submitExplanation(authHans, tx3.id, 'İpek/keten kumaşın boyahane renk tutturma (lab-dip) onayı 1 gün sürdü, kumaşlar atölyeye teslim edildi.');
  taskService.completeTask(authHans, tx3.id);

  // 5. ORTAK EKİP PROJESİ 2: Dijital Dönüşüm & ERP Entegrasyonu
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

  dependencyService.addDependency(authAdmin, t1.id, t2.id);
  dependencyService.addDependency(authAdmin, t1.id, t3.id);
  dependencyService.addDependency(authAdmin, t2.id, t4.id);
  dependencyService.addDependency(authAdmin, t3.id, t5.id);
  dependencyService.addDependency(authAdmin, t4.id, t5.id);
  dependencyService.addDependency(authAdmin, t5.id, t6.id);

  taskService.startTask(authAhmet, t1.id);
  taskService.completeTask(authAhmet, t1.id);
  db.updateTask(tenantFG.id, t1.id, {
    actual_start_date: '2026-10-02T09:00:00Z',
    actual_completion_date: '2026-10-09T16:00:00Z'
  });

  taskService.startTask(authAdmin, t2.id);
  db.updateTask(tenantFG.id, t2.id, { progress: 60, actual_start_date: '2026-10-12T09:00:00Z' });
  delayService.submitExplanation(authAdmin, t2.id, 'Veritabanı replikasyon testleri sırasında ek güvenlik yaması uygulandı.');

  taskService.startTask(authZeynep, t3.id);
  db.updateTask(tenantFG.id, t3.id, { progress: 80, actual_start_date: '2026-10-16T09:00:00Z' });

  // 6. SOLO PROJE 1 (Zeynep Kaya)
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
    'Tüm FG Group ürünlerinde kullanılacak atomik bileşen setinin inşası',
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
  taskService.startTask(authZeynep, zt2.id);
  db.updateTask(tenantFG.id, zt2.id, { progress: 65, actual_start_date: '2026-10-13T10:00:00Z' });

  // 7. SOLO PROJE 2 (Emre Demir)
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
  taskService.startTask(authEmre, et2.id);
  db.updateTask(tenantFG.id, et2.id, { progress: 45, actual_start_date: '2026-10-17T10:00:00Z' });

  // 8. Microsoft To Do & Outlook Başlangıç Eşitlemesi
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

  // 9. Exchange Online Plan 1 (SMTP), Zamanlanmış Raporlar ve Başlangıç Outlook Actionable Cards
  if (prevSmtp) {
    db.upsertSmtpConfig({
      ...prevSmtp,
      tenant_id: tenantFG.id
    });
  } else {
    emailService.getSmtpConfig(tenantFG.id);
  }

  const job1 = emailService.createScheduledReport(authAdmin, {
    name: 'Günlük Tekstil Koleksiyonu & Darboğaz Özeti',
    project_id: textileProj.id,
    report_type: 'EXECUTIVE_SUMMARY',
    frequency: 'DAILY',
    send_time: '09:00',
    recipients: ['admin@fggroup.com.tr', 'ahmet@fggroup.com.tr', 'zeynep@fggroup.com.tr'],
    include_adaptive_card: true
  });

  emailService.createScheduledReport(authAdmin, {
    name: 'Haftalık 5 Kişilik Ekip Performans Karnesi (Şartname v0.3)',
    project_id: 'all',
    report_type: 'PERFORMANCE_SCORECARD',
    frequency: 'WEEKLY',
    day_of_week: 5,
    send_time: '17:00',
    recipients: ['admin@fggroup.com.tr', 'ahmet@fggroup.com.tr'],
    include_adaptive_card: true
  });

  // Başlangıç örnek Actionable Card e-postaları (Emre'nin hazır numune dikimi görevi, Hans'ın gecikme kartı ve örnek otomatik rapor)
  void Promise.all([
    emailService.sendTaskReadyActionableCard(tenantFG.id, tx5.id),
    emailService.sendDelayExplanationActionableCard(tenantFG.id, t2.id),
    emailService.executeScheduledReportJob(tenantFG.id, job1.id)
  ]);

  console.log('FG Group 5 kişilik ekip, Tekstil & ERP projeleri ve Exchange Online / Actionable Cards başarıyla yüklendi.');
}
