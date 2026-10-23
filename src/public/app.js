// Görev ve Bağımlılık Yönetim Sistemi - İstemci Mantığı (v0.3)

let state = {
  tenants: [],
  users: [],
  projects: [],
  currentTenantId: null,
  currentUserId: null,
  currentProjectId: null,
  tasks: [],
  dependencies: [],
  bottlenecks: [],
  notifications: [],
  permissions: { isManager: false, isEditor: false, isFullViewer: true }
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initModals();
  initPwaAndPush();
  await loadInitialContext();
  setupEventListeners();

  // Her 30 saniyede bir bildirimleri yenile
  setInterval(loadNotifications, 30000);
});

// Headers with Security Context
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.currentTenantId) headers['x-tenant-id'] = state.currentTenantId;
  if (state.currentUserId) headers['x-user-id'] = state.currentUserId;
  return headers;
}

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(endpoint, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bilinmeyen sunucu hatası' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// ================= LOAD CONTEXT =================
async function loadInitialContext() {
  state.tenants = await apiCall('/api/tenants');
  renderTenantSelect();

  if (state.tenants.length > 0) {
    state.currentTenantId = state.tenants[0].id;
    await loadUsersForTenant();
    await loadProjects();
  }
}

async function loadUsersForTenant() {
  state.users = await apiCall('/api/users');
  renderUserSelect();
  if (state.users.length > 0 && !state.currentUserId) {
    state.currentUserId = state.users[0].id;
  }
}

async function loadProjects() {
  state.projects = await apiCall('/api/projects');
  renderProjectSelect();

  if (state.projects.length > 0) {
    state.currentProjectId = state.projects[0].id;
    await selectProject(state.currentProjectId);
  } else {
    state.currentProjectId = null;
    clearProjectViews();
  }
  await loadNotifications();
}

async function selectProject(projectId) {
  state.currentProjectId = projectId;
  const projectData = await apiCall(`/api/projects/${projectId}`);
  state.permissions = projectData.permissions;

  updateProjectToolbar(projectData.project);
  await Promise.all([
    loadTasks(),
    loadDependencies(),
    loadBottlenecks(),
    loadReports()
  ]);
}

async function loadTasks() {
  if (!state.currentProjectId) return;
  state.tasks = await apiCall(`/api/projects/${state.currentProjectId}/tasks`);
  renderKanban();
  renderDagNodes();
}

async function loadDependencies() {
  if (!state.currentProjectId) return;
  state.dependencies = await apiCall(`/api/projects/${state.currentProjectId}/dependencies`);
  renderDependenciesTable();
}

async function loadBottlenecks() {
  if (!state.currentProjectId) return;
  state.bottlenecks = await apiCall(`/api/projects/${state.currentProjectId}/bottlenecks`);
  renderBottlenecks();
}

async function loadNotifications() {
  const notifs = await apiCall('/api/notifications');
  state.notifications = notifs;
  renderNotifications();
}

async function loadReports() {
  if (!state.currentProjectId) return;
  const projReport = await apiCall(`/api/projects/${state.currentProjectId}/report`);
  renderProjectReport(projReport);

  const perfReport = await apiCall(`/api/reports/performance?user_id=${state.currentUserId}&project_id=${state.currentProjectId}`);
  renderPerformanceReport(perfReport);
}

// ================= RENDER FUNCTIONS =================

function renderTenantSelect() {
  const el = document.getElementById('tenantSelect');
  el.innerHTML = state.tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  el.value = state.currentTenantId;
}

function renderUserSelect() {
  const el = document.getElementById('userSelect');
  el.innerHTML = state.users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
  el.value = state.currentUserId;
}

function renderProjectSelect() {
  const el = document.getElementById('projectSelect');
  if (state.projects.length === 0) {
    el.innerHTML = '<option value="">(Proje Bulunmuyor)</option>';
    return;
  }
  el.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  el.value = state.currentProjectId;
}

function updateProjectToolbar(p) {
  const summaryEl = document.getElementById('projectDatesSummary');
  summaryEl.innerHTML = `
    <span class="meta-pill">İlk Plan: <strong>${p.initial_start_date.slice(0, 10)} - ${p.initial_due_date.slice(0, 10)}</strong></span>
    <span class="meta-pill">Güncel Plan: <strong>${p.current_start_date.slice(0, 10)} - ${p.current_due_date.slice(0, 10)}</strong></span>
  `;

  // Görünürlük talep butonu
  const reqBtn = document.getElementById('reqVisibilityBtn');
  const banner = document.getElementById('assigneeNoticeBanner');
  if (!state.permissions.isFullViewer) {
    reqBtn.style.display = 'inline-flex';
    banner.style.display = 'flex';
  } else {
    reqBtn.style.display = 'none';
    banner.style.display = 'none';
  }
}

function renderKanban() {
  const cols = {
    BLOCKED: document.getElementById('cards-blocked'),
    READY: document.getElementById('cards-ready'),
    IN_PROGRESS: document.getElementById('cards-inprogress'),
    COMPLETED: document.getElementById('cards-completed')
  };

  const counts = { BLOCKED: 0, READY: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  Object.values(cols).forEach(c => c.innerHTML = '');

  state.tasks.forEach(t => {
    counts[t.work_status] = (counts[t.work_status] || 0) + 1;
    const card = createTaskCard(t);
    if (cols[t.work_status]) {
      cols[t.work_status].appendChild(card);
    }
  });

  document.getElementById('count-blocked').textContent = counts.BLOCKED;
  document.getElementById('count-ready').textContent = counts.READY;
  document.getElementById('count-inprogress').textContent = counts.IN_PROGRESS;
  document.getElementById('count-completed').textContent = counts.COMPLETED;
}

function createTaskCard(t) {
  const card = document.createElement('div');
  card.className = `task-card card-${t.work_status.toLowerCase()}`;

  const assigneeUser = state.users.find(u => u.id === t.assignee_id);
  const isAssignee = t.assignee_id === state.currentUserId;
  const isOverdue = t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < new Date();

  let depSummaryHtml = '';
  if (t.limited_dependencies && t.limited_dependencies.length > 0) {
    const items = t.limited_dependencies.map(d => `
      <div class="dep-item">
        <span>${d.relation === 'PREDECESSOR' ? '⬅️ Öncül:' : '➡️ Ardıl:'} <strong>${d.title}</strong></span>
        <span class="dep-badge ${d.is_blocking ? 'blocking' : 'done'}">${d.work_status}</span>
      </div>
    `).join('');

    depSummaryHtml = `
      <div class="dep-summary-box">
        <div class="dep-summary-title">Bağımlılık Durumu</div>
        ${items}
      </div>
    `;
  }

  let actionsHtml = '';
  if (t.work_status === 'READY') {
    actionsHtml += `<button class="action-btn primary-btn btn-sm btn-start" data-id="${t.id}">▶ Başlat</button>`;
  }
  if (t.work_status === 'IN_PROGRESS' || t.work_status === 'READY') {
    actionsHtml += `<button class="action-btn secondary-btn btn-sm btn-complete" data-id="${t.id}">✓ Tamamla</button>`;
  }
  if (isOverdue) {
    actionsHtml += `<button class="action-btn outline-btn btn-sm btn-explain" data-id="${t.id}" data-title="${t.title}">⚠️ Açıklama Gir</button>`;
  }

  card.innerHTML = `
    <div class="card-title">${t.title}</div>
    <div class="card-meta-row">
      <span class="assignee-chip">👤 ${assigneeUser ? assigneeUser.name : 'Atanmamış'}</span>
      <span class="due-chip ${isOverdue ? 'overdue' : ''}">📅 ${t.current_due_date.slice(0, 10)}</span>
    </div>
    ${depSummaryHtml}
    <div class="card-actions-bar">
      ${actionsHtml}
    </div>
  `;

  return card;
}

function renderDagNodes() {
  const canvas = document.getElementById('dagCanvas');
  canvas.innerHTML = '';

  if (state.tasks.length === 0) {
    canvas.innerHTML = '<p class="empty-state">Projeye ait görev bulunmuyor.</p>';
    return;
  }

  state.tasks.forEach((t, idx) => {
    const node = document.createElement('div');
    node.className = `dag-node node-${t.work_status.toLowerCase()}`;
    node.innerHTML = `
      <div style="font-weight:700; font-size:0.85rem; margin-bottom:4px;">${t.title}</div>
      <div style="font-size:0.75rem; color:#94a3b8;">Durum: <strong>${t.work_status}</strong></div>
      <div style="font-size:0.72rem; color:#64748b; margin-top:4px;">Bitiş: ${t.current_due_date.slice(0, 10)}</div>
    `;
    canvas.appendChild(node);

    if (idx < state.tasks.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'dag-arrow';
      arrow.innerHTML = '➔';
      canvas.appendChild(arrow);
    }
  });
}

function renderDependenciesTable() {
  const tbody = document.querySelector('#depsTable tbody');
  tbody.innerHTML = '';

  if (state.dependencies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Tanımlı bağımlılık yok.</td></tr>';
    return;
  }

  state.dependencies.forEach(d => {
    const pTask = state.tasks.find(t => t.id === d.predecessor_id);
    const sTask = state.tasks.find(t => t.id === d.successor_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${pTask ? pTask.title : d.predecessor_id}</strong></td>
      <td><span class="formula-pill">Finish-to-Start</span></td>
      <td><strong>${sTask ? sTask.title : d.successor_id}</strong></td>
      <td>${d.wait_start_time ? d.wait_start_time.slice(0, 19).replace('T', ' ') : '-'}</td>
      <td>
        <button class="action-btn outline-btn btn-sm btn-delete-dep" data-pred="${d.predecessor_id}" data-succ="${d.successor_id}">Kaldır</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderBottlenecks() {
  const container = document.getElementById('bottlenecksList');
  container.innerHTML = '';

  if (state.bottlenecks.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:30px; grid-column: 1 / -1;">
        <span style="font-size:2rem;">🎉</span>
        <h3 style="margin-top:10px;">Aktif Darboğaz Bulunmuyor</h3>
        <p style="color:#94a3b8; font-size:0.85rem;">Şu anda geciken ve ardıl görevleri engelleyen bir kök görev tespit edilmedi.</p>
      </div>
    `;
    return;
  }

  state.bottlenecks.forEach(b => {
    const victims = b.affected_tasks.map(v => `<li style="margin-left:20px;">🚨 <strong>${v.title}</strong> (BLOCKED)</li>`).join('');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#fb7185;">Kök Darboğaz: "${b.bottleneck_title}"</h3>
        <span class="column-badge" style="background:rgba(244,63,94,0.2); color:#fb7185;">Asıl Geciken Görev</span>
      </div>
      <p style="font-size:0.85rem; color:#cbd5e1; margin-bottom:10px;">
        Bu görev güncel teslim tarihini aştığı için aşağıdaki ardıl görevler başlayamamakta ve mağdur olmaktadır:
      </p>
      <ul style="color:#94a3b8; font-size:0.85rem; margin-bottom:14px;">
        ${victims}
      </ul>
      <button class="action-btn primary-btn btn-sm btn-explain" data-id="${b.bottleneck_task_id}" data-title="${b.bottleneck_title}">
        Gecikme Gerekçesi / Açıklama Gir
      </button>
    `;
    container.appendChild(card);
  });
}

function renderProjectReport(r) {
  document.getElementById('repProjTitle').textContent = r.title;
  document.getElementById('repInitialStart').textContent = r.initial_start_date ? r.initial_start_date.slice(0, 10) : '-';
  document.getElementById('repInitialDue').textContent = r.initial_due_date ? r.initial_due_date.slice(0, 10) : '-';
  document.getElementById('repCurrentStart').textContent = r.current_start_date ? r.current_start_date.slice(0, 10) : '-';
  document.getElementById('repCurrentDue').textContent = r.current_due_date ? r.current_due_date.slice(0, 10) : '-';
  document.getElementById('repActualStart').textContent = r.actual_start_date ? r.actual_start_date.slice(0, 19).replace('T', ' ') : '(Başlamadı)';
  document.getElementById('repActualFinish').textContent = r.actual_finish_date ? r.actual_finish_date.slice(0, 19).replace('T', ' ') : '(Tamamlanmadı)';

  document.getElementById('repPercent').textContent = `${r.completion_rate}%`;
  document.getElementById('repTaskCounts').textContent = `${r.completed_tasks} / ${r.total_tasks} Görev Tamamlandı`;
  document.getElementById('repProgressFill').style.width = `${r.completion_rate}%`;
}

function renderPerformanceReport(p) {
  document.getElementById('perfScoreValue').textContent = p.performance_score !== null ? p.performance_score : '--';
  document.getElementById('perfHCount').textContent = p.eligible_h_count;
  document.getElementById('perfExCount').textContent = `${p.excluded_dependency_count} Görev Muaf Tutuldu`;
  document.getElementById('perfSCount').textContent = p.eligible_s_count;
  document.getElementById('perfZRatio').textContent = p.z_ratio !== null ? `${Math.round(p.z_ratio * 100)}%` : '--';
  document.getElementById('perfTRatio').textContent = p.t_ratio !== null ? `${Math.round(p.t_ratio * 100)}%` : '--';
}

function renderNotifications() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');

  if (state.notifications.length > 0) {
    badge.textContent = state.notifications.length;
    badge.style.display = 'inline-block';

    list.innerHTML = state.notifications.map(n => `
      <div class="notif-card">
        <div class="notif-title">${n.title}</div>
        <div>${n.message}</div>
        <div class="notif-time">${new Date(n.created_at).toLocaleString('tr-TR')}</div>
      </div>
    `).join('');
  } else {
    badge.style.display = 'none';
    list.innerHTML = '<p class="empty-state">Henüz bildirim bulunmuyor.</p>';
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Tenant Switcher
  document.getElementById('tenantSelect').addEventListener('change', async (e) => {
    state.currentTenantId = e.target.value;
    state.currentUserId = null;
    await loadUsersForTenant();
    await loadProjects();
    showToast('Şirket / Kiracı bağlamı güncellendi.', 'info');
  });

  // User Switcher
  document.getElementById('userSelect').addEventListener('change', async (e) => {
    state.currentUserId = e.target.value;
    if (state.currentProjectId) {
      await selectProject(state.currentProjectId);
    }
    showToast(`Aktif kullanıcı: ${state.users.find(u => u.id === state.currentUserId)?.name}`, 'info');
  });

  // Project Switcher
  document.getElementById('projectSelect').addEventListener('change', async (e) => {
    if (e.target.value) {
      await selectProject(e.target.value);
    }
  });

  // Task Buttons Delegation (Başlat, Tamamla, Açıklama)
  document.getElementById('tab-tasks').addEventListener('click', async (e) => {
    const startBtn = e.target.closest('.btn-start');
    if (startBtn) {
      const taskId = startBtn.dataset.id;
      await apiCall(`/api/tasks/${taskId}/start`, 'POST');
      showToast('Görev başlatıldı (IN_PROGRESS).', 'success');
      await loadTasks();
      await loadReports();
    }

    const compBtn = e.target.closest('.btn-complete');
    if (compBtn) {
      const taskId = compBtn.dataset.id;
      const res = await apiCall(`/api/tasks/${taskId}/complete`, 'POST');
      showToast(`Görev tamamlandı! ${res.newlyReadyTaskIds?.length ? res.newlyReadyTaskIds.length + ' ardıl görev READY oldu.' : ''}`, 'success');
      await loadTasks();
      await loadBottlenecks();
      await loadReports();
    }

    const expBtn = e.target.closest('.btn-explain');
    if (expBtn) {
      openExplanationModal(expBtn.dataset.id, expBtn.dataset.title);
    }
  });

  // Bottleneck Explanation Button
  document.getElementById('tab-bottlenecks').addEventListener('click', (e) => {
    const expBtn = e.target.closest('.btn-explain');
    if (expBtn) {
      openExplanationModal(expBtn.dataset.id, expBtn.dataset.title);
    }
  });

  // Delete Dependency
  document.querySelector('#depsTable').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-delete-dep');
    if (delBtn) {
      const { pred, succ } = delBtn.dataset;
      await apiCall('/api/dependencies', 'DELETE', { predecessor_id: pred, successor_id: succ });
      showToast('Bağımlılık kaldırıldı.', 'info');
      await loadDependencies();
      await loadTasks();
    }
  });

  // Modals Open
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('projectModal').classList.add('open');
  });

  document.getElementById('newTaskBtn').addEventListener('click', () => {
    populateAssigneeSelect();
    document.getElementById('taskModal').classList.add('open');
  });

  const openDepModal = () => {
    populateDepSelects();
    document.getElementById('depModal').classList.add('open');
  };
  document.getElementById('addDepQuickBtn').addEventListener('click', openDepModal);
  document.getElementById('addDepFromDagBtn').addEventListener('click', openDepModal);

  // Visibility Request
  document.getElementById('reqVisibilityBtn').addEventListener('click', async () => {
    await apiCall(`/api/projects/${state.currentProjectId}/visibility-request`, 'POST');
    showToast('Proje görünürlük talebiniz yöneticiye iletildi (KAB03).', 'info');
  });

  // Worker Trigger
  document.getElementById('triggerWorkerBtn').addEventListener('click', async () => {
    const res = await apiCall('/api/worker/run', 'POST');
    const logEl = document.getElementById('workerLog');
    const time = new Date().toLocaleTimeString('tr-TR');
    logEl.innerHTML += `<div class="log-line success">[${time}] Worker taraması tamamlandı: ${res.delaysEvaluated} görev kontrol edildi, ${res.remindersSent} hatırlatma tetiklendi.</div>`;
    showToast('Worker başarıyla çalıştırıldı.', 'success');
    await loadNotifications();
    await loadBottlenecks();
  });

  // Forms Submits
  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      title: document.getElementById('pTitle').value,
      description: document.getElementById('pDesc').value,
      initial_start_date: new Date(document.getElementById('pStart').value).toISOString(),
      initial_due_date: new Date(document.getElementById('pDue').value).toISOString()
    };
    const created = await apiCall('/api/projects', 'POST', body);
    showToast('Proje başarıyla oluşturuldu.', 'success');
    document.getElementById('projectModal').classList.remove('open');
    e.target.reset();
    await loadProjects();
    await selectProject(created.id);
  });

  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      project_id: state.currentProjectId,
      title: document.getElementById('tTitle').value,
      assignee_id: document.getElementById('tAssignee').value || undefined,
      initial_start_date: new Date(document.getElementById('tStart').value).toISOString(),
      initial_due_date: new Date(document.getElementById('tDue').value).toISOString(),
      description: document.getElementById('tDesc').value
    };
    await apiCall('/api/tasks', 'POST', body);
    showToast('Görev başarıyla oluşturuldu.', 'success');
    document.getElementById('taskModal').classList.remove('open');
    e.target.reset();
    await loadTasks();
    await loadReports();
  });

  document.getElementById('depForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pred = document.getElementById('depPred').value;
    const succ = document.getElementById('depSucc').value;

    try {
      await apiCall('/api/dependencies', 'POST', { predecessor_id: pred, successor_id: succ });
      showToast('Bağımlılık başarıyla eklendi.', 'success');
      document.getElementById('depModal').classList.remove('open');
      await loadDependencies();
      await loadTasks();
    } catch (err) {
      document.getElementById('depWarningBox').textContent = err.message;
      document.getElementById('depWarningBox').style.display = 'block';
    }
  });

  document.getElementById('explanationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = e.target.dataset.taskId;
    const text = document.getElementById('expText').value;
    await apiCall(`/api/tasks/${taskId}/explanation`, 'POST', { explanation_text: text });
    showToast('Gecikme gerekçesi kaydedildi ve yöneticilere bildirildi.', 'success');
    document.getElementById('explanationModal').classList.remove('open');
    e.target.reset();
    await loadBottlenecks();
    await loadNotifications();
  });

  // Notification Drawer
  document.getElementById('notifBellBtn').addEventListener('click', () => {
    document.getElementById('notifDrawer').classList.add('open');
  });
  document.getElementById('closeDrawerBtn').addEventListener('click', () => {
    document.getElementById('notifDrawer').classList.remove('open');
  });
}

function openExplanationModal(taskId, title) {
  const form = document.getElementById('explanationForm');
  form.dataset.taskId = taskId;
  document.getElementById('expTaskTitle').textContent = title;
  document.getElementById('explanationModal').classList.add('open');
}

function populateAssigneeSelect() {
  const el = document.getElementById('tAssignee');
  el.innerHTML = '<option value="">(Atanmamış)</option>' +
    state.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
}

function populateDepSelects() {
  const pred = document.getElementById('depPred');
  const succ = document.getElementById('depSucc');
  const options = state.tasks.map(t => `<option value="${t.id}">${t.title} (${t.work_status})</option>`).join('');
  pred.innerHTML = options;
  succ.innerHTML = options;
  document.getElementById('depWarningBox').style.display = 'none';
}

// ================= TABS & MODALS =================
function initTabs() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

function initModals() {
  document.querySelectorAll('.modal-close, [data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.dataset.close || el.closest('.modal-backdrop')?.id;
      if (modalId) {
        document.getElementById(modalId)?.classList.remove('open');
      }
    });
  });
}

// ================= PWA & WEB PUSH (WEB01-WEB05) =================
function initPwaAndPush() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('PWA Service Worker kayıtlı:', reg.scope);
    }).catch(err => {
      console.warn('PWA Service Worker kayıt hatası:', err);
    });
  }

  const pushBtn = document.getElementById('pwaPushBtn');
  const pushText = document.getElementById('pwaPushStatusText');

  if (!('Notification' in window)) {
    pushText.textContent = 'Push Desteklenmiyor';
    return;
  }

  if (Notification.permission === 'granted') {
    pushText.textContent = 'Push Açık';
    pushBtn.classList.add('active');
  }

  pushBtn.addEventListener('click', async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        pushText.textContent = 'Push Açık';
        pushBtn.classList.add('active');
        showToast('Web Push bildirimleri başarıyla etkinleştirildi.', 'success');

        // Sunucuya abonelik simülasyonu kaydet
        await apiCall('/api/notifications/push-subscribe', 'POST', {
          endpoint: `https://push.services.mozilla.com/v1/mock-${Date.now()}`,
          p256dh: 'mock-key',
          auth: 'mock-auth'
        });
      } else {
        showToast('Bildirim izni verilmedi.', 'warning');
      }
    } else {
      showToast('Web Push zaten etkin.', 'info');
    }
  });
}

// ================= TOAST =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function clearProjectViews() {
  document.getElementById('cards-blocked').innerHTML = '';
  document.getElementById('cards-ready').innerHTML = '';
  document.getElementById('cards-inprogress').innerHTML = '';
  document.getElementById('cards-completed').innerHTML = '';
  document.getElementById('dagCanvas').innerHTML = '';
  document.getElementById('projectDatesSummary').innerHTML = '';
}
