import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../src/database/db.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ProjectService } from '../src/modules/project/project.service.js';
import { DependencyService } from '../src/modules/dependency/dependency.service.js';
import { DelayService } from '../src/modules/delay/delay.service.js';
import { TaskService } from '../src/modules/task/task.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';
import { ReportingService } from '../src/modules/reporting/reporting.service.js';

test('Görev ve Bağımlılık Yönetim Sistemi - Şartname v0.3 Kabul Senaryoları', async (t) => {
  const db = new Database(); // Fresh in-memory DB for tests
  const authService = new AuthService(db);
  const projectService = new ProjectService(db);
  const dependencyService = new DependencyService(db);
  const delayService = new DelayService(db);
  const taskService = new TaskService(db, dependencyService, delayService);
  const notificationService = new NotificationService(db);
  const reportingService = new ReportingService(db, projectService);

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
});
