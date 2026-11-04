import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Database } from '../database/db.js';
import { PostgresEngine } from '../database/postgres.js';
import { CryptoVault } from '../core/crypto-vault.js';
import { seedDatabase } from '../database/seed.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { ProjectService } from '../modules/project/project.service.js';
import { DependencyService } from '../modules/dependency/dependency.service.js';
import { DelayService } from '../modules/delay/delay.service.js';
import { TaskService } from '../modules/task/task.service.js';
import { NotificationService } from '../modules/notification/notification.service.js';
import { ReportingService } from '../modules/reporting/reporting.service.js';
import { MicrosoftTodoService } from '../modules/microsoft_todo/microsoft_todo.service.js';
import { EmailAndAutomationService } from '../modules/email/email.service.js';
import { AuthContext, UUID, Task } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Veritabanı ve Modül Başlatma (PostgreSQL + AES-256-GCM Şifre Kasası)
const dbPath = path.resolve(__dirname, '../../.work/data.json');
const db = new Database(dbPath);
seedDatabase(db, false);
const pgEngine = new PostgresEngine(db);
void pgEngine.init();

const authService = new AuthService(db);
const projectService = new ProjectService(db);
const dependencyService = new DependencyService(db);
const delayService = new DelayService(db);
const taskService = new TaskService(db, dependencyService, delayService);
const notificationService = new NotificationService(db);
const reportingService = new ReportingService(db, projectService);
const microsoftTodoService = new MicrosoftTodoService(db);
const emailService = new EmailAndAutomationService(db, taskService, delayService, projectService, notificationService);

// Güvenli Kiracı ve Kullanıcı Bağlamı Middleware'i
function getAuthContext(req: Request): AuthContext {
  const tenant_id = (req.headers['x-tenant-id'] as string) || db.getTenants()[0]?.id;
  const user_id = (req.headers['x-user-id'] as string) || db.getUsers(tenant_id)[0]?.id;

  const user = db.getUserById(tenant_id, user_id);
  if (user && user.is_active === false) {
    throw new Error('Hesabınız dondurulmuş / devre dışı bırakılmıştır. Sistem erişim yetkiniz kapatılmıştır.');
  }
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

app.put('/api/profile/theme', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { theme } = req.body;
    if (theme && (theme === 'light' || theme === 'dark')) {
      db.updateUser(auth.tenant_id, auth.user_id, { theme });
    }
    res.json({ success: true, theme });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcının kendi şifresini oluşturması / değiştirmesi
app.put('/api/profile/password', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { current_password, new_password } = req.body;
    authService.changeOwnPassword(auth, current_password, new_password);
    res.json({ success: true, message: 'Şifreniz güvenli bir şekilde güncellendi.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Kullanıcının kendi profil resmini (avatar_url) yüklemesi / kaldırması
app.put('/api/profile/avatar', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { avatar_url } = req.body;
    const updatedUser = authService.updateOwnAvatar(auth, avatar_url);
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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

app.post('/api/admin/personnel', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const caller = db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yetkisiz İşlem: Yeni personel kartı yalnızca Sistem Yöneticisi tarafından oluşturulabilir.' });
    }

    const { name, email, phone, country, password, can_create_project, can_build_reports, department, system_role, avatar_url, is_active, deactivation_reason } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Ad Soyad ve E-posta alanları zorunludur.' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Bu e-posta adresine sahip bir personel zaten mevcut.' });
    }

    const initialPassword = String(password || '123').trim() || '123';
    const newUser = authService.createUser(auth.tenant_id, name, email, undefined, {
      phone,
      country: country || 'Türkiye',
      password: initialPassword,
      can_create_project: !!can_create_project,
      can_build_reports: !!can_build_reports,
      department: department || 'Genel',
      system_role: system_role || 'USER',
      avatar_url: avatar_url || undefined,
      is_active: is_active !== undefined ? !!is_active : true,
      deactivation_reason: deactivation_reason || undefined
    });

    // Yeni eklenen kullanıcıya otomatik Karşılama & Sistem Erişim Bilgisi E-postası (Adaptive Card v1.4) gönder
    const welcomeMail = await emailService.sendUserWelcomeCard(
      auth.tenant_id,
      newUser.id,
      initialPassword,
      auth.user_id
    );

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({
      ...safeUser,
      welcome_email_sent: !!welcomeMail,
      welcome_email_status: welcomeMail?.status || 'SIMULATED',
      welcome_outbox_id: welcomeMail?.id
    });
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
    const now = new Date();
    const enriched = projects.map(p => {
      const pTasks = db.getTasks(auth.tenant_id, p.id);
      const total_tasks = pTasks.length;
      const completed_tasks = pTasks.filter(t => t.work_status === 'COMPLETED').length;
      const in_progress_tasks = pTasks.filter(t => t.work_status === 'IN_PROGRESS').length;
      const blocked_tasks = pTasks.filter(t => t.work_status === 'BLOCKED').length;
      const delayed_tasks = pTasks.filter(t => t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < now).length;
      const completion_rate = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;
      const plan_changes = db.getProjectPlanChanges(auth.tenant_id, p.id);
      const is_manager = projectService.canManageProject(auth, p.id);
      const is_editor = projectService.canEditTasks(auth, p.id);
      const is_full_viewer = projectService.isFullProjectViewer(auth, p.id);
      const pending_visibility_requests = is_manager
        ? db.getVisibilityRequests(auth.tenant_id, p.id).filter(r => r.status === 'PENDING').length
        : 0;

      return {
        ...p,
        total_tasks,
        completed_tasks,
        in_progress_tasks,
        blocked_tasks,
        delayed_tasks,
        completion_rate,
        plan_changes_count: plan_changes.length,
        is_manager,
        is_editor,
        is_full_viewer,
        pending_visibility_requests
      };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { title, description, initial_start_date, initial_due_date, members } = req.body;
    const project = projectService.createProject(
      auth,
      title,
      description,
      initial_start_date,
      initial_due_date
    );
    console.log(`📁 [PROJECT-MONITOR] Yeni Proje Oluşturuldu: "${project.title}" (${project.id}) | Oluşturan: ${auth.name} (${auth.email})`);

    // Proje açılırken seçilen ekip üyelerini dahil et ve her birine otomatik Adaptive Card e-postası gönder
    if (Array.isArray(members) && members.length > 0) {
      for (const m of members) {
        if (m && m.user_id && m.user_id !== auth.user_id) {
          const role = m.role || 'EDITOR';
          try {
            projectService.addOrUpdateMember(auth, project.id, m.user_id, role);
            const u = db.getUserById(auth.tenant_id, m.user_id);
            if (u) {
              notificationService.notifyProjectMemberAdded(auth.tenant_id, project.id, u.id, project.title, role, auth.name);
              void emailService.sendProjectMemberAddedCard(auth.tenant_id, project.id, u.id, role, auth.name);
              console.log(`👥 [PROJECT-MONITOR] Projeye Üye Eklendi & Bildirim Tetiklendi: ${u.name} (${u.email}) -> Rol: ${role}`);
            }
          } catch (memberErr: any) {
            console.warn(`⚠️ [PROJECT-MONITOR] Üye ekleme uyarısı (${m.user_id}):`, memberErr.message);
          }
        }
      }
    }

    res.status(201).json(project);
  } catch (err: any) {
    console.error(`❌ [PROJECT-MONITOR] Proje oluşturma hatası:`, err.message);
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
    const planChanges = db.getProjectPlanChanges(auth.tenant_id, project.id);
    const isManager = projectService.canManageProject(auth, project.id);
    const isEditor = projectService.canEditTasks(auth, project.id);
    const isFullViewer = projectService.isFullProjectViewer(auth, project.id);

    res.json({
      project,
      members,
      visibilityRequests,
      planChanges,
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
    void emailService.sendProjectMemberAddedCard(auth.tenant_id, req.params.id, user_id, role, auth.name);
    res.json(member);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/projects/:id/visibility-request', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const request = projectService.requestVisibility(auth, req.params.id);
    void emailService.sendVisibilityRequestActionableCard(auth.tenant_id, request.id);
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
    if (approve) {
      void emailService.sendProjectMemberAddedCard(auth.tenant_id, updated.project_id, updated.user_id, 'VIEWER', auth.name);
    }
    res.json(updated);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 3. Tasks
app.get('/api/tasks/search', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const q = (req.query.q as string) || '';
    const projectId = (req.query.project_id as string) || undefined;
    const matched = taskService.searchTasks(auth, q, projectId);
    const enriched = matched.map(t => ({
      ...t,
      limited_dependencies: dependencyService.getLimitedDependencySummary(auth, t.id)
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/projects/:id/tasks', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const isFullViewer = projectService.isFullProjectViewer(auth, req.params.id);
    const q = (req.query.q as string) || '';
    const allTasks = q
      ? taskService.searchTasks(auth, q, req.params.id)
      : taskService.listTasks(auth, req.params.id);

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
    const {
      project_id,
      title,
      initial_start_date,
      initial_due_date,
      assignee_id,
      description,
      type,
      priority,
      predecessor_id
    } = req.body;

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
      description,
      { type, priority }
    );

    // Eğer öncül seçildiyse otomatik bağımlılık ekle (OpenProject akışı)
    if (predecessor_id) {
      try {
        dependencyService.addDependency(auth, predecessor_id, task.id);
      } catch (depErr) {
        console.warn('Otomatik bağımlılık ekleme uyarısı:', depErr);
      }
    }

    // Microsoft To Do Entegrasyonu: Görev personele atandıysa otomatik To Do'ya eşitle
    if (task.assignee_id) {
      try {
        microsoftTodoService.syncAssignedTaskToTodo(auth, task);
      } catch (todoErr) {
        console.warn('Microsoft To Do sync error:', todoErr);
      }
    }

    const createdWithStatus = db.getTaskById(auth.tenant_id, task.id);
    if (createdWithStatus && createdWithStatus.assignee_id) {
      // Kullanıcıya görev atandığında hem atama bilgisini hem de canlı Adaptive Card'ı gönder
      void emailService.sendTaskAssignedActionableCard(auth.tenant_id, createdWithStatus.id, auth.name);
    }
    res.status(201).json(createdWithStatus || task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Toplu Görev İçe Aktarma (CSV / Excel Import)
app.post('/api/projects/:id/tasks/bulk', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const projectId = req.params.id;
    if (!projectService.canEditTasks(auth, projectId)) {
      return res.status(403).json({ error: 'Bu projeye görev ekleme yetkiniz yok.' });
    }

    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'Yüklenecek görev listesi boş veya geçersiz formatta.' });
    }

    const result = taskService.bulkCreateTasks(auth, projectId, tasks);
    for (const ct of result.createdTasks) {
      if (ct.assignee_id) {
        void emailService.sendTaskAssignedActionableCard(auth.tenant_id, ct.id, auth.name);
      }
    }
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// OpenProject Split Screen: Görev Detay Paneli (Sağ Çekmece)
app.get('/api/tasks/:id/details', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const task = db.getTaskById(auth.tenant_id, req.params.id);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });

    const project = db.getProjectById(auth.tenant_id, task.project_id);
    const assignee = task.assignee_id ? db.getUserById(auth.tenant_id, task.assignee_id) : null;
    const safeAssignee = assignee ? {
      id: assignee.id,
      name: assignee.name,
      email: assignee.email,
      phone: assignee.phone,
      country: assignee.country,
      department: assignee.department
    } : null;

    // Öncüller ve Ardıllar
    const allDeps = db.getDependencies(auth.tenant_id);
    const predIds = allDeps.filter(d => d.successor_id === task.id).map(d => d.predecessor_id);
    const succIds = allDeps.filter(d => d.predecessor_id === task.id).map(d => d.successor_id);

    const predecessors = predIds.map(pid => {
      const pt = db.getTaskById(auth.tenant_id, pid);
      if (!pt) return null;
      const pa = pt.assignee_id ? db.getUserById(auth.tenant_id, pt.assignee_id) : null;
      return {
        id: pt.id,
        title: pt.title,
        work_status: pt.work_status,
        assignee_name: pa?.name || 'Atanmamış'
      };
    }).filter(Boolean);

    const successors = succIds.map(sid => {
      const st = db.getTaskById(auth.tenant_id, sid);
      if (!st) return null;
      const sa = st.assignee_id ? db.getUserById(auth.tenant_id, st.assignee_id) : null;
      return {
        id: st.id,
        title: st.title,
        work_status: st.work_status,
        assignee_name: sa?.name || 'Atanmamış'
      };
    }).filter(Boolean);

    // Gecikme, Plan Revizyonu ve Açıklama Kayıtları
    const delays = delayService.getDelayRecords(auth.tenant_id, task.id);
    const plan_changes = db.getTaskPlanChanges(auth.tenant_id, task.id);
    const can_manage_plan = projectService.canEditTasks(auth, task.project_id);
    const can_edit = can_manage_plan || task.assignee_id === auth.user_id;

    res.json({
      task,
      project: project ? { id: project.id, title: project.title } : null,
      assignee: safeAssignee,
      predecessors,
      successors,
      delays,
      plan_changes,
      can_manage_plan,
      can_edit
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const task = db.getTaskById(auth.tenant_id, req.params.id);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });

    const { progress, type, priority, description, title, note_text } = req.body;

    if (typeof progress === 'number' && note_text && String(note_text).trim().length >= 2) {
      const updRes = taskService.updateTaskProgressWithNote(auth, req.params.id, progress, String(note_text).trim());
      if (progress >= 100) {
        for (const readyId of updRes.newlyReadyTaskIds || []) {
          const t = db.getTaskById(auth.tenant_id, readyId);
          if (t && t.assignee_id) {
            notificationService.notifyTaskReady(auth.tenant_id, t.id, t.assignee_id, t.title);
            void emailService.sendTaskReadyActionableCard(auth.tenant_id, t.id);
          }
        }
        void emailService.sendTaskCompletedToManagersCard(auth.tenant_id, updRes.task.id, auth.user_id, String(note_text).trim(), updRes.newlyReadyTaskIds || []);
      } else {
        void emailService.sendTaskProgressUpdateToManagersCard(auth.tenant_id, updRes.task.id, auth.user_id, updRes.task.progress || progress, String(note_text).trim());
      }
      return res.json(updRes.task);
    }

    const updates: Partial<Task> = {};
    if (typeof progress === 'number') updates.progress = Math.max(0, Math.min(100, progress));
    if (type) updates.type = type;
    if (priority) updates.priority = priority;
    if (description !== undefined) updates.description = description;
    if (title) updates.title = title;

    const updated = db.updateTask(auth.tenant_id, req.params.id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Zorunlu Notlu İlerleme (%40, %50, %60 vb.) Kayıt Endpoint'i
app.post('/api/tasks/:id/progress', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { progress, note_text } = req.body;
    const updRes = taskService.updateTaskProgressWithNote(auth, req.params.id, Number(progress), String(note_text || ''));

    if (Number(progress) >= 100) {
      for (const readyId of updRes.newlyReadyTaskIds || []) {
        const t = db.getTaskById(auth.tenant_id, readyId);
        if (t && t.assignee_id) {
          notificationService.notifyTaskReady(auth.tenant_id, t.id, t.assignee_id, t.title);
          void emailService.sendTaskReadyActionableCard(auth.tenant_id, t.id);
        }
      }
      void emailService.sendTaskCompletedToManagersCard(auth.tenant_id, updRes.task.id, auth.user_id, String(note_text).trim(), updRes.newlyReadyTaskIds || []);
    } else {
      void emailService.sendTaskProgressUpdateToManagersCard(auth.tenant_id, updRes.task.id, auth.user_id, updRes.task.progress || Number(progress), String(note_text).trim());
    }

    res.json(updRes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/assign', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { assignee_id } = req.body;
    const task = taskService.assignTask(auth, req.params.id, assignee_id);
    if (assignee_id) {
      void emailService.sendTaskAssignedActionableCard(auth.tenant_id, task.id, auth.name);
    }
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
    const { note_text } = req.body || {};
    const task = taskService.startTask(auth, req.params.id);
    if (note_text && String(note_text).trim().length >= 2) {
      delayService.submitExplanation(auth, task.id, `[Görev Başlatma Notu]: ${String(note_text).trim()}`);
    }
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/complete', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { note_text } = req.body || {};
    const result = taskService.completeTask(auth, req.params.id);

    const cleanedNote = note_text ? String(note_text).trim() : '';
    if (cleanedNote.length >= 2) {
      delayService.submitExplanation(auth, result.task.id, `[%100 Tamamlandı Notu]: ${cleanedNote}`);
    }

    // Yeni READY olan görevlerin sorumlularına bildirim ve canlı Adaptive Card gönder
    for (const readyId of result.newlyReadyTaskIds) {
      const t = db.getTaskById(auth.tenant_id, readyId);
      if (t && t.assignee_id) {
        notificationService.notifyTaskReady(auth.tenant_id, t.id, t.assignee_id, t.title);
        void emailService.sendTaskReadyActionableCard(auth.tenant_id, t.id);
      }
    }

    // Projedeki yetkili kişilere (Proje Yöneticileri, Editörler, Admin) "bu kişi bu işi tamamladı" maili gönder!
    void emailService.sendTaskCompletedToManagersCard(
      auth.tenant_id,
      result.task.id,
      auth.user_id,
      cleanedNote || undefined,
      result.newlyReadyTaskIds
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/status', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { status, note_text } = req.body;
    if (!status || !['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz veya eksik hedef durum (TODO, IN_PROGRESS, COMPLETED bekleniyor).' });
    }

    const result = taskService.updateStatus(auth, req.params.id, status as any);

    // KAB05: Eğer yeni READY olan görevler varsa bildirim oluştur
    if (result.newlyReadyTaskIds && result.newlyReadyTaskIds.length > 0) {
      for (const readyId of result.newlyReadyTaskIds) {
        const t = db.getTaskById(auth.tenant_id, readyId);
        if (t && t.assignee_id) {
          notificationService.notifyTaskReady(auth.tenant_id, t.id, t.assignee_id, t.title);
          void emailService.sendTaskReadyActionableCard(auth.tenant_id, t.id);
        }
      }
    }

    if (status === 'COMPLETED') {
      void emailService.sendTaskCompletedToManagersCard(
        auth.tenant_id,
        result.task.id,
        auth.user_id,
        note_text ? String(note_text).trim() : undefined,
        result.newlyReadyTaskIds || []
      );
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
    const cleaned = String(explanation_text || '').trim();
    if (cleaned.length < 2) {
      return res.status(400).json({ error: 'Açıklama veya durum notu boş bırakılamaz (Zorunlu alan).' });
    }
    const record = delayService.submitExplanation(auth, req.params.id, cleaned);

    const task = db.getTaskById(auth.tenant_id, req.params.id);
    if (task) {
      notificationService.notifyExplanationSubmitted(
        auth.tenant_id,
        task.project_id,
        task.id,
        auth.name,
        task.title,
        cleaned
      );
      void emailService.sendTaskProgressUpdateToManagersCard(auth.tenant_id, task.id, auth.user_id, task.progress || 0, cleaned);
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
          void emailService.sendDelayExplanationActionableCard(auth.tenant_id, task.id);
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

// ==========================================
// 8. Özel Rapor Oluşturucu (Custom Report Builder)
// ==========================================
const customReportLayouts = new Map<string, Array<{
  id: string;
  user_id: string;
  name: string;
  project_id?: string;
  widgets: Array<{ id: string; widgetType: string; width: 'full' | 'half'; noteText?: string }>;
  created_at: string;
}>>();

app.get('/api/reports/builder-data', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const caller = db.getUserById(auth.tenant_id, auth.user_id);
    if (!caller) {
      return res.status(401).json({ error: 'Kullanıcı oturumu geçersiz.' });
    }

    if (caller.system_role !== 'ADMIN' && !caller.can_build_reports) {
      return res.status(403).json({ error: 'Yetkisiz Erişim: Özel rapor oluşturma yetkiniz bulunmamaktadır. Admin tarafından yetkilendirilmeniz gerekir.' });
    }

    const projectId = req.query.project_id && req.query.project_id !== 'all' ? String(req.query.project_id) : undefined;
    const projects = projectService.listProjects(auth);
    const allTasks = db.getTasks(auth.tenant_id, projectId);
    const allUsers = authService.listUsers(auth.tenant_id);
    const allDelays = db.getDelayRecords(auth.tenant_id);
    const allDependencies = db.getDependencies(auth.tenant_id);

    const now = new Date();

    // 1. Task KPIs
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.work_status === 'COMPLETED');
    const inProgressTasks = allTasks.filter(t => t.work_status === 'IN_PROGRESS');
    const blockedTasks = allTasks.filter(t => t.work_status === 'BLOCKED');
    const readyTasks = allTasks.filter(t => t.work_status === 'READY');
    const delayedTasks = allTasks.filter(t => {
      if (t.work_status === 'COMPLETED') {
        return t.actual_completion_date ? new Date(t.actual_completion_date) > new Date(t.current_due_date) : false;
      }
      return new Date(t.current_due_date) < now;
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // 2. Status Distribution
    const statusDistribution = [
      { status: 'COMPLETED', label: 'Tamamlandı', count: completedTasks.length, color: '#10b981' },
      { status: 'IN_PROGRESS', label: 'Devam Eden', count: inProgressTasks.length, color: '#3b82f6' },
      { status: 'READY', label: 'Hazır', count: readyTasks.length, color: '#6366f1' },
      { status: 'BLOCKED', label: 'Öncül Bekleyen', count: blockedTasks.length, color: '#ef4444' }
    ];

    // 3. User Performance Metrics (Hesaplanmış Şartname Puanı: 100 * (0.70*Z + 0.30*T))
    const userPerformance = allUsers.map(u => {
      const assignedTasks = allTasks.filter(t => t.assignee_id === u.id);
      const userCompleted = assignedTasks.filter(t => t.work_status === 'COMPLETED');
      const userOnTime = userCompleted.filter(t => t.actual_completion_date && new Date(t.actual_completion_date) <= new Date(t.initial_due_date));
      const userDelayed = assignedTasks.filter(t => {
        if (t.work_status === 'COMPLETED') {
          return t.actual_completion_date ? new Date(t.actual_completion_date) > new Date(t.current_due_date) : false;
        }
        return new Date(t.current_due_date) < now;
      });

      const zRatio = assignedTasks.length > 0 ? (userOnTime.length / assignedTasks.length) : null;
      const tRatio = assignedTasks.length > 0 ? (userCompleted.length / assignedTasks.length) : null;
      const score = (zRatio !== null && tRatio !== null) ? Math.round(100 * (0.70 * zRatio + 0.30 * tRatio)) : null;

      return {
        user_id: u.id,
        name: u.name,
        email: u.email,
        country: u.country,
        department: u.department,
        assigned_count: assignedTasks.length,
        completed_count: userCompleted.length,
        on_time_count: userOnTime.length,
        delayed_count: userDelayed.length,
        performance_score: score,
        score_display: score !== null ? `${score} / 100` : 'Hesaplanamıyor'
      };
    });

    // 4. Bottlenecks (En çok ardıl bekleten aktif/tamamlanmamış öncüller)
    const predecessorWaitCounts = new Map<string, number>();
    for (const dep of allDependencies) {
      const pred = allTasks.find(t => t.id === dep.predecessor_id);
      const succ = allTasks.find(t => t.id === dep.successor_id);
      if (pred && pred.work_status !== 'COMPLETED' && succ && succ.work_status !== 'COMPLETED') {
        predecessorWaitCounts.set(dep.predecessor_id, (predecessorWaitCounts.get(dep.predecessor_id) || 0) + 1);
      }
    }
    const bottlenecks = Array.from(predecessorWaitCounts.entries())
      .map(([taskId, waitCount]) => {
        const task = allTasks.find(t => t.id === taskId) || db.getTaskById(auth.tenant_id, taskId);
        const assignee = task?.assignee_id ? db.getUserById(auth.tenant_id, task.assignee_id) : null;
        return {
          task_id: taskId,
          title: task?.title || 'Bilinmeyen Görev',
          work_status: task?.work_status || 'UNKNOWN',
          due_date: task?.current_due_date,
          assignee_name: assignee?.name || 'Atanmamış',
          waiting_successors_count: waitCount
        };
      })
      .sort((a, b) => b.waiting_successors_count - a.waiting_successors_count);

    // 5. Critical & Delayed Open Tasks (Tamamlanmamış geciken kritik görevler)
    const criticalTasks = delayedTasks
      .filter(t => t.work_status !== 'COMPLETED')
      .map(t => {
        const assignee = t.assignee_id ? db.getUserById(auth.tenant_id, t.assignee_id) : null;
        return {
          id: t.id,
          title: t.title,
          priority: t.priority || 'NORMAL',
          work_status: t.work_status,
          progress: t.progress || 0,
          current_due_date: t.current_due_date,
          assignee_name: assignee?.name || 'Atanmamış'
        };
      });

    // 6. Milestones
    const milestones = allTasks.filter(t => t.type === 'MILESTONE').map(t => {
      const assignee = t.assignee_id ? db.getUserById(auth.tenant_id, t.assignee_id) : null;
      return {
        id: t.id,
        title: t.title,
        work_status: t.work_status,
        current_due_date: t.current_due_date,
        assignee_name: assignee?.name || 'Atanmamış'
      };
    });

    // 7. Recent Delay Explanations
    const delayExplanations = allDelays.map(d => {
      const task = db.getTaskById(auth.tenant_id, d.task_id);
      const reporter = d.reported_by_user_id ? db.getUserById(auth.tenant_id, d.reported_by_user_id) : null;
      return {
        id: d.id,
        task_id: d.task_id,
        task_title: task?.title || 'Görev',
        detected_at: d.detected_at,
        explanation_source: d.explanation_source,
        reason: d.reason,
        explanation_text: d.explanation_text || null,
        reported_by: reporter?.name || 'Sistem'
      };
    });

    // 8. Project Details if selected
    let selectedProjectReport = null;
    if (projectId) {
      try {
        selectedProjectReport = reportingService.getProjectReport(auth, projectId);
      } catch (e) {
        // Ignored
      }
    }

    res.json({
      projects,
      selected_project: selectedProjectReport,
      kpis: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks.length,
        in_progress_tasks: inProgressTasks.length,
        blocked_tasks: blockedTasks.length,
        ready_tasks: readyTasks.length,
        delayed_tasks: delayedTasks.length,
        completion_rate: completionRate
      },
      status_distribution: statusDistribution,
      critical_tasks: criticalTasks,
      personnel_performance: userPerformance,
      bottlenecks,
      milestones,
      delay_explanations: delayExplanations
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/custom-layouts', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const tenantLayouts = customReportLayouts.get(auth.tenant_id) || [];
    res.json(tenantLayouts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/custom-layouts', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const caller = db.getUserById(auth.tenant_id, auth.user_id);
    if (caller?.system_role !== 'ADMIN' && !caller?.can_build_reports) {
      return res.status(403).json({ error: 'Yetkisiz Erişim: Rapor kaydetme yetkiniz bulunmamaktadır.' });
    }

    const { name, widgets, project_id } = req.body;
    if (!name || !widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ error: 'Rapor adı ve bileşenler gereklidir.' });
    }

    const newLayout = {
      id: crypto.randomUUID(),
      user_id: auth.user_id,
      name,
      widgets,
      project_id,
      created_at: new Date().toISOString()
    };

    const list = customReportLayouts.get(auth.tenant_id) || [];
    list.push(newLayout);
    customReportLayouts.set(auth.tenant_id, list);

    res.status(201).json(newLayout);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 9. Microsoft To Do & Outlook Entegrasyonu API
// ==========================================
app.get('/api/todo/items', (req, res) => {
  try {
    const auth = getAuthContext(req);
    // Eşitlemeyi tazele ve getir
    microsoftTodoService.syncAllAssignedTasks(auth);
    const items = microsoftTodoService.getUserTodoList(auth);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todo/items', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { title, due_date, importance, body_content, is_starred } = req.body;
    const item = microsoftTodoService.createPersonalTodo(auth, {
      title,
      due_date,
      importance,
      body_content,
      is_starred
    });
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/todo/items/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { is_completed, noteText, is_starred } = req.body;
    let updated;

    if (typeof is_completed === 'boolean') {
      updated = microsoftTodoService.updateTodoStatus(auth, req.params.id, is_completed);
      // Eğer FG Group görevine bağlıysa ve tamamlandıysa ana görevi de tamamla!
      if (updated.linked_task_id && is_completed) {
        try {
          const comp = taskService.completeTask(auth, updated.linked_task_id);
          for (const readyId of comp.newlyReadyTaskIds) {
            const rt = db.getTaskById(auth.tenant_id, readyId);
            if (rt && rt.assignee_id) {
              notificationService.notifyTaskReady(auth.tenant_id, rt.id, rt.assignee_id, rt.title);
              void emailService.sendTaskReadyActionableCard(auth.tenant_id, rt.id);
            }
          }
          void emailService.sendTaskCompletedToManagersCard(
            auth.tenant_id,
            comp.task.id,
            auth.user_id,
            noteText ? String(noteText).trim() : 'Microsoft To Do üzerinden tamamlandı.',
            comp.newlyReadyTaskIds
          );
        } catch (e) {
          // Görev öncül bekliyor veya tamamlanamaz durumda olabilir
        }
      }
    }

    if (noteText !== undefined) {
      updated = microsoftTodoService.updateTodoNote(auth, req.params.id, noteText);
      // Eğer bağlıysa mazeret/açıklama olarak da kaydet!
      if (updated.linked_task_id) {
        try {
          delayService.submitExplanation(auth, updated.linked_task_id, noteText);
        } catch (e) { }
      }
    }

    if (is_starred !== undefined) {
      updated = db.updateTodoItem(auth.tenant_id, req.params.id, { is_starred: !!is_starred });
    }

    res.json(updated || { success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/todo/items/:id/star', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const item = microsoftTodoService.toggleTodoStarred(auth, req.params.id);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/todo/sync', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const list = microsoftTodoService.syncAllAssignedTasks(auth);
    res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Azure Entra ID / Microsoft 365 Canlı Entegrasyon Bilgileri
const azureTenantConfigs = new Map<string, { tenant_id: string; client_id: string; client_secret?: string }>();

app.get('/api/todo/azure-config', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const config = azureTenantConfigs.get(auth.tenant_id);
    res.json({
      is_configured: !!config,
      tenant_id: config?.tenant_id || '',
      client_id: config?.client_id || '',
      has_secret: !!config?.client_secret
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todo/azure-config', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const user = db.getUserById(auth.tenant_id, auth.user_id);
    if (user?.system_role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yalnızca Admin Azure bağlantı ayarlarını yapılandırabilir.' });
    }
    const { tenant_id, client_id, client_secret } = req.body;
    if (!tenant_id || !client_id) {
      return res.status(400).json({ error: 'Directory (Tenant) ID ve Application (Client) ID zorunludur.' });
    }
    azureTenantConfigs.set(auth.tenant_id, { tenant_id, client_id, client_secret });
    res.json({ success: true, message: 'Azure Entra ID kimlik bilgileri başarıyla kaydedildi.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


// ==========================================
// 10. Exchange Online (SMTP), PostgreSQL Durumu, Outlook Actionable Messages & Zamanlanmış Raporlar API
// ==========================================
app.get('/api/admin/db-status', async (_req, res) => {
  try {
    const status = await pgEngine.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/smtp-config', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const cfg = emailService.getSmtpConfig(auth.tenant_id);
    const rawStored = db.getStoredRawSmtpPassword(auth.tenant_id);
    const { password, ...safeCfg } = cfg;
    res.json({
      ...safeCfg,
      has_password: !!(password && password.length > 0),
      password_masked: password && password.length > 0 ? '••••••••' : '',
      encryption_algorithm: 'AES-256-GCM',
      is_encrypted_at_rest: CryptoVault.isEncrypted(rawStored)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/smtp-config', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const saved = emailService.saveSmtpConfig(auth, req.body);
    const rawStored = db.getStoredRawSmtpPassword(auth.tenant_id);
    const { password, ...safeCfg } = saved;
    res.json({
      ...safeCfg,
      has_password: !!(password && password.length > 0),
      password_masked: password && password.length > 0 ? '••••••••' : '',
      encryption_algorithm: 'AES-256-GCM',
      is_encrypted_at_rest: CryptoVault.isEncrypted(rawStored)
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/admin/smtp-verify', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const result = await emailService.verifyAndTestSmtpConnection(auth, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/smtp-test', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { recipient_email, task_id } = req.body;
    const tasks = db.getTasks(auth.tenant_id);
    const targetTask = (task_id && db.getTaskById(auth.tenant_id, task_id))
      || tasks.find(t => t.work_status === 'READY' && t.assignee_id)
      || tasks[0];

    if (targetTask && !recipient_email) {
      const item = await emailService.sendTaskReadyActionableCard(auth.tenant_id, targetTask.id);
      return res.json({ success: true, item });
    }

    const toEmail = (recipient_email || auth.email).trim();
    const cfg = emailService.getSmtpConfig(auth.tenant_id);
    const baseUrl = cfg.public_base_url || 'http://10.1.0.45:3000';
    const sampleTask = targetTask || { id: 'sample', title: '5. Prototip Numune Dikimi', description: 'Exchange Online Plan 1 Actionable Card Test Görevi' };

    const adaptiveCard = {
      '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      originator: 'fg-group-proje-sistemi',
      body: [
        { type: 'TextBlock', text: '🧪 EXCHANGE ONLINE PLAN 1 • CANLI KART TESTİ', weight: 'Bolder', color: 'Accent', size: 'Small' },
        { type: 'TextBlock', text: sampleTask.title, weight: 'Bolder', size: 'Large', wrap: true },
        {
          type: 'FactSet', facts: [
            { title: 'SMTP Sunucusu:', value: cfg.host + ':' + cfg.port },
            { title: 'Gönderici Hesap:', value: cfg.username },
            { title: 'Alıcı:', value: toEmail }
          ]
        },
        { type: 'Input.Text', id: 'explanationText', placeholder: 'Test notu veya gecikme açıklaması yazınız...', isMultiline: true }
      ],
      actions: targetTask ? [
        {
          type: 'Action.Http',
          title: '▶️ Görevi Başlat',
          method: 'POST',
          url: baseUrl + '/api/outlook/action',
          body: JSON.stringify({ tenant_id: auth.tenant_id, task_id: targetTask.id, user_id: auth.user_id, action: 'START_TASK' })
        },
        {
          type: 'Action.Http',
          title: '✅ Tamamlandı İşaretle',
          method: 'POST',
          url: baseUrl + '/api/outlook/action',
          body: JSON.stringify({ tenant_id: auth.tenant_id, task_id: targetTask.id, user_id: auth.user_id, action: 'COMPLETE_TASK' })
        },
        {
          type: 'Action.Http',
          title: '📝 Not / Gecikme Kaydet',
          method: 'POST',
          url: baseUrl + '/api/outlook/action',
          body: JSON.stringify({ tenant_id: auth.tenant_id, task_id: targetTask.id, user_id: auth.user_id, action: 'SUBMIT_EXPLANATION', explanation_text: '{{explanationText.value}}' })
        }
      ] : []
    };

    const htmlBody = '<div style="padding:20px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;"><h3>🧪 Exchange Online Plan 1 & Outlook Actionable Card Testi</h3><p>Görev: <strong>' + sampleTask.title + '</strong></p></div>';
    const item = await emailService.dispatchEmail({
      tenant_id: auth.tenant_id,
      to: [toEmail],
      subject: '🧪 [Test] Outlook Actionable Card: ' + sampleTask.title,
      category: 'SMTP_TEST',
      htmlBody,
      adaptiveCardJson: adaptiveCard,
      linked_task_id: targetTask?.id
    });

    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/scheduled-reports', (req, res) => {
  try {
    const auth = getAuthContext(req);
    res.json(emailService.listScheduledReports(auth.tenant_id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/scheduled-reports', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const job = emailService.createScheduledReport(auth, req.body);
    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/admin/scheduled-reports/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const updated = emailService.toggleScheduledReport(auth, req.params.id, !!req.body.is_active);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/scheduled-reports/:id', (req, res) => {
  try {
    const auth = getAuthContext(req);
    const ok = emailService.deleteScheduledReport(auth, req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/scheduled-reports/:id/send-now', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const sent = await emailService.executeScheduledReportJob(auth.tenant_id, req.params.id);
    res.json({ success: true, item: sent });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/email/outbox', (req, res) => {
  try {
    const auth = getAuthContext(req);
    res.json(db.getEmailOutbox(auth.tenant_id, 50));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Outlook Adaptive Cards Rehberi (outlook_adaptive_cards_rehberi.md) Canlı Senaryo Tetikleyici
app.post('/api/admin/trigger-card-scenario', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { scenario } = req.body;
    const tasks = db.getTasks(auth.tenant_id);
    const projects = db.getProjects(auth.tenant_id);
    const users = db.getUsers(auth.tenant_id);

    const readyTask = tasks.find(t => t.work_status === 'READY' && t.assignee_id) || tasks.find(t => t.assignee_id) || tasks[0];
    const overdueOrActiveTask = tasks.find(t => t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < new Date() && t.assignee_id)
      || readyTask;
    const completedTask = tasks.find(t => t.work_status === 'COMPLETED') || readyTask;
    const targetProject = projects[0];
    const targetUser = (readyTask?.assignee_id && db.getUserById(auth.tenant_id, readyTask.assignee_id))
      || users.find(u => u.system_role !== 'ADMIN')
      || users[0];

    let item = null;
    if (scenario === 'TASK_READY' && readyTask) {
      item = await emailService.sendTaskReadyActionableCard(auth.tenant_id, readyTask.id);
    } else if (scenario === 'TASK_ASSIGNED' && readyTask) {
      item = await emailService.sendTaskAssignedActionableCard(auth.tenant_id, readyTask.id, auth.name);
    } else if (scenario === 'PROJECT_MEMBER_ADDED' && targetProject && targetUser) {
      item = await emailService.sendProjectMemberAddedCard(auth.tenant_id, targetProject.id, targetUser.id, 'EDITOR', auth.name);
    } else if (scenario === 'TASK_PROGRESS_NOTE' && readyTask && targetUser) {
      item = await emailService.sendTaskProgressUpdateToManagersCard(
        auth.tenant_id,
        readyTask.id,
        targetUser.id,
        60,
        'Numune kesim ve ilk dikim aşamaları %60 oranında tamamlandı; yarın aksesuar montajına geçilecek.'
      );
    } else if (scenario === 'TASK_COMPLETED_MANAGER' && completedTask) {
      item = await emailService.sendTaskCompletedToManagersCard(
        auth.tenant_id,
        completedTask.id,
        completedTask.completed_by_user_id || completedTask.assignee_id || auth.user_id,
        'Tüm kalite kontrol ve ölçü testleri başarıyla tamamlandı, bir sonraki adıma devredildi.',
        []
      );
    } else if (scenario === 'TASK_OVERDUE_ALERT' && overdueOrActiveTask) {
      item = await emailService.sendDelayExplanationActionableCard(auth.tenant_id, overdueOrActiveTask.id);
    } else if (scenario === 'USER_WELCOME' && targetUser) {
      item = await emailService.sendUserWelcomeCard(auth.tenant_id, targetUser.id, targetUser.password || '123', auth.user_id);
    }

    res.json({ success: true, scenario, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function escapeHtmlText(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// E-posta İçi Tek Tık Aksiyon Endpoint'i (Outlook Quick Actions)
app.get('/api/quick-action', async (req, res) => {
  const tenant_id = (req.query.tenant_id as string) || db.getTenants()[0]?.id;
  const taskId = (req.query.task_id as string) || undefined;
  const requestId = (req.query.request_id as string) || undefined;
  const userId = (req.query.user_id as string) || undefined;
  const action = (req.query.action as string) || '';
  const progressVal = (req.query.progress as string) || undefined;
  const note = (req.query.note as string) || (action === 'UPDATE_PROGRESS' ? `E-posta üzerinden %${progressVal || 50} ilerleme bildirildi.` : undefined);
  const approve = req.query.approve === 'true';

  const redirectUrl = taskId ? `/?task_id=${taskId}` : '/';

  try {
    const result = await emailService.handleOutlookCardAction({
      tenant_id,
      task_id: taskId,
      request_id: requestId,
      user_id: userId,
      action: action as any,
      progress_value: progressVal,
      explanation_text: note,
      approve
    });

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3;url=${redirectUrl}">
  <title>İşlem Tamamlandı • FG Group</title>
  <style>
    body { margin:0; padding:40px 16px; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; display:flex; justify-content:center; align-items:center; min-height:80vh; }
    .card { background:#ffffff; max-width:540px; width:100%; border:1px solid #cbd5e1; border-radius:16px; padding:32px; box-shadow:0 10px 25px rgba(0,0,0,0.06); text-align:center; }
    .icon { width:64px; height:64px; margin:0 auto 16px auto; border-radius:50%; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:32px; border:2px solid #a7f3d0; }
    h1 { font-size:20px; font-weight:800; color:#0f172a; margin:0 0 10px 0; }
    p { font-size:14px; color:#475569; line-height:1.6; margin:0 0 20px 0; }
    .badge { display:inline-block; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:24px; text-align:left; width:calc(100% - 28px); }
    .btn { display:inline-block; padding:12px 24px; background:#2563eb; color:#ffffff; font-weight:700; font-size:14px; text-decoration:none; border-radius:10px; box-shadow:0 2px 6px rgba(37,99,235,0.25); transition:all 0.2s; }
    .btn:hover { background:#1d4ed8; }
    .countdown { font-size:12px; color:#94a3b8; margin-top:16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>İşleminiz Başarıyla Tamamlandı</h1>
    <div class="badge">
      ${escapeHtmlText(result.message)}
    </div>
    <p>Bilgilendirme e-postaları proje yetkililerine iletilmiş ve görev durumu güncellenmiştir.</p>
    <a href="${redirectUrl}" class="btn">🚀 Görev ve Proje Paneline Git</a>
    <div class="countdown">3 saniye içinde otomatik yönlendiriliyorsunuz...</div>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (err: any) {
    const errorHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>İşlem Uyarısı • FG Group</title>
  <style>
    body { margin:0; padding:40px 16px; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; display:flex; justify-content:center; align-items:center; min-height:80vh; }
    .card { background:#ffffff; max-width:540px; width:100%; border:1px solid #cbd5e1; border-radius:16px; padding:32px; box-shadow:0 10px 25px rgba(0,0,0,0.06); text-align:center; }
    .icon { width:64px; height:64px; margin:0 auto 16px auto; border-radius:50%; background:#fffbeb; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:32px; border:2px solid #fde68a; }
    h1 { font-size:20px; font-weight:800; color:#0f172a; margin:0 0 10px 0; }
    p { font-size:14px; color:#475569; line-height:1.6; margin:0 0 20px 0; }
    .badge { display:inline-block; padding:10px 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; font-size:13px; font-weight:600; color:#991b1b; margin-bottom:24px; text-align:left; width:calc(100% - 28px); }
    .btn { display:inline-block; padding:12px 24px; background:#2563eb; color:#ffffff; font-weight:700; font-size:14px; text-decoration:none; border-radius:10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>İşlem Gerçekleştirilemedi</h1>
    <div class="badge">
      ${escapeHtmlText(err.message || 'Bilinmeyen bir hata oluştu.')}
    </div>
    <p>Bu görev daha önce tamamlanmış veya güncellenmiş olabilir. Detayları panelden inceleyebilirsiniz.</p>
    <a href="${redirectUrl}" class="btn">🚀 Proje Paneline Git</a>
  </div>
</body>
</html>`;
    res.status(200).send(errorHtml);
  }
});

// Outlook Actionable Message HTTP Callback Endpoint
app.post('/api/outlook/action', async (req, res) => {
  try {
    const result = await emailService.handleOutlookCardAction(req.body);
    res.setHeader('CARD-ACTION-STATUS', encodeURIComponent(result.message));
    res.setHeader('CARD-UPDATE-IN-BODY', 'true');
    res.json(result);
  } catch (err: any) {
    res.setHeader('CARD-ACTION-STATUS', encodeURIComponent(err.message || 'İşlem başarısız'));
    res.status(400).json({ error: err.message });
  }
});

// Fallback SPA route
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Listen on PORT
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Görev & Bağımlılık Yönetim Sistemi (v0.3) Aktif!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
