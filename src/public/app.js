// FG Group - Sadeleştirilmiş Proje & Görev Yönetimi (OpenProject Ergonomisi)

let state = {
  currentUser: null,
  tenant: null,
  token: null,
  projects: [],
  currentProjectId: null,
  tasks: [],
  dependencies: [],
  personnelList: [],
  notifications: [],
  currentView: 'view-my-tasks'
};

const I18N = {
  tr: {
    nav_my_tasks: 'Görevlerim',
    nav_projects: 'Projeler',
    nav_timeline: 'Zaman Çizelgesi (Gantt)',
    nav_board: 'İş Panosu (Kanban)',
    nav_team: 'Ekip & Personel',
    new_project_btn: '+ Yeni Proje',
    new_task_btn: '+ Görev Ekle',
    my_tasks_sub: 'Size atanan görevler, durumları ve yaklaşan teslim tarihleri aşağıda listelenmiştir.',
    projects_intro: 'Şirketinizdeki aktif projeler, tamamlanma yüzdeleri ve takvimleri.',
    timeline_intro: 'Görevlerin başlangıç ve bitiş tarihleri, süreleri ve birbirlerini bekleme akışları.',
    team_intro: 'Şirket personellerinin iletişim kartları, ülkeleri, dilleri ve proje açma yetkileri.',
    legend_blocked: 'Öncül Bekliyor',
    legend_ready: 'Başlamaya Hazır',
    legend_progress: 'Devam Ediyor',
    legend_done: 'Tamamlandı',
    col_todo: 'Yapılacak / Bekliyor',
    col_doing: 'Devam Ediyor',
    col_done: 'Tamamlandı'
  },
  en: {
    nav_my_tasks: 'My Tasks',
    nav_projects: 'Projects',
    nav_timeline: 'Timeline (Gantt)',
    nav_board: 'Work Board',
    nav_team: 'Team & Personnel',
    new_project_btn: '+ New Project',
    new_task_btn: '+ Add Task',
    my_tasks_sub: 'Your assigned tasks, statuses, and upcoming deadlines are listed below.',
    projects_intro: 'Active company projects, completion progress, and project schedules.',
    timeline_intro: 'Task start/due dates, durations, and predecessor flow.',
    team_intro: 'Personnel contact details, country, language, and project creation rights.',
    legend_blocked: 'Waiting on Predecessor',
    legend_ready: 'Ready to Start',
    legend_progress: 'In Progress',
    legend_done: 'Completed',
    col_todo: 'To Do / Waiting',
    col_doing: 'In Progress',
    col_done: 'Completed'
  },
  de: {
    nav_my_tasks: 'Meine Aufgaben',
    nav_projects: 'Projekte',
    nav_timeline: 'Zeitachse (Gantt)',
    nav_board: 'Aufgaben-Board',
    nav_team: 'Team & Personal',
    new_project_btn: '+ Neues Projekt',
    new_task_btn: '+ Aufgabe hinzufügen',
    my_tasks_sub: 'Ihnen zugewiesene Aufgaben, Status und anstehende Termine.',
    projects_intro: 'Aktive Projekte, Fortschritt und Zeitpläne im Unternehmen.',
    timeline_intro: 'Aufgabendaten, Dauer und Abhängigkeitsabläufe im Zeitplan.',
    team_intro: 'Mitarbeiterdaten, Länder, Sprachen und Projektrechte.',
    legend_blocked: 'Wartet auf Vorgänger',
    legend_ready: 'Bereit zum Start',
    legend_progress: 'Wird bearbeitet',
    legend_done: 'Abgeschlossen',
    col_todo: 'Zu erledigen / Wartend',
    col_doing: 'In Bearbeitung',
    col_done: 'Abgeschlossen'
  }
};

let currentLang = 'tr';

function setLanguage(lang) {
  if (!I18N[lang]) lang = 'tr';
  currentLang = lang;
  document.getElementById('langSelect').value = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupEventListeners();

  const savedToken = localStorage.getItem('fg_token');
  const savedUser = localStorage.getItem('fg_user');
  const savedTenant = localStorage.getItem('fg_tenant');

  if (savedToken && savedUser && savedTenant) {
    state.token = savedToken;
    state.currentUser = JSON.parse(savedUser);
    state.tenant = JSON.parse(savedTenant);
    onLoginSuccess(state.currentUser, state.tenant, state.token);
  } else {
    showLoginOverlay();
  }
});

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.tenant) headers['x-tenant-id'] = state.tenant.id;
  if (state.currentUser) headers['x-user-id'] = state.currentUser.id;
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  return headers;
}

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(endpoint, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'İşlem başarısız' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// ================= LOGIN & AUTH =================
function showLoginOverlay() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function onLoginSuccess(user, tenant, token) {
  state.currentUser = user;
  state.tenant = tenant;
  state.token = token;

  localStorage.setItem('fg_token', token);
  localStorage.setItem('fg_user', JSON.stringify(user));
  localStorage.setItem('fg_tenant', JSON.stringify(tenant));

  setLanguage(user.language || 'tr');

  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appContainer').style.display = 'flex';

  document.getElementById('userNameDisplay').textContent = user.name;
  document.getElementById('userAvatar').textContent = user.name.slice(0, 1).toUpperCase();
  document.getElementById('welcomeUserText').textContent = `Hoş geldiniz, ${user.name}!`;

  const roleTitle = user.system_role === 'ADMIN'
    ? 'Yönetici'
    : (user.can_create_project ? 'Proje Lideri' : 'Çalışan');
  document.getElementById('userRoleDisplay').textContent = roleTitle;

  // Admin yetki görünürlüğü
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = user.system_role === 'ADMIN' ? 'flex' : 'none';
  });

  // Proje oluşturma butonu
  const newProjBtn = document.getElementById('newProjectBtn');
  if (user.system_role === 'ADMIN' || user.can_create_project) {
    newProjBtn.style.display = 'inline-flex';
  } else {
    newProjBtn.style.display = 'none';
  }

  loadInitialData();
}

function logout() {
  localStorage.clear();
  state.currentUser = null;
  state.token = null;
  state.tenant = null;
  showLoginOverlay();
  showToast('Oturum kapatıldı.', 'info');
}

// ================= LOAD DATA =================
async function loadInitialData() {
  await Promise.all([
    loadProjects(),
    loadPersonnel()
  ]);
}

async function loadProjects() {
  state.projects = await apiCall('/api/projects');
  document.getElementById('projectsCount').textContent = state.projects.length;
  renderProjectSelector();
  renderProjectsGrid();

  if (state.projects.length > 0 && !state.currentProjectId) {
    state.currentProjectId = state.projects[0].id;
  }

  if (state.currentProjectId) {
    await loadProjectTasks(state.currentProjectId);
  }
}

async function loadProjectTasks(projectId) {
  state.currentProjectId = projectId;
  const projectSelect = document.getElementById('projectSelect');
  if (projectSelect) projectSelect.value = projectId;

  state.tasks = await apiCall(`/api/projects/${projectId}/tasks`);
  state.dependencies = await apiCall(`/api/projects/${projectId}/dependencies`);

  renderMyTasks();
  renderTimeline();
  renderBoard();
}

async function loadPersonnel() {
  state.personnelList = await apiCall('/api/users');
  renderPersonnelTable();
}

// ================= RENDER VIEWS =================

function renderProjectSelector() {
  const el = document.getElementById('projectSelect');
  if (state.projects.length === 0) {
    el.innerHTML = '<option value="">(Proje Yok)</option>';
    return;
  }
  el.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  el.value = state.currentProjectId;
}

// 1. GÖREVLERİM LİSTESİ (MY TASKS)
function renderMyTasks() {
  const container = document.getElementById('myTasksTable');
  container.innerHTML = '';

  // Giriş yapan kullanıcının görevlerini filtrele (Admin hepsini de görebilir)
  const myTasks = state.currentUser?.system_role === 'ADMIN'
    ? state.tasks
    : state.tasks.filter(t => t.assignee_id === state.currentUser?.id);

  document.getElementById('myTasksCount').textContent = myTasks.length;

  if (myTasks.length === 0) {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:#64748b;">
        <span style="font-size:2rem;">🎉</span>
        <h4 style="margin-top:10px; color:#f8fafc;">Şu anda bekleyen göreviniz bulunmuyor!</h4>
        <p style="font-size:0.85rem; margin-top:4px;">Yeni bir iş atandığında burada listelenecektir.</p>
      </div>
    `;
    return;
  }

  myTasks.forEach(task => {
    const isDone = task.work_status === 'COMPLETED';
    const isOverdue = !isDone && new Date(task.current_due_date) < new Date();
    const row = document.createElement('div');
    row.className = 'task-list-row';

    // Bağımlılık uyarısı (Öncül bekleniyor mu?)
    let depNote = '';
    if (task.limited_dependencies && task.limited_dependencies.length > 0) {
      const blocking = task.limited_dependencies.find(d => d.is_blocking);
      if (blocking) {
        depNote = `<span class="task-dep-pill">⏳ Öncül: "${blocking.title}" tamamlanmalı</span>`;
      }
    }

    const statusPillClass = {
      BLOCKED: 'pill-status-blocked',
      READY: 'pill-status-ready',
      IN_PROGRESS: 'pill-status-progress',
      COMPLETED: 'pill-status-done'
    }[task.work_status] || 'pill-status-ready';

    const statusText = {
      BLOCKED: 'Öncül Bekliyor',
      READY: 'Başlamaya Hazır',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı'
    }[task.work_status] || task.work_status;

    let quickActionBtn = '';
    if (task.work_status === 'READY') {
      quickActionBtn = `<button class="action-btn primary-btn sm-btn btn-start-task" data-id="${task.id}">▶ Başlat</button>`;
    } else if (isOverdue) {
      quickActionBtn = `<button class="action-btn outline-btn sm-btn btn-explain-task" data-id="${task.id}" data-title="${task.title}">⚠️ Gecikme Bildir</button>`;
    }

    row.innerHTML = `
      <button class="task-check-btn ${isDone ? 'checked' : ''}" data-id="${task.id}" title="${isDone ? 'Tamamlandı' : 'Tamamla'}"></button>
      <div class="task-info-col">
        <span class="task-main-title ${isDone ? 'done-title' : ''}">${task.title}</span>
        ${depNote}
      </div>
      <div class="task-date-col ${isOverdue ? 'overdue' : ''}">
        📅 ${task.current_due_date.slice(0, 10)} ${isOverdue ? '(Gecikti)' : ''}
      </div>
      <div>
        <span class="task-status-pill ${statusPillClass}">${statusText}</span>
      </div>
      <div>${quickActionBtn}</div>
    `;

    container.appendChild(row);
  });
}

// 2. PROJELER GRID GÖRÜNÜMÜ
function renderProjectsGrid() {
  const container = document.getElementById('projectsCardsGrid');
  container.innerHTML = '';

  if (state.projects.length === 0) {
    container.innerHTML = '<p style="color:#64748b;">Henüz proje bulunmuyor.</p>';
    return;
  }

  state.projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.id = p.id;

    card.innerHTML = `
      <div class="proj-card-header">
        <h4 class="proj-title">${p.title}</h4>
      </div>
      <p class="proj-desc">${p.description || 'Açıklama belirtilmemiş.'}</p>
      
      <div class="proj-progress-box">
        <div class="proj-progress-meta">
          <span>İlerleme</span>
          <strong>${p.id === state.currentProjectId ? 'Aktif Proje' : 'Görüntüle ➔'}</strong>
        </div>
        <div class="proj-track">
          <div class="proj-fill" style="width: 50%;"></div>
        </div>
      </div>

      <div class="proj-dates-row">
        <span>Başlangıç: ${p.current_start_date.slice(0, 10)}</span>
        <span>Bitiş: ${p.current_due_date.slice(0, 10)}</span>
      </div>
    `;

    card.addEventListener('click', async () => {
      await loadProjectTasks(p.id);
      switchView('view-my-tasks');
    });

    container.appendChild(card);
  });
}

// 3. ZAMAN ÇİZELGESİ (GANTT TIMELINE)
function renderTimeline() {
  const container = document.getElementById('timelineChart');
  container.innerHTML = '';

  const activeProj = state.projects.find(p => p.id === state.currentProjectId);
  document.getElementById('timelineProjectName').textContent = activeProj ? activeProj.title : 'Proje Çizelgesi';

  if (state.tasks.length === 0) {
    container.innerHTML = '<p style="color:#64748b; padding:20px;">Bu projede gösterilecek görev yok.</p>';
    return;
  }

  state.tasks.forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'gantt-row';

    const barClass = {
      BLOCKED: 'bar-blocked',
      READY: 'bar-ready',
      IN_PROGRESS: 'bar-progress',
      COMPLETED: 'bar-done'
    }[t.work_status] || 'bar-ready';

    // Bağımlı olduğu öncül var mı?
    const predDep = state.dependencies.find(d => d.successor_id === t.id);
    let depLine = '';
    if (predDep) {
      const predTask = state.tasks.find(pt => pt.id === predDep.predecessor_id);
      depLine = `<span class="gantt-dep-link">⬅️ "${predTask ? predTask.title : 'Öncül'}" bittikten sonra</span>`;
    }

    row.innerHTML = `
      <div class="gantt-task-name" title="${t.title}">
        ${idx + 1}. ${t.title}
      </div>
      <div class="gantt-bar-area">
        <div class="gantt-bar ${barClass}" style="width: ${40 + (idx * 8)}%;">
          <span>${t.current_start_date.slice(5, 10)} ➔ ${t.current_due_date.slice(5, 10)}</span>
        </div>
        ${depLine}
      </div>
    `;

    container.appendChild(row);
  });
}

// 4. İŞ PANOSU (KANBAN)
function renderBoard() {
  const lists = {
    TODO: document.getElementById('bListTodo'),
    DOING: document.getElementById('bListDoing'),
    DONE: document.getElementById('bListDone')
  };

  const counts = { TODO: 0, DOING: 0, DONE: 0 };
  Object.values(lists).forEach(l => l.innerHTML = '');

  state.tasks.forEach(t => {
    const card = document.createElement('div');
    card.className = 'board-card';

    const assignee = state.personnelList.find(p => p.id === t.assignee_id);
    const isOverdue = t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < new Date();

    card.innerHTML = `
      <div style="font-weight:600; font-size:0.9rem; line-height:1.3;">${t.title}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94a3b8;">
        <span>👤 ${assignee ? assignee.name : 'Atanmamış'}</span>
        <span class="${isOverdue ? 'due-chip overdue' : ''}">${t.current_due_date.slice(0, 10)}</span>
      </div>
    `;

    if (t.work_status === 'COMPLETED') {
      counts.DONE++;
      lists.DONE.appendChild(card);
    } else if (t.work_status === 'IN_PROGRESS') {
      counts.DOING++;
      lists.DOING.appendChild(card);
    } else {
      counts.TODO++;
      lists.TODO.appendChild(card);
    }
  });

  document.getElementById('bCountTodo').textContent = counts.TODO;
  document.getElementById('bCountDoing').textContent = counts.DOING;
  document.getElementById('bCountDone').textContent = counts.DONE;
}

// 5. PERSONEL TABLOSU (ADMIN)
function renderPersonnelTable() {
  const tbody = document.getElementById('personnelTableBody');
  tbody.innerHTML = '';

  const countryFlags = {
    'Türkiye': '🇹🇷 Türkiye',
    'Almanya': '🇩🇪 Almanya',
    'İngiltere': '🇬🇧 İngiltere',
    'USA': '🇺🇸 ABD'
  };

  state.personnelList.forEach(u => {
    const isSelf = u.id === state.currentUser?.id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="profile-avatar" style="width:28px; height:28px; font-size:0.75rem;">${u.name.slice(0, 1).toUpperCase()}</div>
          <strong>${u.name}</strong> ${isSelf ? '<span class="nav-badge neutral">Siz</span>' : ''}
        </div>
      </td>
      <td>
        <div>${u.email}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${u.phone || '-'}</div>
      </td>
      <td>
        <span>${countryFlags[u.country] || u.country} (${(u.language || 'tr').toUpperCase()})</span>
      </td>
      <td>${u.department || 'Genel'}</td>
      <td>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
          <input type="checkbox" class="perm-toggle" data-id="${u.id}" ${u.can_create_project ? 'checked' : ''} ${isSelf ? 'disabled' : ''}>
          <span>${u.can_create_project ? 'Yetkili' : 'Standart'}</span>
        </label>
      </td>
      <td>
        <button class="action-btn outline-btn sm-btn btn-edit-personnel" data-id="${u.id}">Düzenle</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ================= NAVIGATION =================
function setupNavigation() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.nav;
      switchView(viewId);
    });
  });
}

function switchView(viewId) {
  state.currentView = viewId;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

  const activeNavBtn = document.querySelector(`[data-nav="${viewId}"]`);
  if (activeNavBtn) activeNavBtn.classList.add('active');

  const activeSection = document.getElementById(viewId);
  if (activeSection) activeSection.classList.add('active');

  const titles = {
    'view-my-tasks': 'Görevlerim',
    'view-projects': 'Projeler',
    'view-timeline': 'Zaman Çizelgesi (Gantt)',
    'view-board': 'İş Panosu (Kanban)',
    'view-team': 'Ekip & Personel'
  };
  document.getElementById('currentViewTitle').textContent = titles[viewId] || 'Panel';

  // Proje seçici göster/gizle
  const projContainer = document.getElementById('projectSelectorContainer');
  if (viewId === 'view-team' || viewId === 'view-projects') {
    projContainer.style.display = 'none';
  } else {
    projContainer.style.display = 'flex';
  }
}

// ================= MODALS & EVENTS =================
function setupModals() {
  document.querySelectorAll('.modal-close, [data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.dataset.close || el.closest('.modal-backdrop')?.id;
      if (modalId) document.getElementById(modalId)?.classList.remove('open');
    });
  });
}

function setupEventListeners() {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      const res = await apiCall('/api/auth/login', 'POST', { email, password });
      showToast('Giriş başarılı!', 'success');
      onLoginSuccess(res.user, res.tenant, res.token);
    } catch (err) {}
  });

  // Hızlı Demo Giriş Butonları
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('loginEmail').value = btn.dataset.email;
      document.getElementById('loginPassword').value = btn.dataset.pass;
      document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    });
  });

  // Çıkış
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Dil Değiştirici
  document.getElementById('langSelect').addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });

  // Proje Seçici
  document.getElementById('projectSelect').addEventListener('change', async (e) => {
    if (e.target.value) {
      await loadProjectTasks(e.target.value);
    }
  });

  // Görev Tamamla (Check Butonu)
  document.getElementById('myTasksTable').addEventListener('click', async (e) => {
    const checkBtn = e.target.closest('.task-check-btn');
    if (checkBtn) {
      const taskId = checkBtn.dataset.id;
      const res = await apiCall(`/api/tasks/${taskId}/complete`, 'POST');
      showToast('Görev tamamlandı!', 'success');
      await loadProjectTasks(state.currentProjectId);
    }

    const startBtn = e.target.closest('.btn-start-task');
    if (startBtn) {
      const taskId = startBtn.dataset.id;
      await apiCall(`/api/tasks/${taskId}/start`, 'POST');
      showToast('Görev başlatıldı.', 'success');
      await loadProjectTasks(state.currentProjectId);
    }

    const expBtn = e.target.closest('.btn-explain-task');
    if (expBtn) {
      openExplanationModal(expBtn.dataset.id, expBtn.dataset.title);
    }
  });

  // Yeni Görev Modalı Aç
  document.getElementById('newTaskBtn').addEventListener('click', () => {
    populateTaskModalSelects();
    document.getElementById('taskModal').classList.add('open');
  });

  // Yeni Görev Kaydet (Öncül Bağımlılığı da Otomatik Ekler!)
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('tTitle').value.trim();
    const assignee_id = document.getElementById('tAssignee').value || undefined;
    const initial_start_date = new Date(document.getElementById('tStart').value).toISOString();
    const initial_due_date = new Date(document.getElementById('tDue').value).toISOString();
    const description = document.getElementById('tDesc').value.trim();
    const predecessor_id = document.getElementById('tPredecessor').value;

    const newTask = await apiCall('/api/tasks', 'POST', {
      project_id: state.currentProjectId,
      title,
      assignee_id,
      initial_start_date,
      initial_due_date,
      description
    });

    // Eğer öncül seçildiyse bağımlılığı anında bağla
    if (predecessor_id) {
      try {
        await apiCall('/api/dependencies', 'POST', {
          predecessor_id,
          successor_id: newTask.id
        });
      } catch (err) {
        showToast('Görev eklendi fakat bağımlılık döngü nedeniyle bağlanamadı.', 'warning');
      }
    }

    showToast('Görev başarıyla oluşturuldu.', 'success');
    document.getElementById('taskModal').classList.remove('open');
    e.target.reset();
    await loadProjectTasks(state.currentProjectId);
  });

  // Yeni Proje Modalı
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('projectModal').classList.add('open');
  });

  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('pTitle').value.trim();
    const description = document.getElementById('pDesc').value.trim();
    const initial_start_date = new Date(document.getElementById('pStart').value).toISOString();
    const initial_due_date = new Date(document.getElementById('pDue').value).toISOString();

    const newProj = await apiCall('/api/projects', 'POST', {
      title,
      description,
      initial_start_date,
      initial_due_date
    });

    showToast('Yeni proje oluşturuldu.', 'success');
    document.getElementById('projectModal').classList.remove('open');
    e.target.reset();
    await loadProjects();
    await loadProjectTasks(newProj.id);
  });

  // Yeni Personel Modalı (Admin)
  document.getElementById('newPersonnelBtn')?.addEventListener('click', () => {
    document.getElementById('personnelForm').reset();
    document.getElementById('personnelModal').classList.add('open');
  });

  document.getElementById('personnelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('persName').value.trim(),
      email: document.getElementById('persEmail').value.trim(),
      phone: document.getElementById('persPhone').value.trim(),
      password: document.getElementById('persPassword').value.trim() || '123',
      country: document.getElementById('persCountry').value,
      department: document.getElementById('persDept').value.trim() || 'Genel',
      can_create_project: document.getElementById('persCanCreateProj').checked
    };

    await apiCall('/api/admin/personnel', 'POST', body);
    showToast('Personel kartı eklendi.', 'success');
    document.getElementById('personnelModal').classList.remove('open');
    await loadPersonnel();
  });

  // Personel Proje Yetki Toggle
  document.getElementById('personnelTable')?.addEventListener('change', async (e) => {
    const toggle = e.target.closest('.perm-toggle');
    if (toggle) {
      await apiCall(`/api/admin/personnel/${toggle.dataset.id}`, 'PUT', {
        can_create_project: toggle.checked
      });
      showToast('Personel yetkisi güncellendi.', 'success');
    }
  });

  // Gecikme Açıklama Formu
  document.getElementById('explanationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = e.target.dataset.taskId;
    const text = document.getElementById('expText').value.trim();
    await apiCall(`/api/tasks/${taskId}/explanation`, 'POST', { explanation_text: text });
    showToast('Gecikme gerekçesi kaydedildi.', 'success');
    document.getElementById('explanationModal').classList.remove('open');
    e.target.reset();
    await loadProjectTasks(state.currentProjectId);
  });
}

function openExplanationModal(taskId, title) {
  const form = document.getElementById('explanationForm');
  form.dataset.taskId = taskId;
  document.getElementById('expTaskTitle').textContent = title;
  document.getElementById('explanationModal').classList.add('open');
}

function populateTaskModalSelects() {
  const assigneeEl = document.getElementById('tAssignee');
  assigneeEl.innerHTML = '<option value="">(Atanmamış)</option>' +
    state.personnelList.map(p => `<option value="${p.id}">${p.name} (${p.department || 'Genel'})</option>`).join('');

  const predEl = document.getElementById('tPredecessor');
  predEl.innerHTML = '<option value="">(Hiçbir görevi beklemiyor - Hemen başlayabilir)</option>' +
    state.tasks.map(t => `<option value="${t.id}">${t.title} (${t.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'})</option>`).join('');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
