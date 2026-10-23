import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Database } from '../database/db.js';
import { seedDatabase } from '../database/seed.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { NotificationService } from '../modules/notification/notification.service.js';
import { ReportingService } from '../modules/reporting/reporting.service.js';
import { AuthContext, UUID } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Veritabanı ve Modül Başlatma
const dbPath = path.resolve(__dirname, '../../.work/data.json');
const db = new Database(dbPath);
seedDatabase(db);

const authService = new AuthService(db);
const projectService = new ProjectService(db);
const dependencyService = new DependencyService(db);
const delayService = new DelayService(db);
const taskService = new TaskService(db, dependencyService, delayService);
const notificationService = new NotificationService(db);
const reportingService = new ReportingService(db, projectService);

// Güvenli Kiracı ve Kullanıcı Bağlamı Middleware'i
function getAuthContext(req: Request): AuthContext {
  const tenant_id = (req.headers['x-tenant-id'] as string) || db.getTenants()[0]?.id;
  const user_id = (req.headers['x-user-id'] as string) || db.getUsers(tenant_id)[0]?.id;

  const user = db.getUserById(tenant_id, user_id);
  return {
    tenant_id,
    user_id,
    email: user?.email || 'anon@system.com',
    name: user?.name || 'Kullanıcı'
  };
}

// Statik frontend dosyaları
const srcPublic = path.resolve(__dirname, '../../src/public');
const localPublic = path.resolve(__dirname, '../public');
const publicDir = fs.existsSync(srcPublic) ? srcPublic : (fs.existsSync(localPublic) ? localPublic : path.resolve(process.cwd(), 'src/public'));
app.use(express.static(publicDir));

// --- API Endpoints ---

// 1. Auth & Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
    }
    const result = authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/tenants', (req, res) => {
  res.json(db.getTenants());
});

app.get('/api/users', (req, res) => {
  const auth = getAuthContext(req);
  res.json(authService.listUsers(auth.tenant_id));
});

app.get('/api/current-context', (req, res) => {
  const auth = getAuthContext(req);
  const tenant = db.getTenantById(auth.tenant_id);
  const user = db.getUserById(auth.tenant_id, auth.user_id);
  if (user) {
    const { password, ...safeUser } = user;
    res.json({ auth, tenant, user: safeUser });
  } else {
    res.json({ auth, tenant, user: null });
  }
});

// Admin Personel Kartı Yönetimi
app.get('/api/admin/personnel', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const caller = db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yetkisiz Erişim: Personel kartlarını yalnızca Sistem Yöneticisi görebilir.' });
    }
    const users = authService.listUsers(auth.tenant_id);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/personnel', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const caller = db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yetkisiz İşlem: Yeni personel kartı yalnızca Sistem Yöneticisi tarafından oluşturulabilir.' });
    }

    const { name, email, phone, country, password, can_create_project, department, system_role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Ad Soyad ve E-posta alanları zorunludur.' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Bu e-posta adresine sahip bir personel zaten mevcut.' });
    }

    const newUser = authService.createUser(auth.tenant_id, name, email, undefined, {
      phone,
      country: country || 'Türkiye',
      password: password || '123',
      can_create_project: !!can_create_project,
      department: department || 'Genel',
      system_role: system_role || 'USER'
    });

    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/personnel/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const updated = authService.updateUser(auth, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 2. Projects
app.get('/api/projects', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const projects = projectService.listProjects(auth);
    res.json(projects);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { title, description, initial_start_date, initial_due_date } = req.body;
    const project = projectService.createProject(
      auth,
      title,
      description,
      initial_start_date,
      initial_due_date
    );
    res.status(201).json(project);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const project = projectService.getProject(auth, req.params.id);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    let members: any[] = [];
    try {
      members = projectService.getMembers(auth, project.id);
    } catch {
      // Sorumlu üye listesini göremez (KAB02)
    }

    const visibilityRequests = projectService.getVisibilityRequests(auth, project.id);
    const isManager = projectService.canManageProject(auth, project.id);
    const isEditor = projectService.canEditTasks(auth, project.id);
    const isFullViewer = projectService.isFullProjectViewer(auth, project.id);

    res.json({
      project,
      members,
      visibilityRequests,
      permissions: { isManager, isEditor, isFullViewer }
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects/:id/plan', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { new_start_date, new_due_date, reason } = req.body;
    const updated = projectService.updateProjectPlan(auth, req.params.id, new_start_date, new_due_date, reason);
    res.json(updated);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects/:id/members', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { user_id, role } = req.body;
    const member = projectService.addOrUpdateMember(auth, req.params.id, user_id, role);
    res.json(member);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects/:id/visibility-request', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const request = projectService.requestVisibility(auth, req.params.id);
    res.status(201).json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/:id/visibility-decide', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { request_id, approve } = req.body;
    const updated = projectService.decideVisibilityRequest(auth, request_id, approve);
    res.json(updated);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 3. Tasks
app.get('/api/projects/:id/tasks', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const isFullViewer = projectService.isFullProjectViewer(auth, req.params.id);
    const allTasks = taskService.listTasks(auth, req.params.id);

    // KAB02: Görev sorumlusu yalnızca kendi görevini ve sınırlı bağımlılık özetini görür
    if (!isFullViewer) {
      const myTasks = allTasks.filter(t => t.assignee_id === auth.user_id);
      const tasksWithSummary = myTasks.map(t => ({
        ...t,
        limited_dependencies: dependencyService.getLimitedDependencySummary(auth, t.id)
      }));
      return res.json(tasksWithSummary);
    }

    // Tam erişimli kullanıcılar tüm görevleri ve bağımlılık özetlerini görür
    const enriched = allTasks.map(t => ({
      ...t,
      limited_dependencies: dependencyService.getLimitedDependencySummary(auth, t.id)
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { project_id, title, initial_start_date, initial_due_date, assignee_id, description } = req.body;

    if (!projectService.canEditTasks(auth, project_id)) {
      return res.status(403).json({ error: 'Görev ekleme yetkiniz yok.' });
    }

    const task = taskService.createTask(
      auth,
      project_id,
      title,
      initial_start_date,
      initial_due_date,
      assignee_id,
      description
    );
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/assign', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { assignee_id } = req.body;
    const task = taskService.assignTask(auth, req.params.id, assignee_id);
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/plan', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { new_start_date, new_due_date, reason } = req.body;
    const task = taskService.updateTaskPlan(auth, req.params.id, new_start_date, new_due_date, reason);
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/start', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const task = taskService.startTask(auth, req.params.id);
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/complete', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const result = taskService.completeTask(auth, req.params.id);

    // Yeni READY olan görevlerin sorumlularına bildirim gönder
    for (const readyId of result.newlyReadyTaskIds) {
      const t = db.getTaskById(auth.tenant_id, readyId);
      if (t && t.assignee_id) {
        notificationService.notifyTaskReady(auth.tenant_id, t.id, t.assignee_id, t.title);
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Dependencies
app.get('/api/projects/:id/dependencies', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const deps = db.getDependencies(auth.tenant_id);
    const projectTasks = new Set(db.getTasks(auth.tenant_id, req.params.id).map(t => t.id));
    const filtered = deps.filter(d => projectTasks.has(d.predecessor_id) && projectTasks.has(d.successor_id));
    res.json(filtered);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/dependencies', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { predecessor_id, successor_id } = req.body;
    const dep = dependencyService.addDependency(auth, predecessor_id, successor_id);
    res.status(201).json(dep);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/dependencies', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { predecessor_id, successor_id } = req.body;
    const removed = dependencyService.removeDependency(auth, predecessor_id, successor_id);
    res.json({ success: removed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Delays, Bottlenecks & Explanations
app.get('/api/projects/:id/bottlenecks', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const bottlenecks = delayService.diagnoseBottlenecks(auth.tenant_id, req.params.id);
    res.json(bottlenecks);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/tasks/:id/delays', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const delays = delayService.getDelayRecords(auth.tenant_id, req.params.id);
    res.json(delays);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/explanation', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { explanation_text } = req.body;
    const record = delayService.submitExplanation(auth, req.params.id, explanation_text);

    const task = db.getTaskById(auth.tenant_id, req.params.id);
    if (task) {
      notificationService.notifyExplanationSubmitted(
        auth.tenant_id,
        task.project_id,
        task.id,
        auth.name,
        task.title,
        explanation_text
      );
    }

    res.json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Notifications & Web Push
app.get('/api/notifications', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const notifications = notificationService.getUserNotifications(auth);
    res.json(notifications);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/notifications/push-subscribe', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { endpoint, p256dh, auth: authKey } = req.body;
    const sub = notificationService.registerPushSubscription(auth, endpoint, p256dh, authKey);
    res.json(sub);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications/push-unsubscribe', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { endpoint } = req.body;
    notificationService.deactivatePushSubscription(auth, endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Reports
app.get('/api/projects/:id/report', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const cutoff = req.query.cutoff as string | undefined;
    const report = reportingService.getProjectReport(auth, req.params.id, cutoff);
    res.json(report);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/reports/performance', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const targetUserId = (req.query.user_id as string) || auth.user_id;
    const periodStart = (req.query.start as string) || '2026-10-01T00:00:00Z';
    const periodEnd = (req.query.end as string) || '2026-11-01T00:00:00Z';
    const cutoff = req.query.cutoff as string | undefined;
    const projectId = req.query.project_id as string | undefined;

    const report = reportingService.getUserPerformanceReport(
      auth,
      targetUserId,
      periodStart,
      periodEnd,
      cutoff,
      projectId
    );
    res.json(report);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 8. Background Worker Simulation (Manual or Interval)
app.post('/api/worker/run', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const now = new Date();
    const tasks = db.getTasks(auth.tenant_id);
    let delaysEvaluated = 0;
    let remindersSent = 0;

    for (const task of tasks) {
      // Gecikme kontrolü
      const delay = delayService.evaluateTaskDelay(auth.tenant_id, task.id);
      if (delay) {
        delaysEvaluated++;
        // Açıklama gerekiyorsa günlük hatırlat
        if (delay.explanation_status === 'REQUIRED' && task.assignee_id) {
          notificationService.notifyDailyExplanationReminder(auth.tenant_id, task.id, task.assignee_id, task.title);
          remindersSent++;
        }
      }

      // 24 saat hatırlatması
      if (task.work_status !== 'COMPLETED' && task.assignee_id) {
        const dueDate = new Date(task.current_due_date);
        const hoursLeft = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft > 0 && hoursLeft <= 24) {
          notificationService.notify24HourReminder(auth.tenant_id, task.id, task.assignee_id, task.title, task.current_due_date);
          remindersSent++;
        }
      }
    }

    res.json({ success: true, delaysEvaluated, remindersSent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback SPA route
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Listen on PORT
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Görev & Bağımlılık Yönetim Sistemi (v0.3) Aktif!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
