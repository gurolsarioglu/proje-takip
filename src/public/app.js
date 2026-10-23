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
  currentView: 'view-my-tasks',
  activeFilter: 'all',
  searchQuery: '',
  activeTaskId: null
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

// 1. GÖREVLERİM & İŞ PAKETLERİ LİSTESİ (MY TASKS & WORK PACKAGES)
function renderMyTasks() {
  const container = document.getElementById('myTasksTable');
  container.innerHTML = '';

  const countAllEl = document.getElementById('countAll');
  if (countAllEl) countAllEl.textContent = state.tasks.length;

  let filtered = [...state.tasks];

  // Filtre Sekmesi
  if (state.activeFilter === 'mine') {
    filtered = filtered.filter(t => t.assignee_id === state.currentUser?.id);
  } else if (state.activeFilter !== 'all') {
    filtered = filtered.filter(t => t.work_status === state.activeFilter);
  }

  // Arama Sorgusu
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
  }

  // Badge sayacı güncelle
  const myOwnTasks = state.tasks.filter(t => t.assignee_id === state.currentUser?.id);
  document.getElementById('myTasksCount').textContent = myOwnTasks.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:#64748b;">
        <span style="font-size:2rem;">🔍</span>
        <h4 style="margin-top:10px; color:#f8fafc;">Arama veya filtre kriterine uygun görev bulunamadı.</h4>
        <p style="font-size:0.85rem; margin-top:4px;">Yeni görev ekleyebilir veya filtreleri temizleyebilirsiniz.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(task => {
    const isDone = task.work_status === 'COMPLETED';
    const isOverdue = !isDone && new Date(task.current_due_date) < new Date();
    const row = document.createElement('div');
    row.className = 'task-list-row';
    row.dataset.id = task.id;

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

    const typeLabel = task.type === 'MILESTONE' ? '🏁' : (task.type === 'BUG' ? '🐞' : '📌');
    const priorityDot = task.priority === 'HIGH' ? '<span title="Yüksek Öncelik" style="color:#f59e0b; margin-right:4px;">●</span>' : '';
    const assignee = state.personnelList.find(p => p.id === task.assignee_id);

    row.innerHTML = `
      <button class="task-check-btn ${isDone ? 'checked' : ''}" data-id="${task.id}" title="${isDone ? 'Tamamlandı' : 'Tamamla'}"></button>
      <div class="task-info-col">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>${typeLabel}</span>
          ${priorityDot}
          <span class="task-main-title ${isDone ? 'done-title' : ''}">${task.title}</span>
        </div>
        ${depNote}
      </div>
      <div style="font-size:0.8rem; color:#94a3b8;">
        👤 ${assignee ? assignee.name : 'Atanmamış'}
      </div>
      <div class="task-date-col ${isOverdue ? 'overdue' : ''}">
        📅 ${task.current_due_date.slice(0, 10)} ${isOverdue ? '(Gecikti)' : ''}
      </div>
      <div>
        <span class="task-status-pill ${statusPillClass}">${statusText}</span>
      </div>
      <div>${quickActionBtn}</div>
    `;

    // Satıra tıklanınca OpenProject Detay Çekmecesi açılır
    row.addEventListener('click', (e) => {
      if (e.target.closest('.task-check-btn') || e.target.closest('button')) return;
      openTaskDrawer(task.id);
    });

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

function formatDateTR(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// 3. ZAMAN ÇİZELGESİ (GANTT TIMELINE) - RESİM 2 VE İSTEKLER ŞARTNAMESİ
function renderTimeline() {
  const container = document.getElementById('timelineChart');
  container.innerHTML = '';

  const activeProj = state.projects.find(p => p.id === state.currentProjectId);
  document.getElementById('timelineProjectName').textContent = activeProj ? activeProj.title : 'Proje Çizelgesi';

  if (state.tasks.length === 0) {
    container.innerHTML = '<p style="color:#64748b; padding:20px;">Bu projede gösterilecek görev yok.</p>';
    return;
  }

  // 1. Tarih Aralığı Hesaplama (En erken başlangıçtan en geç bitişe + marj)
  let minTime = Infinity;
  let maxTime = -Infinity;

  state.tasks.forEach(t => {
    const s = new Date(t.current_start_date).getTime();
    const d = new Date(t.current_due_date).getTime();
    if (s < minTime) minTime = s;
    if (d > maxTime) maxTime = d;
  });

  if (minTime === Infinity) {
    minTime = Date.now();
    maxTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }

  // Başlangıcı 2 gün geriye, bitişi 5 gün ileriye al
  const startDate = new Date(minTime);
  startDate.setDate(startDate.getDate() - 2);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(maxTime);
  endDate.setDate(endDate.getDate() + 5);
  endDate.setHours(0, 0, 0, 0);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(16, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
  const COL_WIDTH = 44; // Gün sütunu genişliği (px)
  const timelineWidth = totalDays * COL_WIDTH;

  // 2. Takvim Günleri & Aylar Dizisi
  const days = [];
  const monthSpans = [];
  let currentMonthName = '';
  let currentMonthSpan = 0;

  const monthNamesTR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * MS_PER_DAY);
    const dayNum = d.getDate();
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    const mName = `${monthNamesTR[monthIndex]} ${year}`;

    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dateKey === todayStr;

    days.push({ dayNum, isToday, date: d });

    if (mName !== currentMonthName) {
      if (currentMonthName) {
        monthSpans.push({ name: currentMonthName, count: currentMonthSpan });
      }
      currentMonthName = mName;
      currentMonthSpan = 1;
    } else {
      currentMonthSpan++;
    }
  }
  if (currentMonthSpan > 0) {
    monthSpans.push({ name: currentMonthName, count: currentMonthSpan });
  }

  // 3. HTML İskeleti Oluşturma (Scrollable wrapper, Header, Grid Lines, Task Rows, SVG Overlay)
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'timeline-scroll-wrap';

  // Üst Başlık (Aylar + Günler)
  const header = document.createElement('div');
  header.className = 'gantt-grid-header';
  header.style.width = `${timelineWidth}px`;

  // Aylar satırı
  const monthsRow = document.createElement('div');
  monthsRow.className = 'gantt-months-track';
  monthsRow.innerHTML = monthSpans.map(m => `
    <div class="gantt-month-header" style="width: ${m.count * COL_WIDTH}px;">
      ${m.name}
    </div>
  `).join('');

  // Günler satırı
  const daysRow = document.createElement('div');
  daysRow.className = 'gantt-days-track';
  daysRow.innerHTML = days.map(d => `
    <div class="gantt-day-col ${d.isToday ? 'today' : ''}" title="${d.dayNum}">
      ${d.dayNum}
    </div>
  `).join('');

  header.appendChild(monthsRow);
  header.appendChild(daysRow);
  scrollWrap.appendChild(header);

  // Görev Satırları ve Izgara Gövdesi
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'gantt-rows-container';
  rowsContainer.id = 'ganttRowsContainer';
  rowsContainer.style.width = `${timelineWidth}px`;

  // Arka Plan Dikey Izgara Çizgileri
  const gridLines = document.createElement('div');
  gridLines.className = 'gantt-grid-lines';
  gridLines.style.width = `${timelineWidth}px`;
  gridLines.innerHTML = days.map(() => `<div class="gantt-grid-line"></div>`).join('');
  rowsContainer.appendChild(gridLines);

  // SVG Bağlantı Çizgileri Katmanı
  const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('class', 'gantt-svg-overlay');
  svgOverlay.setAttribute('id', 'ganttSvgOverlay');
  svgOverlay.setAttribute('width', timelineWidth);
  svgOverlay.setAttribute('height', '100%');
  svgOverlay.innerHTML = `
    <defs>
      <marker id="gantt-arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
      </marker>
    </defs>
  `;
  rowsContainer.appendChild(svgOverlay);

  // Her görev için bir satır ve kart (Resim 2 Stili)
  state.tasks.forEach((t) => {
    const track = document.createElement('div');
    track.className = 'gantt-row-track';
    track.style.width = `${timelineWidth}px`;

    const tStart = new Date(t.current_start_date).getTime();
    const tDue = new Date(t.current_due_date).getTime();

    const startOffsetDays = Math.max(0, (tStart - startDate.getTime()) / MS_PER_DAY);
    const durationDays = Math.max(1, (tDue - tStart) / MS_PER_DAY + 1);

    const leftPx = Math.round(startOffsetDays * COL_WIDTH);
    const minWidthPx = Math.max(280, Math.round(durationDays * COL_WIDTH));

    const barClass = {
      BLOCKED: 'bar-blocked',
      READY: 'bar-ready',
      IN_PROGRESS: 'bar-progress',
      COMPLETED: 'bar-done'
    }[t.work_status] || 'bar-ready';

    const chipClass = {
      BLOCKED: 'chip-blocked',
      READY: 'chip-ready',
      IN_PROGRESS: 'chip-progress',
      COMPLETED: 'chip-done'
    }[t.work_status] || 'chip-ready';

    const statusText = {
      BLOCKED: 'Öncül Bekliyor',
      READY: 'Başlamaya Hazır',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı'
    }[t.work_status] || t.work_status;

    const typeIcon = t.type === 'MILESTONE' ? '🏁' : (t.type === 'BUG' ? '🐞' : '📌');
    const prog = t.work_status === 'COMPLETED' ? 100 : (t.progress || 0);

    const pill = document.createElement('div');
    pill.className = `gantt-pill-bar ${barClass}`;
    pill.id = `gantt-bar-${t.id}`;
    pill.style.left = `${leftPx}px`;
    pill.style.minWidth = `${minWidthPx}px`;
    pill.dataset.id = t.id;

    // Resim 1 & 2 gereksinimi: tarihler içerde gg.aa.yyyy formatında yazılıyor!
    pill.innerHTML = `
      <span class="pill-icon">${typeIcon}</span>
      <span class="pill-title">${t.title}</span>
      <span class="pill-progress">${prog}%</span>
      <span class="pill-dates">${formatDateTR(t.current_start_date)} ➔ ${formatDateTR(t.current_due_date)}</span>
      <span class="pill-status-chip ${chipClass}">● ${statusText}</span>
    `;

    pill.addEventListener('click', () => openTaskDrawer(t.id));

    track.appendChild(pill);
    rowsContainer.appendChild(track);
  });

  scrollWrap.appendChild(rowsContainer);
  container.appendChild(scrollWrap);

  // 4. Bağımlılık Oklarını Çiz (Resim 2 gibi altın kavisli oklar)
  setTimeout(() => {
    drawDependencyArrows(svgOverlay, rowsContainer);
  }, 60);
}

function drawDependencyArrows(svg, container) {
  if (!svg || !container) return;

  state.dependencies.forEach(dep => {
    const predEl = document.getElementById(`gantt-bar-${dep.predecessor_id}`);
    const succEl = document.getElementById(`gantt-bar-${dep.successor_id}`);

    if (predEl && succEl) {
      const predTrack = predEl.closest('.gantt-row-track');
      const succTrack = succEl.closest('.gantt-row-track');
      if (!predTrack || !succTrack) return;

      const x1 = predEl.offsetLeft + predEl.offsetWidth;
      const y1 = predTrack.offsetTop + predEl.offsetTop + (predEl.offsetHeight / 2);

      const x2 = succEl.offsetLeft;
      const y2 = succTrack.offsetTop + succEl.offsetTop + (succEl.offsetHeight / 2);

      const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
      let d;

      if (x2 >= x1 + 10) {
        // İleriye doğru akıcı S-eğrisi (Resim 2)
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      } else {
        // Geriye veya dikey döngüsel kavis
        const midY = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1 + 45} ${y1}, ${x1 + 45} ${midY}, ${(x1 + x2)/2} ${midY} S ${x2 - 45} ${y2}, ${x2} ${y2}`;
      }

      // Başlangıç noktası yuvarlağı (Resim 2 stili)
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x1);
      dot.setAttribute('cy', y1);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#f59e0b');
      svg.appendChild(dot);

      // Kavisli ok yolu
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#f59e0b');
      path.setAttribute('stroke-width', '2.4');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('marker-end', 'url(#gantt-arrow-gold)');
      svg.appendChild(path);
    }
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
    const typeIcon = t.type === 'MILESTONE' ? '🏁' : (t.type === 'BUG' ? '🐞' : '📌');

    card.innerHTML = `
      <div style="font-weight:600; font-size:0.9rem; line-height:1.3; display:flex; align-items:flex-start; gap:6px;">
        <span>${typeIcon}</span>
        <span>${t.title}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94a3b8; margin-top:6px;">
        <span>👤 ${assignee ? assignee.name : 'Atanmamış'}</span>
        <span class="${isOverdue ? 'due-chip overdue' : ''}">${t.current_due_date.slice(0, 10)}</span>
      </div>
    `;

    // Tıklanınca sağ çekmeceyi aç
    card.addEventListener('click', () => openTaskDrawer(t.id));

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

// ================= OPENPROJECT SPLIT SCREEN DRAWER =================
async function openTaskDrawer(taskId) {
  state.activeTaskId = taskId;
  const drawer = document.getElementById('workPackageDrawer');
  const backdrop = document.getElementById('wpDrawerBackdrop');
  if (!drawer) return;

  try {
    const details = await apiCall(`/api/tasks/${taskId}/details`);
    const { task, project, assignee, predecessors, successors, delays } = details;

    document.getElementById('wpProjectTitle').textContent = project?.title || 'FG Group Projesi';
    document.getElementById('wpId').textContent = `#${task.id.slice(0, 6)}`;
    
    const typeBadge = document.getElementById('wpType');
    typeBadge.textContent = task.type === 'MILESTONE' ? '🏁 KİLOMETRE TAŞI' : (task.type === 'BUG' ? '🐞 HATA' : '📌 GÖREV');
    typeBadge.className = `op-type-badge ${task.type === 'MILESTONE' ? 'milestone' : (task.type === 'BUG' ? 'bug' : '')}`;

    const priorityBadge = document.getElementById('wpPriority');
    priorityBadge.textContent = task.priority === 'HIGH' ? '🔥 Yüksek' : (task.priority === 'LOW' ? 'Düşük' : 'Normal');
    priorityBadge.className = `op-priority-badge ${task.priority === 'HIGH' ? 'high' : ''}`;

    document.getElementById('wpTitle').textContent = task.title;

    // Durum Pill
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

    const sb = document.getElementById('wpStatusBadge');
    sb.className = `task-status-pill ${statusPillClass}`;
    sb.textContent = statusText;

    const prog = task.work_status === 'COMPLETED' ? 100 : (task.progress || 0);
    document.getElementById('wpProgressText').textContent = `%${prog}`;
    document.getElementById('wpProgressFill').style.width = `${prog}%`;

    // Personel Kartı
    const avatar = document.getElementById('wpAssigneeAvatar');
    const nameEl = document.getElementById('wpAssigneeName');
    const deptEl = document.getElementById('wpAssigneeDept');
    const emailEl = document.getElementById('wpAssigneeEmail');
    const phoneEl = document.getElementById('wpAssigneePhone');

    if (assignee) {
      avatar.textContent = assignee.name.slice(0, 1).toUpperCase();
      nameEl.textContent = assignee.name;
      deptEl.textContent = `${assignee.department || 'Genel'} (${assignee.country || 'Türkiye'})`;
      emailEl.textContent = assignee.email;
      phoneEl.textContent = assignee.phone || 'Telefon belirtilmemiş';
    } else {
      avatar.textContent = '?';
      nameEl.textContent = 'Atanmamış';
      deptEl.textContent = '-';
      emailEl.textContent = '-';
      phoneEl.textContent = '-';
    }

    // Tarihler & Gecikme Uyarısı
    document.getElementById('wpStartDate').textContent = task.current_start_date ? task.current_start_date.slice(0, 10) : '-';
    document.getElementById('wpDueDate').textContent = task.current_due_date ? task.current_due_date.slice(0, 10) : '-';

    const delayAlert = document.getElementById('wpDelayBadge');
    const isOverdue = task.work_status !== 'COMPLETED' && new Date(task.current_due_date) < new Date();
    if (isOverdue) {
      delayAlert.style.display = 'flex';
      delayAlert.innerHTML = '⚠️ <strong>Teslim Tarihi Aşıldı:</strong> Bu görev planlanan bitiş tarihini geçti.';
    } else {
      delayAlert.style.display = 'none';
    }

    document.getElementById('wpDesc').textContent = task.description || 'Bu görev için detaylı açıklama girilmemiş.';

    // Öncül Listesi
    const predContainer = document.getElementById('wpPredecessorsList');
    if (predecessors && predecessors.length > 0) {
      predContainer.innerHTML = predecessors.map(p => `
        <div class="op-rel-item">
          <div>
            <span class="rel-title">${p.title}</span>
            <div class="rel-user">👤 ${p.assignee_name}</div>
          </div>
          <span class="task-status-pill ${p.work_status === 'COMPLETED' ? 'pill-status-done' : 'pill-status-progress'}">${p.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'}</span>
        </div>
      `).join('');
    } else {
      predContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">(Öncül görev yok - hemen başlayabilir)</span>';
    }

    // Ardıl Listesi
    const succContainer = document.getElementById('wpSuccessorsList');
    if (successors && successors.length > 0) {
      succContainer.innerHTML = successors.map(s => `
        <div class="op-rel-item">
          <div>
            <span class="rel-title">${s.title}</span>
            <div class="rel-user">👤 ${s.assignee_name}</div>
          </div>
          <span class="task-status-pill ${s.work_status === 'COMPLETED' ? 'pill-status-done' : 'pill-status-blocked'}">${s.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'}</span>
        </div>
      `).join('');
    } else {
      succContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">(Bu görevi bekleyen ardıl görev yok)</span>';
    }

    // Öncül Ekleme Dropdown'ı
    const addDepSelect = document.getElementById('wpAddDepSelect');
    const currentPredIds = new Set((predecessors || []).map(p => p.id));
    const eligibleTasks = state.tasks.filter(t => t.id !== task.id && !currentPredIds.has(t.id));
    addDepSelect.innerHTML = '<option value="">+ Öncül Bağımlılık Seç...</option>' +
      eligibleTasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('');

    // Gecikme & Aktivite Akışı
    const delaysContainer = document.getElementById('wpDelaysList');
    if (delays && delays.length > 0) {
      delaysContainer.innerHTML = delays.map(d => `
        <div class="op-activity-item ${d.explanation_type === 'SYSTEM_DEPENDENCY_BLOCK' ? 'system' : ''}">
          <div><strong>${d.explanation_type === 'SYSTEM_DEPENDENCY_BLOCK' ? '⚙️ Sistem Tespiti' : '👤 Personel Açıklaması'}:</strong> ${d.explanation_text || d.delay_reason || 'Gecikme kaydedildi.'}</div>
          <div class="op-activity-time">${new Date(d.logged_at).toLocaleString('tr-TR')}</div>
        </div>
      `).join('');
    } else {
      delaysContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">Henüz gecikme kaydı veya aktivite bulunmuyor.</span>';
    }

    // Butonlar
    const startBtn = document.getElementById('wpStartBtn');
    const compBtn = document.getElementById('wpCompleteBtn');

    if (task.work_status === 'READY') {
      startBtn.style.display = 'inline-flex';
      compBtn.style.display = 'inline-flex';
    } else if (task.work_status === 'IN_PROGRESS') {
      startBtn.style.display = 'none';
      compBtn.style.display = 'inline-flex';
    } else {
      startBtn.style.display = 'none';
      compBtn.style.display = 'none';
    }

    // Aç
    drawer.classList.add('open');
    if (backdrop) backdrop.style.display = 'block';
  } catch (err) {
    showToast('Görev detayları alınamadı: ' + err.message, 'error');
  }
}

function closeTaskDrawer() {
  state.activeTaskId = null;
  const drawer = document.getElementById('workPackageDrawer');
  const backdrop = document.getElementById('wpDrawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.style.display = 'none';
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

  if (viewId === 'view-timeline') {
    renderTimeline();
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

  // OpenProject Filtre ve Arama Çubuğu
  const searchInput = document.getElementById('taskSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderMyTasks();
    });
  }

  document.querySelectorAll('.op-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.op-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderMyTasks();
    });
  });

  // OpenProject Split Screen Çekmece Eylemleri
  document.getElementById('wpCloseBtn')?.addEventListener('click', closeTaskDrawer);
  document.getElementById('wpCloseFooterBtn')?.addEventListener('click', closeTaskDrawer);
  document.getElementById('wpDrawerBackdrop')?.addEventListener('click', closeTaskDrawer);

  document.getElementById('wpStartBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    await apiCall(`/api/tasks/${state.activeTaskId}/start`, 'POST');
    showToast('Görev başlatıldı.', 'success');
    await loadProjectTasks(state.currentProjectId);
    await openTaskDrawer(state.activeTaskId);
  });

  document.getElementById('wpCompleteBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    await apiCall(`/api/tasks/${state.activeTaskId}/complete`, 'POST');
    showToast('Görev tamamlandı!', 'success');
    await loadProjectTasks(state.currentProjectId);
    await openTaskDrawer(state.activeTaskId);
  });

  document.getElementById('wpAddDepBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    const predId = document.getElementById('wpAddDepSelect').value;
    if (!predId) return showToast('Lütfen bir öncül görev seçiniz.', 'warning');
    try {
      await apiCall('/api/dependencies', 'POST', {
        predecessor_id: predId,
        successor_id: state.activeTaskId
      });
      showToast('Bağımlılık başarıyla bağlandı.', 'success');
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
    } catch (err) {
      showToast('Bağımlılık bağlanamadı: ' + err.message, 'error');
    }
  });

  document.getElementById('wpInlineExpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeTaskId) return;
    const text = document.getElementById('wpInlineExpText').value.trim();
    if (!text) return;
    await apiCall(`/api/tasks/${state.activeTaskId}/explanation`, 'POST', { explanation_text: text });
    showToast('Gerekçe / durum notu kaydedildi.', 'success');
    document.getElementById('wpInlineExpText').value = '';
    await loadProjectTasks(state.currentProjectId);
    await openTaskDrawer(state.activeTaskId);
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
    const type = document.getElementById('tType')?.value || 'TASK';
    const priority = document.getElementById('tPriority')?.value || 'NORMAL';
    const assignee_id = document.getElementById('tAssignee').value || undefined;
    const initial_start_date = new Date(document.getElementById('tStart').value).toISOString();
    const initial_due_date = new Date(document.getElementById('tDue').value).toISOString();
    const description = document.getElementById('tDesc').value.trim();
    const predecessor_id = document.getElementById('tPredecessor').value;

    const newTask = await apiCall('/api/tasks', 'POST', {
      project_id: state.currentProjectId,
      title,
      type,
      priority,
      assignee_id,
      initial_start_date,
      initial_due_date,
      description,
      predecessor_id
    });

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
