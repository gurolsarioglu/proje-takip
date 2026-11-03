import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../src/database/db.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ProjectService } from '../src/modules/project/project.service.js';
import { DependencyService } from '../src/modules/dependency/dependency.service.js';
import { DelayService } from '../src/modules/delay/delay.service.js';
import { TaskService, matchesTaskSearch } from '../src/modules/task/task.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';
import { ReportingService } from '../src/modules/reporting/reporting.service.js';
import { MicrosoftTodoService } from '../src/modules/microsoft_todo/microsoft_todo.service.js';
import { EmailAndAutomationService } from '../src/modules/email/email.service.js';
import { CryptoVault } from '../src/core/crypto-vault.js';
import { seedDatabase } from '../src/database/seed.js';
import { PostgresEngine } from '../src/database/postgres.js';

test('Görev ve Bağımlılık Yönetim Sistemi - Şartname v0.3 Kabul Senaryoları', async (t) => {
  const db = new Database(); // Fresh in-memory DB for tests
  const authService = new AuthService(db);
  const projectService = new ProjectService(db);
  const dependencyService = new DependencyService(db);
  const delayService = new DelayService(db);
  const taskService = new TaskService(db, dependencyService, delayService);
  const notificationService = new NotificationService(db);
  const reportingService = new ReportingService(db, projectService);
  const microsoftTodoService = new MicrosoftTodoService(db);
  const emailService = new EmailAndAutomationService(db, taskService, delayService, projectService, notificationService);

  // Setup Test Tenants and Users
  const tenantA = authService.createTenant('Acme Holding', 'entra-tenant-acme-111');
  const tenantB = authService.createTenant('Beta Sanayi', 'entra-tenant-beta-222');

  const managerA = authService.createUser(tenantA.id, 'Ali Yönetici', 'ali@acme.com', undefined, { can_create_project: true, system_role: 'ADMIN' });
  const editorA = authService.createUser(tenantA.id, 'Ayşe Editör', 'ayse@acme.com', undefined, { can_create_project: true });
  const assigneeA = authService.createUser(tenantA.id, 'Mehmet Sorumlu', 'mehmet@acme.com', undefined, { can_create_project: false });
  const externalA = authService.createUser(tenantA.id, 'Can İzleyici', 'can@acme.com', undefined, { can_create_project: false });

  const userB = authService.createUser(tenantB.id, 'Burak Beta', 'burak@beta.com', undefined, { can_create_project: true });

  const authManagerA = { tenant_id: tenantA.id, user_id: managerA.id, email: managerA.email, name: managerA.name };
  const authEditorA = { tenant_id: tenantA.id, user_id: editorA.id, email: editorA.email, name: editorA.name };
  const authAssigneeA = { tenant_id: tenantA.id, user_id: assigneeA.id, email: assigneeA.email, name: assigneeA.name };
  const authExternalA = { tenant_id: tenantA.id, user_id: externalA.id, email: externalA.email, name: externalA.name };
  const authUserB = { tenant_id: tenantB.id, user_id: userB.id, email: userB.email, name: userB.name };

  // Project setup in Tenant A
  const projectA = projectService.createProject(
    authManagerA,
    'E-Dönüşüm Projesi',
    'Kurumsal ERP entegrasyonu',
    '2026-10-01T09:00:00Z',
    '2026-10-31T18:00:00Z'
  );

  projectService.addOrUpdateMember(authManagerA, projectA.id, editorA.id, 'EDITOR');

  await t.test('KAB01: Şirketler arası veri ayrımı (Multi-Tenant Isolation)', () => {
    // User B from Tenant B cannot access Project A from Tenant A
    assert.throws(() => {
      authService.validateTenantAccess(authUserB, projectA.tenant_id);
    }, /Yetkisiz Kiracı Erişimi/);

    // Queries scoped to Tenant B return 0 projects
    const projectsForB = projectService.listProjects(authUserB);
    assert.equal(projectsForB.length, 0);
  });

  await t.test('KAB02: Görev sorumlusu yalnızca kendi görevini ve sınırlı bağımlılık özetini görür', () => {
    // Create Task 1 and Task 2
    const task1 = taskService.createTask(authManagerA, projectA.id, 'Analiz Yapılması', '2026-10-01T09:00:00Z', '2026-10-10T18:00:00Z', managerA.id);
    const task2 = taskService.createTask(authManagerA, projectA.id, 'Geliştirme', '2026-10-11T09:00:00Z', '2026-10-20T18:00:00Z', assigneeA.id);

    dependencyService.addDependency(authManagerA, task1.id, task2.id);

    // Mehmet (assignee) is not a member of project members list
    assert.throws(() => {
      projectService.getMembers(authAssigneeA, projectA.id);
    }, /Yetersiz Yetki/);

    // Sınırlı bağımlılık özeti kontrolü (K06)
    const summary = dependencyService.getLimitedDependencySummary(authAssigneeA, task2.id);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].task_id, task1.id);
    assert.equal(summary[0].title, 'Analiz Yapılması');
    assert.equal(summary[0].is_blocking, true);
  });

  await t.test('KAB03: Görünürlük talebi onaylanana kadar erişim genişletilmez', () => {
    // Can creates visibility request
    const req = projectService.requestVisibility(authExternalA, projectA.id);
    assert.equal(req.status, 'PENDING');

    // While pending, Can cannot view project details
    assert.equal(projectService.isFullProjectViewer(authExternalA, projectA.id), false);

    // Manager approves
    projectService.decideVisibilityRequest(authManagerA, req.id, true);
    assert.equal(projectService.isFullProjectViewer(authExternalA, projectA.id), true);
  });

  await t.test('KAB04: DAG Döngü kontrolü (A -> B -> C varken C -> A ve A -> A reddedilir)', () => {
    const tA = taskService.createTask(authManagerA, projectA.id, 'Görev A', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z');
    const tB = taskService.createTask(authManagerA, projectA.id, 'Görev B', '2026-10-05T00:00:00Z', '2026-10-10T00:00:00Z');
    const tC = taskService.createTask(authManagerA, projectA.id, 'Görev C', '2026-10-10T00:00:00Z', '2026-10-15T00:00:00Z');

    // A -> A should throw
    assert.throws(() => {
      dependencyService.addDependency(authManagerA, tA.id, tA.id);
    }, /A -> A/);

    // Add A -> B and B -> C
    dependencyService.addDependency(authManagerA, tA.id, tB.id);
    dependencyService.addDependency(authManagerA, tB.id, tC.id);

    // Adding C -> A should throw cycle error
    assert.throws(() => {
      dependencyService.addDependency(authManagerA, tC.id, tA.id);
    }, /Döngüsel Bağımlılık Reddedildi/);
  });

  await t.test('KAB05: C, A ve B’yi bekliyorsa yalnız A’nın bitmesi yetmez; B de bitince C READY olur', () => {
    const pX = taskService.createTask(authManagerA, projectA.id, 'Öncül X', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z');
    const pY = taskService.createTask(authManagerA, projectA.id, 'Öncül Y', '2026-10-01T00:00:00Z', '2026-10-06T00:00:00Z');
    const pZ = taskService.createTask(authManagerA, projectA.id, 'Ardıl Z', '2026-10-07T00:00:00Z', '2026-10-12T00:00:00Z');

    dependencyService.addDependency(authManagerA, pX.id, pZ.id);
    dependencyService.addDependency(authManagerA, pY.id, pZ.id);

    // Z must be BLOCKED
    assert.equal(db.getTaskById(tenantA.id, pZ.id)?.work_status, 'BLOCKED');

    // Complete X only
    taskService.completeTask(authManagerA, pX.id);
    assert.equal(db.getTaskById(tenantA.id, pZ.id)?.work_status, 'BLOCKED');

    // Complete Y
    taskService.completeTask(authManagerA, pY.id);
    // Now Z must be READY
    assert.equal(db.getTaskById(tenantA.id, pZ.id)?.work_status, 'READY');
  });

  await t.test('KAB06: Geciken BLOCKED görevde sistem gerekçesi oluşur; görevi IN_PROGRESS yapmaz', () => {
    const parentTask = taskService.createTask(authManagerA, projectA.id, 'Geciken Ana İş', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z');
    const blockedTask = taskService.createTask(authManagerA, projectA.id, 'Bekleyen İş', '2026-10-06T00:00:00Z', '2026-10-10T00:00:00Z');

    dependencyService.addDependency(authManagerA, parentTask.id, blockedTask.id);

    // Simulate now = 2026-10-12 (blockedTask due date passed while blocked)
    const delayRecord = delayService.evaluateTaskDelay(tenantA.id, blockedTask.id, '2026-10-12T00:00:00Z');
    assert.ok(delayRecord);
    assert.equal(delayRecord.explanation_status, 'RECORDED');
    assert.equal(delayRecord.explanation_source, 'SYSTEM');
    assert.equal(delayRecord.cause_class, 'DEPENDENCY_BLOCKED');

    // Task status is still BLOCKED
    assert.equal(db.getTaskById(tenantA.id, blockedTask.id)?.work_status, 'BLOCKED');
  });

  await t.test('KAB07: Sorumlu açıklama girince kayıt saklanır, yöneticiler bilgilendirilir', () => {
    const delayedTask = taskService.createTask(authManagerA, projectA.id, 'Açıklama Beklenen İş', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z', assigneeA.id);

    // Evaluate delay: no dependencies, so USER explanation is required
    const delay = delayService.evaluateTaskDelay(tenantA.id, delayedTask.id, '2026-10-08T00:00:00Z');
    assert.equal(delay?.explanation_status, 'REQUIRED');

    // Assignee submits explanation
    const updatedDelay = delayService.submitExplanation(authAssigneeA, delayedTask.id, 'Sunucu tedarikinde gümrük gecikmesi yaşandı.');
    assert.equal(updatedDelay.explanation_status, 'RECORDED');
    assert.equal(updatedDelay.explanation_source, 'USER');
    assert.equal(updatedDelay.reported_by_user_id, assigneeA.id);

    // Notify managers
    notificationService.notifyExplanationSubmitted(tenantA.id, projectA.id, delayedTask.id, assigneeA.name, delayedTask.title, updatedDelay.reason);

    const managerNotifs = notificationService.getUserNotifications(authManagerA);
    assert.ok(managerNotifs.some(n => n.title.includes('Gecikme Açıklaması Girildi')));
  });

  await t.test('KAB09: Bildirim mükerrerlik ve dedup kontrolü', () => {
    const notif1 = notificationService.createNotification(tenantA.id, assigneeA.id, 'event-101', 'IN_APP', 'Test Başlık', 'Test Mesaj');
    const notif2 = notificationService.createNotification(tenantA.id, assigneeA.id, 'event-101', 'IN_APP', 'Test Başlık', 'Test Mesaj');

    assert.equal(notif1?.id, notif2?.id);
  });

  await t.test('KAB10: Tamamlama sırasında güncel bitiş aşılmışsa gecikme kaydı eksiksiz oluşur', () => {
    const lateTask = taskService.createTask(authManagerA, projectA.id, 'Geç Biten Görev', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z', assigneeA.id);
    // Completing on 2026-10-08 (late)
    const { task } = taskService.completeTask(authManagerA, lateTask.id);
    assert.equal(task.work_status, 'COMPLETED');

    const delays = delayService.getDelayRecords(tenantA.id, lateTask.id);
    assert.ok(delays.length > 0);
  });

  await t.test('RAP01: Proje plan revizyonunda ilk plan korunur', () => {
    const proj = projectService.createProject(authManagerA, 'Revizyon Projesi', 'Test', '2026-11-01T00:00:00Z', '2026-11-15T00:00:00Z');
    projectService.updateProjectPlan(authManagerA, proj.id, '2026-11-03T00:00:00Z', '2026-11-20T00:00:00Z', 'Müşteri talebi');

    const report = reportingService.getProjectReport(authManagerA, proj.id);
    assert.equal(report.initial_start_date, '2026-11-01T00:00:00Z');
    assert.equal(report.initial_due_date, '2026-11-15T00:00:00Z');
    assert.equal(report.current_start_date, '2026-11-03T00:00:00Z');
    assert.equal(report.current_due_date, '2026-11-20T00:00:00Z');
  });

  await t.test('RAP04 & RAP05: Kullanıcı Performans Puanı (100 * (0.70*Z + 0.30*T)) ve Bağımlılık Muafiyeti', () => {
    // Create Project for score calculation
    const pScore = projectService.createProject(authManagerA, 'Puan Projesi', 'Test', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z');

    // Create 10 tasks for Mehmet (assigneeA) due in October 2026:
    // 8 completed on-time
    // 1 completed late
    // 1 incomplete
    // Total in S: 10 tasks. Z = 8/10 = 0.8, T = 9/10 = 0.9.
    // Score = 100 * (0.7 * 0.8 + 0.3 * 0.9) = 100 * (0.56 + 0.27) = 83!
    const taskIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const t = taskService.createTask(
        authManagerA,
        pScore.id,
        `Görev ${i}`,
        '2026-10-01T00:00:00Z',
        '2026-10-15T00:00:00Z',
        assigneeA.id
      );
      taskIds.push(t.id);
    }

    // Complete first 8 on-time (2026-10-14)
    for (let i = 0; i < 8; i++) {
      db.updateTask(tenantA.id, taskIds[i], {
        work_status: 'COMPLETED',
        actual_start_date: '2026-10-02T00:00:00Z',
        actual_completion_date: '2026-10-14T00:00:00Z'
      });
    }

    // Complete 9th task late (2026-10-20, after due date 2026-10-15 but before cutoff 2026-10-25)
    db.updateTask(tenantA.id, taskIds[8], {
      work_status: 'COMPLETED',
      actual_start_date: '2026-10-02T00:00:00Z',
      actual_completion_date: '2026-10-20T00:00:00Z'
    });

    // 10th task remains open

    const perfReport = reportingService.getUserPerformanceReport(
      authManagerA,
      assigneeA.id,
      '2026-10-01T00:00:00Z',
      '2026-10-31T00:00:00Z',
      '2026-10-25T00:00:00Z',
      pScore.id
    );

    assert.equal(perfReport.eligible_s_count, 10);
    assert.equal(perfReport.z_ratio, 0.8);
    assert.equal(perfReport.t_ratio, 0.9);
    assert.equal(perfReport.performance_score, 83); // Şartname sayfa 8 örneği: tam olarak 83!
  });

  await t.test('RAP06: Proje gerçek başlangıç ve bitiş hesabı', () => {
    const pDates = projectService.createProject(authManagerA, 'Tarih Projesi', 'Test', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z');
    const t1 = taskService.createTask(authManagerA, pDates.id, 'İş 1', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z');
    const t2 = taskService.createTask(authManagerA, pDates.id, 'İş 2', '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z');

    // Henüz başlamadı
    let rep = reportingService.getProjectReport(authManagerA, pDates.id);
    assert.equal(rep.actual_start_date, null);
    assert.equal(rep.actual_finish_date, null);

    // İş 1 başladı
    taskService.startTask(authManagerA, t1.id);
    rep = reportingService.getProjectReport(authManagerA, pDates.id);
    assert.ok(rep.actual_start_date !== null);
    assert.equal(rep.actual_finish_date, null); // İş 2 henüz bitmedi!

    // İki iş de tamamlandı
    taskService.completeTask(authManagerA, t1.id);
    taskService.startTask(authManagerA, t2.id);
    taskService.completeTask(authManagerA, t2.id);

    rep = reportingService.getProjectReport(authManagerA, pDates.id);
    assert.ok(rep.actual_finish_date !== null);
  });

  await t.test('ADMIN: Proje oluşturma izni (can_create_project) ve ülke bazlı dil seçimi', () => {
    // 1. Yetkisiz personel proje oluşturamaz
    assert.throws(() => {
      projectService.createProject(authAssigneeA, 'İzinsiz Proje', 'Test', '2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z');
    }, /Yeni proje oluşturma yetkiniz bulunmamaktadır/);

    // 2. Ülke bazlı dil çözümlemesi
    assert.equal(AuthService.resolveLanguageByCountry('Türkiye'), 'tr');
    assert.equal(AuthService.resolveLanguageByCountry('TR'), 'tr');
    assert.equal(AuthService.resolveLanguageByCountry('Almanya'), 'de');
    assert.equal(AuthService.resolveLanguageByCountry('Germany'), 'de');
    assert.equal(AuthService.resolveLanguageByCountry('İngiltere'), 'en');
    assert.equal(AuthService.resolveLanguageByCountry('USA'), 'en');

    // 3. Login doğrulaması
    const loginRes = authService.login(managerA.email, '123');
    assert.equal(loginRes.user.email, managerA.email);
    assert.ok(loginRes.token);

    // Hatalı şifre reddedilir
    assert.throws(() => {
      authService.login(managerA.email, 'yanlis_sifre');
    }, /Hatalı şifre/);
  });

  await t.test('ADMIN & YETKİ: Rapor oluşturma yetkilendirmesi (can_build_reports) ve admin kontrolleri', () => {
    // 1. Admin yetkisiyle kullanıcı oluşturulurken can_build_reports true gelir
    const adminUser = authService.createUser(tenantA.id, 'Yetkili Admin', 'super@acme.com', undefined, { system_role: 'ADMIN' });
    assert.equal(adminUser.can_build_reports, true);

    // 2. Standart kullanıcı varsayılan olarak can_build_reports = false gelir
    const normalUser = authService.createUser(tenantA.id, 'Düz Personel', 'duz@acme.com', undefined, { system_role: 'USER', can_build_reports: false });
    assert.equal(normalUser.can_build_reports, false);

    // 3. Admin personele rapor yetkisi verir
    const updated = authService.updateUser(authManagerA, normalUser.id, { can_build_reports: true });
    assert.equal(updated.can_build_reports, true);

    // 4. Yetkisiz personel (editorA) başkasının yetkisini güncelleyemez
    assert.throws(() => {
      authService.updateUser(authEditorA, normalUser.id, { can_build_reports: false });
    }, /Yetkisiz İşlem/);
  });

  await t.test('MICROSOFT TO DO: Çift yönlü görev senkronizasyonu, kişisel todo ve açıklama notu eşitlemesi', () => {
    // 1. Personele atanan görev To Do'ya eşitlenir
    const taskAssigned = taskService.createTask(
      authManagerA,
      projectA.id,
      'ERP Güvenlik Denetimi',
      '2026-10-10T09:00:00Z',
      '2026-10-20T18:00:00Z',
      assigneeA.id,
      'Güvenlik açıklarının taranması',
      { priority: 'HIGH' }
    );

    const syncedTodo = microsoftTodoService.syncAssignedTaskToTodo(authManagerA, taskAssigned);
    assert.equal(syncedTodo.user_id, assigneeA.id);
    assert.equal(syncedTodo.title, 'ERP Güvenlik Denetimi');
    assert.equal(syncedTodo.source, 'FG_SYSTEM');
    assert.equal(syncedTodo.importance, 'high');

    // 2. Kullanıcı kendine ait kişisel To Do oluşturabilir (Outlook To Do maddesi)
    const personalTodo = microsoftTodoService.createPersonalTodo(authAssigneeA, {
      title: 'Müdür ile haftalık görüşme',
      due_date: '2026-10-15T15:00:00Z',
      body_content: 'Bütçe onayları konuşulacak'
    });
    assert.equal(personalTodo.user_id, assigneeA.id);
    assert.equal(personalTodo.source, 'OUTLOOK_TODO');
    assert.equal(personalTodo.is_completed, false);

    // 3. To Do listesini çekme
    const list = microsoftTodoService.getUserTodoList(authAssigneeA);
    assert.ok(list.length >= 2);

    // 4. To Do üzerinden açıklama / not girme
    const updatedWithNote = microsoftTodoService.updateTodoNote(authAssigneeA, syncedTodo.id, 'Tarama başlatıldı, bulgular raporlanıyor.');
    assert.equal(updatedWithNote.body_content, 'Tarama başlatıldı, bulgular raporlanıyor.');

    // 5. To Do tamamlandı işaretleme
    const completedTodo = microsoftTodoService.updateTodoStatus(authAssigneeA, personalTodo.id, true);
    assert.equal(completedTodo.is_completed, true);
  });

  await t.test('KANBAN DRAG & DROP: Durum güncelleme ve BLOCKED bağımlılık koruması', () => {
    // 1. İki görev oluşturalım: Öncül (Task 1) -> Ardıl (Task 2)
    const task1 = taskService.createTask(
      authManagerA,
      projectA.id,
      'Kanban Öncül Görev',
      '2026-10-01T09:00:00Z',
      '2026-10-05T18:00:00Z',
      assigneeA.id
    );

    const task2 = taskService.createTask(
      authManagerA,
      projectA.id,
      'Kanban Ardıl Görev',
      '2026-10-06T09:00:00Z',
      '2026-10-10T18:00:00Z',
      assigneeA.id
    );

    dependencyService.addDependency(authManagerA, task1.id, task2.id);

    // Task 2, Task 1'e bağımlı olduğu için BLOCKED olmalı
    const t2Before = taskService.getTask(authManagerA, task2.id)!;
    assert.equal(t2Before.work_status, 'BLOCKED');

    // 2. BLOCKED görevi doğrudan IN_PROGRESS veya COMPLETED sütununa sürükleme reddedilmelidir!
    assert.throws(
      () => taskService.updateStatus(authManagerA, task2.id, 'IN_PROGRESS'),
      /BLOCKED durumundadır/
    );
    assert.throws(
      () => taskService.updateStatus(authManagerA, task2.id, 'COMPLETED'),
      /BLOCKED görev doğrudan tamamlanamaz/
    );

    // 3. Task 1'i IN_PROGRESS sütununa sürükleme (Başlatma)
    const res1 = taskService.updateStatus(authManagerA, task1.id, 'IN_PROGRESS');
    assert.equal(res1.task.work_status, 'IN_PROGRESS');
    assert.equal(res1.task.progress, 25);

    // 4. Task 1'i COMPLETED sütununa sürükleme (Tamamlama) -> Task 2 ardıl olarak READY olmalıdır
    const resDone = taskService.updateStatus(authManagerA, task1.id, 'COMPLETED');
    assert.equal(resDone.task.work_status, 'COMPLETED');
    assert.equal(resDone.task.progress, 100);
    assert.ok(resDone.newlyReadyTaskIds?.includes(task2.id));

    // 5. Şimdi Task 2 serbest kaldı (READY), IN_PROGRESS sütununa taşınabilir
    const res2 = taskService.updateStatus(authManagerA, task2.id, 'IN_PROGRESS');
    assert.equal(res2.task.work_status, 'IN_PROGRESS');

    // 6. Task 2'yi TODO sütununa geri sürükleme
    const resTodo = taskService.updateStatus(authManagerA, task2.id, 'TODO');
    assert.equal(resTodo.task.work_status, 'READY'); // Öncülü bittiği için hazır durumda kalır
  });

  await t.test('EXCEL / CSV IMPORT: Toplu görev içe aktarma doğrulaması', () => {
    const importData = [
      {
        title: 'Veritabanı Şeması Tasarımı',
        type: 'TASK' as const,
        priority: 'HIGH' as const,
        assignee_email_or_name: assigneeA.email,
        initial_start_date: '2026-11-01T09:00:00Z',
        initial_due_date: '2026-11-05T18:00:00Z',
        description: 'PostgreSQL tabloları oluşturulacak'
      },
      {
        title: 'Kullanıcı Kabul Testleri Tamamlandı',
        type: 'MILESTONE' as const,
        priority: 'HIGH' as const,
        assignee_email_or_name: assigneeA.name,
        initial_start_date: '2026-11-06T09:00:00Z',
        initial_due_date: '2026-11-06T18:00:00Z',
        description: 'Müşteri onayı alınacak'
      },
      {
        title: 'Giriş Sayfası Buton Renk Hatası',
        type: 'BUG' as const,
        priority: 'NORMAL' as const,
        assignee_email_or_name: 'Bilinmeyen Kişi',
        initial_start_date: '2026-11-07T09:00:00Z',
        initial_due_date: '2026-11-08T18:00:00Z',
        description: 'Buton hover rengi kontrol edilecek'
      }
    ];

    const result = taskService.bulkCreateTasks(authManagerA, projectA.id, importData);
    assert.equal(result.count, 3);
    assert.equal(result.createdTasks.length, 3);

    // E-posta ile eşleşen sorumlu doğrulaması
    assert.equal(result.createdTasks[0].title, 'Veritabanı Şeması Tasarımı');
    assert.equal(result.createdTasks[0].assignee_id, assigneeA.id);
    assert.equal(result.createdTasks[0].type, 'TASK');

    // İsim ile eşleşen sorumlu ve Milestone türü
    assert.equal(result.createdTasks[1].title, 'Kullanıcı Kabul Testleri Tamamlandı');
    assert.equal(result.createdTasks[1].assignee_id, assigneeA.id);
    assert.equal(result.createdTasks[1].type, 'MILESTONE');

    // Eşleşmeyen sorumlu (atanmamış kalır) ve Bug türü
    assert.equal(result.createdTasks[2].title, 'Giriş Sayfası Buton Renk Hatası');
    assert.equal(result.createdTasks[2].assignee_id, undefined);
    assert.equal(result.createdTasks[2].type, 'BUG');
  });

  await t.test('GLOBAL SEARCH: Görevleri başlık, açıklama ve atanan personele göre filtreleme', () => {
    // 1. Başlığa göre arama
    const byTitle = taskService.searchTasks(authManagerA, 'Veritabanı Şeması', projectA.id);
    assert.ok(byTitle.some(t => t.title === 'Veritabanı Şeması Tasarımı'));

    // 2. Açıklamaya göre arama (başlıkta geçmeyen "PostgreSQL tabloları" ifadesi)
    const byDesc = taskService.searchTasks(authManagerA, 'PostgreSQL tabloları', projectA.id);
    assert.equal(byDesc.length, 1);
    assert.equal(byDesc[0].title, 'Veritabanı Şeması Tasarımı');

    // 3. Atanan personel adına göre arama ("Mehmet Sorumlu")
    const byAssignee = taskService.searchTasks(authManagerA, 'Mehmet Sorumlu', projectA.id);
    assert.ok(byAssignee.length >= 2);
    assert.ok(byAssignee.every(t => t.assignee_id === assigneeA.id));

    // 4. Saf yardımcı fonksiyon (matchesTaskSearch) doğrulaması
    assert.equal(
      matchesTaskSearch(
        { title: 'Sunucu Kurulumu', description: 'Yüksek erişilebilirlik', assignee_id: 'u1' },
        'hans gruber',
        { name: 'Hans Gruber', email: 'hans@fggroup.com.tr', department: 'Mühendislik' }
      ),
      true
    );
    assert.equal(
      matchesTaskSearch(
        { title: 'Sunucu Kurulumu', description: 'Yüksek erişilebilirlik', assignee_id: 'u1' },
        'olmayan_sorgu_xyz',
        { name: 'Hans Gruber', email: 'hans@fggroup.com.tr' }
      ),
      false
    );
  });

  await t.test('DRAWER INLINE EDIT, DEPENDENCY REMOVAL & SAVED REPORTS: Plan revizyonu, bağımlılık silme ve rapor kaydetme', () => {
    // 1. Görev plan revizyonunda ilk plan korunur ve geçmişe kaydedilir
    const tPred = taskService.createTask(
      authManagerA,
      projectA.id,
      'Öncül Altyapı Görevi',
      '2026-12-01T09:00:00Z',
      '2026-12-05T18:00:00Z',
      assigneeA.id
    );
    const tSucc = taskService.createTask(
      authManagerA,
      projectA.id,
      'Ardıl Entegrasyon Görevi',
      '2026-12-06T09:00:00Z',
      '2026-12-10T18:00:00Z',
      assigneeA.id
    );

    const revised = taskService.updateTaskPlan(
      authManagerA,
      tPred.id,
      '2026-12-02T09:00:00Z',
      '2026-12-08T18:00:00Z',
      'Kapsam genişletildi'
    );
    assert.equal(revised.initial_due_date, '2026-12-05T18:00:00Z');
    assert.equal(revised.current_due_date, '2026-12-08T18:00:00Z');
    const changes = db.getTaskPlanChanges(tenantA.id, tPred.id);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].reason, 'Kapsam genişletildi');

    // 2. Bağımlılık eklenince ardıl BLOCKED olur, bağımlılık silinince otomatik READY olur
    dependencyService.addDependency(authManagerA, tPred.id, tSucc.id);
    assert.equal(db.getTaskById(tenantA.id, tSucc.id)?.work_status, 'BLOCKED');

    dependencyService.removeDependency(authManagerA, tPred.id, tSucc.id);
    assert.equal(db.getTaskById(tenantA.id, tSucc.id)?.work_status, 'READY');
  });

  await t.test('5 KİŞİLİK EKİP & SOLO PROJELER SİMÜLASYONU: Yönetici ve son kullanıcı uçtan uca eşzamanlı çalışma testi', () => {
    const simTenant = authService.createTenant('FG Simülasyon A.Ş.', 'entra-fg-sim-5');
    const simAdmin = authService.createUser(simTenant.id, 'Yönetici Admin', 'admin@sim.com', undefined, { system_role: 'ADMIN', can_create_project: true, can_build_reports: true });
    const u1 = authService.createUser(simTenant.id, 'Ahmet (PM)', 'ahmet@sim.com', undefined, { can_create_project: true, can_build_reports: true });
    const u2 = authService.createUser(simTenant.id, 'Zeynep (Solo + UX)', 'zeynep@sim.com', undefined, { can_create_project: true, can_build_reports: true });
    const u3 = authService.createUser(simTenant.id, 'Emre (Solo + Sec)', 'emre@sim.com', undefined, { can_create_project: true, can_build_reports: false });
    const u4 = authService.createUser(simTenant.id, 'Hans (Backend)', 'hans@sim.com', undefined, { country: 'Almanya', can_create_project: false });
    const u5 = authService.createUser(simTenant.id, 'Sarah (QA)', 'sarah@sim.com', undefined, { country: 'İngiltere', can_create_project: false });

    const ctxAdmin = { tenant_id: simTenant.id, user_id: simAdmin.id, email: simAdmin.email, name: simAdmin.name };
    const ctx1 = { tenant_id: simTenant.id, user_id: u1.id, email: u1.email, name: u1.name };
    const ctx2 = { tenant_id: simTenant.id, user_id: u2.id, email: u2.email, name: u2.name };
    const ctx3 = { tenant_id: simTenant.id, user_id: u3.id, email: u3.email, name: u3.name };
    const ctx4 = { tenant_id: simTenant.id, user_id: u4.id, email: u4.email, name: u4.name };
    const ctx5 = { tenant_id: simTenant.id, user_id: u5.id, email: u5.email, name: u5.name };

    // 1. Ortak Proje başlatılır (5 kişiye görev atanır)
    const sharedProj = projectService.createProject(ctx1, 'Ortak 5 Kişilik ERP Projesi', 'Tüm ekibin ortak çalıştığı proje', '2026-10-01T09:00:00Z', '2026-11-30T18:00:00Z');
    projectService.addOrUpdateMember(ctx1, sharedProj.id, u2.id, 'EDITOR');
    projectService.addOrUpdateMember(ctx1, sharedProj.id, u4.id, 'VIEWER');

    const st1 = taskService.createTask(ctx1, sharedProj.id, '1. Mimari Kararlar', '2026-10-01T09:00:00Z', '2026-10-05T18:00:00Z', u1.id);
    const st2 = taskService.createTask(ctx1, sharedProj.id, '2. Arayüz Tasarımı', '2026-10-06T09:00:00Z', '2026-10-10T18:00:00Z', u2.id);
    const st3 = taskService.createTask(ctx1, sharedProj.id, '3. Veritabanı Kurulumu', '2026-10-06T09:00:00Z', '2026-10-12T18:00:00Z', u4.id);
    const st4 = taskService.createTask(ctx1, sharedProj.id, '4. Güvenlik Sıkılaştırma', '2026-10-13T09:00:00Z', '2026-10-18T18:00:00Z', u3.id);
    const st5 = taskService.createTask(ctx1, sharedProj.id, '5. Uçtan Uca QA Testi', '2026-10-19T09:00:00Z', '2026-10-25T18:00:00Z', u5.id);

    dependencyService.addDependency(ctx1, st1.id, st2.id);
    dependencyService.addDependency(ctx1, st1.id, st3.id);
    dependencyService.addDependency(ctx1, st2.id, st4.id);
    dependencyService.addDependency(ctx1, st3.id, st4.id);
    dependencyService.addDependency(ctx1, st4.id, st5.id);

    // 2. Zeynep ve Emre kendi solo projelerini başlatıp tek başlarına yürütür
    const soloZeynep = projectService.createProject(ctx2, 'Zeynep Solo Tasarım Projesi', 'Tek başına yürütülen proje', '2026-10-05T09:00:00Z', '2026-11-10T18:00:00Z');
    const zTask = taskService.createTask(ctx2, soloZeynep.id, 'Solo UI Kit', '2026-10-05T09:00:00Z', '2026-10-15T18:00:00Z', u2.id);
    taskService.startTask(ctx2, zTask.id);
    taskService.completeTask(ctx2, zTask.id);

    const soloEmre = projectService.createProject(ctx3, 'Emre Solo Pentest Projesi', 'Tek başına yürütülen siber denetim', '2026-10-05T09:00:00Z', '2026-11-10T18:00:00Z');
    const eTask = taskService.createTask(ctx3, soloEmre.id, 'Solo Firewall Kuralları', '2026-10-05T09:00:00Z', '2026-10-15T18:00:00Z', u3.id);
    taskService.startTask(ctx3, eTask.id);

    // İzolasyon kontrolü: Hans (u4) Zeynep veya Emre'nin solo projesini göremez, Admin ise hepsini görür!
    assert.equal(projectService.listProjects(ctx4).length, 1);
    assert.equal(projectService.listProjects(ctx2).length, 2); // Ortak + Kendi Solo Projesi
    assert.equal(projectService.listProjects(ctx3).length, 2); // Ortak + Kendi Solo Projesi
    assert.equal(projectService.listProjects(ctxAdmin).length, 3); // Admin tüm şirket projelerini denetler

    // 3. Ekip aynı anda ortak projede çalışır:
    // Ahmet (u1) 1. görevi tamamlar -> Zeynep (u2) ve Hans (u4) görevleri aynı anda READY olur!
    taskService.startTask(ctx1, st1.id);
    const comp1 = taskService.completeTask(ctx1, st1.id);
    assert.equal(comp1.newlyReadyTaskIds.length, 2);

    // Zeynep (u2) ve Hans (u4) eşzamanlı olarak görevlerini başlatıp tamamlar -> Emre'nin (u3) görevi (st4) READY olur!
    taskService.startTask(ctx2, st2.id);
    taskService.startTask(ctx4, st3.id);
    taskService.completeTask(ctx2, st2.id);
    assert.equal(db.getTaskById(simTenant.id, st4.id)?.work_status, 'BLOCKED'); // Hans henüz bitirmedi
    const comp3 = taskService.completeTask(ctx4, st3.id);
    assert.ok(comp3.newlyReadyTaskIds.includes(st4.id));
    assert.equal(db.getTaskById(simTenant.id, st4.id)?.work_status, 'READY'); // İkisi de bitince Emre'nin görevi açıldı!

    // 4. Emre (u3) ve Sarah (u5) ortak projede kısıtlı sorumludur; Sarah görünürlük talep eder, Ahmet (PM) onaylar
    assert.equal(projectService.isFullProjectViewer(ctx5, sharedProj.id), false);
    const visReq = projectService.requestVisibility(ctx5, sharedProj.id);
    projectService.decideVisibilityRequest(ctx1, visReq.id, true);
    assert.equal(projectService.isFullProjectViewer(ctx5, sharedProj.id), true);

    // Emre ve Sarah görevlerini tamamlar -> Tüm ortak proje %100 tamamlanır!
    taskService.startTask(ctx3, st4.id);
    taskService.completeTask(ctx3, st4.id);
    taskService.startTask(ctx5, st5.id);
    taskService.completeTask(ctx5, st5.id);

    const report = reportingService.getProjectReport(ctxAdmin, sharedProj.id);
    assert.equal(report.total_tasks, 5);
    assert.equal(report.completed_tasks, 5);
  });

  await t.test('EXCHANGE ONLINE (SMTP), OUTLOOK ACTIONABLE CARDS & ZAMANLANMIŞ RAPORLAR: Canlı e-posta kartı ve zamanlanmış rapor testi', async () => {
    // 1. Varsayılan Exchange Online Plan 1 ayarlarının gelmesi
    const defaultCfg = emailService.getSmtpConfig(tenantA.id);
    assert.equal(defaultCfg.host, 'smtp.office365.com');
    assert.equal(defaultCfg.port, 587);

    // 2. Yetkisiz kullanıcı SMTP ayarlarını değiştiremez
    assert.throws(() => {
      emailService.saveSmtpConfig(authAssigneeA, { username: 'hacker@acme.com' });
    }, /Yetkisiz İşlem/);

    // 3. Admin SMTP ayarlarını günceller
    const savedCfg = emailService.saveSmtpConfig(authManagerA, {
      host: 'smtp.office365.com',
      port: 587,
      username: 'bildirim@fggroup.com.tr',
      from_name: 'FG Group Tekstil Sistemi',
      public_base_url: 'http://10.1.0.45:3000',
      enable_actionable_cards: true
    });
    assert.equal(savedCfg.username, 'bildirim@fggroup.com.tr');

    // 4. Tekstil numune görevi için Actionable Card (Adaptive Card v1.4) üretimi
    const cardTask1 = taskService.createTask(
      authManagerA,
      projectA.id,
      'Numune Kesim & Dikim (Outlook Card)',
      '2026-11-01T09:00:00Z',
      '2026-11-05T18:00:00Z',
      assigneeA.id
    );
    const cardTask2 = taskService.createTask(
      authManagerA,
      projectA.id,
      'Kalite Kontrol & Showroom Sunumu',
      '2026-11-06T09:00:00Z',
      '2026-11-10T18:00:00Z',
      editorA.id
    );
    dependencyService.addDependency(authManagerA, cardTask1.id, cardTask2.id);

    const outboxItem = await emailService.sendTaskReadyActionableCard(tenantA.id, cardTask1.id);
    assert.ok(outboxItem);
    assert.equal(outboxItem.category, 'ACTIONABLE_TASK_CARD');
    assert.equal(outboxItem.adaptive_card_json.type, 'AdaptiveCard');
    assert.equal(outboxItem.adaptive_card_json.actions.length, 4);

    // 5. Outlook içinden [▶️ Görevi Başlat] butonuna tıklama simülasyonu
    const startRes = await emailService.handleOutlookCardAction({
      tenant_id: tenantA.id,
      task_id: cardTask1.id,
      user_id: assigneeA.id,
      outboxId: outboxItem.id,
      action: 'START_TASK'
    });
    assert.equal(db.getTaskById(tenantA.id, cardTask1.id)?.work_status, 'IN_PROGRESS');
    assert.ok(startRes.message.includes('BAŞLATILDI'));

    // 6. Outlook içinden [✅ Tamamlandı İşaretle] butonuna tıklama -> Ardıl görev (cardTask2) otomatik READY olur ve yeni e-posta kartı gider!
    const compRes = await emailService.handleOutlookCardAction({
      tenant_id: tenantA.id,
      task_id: cardTask1.id,
      user_id: assigneeA.id,
      outboxId: outboxItem.id,
      action: 'COMPLETE_TASK'
    });
    assert.equal(db.getTaskById(tenantA.id, cardTask1.id)?.work_status, 'COMPLETED');
    assert.equal(db.getTaskById(tenantA.id, cardTask2.id)?.work_status, 'READY');
    assert.ok(compRes.message.includes('Kalite Kontrol & Showroom Sunumu'));

    // 7. Zamanlanmış Otomatik Rapor oluşturma ve anında gönderme
    const schedJob = emailService.createScheduledReport(authManagerA, {
      name: 'Günlük Tekstil Müşteri Sunumu İlerleme Raporu',
      project_id: projectA.id,
      report_type: 'EXECUTIVE_SUMMARY',
      frequency: 'DAILY',
      send_time: '09:00',
      recipients: ['ali@acme.com', 'ayse@acme.com'],
      include_adaptive_card: true
    });
    assert.equal(schedJob.is_active, true);

    const reportMail = await emailService.executeScheduledReportJob(tenantA.id, schedJob.id);
    assert.equal(reportMail.category, 'SCHEDULED_REPORT');
    assert.ok(reportMail.subject.includes('Günlük Tekstil Müşteri Sunumu İlerleme Raporu'));
    assert.ok(reportMail.adaptive_card_json);
  });

  await t.test('POSTGRESQL & AES-256-GCM VAULT: SMTP şifresinin şifreli saklanması, yeniden başlatmada korunması ve PostgreSQL senkronizasyonu', async () => {
    // 1. CryptoVault AES-256-GCM şifreleme / çözme doğrulaması
    const rawSecret = 'FgGroup!2026#ExchangePlan1';
    const encrypted = CryptoVault.encrypt(rawSecret);
    assert.ok(encrypted.startsWith('enc:v1:'), 'Şifreli metin enc:v1: önekiyle başlamalı');
    assert.notEqual(encrypted, rawSecret, 'Düz metin ile şifreli metin aynı olmamalı');
    assert.equal(CryptoVault.decrypt(encrypted), rawSecret, 'Çözülen şifre orijinal şifreyle birebir aynı olmalı');

    // 2. Database katmanında SMTP şifresinin bellekte/diskte şifreli tutulması ve okurken çözülmesi
    emailService.saveSmtpConfig(authManagerA, {
      host: 'smtp.office365.com',
      port: 587,
      username: 'bildirim@fggroup.com.tr',
      password: rawSecret,
      from_name: 'FG Group Bildirim',
      public_base_url: 'http://10.1.0.45:3000',
      enable_actionable_cards: true
    });

    const rawStored = db.state.smtp_configs.find(c => c.tenant_id === tenantA.id);
    assert.ok(rawStored?.password.startsWith('enc:v1:'), 'Veritabanı içinde şifre düz metin değil AES-256-GCM şifreli tutulmalı');

    const decryptedCfg = db.getSmtpConfig(tenantA.id);
    assert.equal(decryptedCfg?.password, rawSecret, 'Servis katmanı okuduğunda şifre otomatik çözülmeli');

    // 3. Sunucu yeniden başlatıldığında (seedDatabase(db, false)) verilerin ve SMTP şifresinin asla silinmemesi
    const projectCountBefore = db.getProjects(tenantA.id).length;
    seedDatabase(db, false);
    const projectCountAfter = db.getProjects(tenantA.id).length;
    assert.equal(projectCountAfter, projectCountBefore, 'Normal sunucu yeniden başlatmasında mevcut projeler silinmemeli');
    assert.equal(db.getSmtpConfig(tenantA.id)?.password, rawSecret, 'Yeniden başlatma sonrası SMTP şifresi korunmalı');

    // 4. PostgreSQL (PGlite) motorunun ilişkisel tabloları oluşturması ve SMTP + proje verilerini senkronize etmesi
    const pgEngine = new PostgresEngine(db, 'memory://');
    await pgEngine.init();
    const pgStatus = await pgEngine.getStatus();
    assert.equal(pgStatus.connected, true);
    assert.equal(pgStatus.engine, 'PGLITE_EMBEDDED');
    assert.equal(pgStatus.vault_encryption, 'AES-256-GCM');
    assert.equal(pgStatus.smtp_password_encrypted, true);
    assert.ok(pgStatus.table_counts.projects >= 1);
    await pgEngine.close();

    // Test ortamında gerçek SMTP zaman aşımı yaşanmaması için test şifresini simülasyon moduna çek
    if (rawStored) {
      rawStored.password = '';
    }
  });

  await t.test('OUTLOOK ADAPTIVE CARDS v1.4 YAŞAM DÖNGÜSÜ: Görev Atama, Projeye Dahil Edilme, %40-%50-%60 Zorunlu Notlu İlerleme, İş Tamamlandı Yetkili Maili ve Gecikme Uyarısı', async () => {
    // 1. Projeye yeni üye dahil edildiğinde PROJECT_MEMBER_CARD gönderimi
    const memberCard = await emailService.sendProjectMemberAddedCard(
      tenantA.id,
      projectA.id,
      assigneeA.id,
      'EDITOR',
      authManagerA.user_id
    );
    assert.ok(memberCard);
    assert.equal(memberCard.category, 'PROJECT_MEMBER_CARD');
    assert.ok(memberCard.to.includes(assigneeA.email));
    assert.ok(memberCard.subject.includes('Projeye Dahil Edildiniz'));

    // 2. Yeni görev oluşturulduğunda / atandığında TASK_ASSIGNED_CARD gönderimi
    const lifecycleTask = taskService.createTask(
      authManagerA,
      projectA.id,
      'Kumaş Boyahane Renk Onayı (Lifecycle Test)',
      '2026-10-20T09:00:00Z',
      '2026-10-25T18:00:00Z',
      assigneeA.id
    );
    const assignedCard = await emailService.sendTaskAssignedActionableCard(
      tenantA.id,
      lifecycleTask.id,
      authManagerA.user_id
    );
    assert.ok(assignedCard);
    assert.equal(assignedCard.category, 'TASK_ASSIGNED_CARD');
    assert.ok(assignedCard.to.includes(assigneeA.email));

    // 3. %40 / %50 / %60 ilerleme bildiriminde ZORUNLU NOT kuralı (Not boşsa hata fırlatmalı!)
    assert.throws(() => {
      taskService.updateTaskProgressWithNote(authAssigneeA, lifecycleTask.id, 50, '');
    }, /zorunludur/i);

    await assert.rejects(async () => {
      await emailService.handleOutlookCardAction({
        tenant_id: tenantA.id,
        task_id: lifecycleTask.id,
        user_id: assigneeA.id,
        outboxId: assignedCard.id,
        action: 'UPDATE_PROGRESS',
        progress_value: 50,
        explanation_text: ' '
      });
    }, /Zorunlu Not Kuralı|zorunludur/i);

    // 4. Not girilerek %50 ilerleme bildirildiğinde hem görev güncellenmeli hem de proje yetkililerine TASK_PROGRESS_MANAGER_CARD gitmeli
    const progActionRes = await emailService.handleOutlookCardAction({
      tenant_id: tenantA.id,
      task_id: lifecycleTask.id,
      user_id: assigneeA.id,
      outboxId: assignedCard.id,
      action: 'UPDATE_PROGRESS',
      progress_value: 50,
      explanation_text: 'Lab-dip numunelerinin %50 renk onayı tamamlandı, 2. parti yıkama testinde.'
    });
    assert.equal(db.getTaskById(tenantA.id, lifecycleTask.id)?.progress, 50);
    assert.equal(db.getTaskById(tenantA.id, lifecycleTask.id)?.work_status, 'IN_PROGRESS');
    assert.ok(progActionRes.message.includes('%50'));

    const progressManagerCards = db.getEmailOutbox(tenantA.id).filter(
      m => m.category === 'TASK_PROGRESS_MANAGER_CARD' && m.linked_task_id === lifecycleTask.id
    );
    assert.ok(progressManagerCards.length >= 1, 'Proje yetkililerine %50 ilerleme ve zorunlu not maili gitmeli');

    // 5. Görev zamanında yapılmadığında (Overdue) hem sorumluya DELAY_EXPLANATION_CARD hem de yetkililere OVERDUE_MANAGER_ALERT gitmeli
    const delayOutbox = await emailService.sendDelayExplanationActionableCard(
      tenantA.id,
      lifecycleTask.id,
      3
    );
    assert.ok(delayOutbox);
    assert.equal(delayOutbox.category, 'DELAY_EXPLANATION_CARD');

    const overdueManagerAlerts = db.getEmailOutbox(tenantA.id).filter(
      m => m.category === 'OVERDUE_MANAGER_ALERT' && m.linked_task_id === lifecycleTask.id
    );
    assert.ok(overdueManagerAlerts.length >= 1, 'Proje yetkililerine geciken görev uyarısı (OVERDUE_MANAGER_ALERT) gitmeli');

    // 6. Görev tamamlandığında proje yetkililerine TASK_COMPLETED_MANAGER_CARD gitmeli
    const compActionRes = await emailService.handleOutlookCardAction({
      tenant_id: tenantA.id,
      task_id: lifecycleTask.id,
      user_id: assigneeA.id,
      outboxId: assignedCard.id,
      action: 'COMPLETE_TASK',
      explanation_text: 'Tüm renk onayları alındı ve üretim bandına teslim edildi.'
    });
    assert.equal(db.getTaskById(tenantA.id, lifecycleTask.id)?.work_status, 'COMPLETED');
    assert.ok(compActionRes.message.includes('TAMAMLANDI'));

    const completedManagerCards = db.getEmailOutbox(tenantA.id).filter(
      m => m.category === 'TASK_COMPLETED_MANAGER_CARD' && m.linked_task_id === lifecycleTask.id
    );
    assert.ok(completedManagerCards.length >= 1, 'Görev tamamlandığında proje yetkililerine tamamlama raporu gitmeli');
  });
});
