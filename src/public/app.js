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
  activeTaskId: null,
  workflowSteps: [],
  taskDefinitions: []
};

function getStepColor(stepName) {
  if (!stepName) return '#8b5cf6';
  const found = (state.workflowSteps || []).find(s => s.name.toUpperCase() === stepName.toUpperCase());
  if (found && found.color) return found.color;
  const colors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#4f46e5', '#db2777'];
  let hash = 0;
  for (let i = 0; i < stepName.length; i++) hash = stepName.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

async function loadWorkflowCatalog() {
  try {
    const [steps, defs] = await Promise.all([
      apiCall('/api/workflow-steps'),
      apiCall('/api/task-definitions')
    ]);
    state.workflowSteps = Array.isArray(steps) ? steps : [];
    state.taskDefinitions = Array.isArray(defs) ? defs : [];
  } catch (err) {
    console.warn('İş adımları kataloğu yüklenirken uyarı:', err);
  }
}

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
    col_done: 'Tamamlandı',
    gantt_today: 'Bugün',
    gantt_toggle_table: 'Tabloyu Gizle',
    zoom_day: 'Günlük',
    zoom_week: 'Haftalık',
    zoom_month: 'Aylık',
    zoom_year: 'Yıllık',
    global_search_placeholder: 'Görev, açıklama veya personel ara... (Ctrl+K)',
    label_current: 'Güncel',
    label_initial_plan: 'İlk Plan',
    label_revised: 'Revize Edildi',
    label_original_plan: 'Orijinal Plan',
    label_overdue: 'Gecikti',
    label_on_track: 'Takvimde',
    label_tasks: 'Görev',
    label_completion: 'Tamamlanma',
    label_open_tasks: 'Görevleri Aç',
    label_team_and_plan: 'Ekip & Plan',
    label_active_project: 'Aktif Proje',
    label_unassigned: 'Atanmamış',
    label_due: 'Vade'
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
    col_done: 'Completed',
    gantt_today: 'Today',
    gantt_toggle_table: 'Toggle Table',
    zoom_day: 'Daily',
    zoom_week: 'Weekly',
    zoom_month: 'Monthly',
    zoom_year: 'Yearly',
    global_search_placeholder: 'Search tasks by title, description, or assignee... (Ctrl+K)',
    label_current: 'Current',
    label_initial_plan: 'Initial Plan',
    label_revised: 'Revised',
    label_original_plan: 'Original Plan',
    label_overdue: 'Overdue',
    label_on_track: 'On Track',
    label_tasks: 'Tasks',
    label_completion: 'Completion',
    label_open_tasks: 'Open Tasks',
    label_team_and_plan: 'Team & Plan',
    label_active_project: 'Active Project',
    label_unassigned: 'Unassigned',
    label_due: 'Due'
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
    col_done: 'Abgeschlossen',
    gantt_today: 'Heute',
    gantt_toggle_table: 'Tabelle umschalten',
    zoom_day: 'Täglich',
    zoom_week: 'Wöchentlich',
    zoom_month: 'Monatlich',
    zoom_year: 'Jährlich',
    global_search_placeholder: 'Aufgaben, Beschreibung oder Personal suchen... (Ctrl+K)',
    label_current: 'Aktuell',
    label_initial_plan: 'Ursprünglicher Plan',
    label_revised: 'Überarbeitet',
    label_original_plan: 'Originalplan',
    label_overdue: 'Überfällig',
    label_on_track: 'Im Zeitplan',
    label_tasks: 'Aufgaben',
    label_completion: 'Fertigstellung',
    label_open_tasks: 'Aufgaben öffnen',
    label_team_and_plan: 'Team & Plan',
    label_active_project: 'Aktives Projekt',
    label_unassigned: 'Nicht zugewiesen',
    label_due: 'Fällig'
  }
};

let currentLang = 'tr';

function setLanguage(lang) {
  if (!I18N[lang]) lang = 'tr';
  currentLang = lang;
  state.currentLang = lang;
  const langSelect = document.getElementById('langSelect');
  if (langSelect) langSelect.value = lang;
  const modalLangSelect = document.getElementById('modalLangSelect');
  if (modalLangSelect) modalLangSelect.value = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (I18N[lang] && I18N[lang][key]) {
      el.setAttribute('placeholder', I18N[lang][key]);
    }
  });

  // Seçilen dile göre arayüzdeki tarihleri, etiketleri ve görünümleri anında yeniden çiz
  if (state.currentUser) {
    if (typeof renderProjectsGrid === 'function' && state.projects) renderProjectsGrid();
    if (typeof renderMyTasks === 'function' && state.myTasks) renderMyTasks();
    if (state.currentView === 'view-timeline' && typeof renderTimeline === 'function') renderTimeline();
    if (state.currentView === 'view-board' && typeof renderBoard === 'function') renderBoard();
  }
}

function t(key, fallback = '') {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N['tr'] && I18N['tr'][key]) || fallback || key;
}

function formatDate(isoStr, lang = currentLang) {
  if (!isoStr) return '';
  const s = String(isoStr).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    if (lang === 'en') return `${day}/${month}/${year}`;
    return `${day}.${month}.${year}`;
  }
  const d = (isoStr instanceof Date) ? isoStr : new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (lang === 'en') return `${day}/${month}/${year}`;
  return `${day}.${month}.${year}`;
}

function formatDateTime(isoStr, lang = currentLang) {
  if (!isoStr) return '';
  const d = (isoStr instanceof Date) ? isoStr : new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const datePart = formatDate(d, lang);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}

function formatTime(isoStr, lang = currentLang) {
  if (!isoStr) return '';
  const d = (isoStr instanceof Date) ? isoStr : new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateTR(isoStr) {
  return formatDate(isoStr, currentLang);
}

function formatDateTimeTR(isoStr) {
  return formatDateTime(isoStr, currentLang);
}

// Küresel Görev Arama Yardımcıları (Başlık, Açıklama ve Sorumlu Personel)
function normalizeSearchText(val) {
  if (!val) return '';
  return String(val).toLocaleLowerCase('tr-TR').trim();
}

function matchesTaskQuery(task, rawQuery) {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;

  const assignee = state.personnelList.find(p => p.id === task.assignee_id);
  const titleNorm = normalizeSearchText(task.title);
  const descNorm = normalizeSearchText(task.description);
  const assigneeNameNorm = normalizeSearchText(assignee?.name);
  const assigneeEmailNorm = normalizeSearchText(assignee?.email);
  const assigneeDeptNorm = normalizeSearchText(assignee?.department);
  const assigneeCountryNorm = normalizeSearchText(assignee?.country);
  const unassignedNorm = !task.assignee_id ? 'atanmamış atanmadı unassigned' : '';

  return (
    titleNorm.includes(q) ||
    descNorm.includes(q) ||
    assigneeNameNorm.includes(q) ||
    assigneeEmailNorm.includes(q) ||
    assigneeDeptNorm.includes(q) ||
    assigneeCountryNorm.includes(q) ||
    unassignedNorm.includes(q)
  );
}

function updateGlobalSearchUI() {
  const q = (state.searchQuery || '').trim();
  const container = document.getElementById('globalSearchContainer');
  const badge = document.getElementById('globalSearchCountBadge');
  const clearBtn = document.getElementById('globalSearchClearBtn');

  if (container) {
    container.classList.toggle('has-active-query', q.length > 0);
  }

  if (clearBtn) {
    clearBtn.style.display = q.length > 0 ? 'inline-flex' : 'none';
  }

  if (badge) {
    if (q.length > 0) {
      const matchedCount = state.tasks.filter(t => matchesTaskQuery(t, q)).length;
      badge.textContent = `${matchedCount} / ${state.tasks.length}`;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function applyGlobalTaskSearch(rawQuery, sourceInputId = '') {
  const q = rawQuery || '';
  const trimmed = q.trim();

  state.searchQuery = trimmed;
  ganttFilterQuery = trimmed.toLocaleLowerCase('tr-TR');
  state.kanbanSearchQuery = trimmed;

  const inputIds = ['globalTaskSearchInput', 'taskSearchInput', 'ganttSearchInput', 'kanbanSearchInput'];
  inputIds.forEach(id => {
    if (id !== sourceInputId) {
      const el = document.getElementById(id);
      if (el && el.value !== q) {
        el.value = q;
      }
    }
  });

  updateGlobalSearchUI();
  renderMyTasks();
  renderTimeline();
  renderBoard();
  renderMicrosoftTodoList();
}

function clearAllSearchFilters() {
  state.searchQuery = '';
  ganttFilterQuery = '';
  state.kanbanSearchQuery = '';
  const inputIds = ['globalTaskSearchInput', 'taskSearchInput', 'ganttSearchInput', 'kanbanSearchInput'];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
    }
  });
  updateGlobalSearchUI();
}

// Sayfa her açıldığında veya geri gelindiğinde arama alanlarının temiz gelmesini garantiye al
window.addEventListener('pageshow', () => {
  if (!state.searchQuery) {
    clearAllSearchFilters();
  }
});

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  clearAllSearchFilters();
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

// ================= TEMA YÖNETİMİ (LIGHT / DARK THEME) =================
function getActiveTheme() {
  return localStorage.getItem('fggroup_theme') || state.currentUser?.theme || 'light';
}

function applyTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('fggroup_theme', t);

  // Üst bar ikonunu güncelle
  const topbarIcon = document.getElementById('topbarThemeIcon');
  if (topbarIcon) {
    topbarIcon.textContent = t === 'dark' ? '🌙' : '☀️';
  }

  // Sol alt mini toggle güncelle
  const miniIcon = document.getElementById('themeMiniIcon');
  const miniText = document.getElementById('themeMiniText');
  if (miniIcon) miniIcon.textContent = t === 'dark' ? '🌙' : '☀️';
  if (miniText) miniText.textContent = t === 'dark' ? 'Koyu' : 'Açık';

  // Profil modalındaki kartları güncelle
  document.querySelectorAll('#userProfileModal .theme-choice-card').forEach(card => {
    if (card.dataset.setTheme === t) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function toggleTheme() {
  const current = getActiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if (state.currentUser) {
    state.currentUser.theme = next;
    apiCall('/api/profile/theme', 'PUT', { theme: next }).catch(() => { });
  }
  showToast(next === 'dark' ? '🌙 Koyu tema aktif edildi.' : '☀️ Açık tema aktif edildi.', 'info');
}

function applyAvatarToElement(el, user) {
  if (!el) return;
  if (user && user.avatar_url) {
    el.innerHTML = `<img src="${user.avatar_url}" alt="${escapeHtml(user.name || 'Profil')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
    el.style.overflow = 'hidden';
    el.style.padding = '0';
  } else {
    el.innerHTML = '';
    el.textContent = (user?.name || '?').slice(0, 1).toUpperCase();
  }
}

function compressAvatarImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Dosya okuma hatası.'));
    reader.readAsDataURL(file);
  });
}

function openUserProfileModal() {
  const u = state.currentUser;
  if (!u) return;

  const avatar = document.getElementById('modalUserAvatar');
  const removeAvatarBtn = document.getElementById('removeProfileAvatarBtn');
  const name = document.getElementById('modalUserName');
  const email = document.getElementById('modalUserEmail');
  const role = document.getElementById('modalUserRole');
  const dept = document.getElementById('modalUserDept');
  const langSelect = document.getElementById('modalLangSelect');

  applyAvatarToElement(avatar, u);
  if (removeAvatarBtn) {
    removeAvatarBtn.style.display = u.avatar_url ? 'inline-flex' : 'none';
  }
  if (name) name.textContent = u.name;
  if (email) email.textContent = u.email;
  if (role) role.textContent = u.system_role === 'ADMIN' ? 'Sistem Yöneticisi (Admin)' : 'Personel';
  if (dept) dept.textContent = u.department || 'Genel';
  if (langSelect) langSelect.value = state.currentLang || u.language || 'tr';

  // Şifre alanlarını sıfırla
  const curPassEl = document.getElementById('profileCurrentPassword');
  const newPassEl = document.getElementById('profileNewPassword');
  const confPassEl = document.getElementById('profileConfirmPassword');
  const passMsgEl = document.getElementById('profilePasswordStatusMsg');
  if (curPassEl) curPassEl.value = '';
  if (newPassEl) newPassEl.value = '';
  if (confPassEl) confPassEl.value = '';
  if (passMsgEl) {
    passMsgEl.textContent = 'Kendi belirlediğiniz şifre anında güvenli olarak kaydedilir.';
    passMsgEl.style.color = 'var(--text-secondary)';
  }

  const currentTheme = getActiveTheme();
  document.querySelectorAll('#userProfileModal .theme-choice-card').forEach(card => {
    if (card.dataset.setTheme === currentTheme) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  document.getElementById('userProfileModal')?.classList.add('open');
}

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
  applyTheme(user.theme || getActiveTheme());

  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appContainer').style.display = 'flex';

  document.getElementById('userNameDisplay').textContent = user.name;
  applyAvatarToElement(document.getElementById('userAvatar'), user);
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

  // Rapor oluşturma yetki kontrolü
  const canBuildReports = user.system_role === 'ADMIN' || !!user.can_build_reports;
  const reportsNavBtn = document.getElementById('navReportsBuilderBtn');
  if (reportsNavBtn) {
    reportsNavBtn.style.display = canBuildReports ? 'flex' : 'none';
  }

  // Girişte arama filtrelerini temizle (tüm görevler eksiksiz gelsin)
  clearAllSearchFilters();

  loadInitialData();
}

function logout() {
  localStorage.clear();
  state.currentUser = null;
  state.token = null;
  state.tenant = null;
  state.currentProjectId = null;
  state.projects = [];
  state.tasks = [];
  state.dependencies = [];
  state.notifications = [];
  closeTaskDrawer();
  document.getElementById('notifDrawer')?.classList.remove('open');
  showLoginOverlay();
  showToast('Oturum kapatıldı.', 'info');
}

// ================= LOAD DATA =================
async function loadInitialData() {
  clearAllSearchFilters();
  await Promise.all([
    loadProjects(),
    loadPersonnel(),
    loadWorkflowCatalog(),
    loadAndRenderMicrosoftTodo(),
    triggerWorkerAndLoadNotifications(true)
  ]);

  // URL parametresinde task_id varsa otomatik olarak o görevin detay çekmecesini aç
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const targetTaskId = urlParams.get('task_id');
    if (targetTaskId) {
      setTimeout(async () => {
        await openTaskDrawer(targetTaskId);
      }, 350);
    }
  } catch (err) {
    console.warn('URL task_id parse uyarısı:', err);
  }
}

async function triggerWorkerAndLoadNotifications(silent = true) {
  try {
    await apiCall('/api/worker/run', 'POST');
  } catch (err) {
    // ignore background worker error
  }
  await loadNotifications();
  if (!silent) {
    showToast('🔄 Teslim ve gecikme taraması tamamlandı.', 'info');
  }
}

async function loadNotifications() {
  try {
    const rawNotifs = await apiCall('/api/notifications');
    // Tekilleştirme: Kullanıcıya aynı olayı hem IN_APP hem EMAIL hem WEB_PUSH olarak 3 kez göstermek yerine IN_APP kanalını al
    const inAppOnly = Array.isArray(rawNotifs) ? rawNotifs.filter(n => n.channel === 'IN_APP') : [];
    state.notifications = inAppOnly.length > 0 ? inAppOnly : (Array.isArray(rawNotifs) ? rawNotifs : []);
    renderNotifications();
  } catch (err) {
    state.notifications = [];
    renderNotifications();
  }
}

function renderNotifications() {
  const notifs = state.notifications || [];
  const unreadNotifs = notifs.filter(n => !n.is_read);
  const badge = document.getElementById('notifBadge');
  if (badge) {
    if (unreadNotifs.length > 0) {
      badge.textContent = String(unreadNotifs.length);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  const listEl = document.getElementById('notifList');
  if (!listEl) return;

  if (notifs.length === 0) {
    listEl.innerHTML = `
      <div style="padding:40px 20px; text-align:center; color:var(--text-tertiary);">
        <div style="font-size:2.5rem; margin-bottom:10px;">🎉</div>
        <strong style="color:var(--text-primary); display:block; margin-bottom:4px; font-size:1rem;">Yeni bildirim yok</strong>
        <span style="font-size:0.82rem; line-height:1.4; display:block;">Tüm görevler, teslim tarihleri ve bağımlılıklar kontrol altında.</span>
      </div>
    `;
    return;
  }

  const sorted = [...notifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  listEl.innerHTML = sorted.map(n => {
    const isUnread = !n.is_read;
    const icon = n.type === 'DELAY_EXPLANATION_REQUEST' || (n.title && n.title.includes('Gecik'))
      ? '⚠️'
      : (n.type === 'DEPENDENCY_UNBLOCKED' || (n.title && n.title.includes('Hazır')) ? '🔓' : (n.type === 'DUE_REMINDER_24H' || (n.title && n.title.includes('Hatırlat')) ? '⏰' : '🔔'));
    const typeClass = (n.type === 'DELAY_EXPLANATION_REQUEST' || (n.title && n.title.includes('Gecik'))) ? 'notif-danger' : (n.type === 'DEPENDENCY_UNBLOCKED' || (n.title && n.title.includes('Hazır')) ? 'notif-success' : 'notif-info');
    const timeStr = n.created_at ? formatDateTime(n.created_at) : '';
    return `
      <div class="notif-card-item ${typeClass} ${isUnread ? 'unread-item' : 'read-item'}" data-task-id="${n.link_task_id || ''}">
        <div class="notif-icon-col">${icon}</div>
        <div class="notif-body-col">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px;">
            <div class="notif-title" style="font-size:0.84rem; font-weight:700; color:var(--text-primary); line-height:1.3;">
              ${escapeHtml(n.title || 'Sistem Bildirimi')}
            </div>
            ${isUnread ? '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; margin-top:4px;" title="Yeni"></span>' : ''}
          </div>
          <div class="notif-msg" style="margin-top:4px;">${escapeHtml(n.message)}</div>
          <div class="notif-meta">
            <span>${timeStr}</span>
            ${n.link_task_id ? '<span class="notif-goto-link">Görevi Aç ➔</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.notif-card-item').forEach(item => {
    item.addEventListener('click', () => {
      const taskId = item.dataset.taskId;
      document.getElementById('notifDrawer')?.classList.remove('open');
      if (taskId) {
        openTaskDrawer(taskId);
      }
    });
  });
}

// Görevin tamamlanmamış kaç ardıl görevi beklettiğini hesapla (Kimi Bekletiyor?)
function getBlockingSuccessorSummary(task) {
  if (!task || task.work_status === 'COMPLETED') return { count: 0, titles: [] };

  // 1. Tam bağımlılık grafiğinden kontrol
  if (state.dependencies && state.dependencies.length > 0) {
    const succIds = state.dependencies
      .filter(d => d.predecessor_id === task.id)
      .map(d => d.successor_id);
    const activeSuccessors = succIds
      .map(sid => state.tasks.find(t => t.id === sid))
      .filter(st => st && st.work_status !== 'COMPLETED');
    if (activeSuccessors.length > 0) {
      return {
        count: activeSuccessors.length,
        titles: activeSuccessors.map(s => s.title)
      };
    }
  }

  // 2. Sınırlı bağımlılık özetinden kontrol (KAB02 kısıtlı görünüm için)
  if (task.limited_dependencies && task.limited_dependencies.length > 0) {
    const succs = task.limited_dependencies.filter(
      d => d.relation_type === 'SUCCESSOR' && d.work_status !== 'COMPLETED'
    );
    if (succs.length > 0) {
      return {
        count: succs.length,
        titles: succs.map(s => s.title)
      };
    }
  }

  return { count: 0, titles: [] };
}

async function loadProjects() {
  state.projects = await apiCall('/api/projects');
  document.getElementById('projectsCount').textContent = state.projects.length;

  const hasCurrent = state.projects.some(p => p.id === state.currentProjectId);
  if (state.projects.length > 0 && (!state.currentProjectId || !hasCurrent)) {
    state.currentProjectId = state.projects[0].id;
  } else if (state.projects.length === 0) {
    state.currentProjectId = null;
  }

  renderProjectSelector();
  renderProjectsGrid();

  if (state.currentProjectId) {
    await loadProjectTasks(state.currentProjectId);
  } else {
    await loadProjectTasks('');
  }
}

async function loadProjectTasks(projectId) {
  state.currentProjectId = projectId || null;
  const projectSelect = document.getElementById('projectSelect');
  if (projectSelect && projectId) projectSelect.value = projectId;

  let projTasks = [];
  let dependencies = [];
  if (projectId) {
    try {
      projTasks = await apiCall(`/api/projects/${projectId}/tasks`);
      dependencies = await apiCall(`/api/projects/${projectId}/dependencies`);
    } catch (err) {
      projTasks = [];
      dependencies = [];
    }
  }

  // Kullanıcının bireysel (projesiz) görevlerini de yükle
  let personalTasks = [];
  try {
    personalTasks = await apiCall('/api/tasks/personal');
  } catch (err) {
    personalTasks = [];
  }

  state.tasks = [...projTasks, ...personalTasks];
  state.dependencies = dependencies;

  // Tekstil Şablonunu Uygula Butonu Görünürlüğü (Yalnızca Proje Yetkilisi / Admin için)
  const textileBtn = document.getElementById('applyTextileTemplateBtn');
  if (textileBtn) {
    const currProj = state.projects.find(p => p.id === projectId);
    const u = state.currentUser;
    const isAdmin = u?.system_role === 'ADMIN';
    const canCreate = !!u?.can_create_project;
    const isManager = currProj?.created_by_user_id === u?.id || (currProj?.members || []).some(m => m.user_id === u?.id && m.role === 'PROJECT_MANAGER');
    textileBtn.style.display = (projectId && (isAdmin || canCreate || isManager)) ? 'inline-block' : 'none';
  }

  updateGlobalSearchUI();
  renderMyTasks();
  renderTimeline();
  renderBoard();
}

async function loadPersonnel() {
  state.personnelList = await apiCall('/api/users');
  renderPersonnelTable();
  if (state.tasks.length > 0) {
    updateGlobalSearchUI();
    renderMyTasks();
    renderTimeline();
    renderBoard();
  }
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
  } else if (state.activeFilter === 'personal') {
    filtered = filtered.filter(t => !t.project_id && t.assignee_id === state.currentUser?.id);
  } else if (state.activeFilter !== 'all') {
    filtered = filtered.filter(t => t.work_status === state.activeFilter);
  }

  // Arama Sorgusu (Başlık, Açıklama veya Atanan Personel)
  if (!state.searchQuery) {
    const taskInput = document.getElementById('taskSearchInput');
    if (taskInput && taskInput.value !== '') {
      taskInput.value = '';
    }
  } else {
    filtered = filtered.filter(t => matchesTaskQuery(t, state.searchQuery));
  }

  // Badge sayacı güncelle
  const myOwnTasks = state.tasks.filter(t => t.assignee_id === state.currentUser?.id);
  document.getElementById('myTasksCount').textContent = myOwnTasks.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-tertiary);">
        <span style="font-size:2rem;">🔍</span>
        <h4 style="margin-top:10px; color:var(--text-primary);">Arama veya filtre kriterine uygun görev bulunamadı.</h4>
        <p style="font-size:0.85rem; margin-top:4px;">Yeni görev ekleyebilir veya arama filtresini temizleyebilirsiniz.</p>
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

    // Bağımlılık uyarısı (Öncül bekleniyor mu? + Kimi bekletiyor?)
    const depBadges = [];
    if (task.limited_dependencies && task.limited_dependencies.length > 0) {
      const blocking = task.limited_dependencies.find(d => d.is_blocking);
      if (blocking) {
        depBadges.push(`<span class="task-dep-pill">⏳ Öncül: "${escapeHtml(blocking.title)}" tamamlanmalı</span>`);
      }
    }

    const blockingSucc = getBlockingSuccessorSummary(task);
    if (blockingSucc.count > 0) {
      const tooltip = `Bekleyen ardıl görevler: ${blockingSucc.titles.join(', ')}`;
      depBadges.push(`<span class="task-bottleneck-pill" title="${escapeHtml(tooltip)}">🔥 ${blockingSucc.count} Görevi Bekletiyor</span>`);
    }
    const depNote = depBadges.length > 0 ? `<div class="task-dep-badges-row">${depBadges.join('')}</div>` : '';

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
    const proj = task.project_id ? state.projects.find(p => p.id === task.project_id) : null;
    const projPill = proj
      ? `<span class="task-proj-pill" style="font-size:0.72rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:500;">📁 ${escapeHtml(proj.title)}</span>`
      : `<span class="task-personal-pill" style="font-size:0.72rem; background:#f3e8ff; color:#7e22ce; padding:2px 6px; border-radius:4px; font-weight:600;">📌 Kişisel To-Do</span>`;

    row.innerHTML = `
      <button class="task-check-btn ${isDone ? 'checked' : ''}" data-id="${task.id}" title="${isDone ? 'Tamamlandı' : 'Tamamla'}"></button>
      <div class="task-info-col">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>${typeLabel}</span>
          ${priorityDot}
          ${projPill}
          ${task.workflow_step ? `<span class="op-step-badge" style="font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700; color:#fff; background:${getStepColor(task.workflow_step)}; display:inline-block;">${escapeHtml(task.workflow_step)}</span>` : ''}
          <span class="task-main-title ${isDone ? 'done-title' : ''}">${task.title}</span>
        </div>
        ${depNote}
      </div>
      <div style="font-size:0.8rem; color:#94a3b8;">
        👤 ${assignee ? assignee.name : t('label_unassigned', 'Atanmamış')}
      </div>
      <div class="task-date-col ${isOverdue ? 'overdue' : ''}">
        📅 ${formatDate(task.current_due_date)} ${isOverdue ? `(${t('label_overdue', 'Gecikti')})` : ''}
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

    const rate = typeof p.completion_rate === 'number' ? p.completion_rate : 0;
    const totalTasks = typeof p.total_tasks === 'number' ? p.total_tasks : 0;
    const completedTasks = typeof p.completed_tasks === 'number' ? p.completed_tasks : 0;
    const delayedTasks = typeof p.delayed_tasks === 'number' ? p.delayed_tasks : 0;
    const isRevised = p.initial_due_date && p.current_due_date && p.initial_due_date.slice(0, 10) !== p.current_due_date.slice(0, 10);

    card.innerHTML = `
      <div class="proj-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <h4 class="proj-title">${escapeHtml(p.title)}</h4>
        <span class="nav-badge ${p.id === state.currentProjectId ? '' : 'neutral'}">
          ${p.id === state.currentProjectId ? t('label_active_project', 'Aktif Proje') : `%${rate}`}
        </span>
      </div>
      <p class="proj-desc">${escapeHtml(p.description || 'Açıklama belirtilmemiş.')}</p>
      
      <div class="proj-progress-box">
        <div class="proj-progress-meta">
          <span>${t('label_completion', 'Tamamlanma')}: <strong>%${rate}</strong> (${completedTasks}/${totalTasks} ${t('label_tasks', 'Görev')})</span>
          ${delayedTasks > 0 ? `<span class="proj-delayed-chip">⚠️ ${delayedTasks} ${t('label_overdue', 'Geciken')}</span>` : `<span style="color:#10b981; font-weight:600;">✓ ${t('label_on_track', 'Takvimde')}</span>`}
        </div>
        <div class="proj-track">
          <div class="proj-fill" style="width: ${rate}%;"></div>
        </div>
      </div>

      <div class="proj-dates-row">
        <span>📅 ${t('label_current', 'Güncel')}: ${formatDate(p.current_start_date)} → ${formatDate(p.current_due_date)}</span>
        ${isRevised ? `<span class="proj-revised-tag" title="${t('label_initial_plan', 'İlk Plan')}: ${formatDate(p.initial_start_date)} → ${formatDate(p.initial_due_date)}">🔄 ${t('label_revised', 'Revize Edildi')}</span>` : ''}
      </div>

      <div class="proj-card-actions" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:12px; padding-top:10px; border-top:1px solid var(--border-subtle);">
        <button type="button" class="action-btn secondary-btn sm-btn btn-open-project" data-id="${p.id}">
          📋 ${t('label_open_tasks', 'Görevleri Aç')}
        </button>
        ${p.is_manager ? `
          <button type="button" class="action-btn outline-btn sm-btn btn-manage-project" data-id="${p.id}">
            ⚙️ ${t('label_team_and_plan', 'Ekip & Plan')} ${p.pending_visibility_requests > 0 ? `<span class="nav-badge" style="margin-left:4px;">${p.pending_visibility_requests}</span>` : ''}
          </button>
        ` : (!p.is_full_viewer ? `
          <button type="button" class="action-btn outline-btn sm-btn btn-req-visibility" data-id="${p.id}">
            👁️ Tüm Projeyi Gör Talebi
          </button>
        ` : '')}
      </div>
    `;

    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-manage-project')) {
        e.stopPropagation();
        openProjectManageModal(p.id);
        return;
      }
      if (e.target.closest('.btn-req-visibility')) {
        e.stopPropagation();
        try {
          await apiCall(`/api/projects/${p.id}/visibility-request`, 'POST');
          showToast('👁️ Tam proje görünürlük talebiniz proje yöneticisine iletildi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }
      await loadProjectTasks(p.id);
      switchView('view-my-tasks');
    });

    container.appendChild(card);
  });
}

// 3. ZAMAN ÇİZELGESİ (GANTT TIMELINE) - OPENPROJECT MODELİ BÖLÜNMÜŞ (SPLIT) EKRAN & ÇOKLU ZOOM (GÜNLÜK, HAFTALIK, AYLIK, YILLIK)
let ganttFilterQuery = '';
let ganttListenersInitialized = false;
let ganttZoomLevel = 'day'; // 'day' | 'week' | 'month' | 'year'

function setupGanttInteractions() {
  if (ganttListenersInitialized) return;
  ganttListenersInitialized = true;

  // 1. Zoom Seviyesi Seçici (Günlük, Haftalık, Aylık, Yıllık)
  document.querySelectorAll('#ganttZoomGroup .zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoom = btn.dataset.zoom;
      if (zoom && zoom !== ganttZoomLevel) {
        ganttZoomLevel = zoom;
        document.querySelectorAll('#ganttZoomGroup .zoom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTimeline();
      }
    });
  });

  // 2. Arama Filtresi (Küresel arama ile senkronize & varsayılan boş)
  const searchInput = document.getElementById('ganttSearchInput');
  if (searchInput) {
    if (!state.searchQuery) {
      searchInput.value = '';
    }
    searchInput.addEventListener('input', (e) => {
      applyGlobalTaskSearch(e.target.value, 'ganttSearchInput');
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        applyGlobalTaskSearch('', '');
        searchInput.blur();
      }
    });
  }

  // 3. Bugün Butonu
  const todayBtn = document.getElementById('ganttTodayBtn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const chartPane = document.getElementById('opGanttChartPane');
      const todayLine = chartPane?.querySelector('.gantt-today-line');
      if (todayLine && chartPane) {
        const left = todayLine.offsetLeft - (chartPane.clientWidth / 2);
        chartPane.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      } else {
        const todayEl = chartPane?.querySelector('.gantt-day-col.today');
        if (todayEl && chartPane) {
          const left = todayEl.offsetLeft - (chartPane.clientWidth / 2);
          chartPane.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
      }
    });
  }

  // 4. Sol Tabloyu Gizle / Göster Butonu
  const toggleBtn = document.getElementById('ganttToggleTableBtn');
  const toggleLabel = document.getElementById('ganttToggleTableLabel');
  const wrapper = document.getElementById('opGanttWrapper');
  if (toggleBtn && wrapper) {
    toggleBtn.addEventListener('click', () => {
      wrapper.classList.toggle('table-collapsed');
      const isCollapsed = wrapper.classList.contains('table-collapsed');
      if (toggleLabel) {
        toggleLabel.textContent = isCollapsed ? (I18N[currentLang]?.zoom_day ? 'Tabloyu Göster' : 'Tabloyu Göster') : 'Tabloyu Gizle';
      }
      setTimeout(() => {
        const svg = document.getElementById('ganttSvgOverlay');
        const container = document.getElementById('ganttRowsContainer');
        if (svg && container) drawDependencyArrows(svg, container);
      }, 250);
    });
  }

  // 5. Splitter Boyutlandırma (Drag-to-resize)
  const splitter = document.getElementById('opGanttSplitter');
  const tablePane = document.getElementById('opGanttTablePane');
  if (splitter && tablePane && wrapper) {
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    splitter.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = tablePane.offsetWidth;
      splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const newWidth = Math.min(750, Math.max(260, startWidth + deltaX));
      tablePane.style.width = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        splitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const svg = document.getElementById('ganttSvgOverlay');
        const container = document.getElementById('ganttRowsContainer');
        if (svg && container) drawDependencyArrows(svg, container);
      }
    });
  }
}

// Zaman Ölçeği Hesaplayıcı (Günlük, Haftalık, Aylık, Yıllık)
function calculateGanttScale(minTime, maxTime, zoomLevel) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const monthNamesByLang = {
    tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  };
  const monthShortNamesByLang = {
    tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  };
  const dayNamesShortByLang = {
    tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  };
  const monthNamesTR = monthNamesByLang[currentLang] || monthNamesByLang['tr'];
  const monthShortNamesTR = monthShortNamesByLang[currentLang] || monthShortNamesByLang['tr'];
  const dayNamesShortTR = dayNamesShortByLang[currentLang] || dayNamesShortByLang['tr'];
  const now = new Date();
  const todayTime = now.getTime();

  let timelineWidth = 0;
  let topHeaderHtml = '';
  let subHeaderHtml = '';
  let gridLinesHtml = '';
  let todayOffsetPx = -1;
  let dateToPx = (time) => 0;

  if (zoomLevel === 'day') {
    // 1. GÜNLÜK GÖRÜNÜM
    const COL_WIDTH = 44;
    const startDate = new Date(minTime);
    startDate.setDate(startDate.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(maxTime);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(0, 0, 0, 0);

    const totalDays = Math.max(16, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
    timelineWidth = totalDays * COL_WIDTH;

    const days = [];
    const monthSpans = [];
    let currentMonthName = '';
    let currentMonthSpan = 0;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate.getTime() + i * MS_PER_DAY);
      const dayNum = d.getDate();
      const dayOfWeek = d.getDay();
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const mName = `${monthNamesTR[monthIndex]} ${year}`;
      const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = dateKey === todayStr;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isToday) {
        todayOffsetPx = i * COL_WIDTH + (COL_WIDTH / 2);
      }

      days.push({ dayNum, dayName: dayNamesShortTR[dayOfWeek], isToday, isWeekend, date: d });

      if (mName !== currentMonthName) {
        if (currentMonthName) monthSpans.push({ name: currentMonthName, count: currentMonthSpan });
        currentMonthName = mName;
        currentMonthSpan = 1;
      } else {
        currentMonthSpan++;
      }
    }
    if (currentMonthSpan > 0) monthSpans.push({ name: currentMonthName, count: currentMonthSpan });

    topHeaderHtml = monthSpans.map(m => `
      <div class="gantt-month-header" style="width: ${m.count * COL_WIDTH}px;">${m.name}</div>
    `).join('');

    subHeaderHtml = days.map(d => `
      <div class="gantt-day-col ${d.isWeekend ? 'weekend' : ''} ${d.isToday ? 'today' : ''}" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;" title="${formatDateTR(d.date)}">
        <span>${d.dayNum}</span>
        <span class="day-dow">${d.dayName}</span>
      </div>
    `).join('');

    gridLinesHtml = days.map(d => `
      <div class="gantt-grid-line ${d.isWeekend ? 'weekend' : ''}" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;"></div>
    `).join('');

    dateToPx = (time) => {
      const offsetDays = (time - startDate.getTime()) / MS_PER_DAY;
      return offsetDays * COL_WIDTH;
    };
  } else if (zoomLevel === 'week') {
    // 2. HAFTALIK GÖRÜNÜM
    const COL_WIDTH = 68;
    const MS_PER_WEEK = 7 * MS_PER_DAY;

    const startDate = new Date(minTime);
    const day = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - day - 7);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(maxTime);
    const dayEnd = (endDate.getDay() + 6) % 7;
    endDate.setDate(endDate.getDate() + (6 - dayEnd) + 14);
    endDate.setHours(23, 59, 59, 999);

    const totalWeeks = Math.max(8, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_WEEK));
    timelineWidth = totalWeeks * COL_WIDTH;

    const weeks = [];
    const monthSpans = [];
    let currentMonthName = '';
    let currentMonthSpan = 0;

    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(startDate.getTime() + w * MS_PER_WEEK);
      const wEnd = new Date(wStart.getTime() + 6 * MS_PER_DAY);
      const midWeek = new Date(wStart.getTime() + 3 * MS_PER_DAY);
      const mName = `${monthNamesTR[midWeek.getMonth()]} ${midWeek.getFullYear()}`;
      const isCurrentWeek = todayTime >= wStart.getTime() && todayTime <= wEnd.getTime();
      const weekLabel = `${wStart.getDate()}-${wEnd.getDate()} ${monthShortNamesTR[wEnd.getMonth()]}`;

      weeks.push({ weekLabel, isCurrentWeek, wStart, wEnd });

      if (mName !== currentMonthName) {
        if (currentMonthName) monthSpans.push({ name: currentMonthName, count: currentMonthSpan });
        currentMonthName = mName;
        currentMonthSpan = 1;
      } else {
        currentMonthSpan++;
      }
    }
    if (currentMonthSpan > 0) monthSpans.push({ name: currentMonthName, count: currentMonthSpan });

    topHeaderHtml = monthSpans.map(m => `
      <div class="gantt-month-header" style="width: ${m.count * COL_WIDTH}px;">${m.name}</div>
    `).join('');

    subHeaderHtml = weeks.map(w => `
      <div class="gantt-day-col ${w.isCurrentWeek ? 'today' : ''}" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px; font-size:0.68rem;" title="${formatDateTR(w.wStart)} - ${formatDateTR(w.wEnd)}">
        <span>${w.weekLabel}</span>
      </div>
    `).join('');

    gridLinesHtml = weeks.map(() => `
      <div class="gantt-grid-line" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;"></div>
    `).join('');

    dateToPx = (time) => {
      const offsetWeeks = (time - startDate.getTime()) / MS_PER_WEEK;
      return offsetWeeks * COL_WIDTH;
    };

    if (todayTime >= startDate.getTime() && todayTime <= endDate.getTime()) {
      todayOffsetPx = dateToPx(todayTime);
    }
  } else if (zoomLevel === 'month') {
    // 3. AYLIK GÖRÜNÜM
    const COL_WIDTH = 84;
    const startD = new Date(minTime);
    startD.setMonth(startD.getMonth() - 1);
    startD.setDate(1);
    startD.setHours(0, 0, 0, 0);

    const endD = new Date(maxTime);
    endD.setMonth(endD.getMonth() + 3);
    endD.setDate(0);
    endD.setHours(23, 59, 59, 999);

    const startYear = startD.getFullYear();
    const startMonth = startD.getMonth();
    const endYear = endD.getFullYear();
    const endMonth = endD.getMonth();

    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    timelineWidth = Math.max(totalMonths, 8) * COL_WIDTH;

    const months = [];
    const yearSpans = [];
    let currentYearName = '';
    let currentYearSpan = 0;

    for (let m = 0; m < totalMonths; m++) {
      const curYear = startYear + Math.floor((startMonth + m) / 12);
      const curMonthIdx = (startMonth + m) % 12;
      const yName = `${curYear}`;
      const isCurMonth = now.getFullYear() === curYear && now.getMonth() === curMonthIdx;

      months.push({
        name: monthShortNamesTR[curMonthIdx],
        year: curYear,
        monthIdx: curMonthIdx,
        isCurMonth
      });

      if (yName !== currentYearName) {
        if (currentYearName) yearSpans.push({ name: currentYearName, count: currentYearSpan });
        currentYearName = yName;
        currentYearSpan = 1;
      } else {
        currentYearSpan++;
      }
    }
    if (currentYearSpan > 0) yearSpans.push({ name: currentYearName, count: currentYearSpan });

    topHeaderHtml = yearSpans.map(y => `
      <div class="gantt-month-header" style="width: ${y.count * COL_WIDTH}px;">${y.name} Yılı</div>
    `).join('');

    subHeaderHtml = months.map(m => `
      <div class="gantt-day-col ${m.isCurMonth ? 'today' : ''}" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;" title="${m.name} ${m.year}">
        <span style="font-weight:600;">${m.name}</span>
      </div>
    `).join('');

    gridLinesHtml = months.map(() => `
      <div class="gantt-grid-line" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;"></div>
    `).join('');

    dateToPx = (time) => {
      const d = new Date(time);
      const mIdx = (d.getFullYear() - startYear) * 12 + (d.getMonth() - startMonth);
      const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const frac = Math.min(1, Math.max(0, (d.getDate() - 1) / daysInM));
      return (mIdx + frac) * COL_WIDTH;
    };

    if (todayTime >= startD.getTime() && todayTime <= endD.getTime()) {
      todayOffsetPx = dateToPx(todayTime);
    }
  } else if (zoomLevel === 'year') {
    // 4. YILLIK GÖRÜNÜM (Çeyrekler Q1..Q4)
    const COL_WIDTH = 76;
    const minD = new Date(minTime);
    const maxD = new Date(maxTime);

    const startYear = minD.getFullYear() - 1;
    const endYear = maxD.getFullYear() + 1;
    const totalYears = (endYear - startYear) + 1;
    const totalQuarters = totalYears * 4;
    timelineWidth = totalQuarters * COL_WIDTH;

    const quarters = [];
    const yearSpans = [];

    const quarterNamesTR = ['Ç1 (Oca-Mar)', 'Ç2 (Nis-Haz)', 'Ç3 (Tem-Eyl)', 'Ç4 (Eki-Ara)'];
    const quarterLabelsTR = ['Ç1', 'Ç2', 'Ç3', 'Ç4'];

    for (let y = 0; y < totalYears; y++) {
      const year = startYear + y;
      yearSpans.push({ name: `${year}`, count: 4 });

      for (let q = 0; q < 4; q++) {
        const isCurrentQ = now.getFullYear() === year && Math.floor(now.getMonth() / 3) === q;
        quarters.push({
          label: quarterLabelsTR[q],
          fullName: `${quarterNamesTR[q]} ${year}`,
          isCurrentQ,
          year,
          quarter: q
        });
      }
    }

    topHeaderHtml = yearSpans.map(y => `
      <div class="gantt-month-header" style="width: ${y.count * COL_WIDTH}px;">${y.name} Yılı</div>
    `).join('');

    subHeaderHtml = quarters.map(q => `
      <div class="gantt-day-col ${q.isCurrentQ ? 'today' : ''}" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;" title="${q.fullName}">
        <span style="font-weight:700;">${q.label}</span>
      </div>
    `).join('');

    gridLinesHtml = quarters.map(() => `
      <div class="gantt-grid-line" style="width:${COL_WIDTH}px; min-width:${COL_WIDTH}px;"></div>
    `).join('');

    dateToPx = (time) => {
      const d = new Date(time);
      const qIdx = (d.getFullYear() - startYear) * 4 + Math.floor(d.getMonth() / 3);
      const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
      const qStartDate = new Date(d.getFullYear(), qStartMonth, 1).getTime();
      const qEndDate = new Date(d.getFullYear(), qStartMonth + 3, 0, 23, 59, 59).getTime();
      const frac = Math.min(1, Math.max(0, (time - qStartDate) / (qEndDate - qStartDate)));
      return (qIdx + frac) * COL_WIDTH;
    };

    const startYearTime = new Date(startYear, 0, 1).getTime();
    const endYearTime = new Date(endYear, 11, 31, 23, 59, 59).getTime();
    if (todayTime >= startYearTime && todayTime <= endYearTime) {
      todayOffsetPx = dateToPx(todayTime);
    }
  }

  return {
    timelineWidth,
    topHeaderHtml,
    subHeaderHtml,
    gridLinesHtml,
    todayOffsetPx,
    dateToPx,
    colWidth: (zoomLevel === 'day' ? 44 : (zoomLevel === 'week' ? 68 : (zoomLevel === 'month' ? 84 : 76)))
  };
}

// ================= GANTT CANLI DETAY HOVER ÖNİZLEME POPUP =================
function showGanttTaskHoverPopup(task, targetElement) {
  const popup = document.getElementById('ganttTaskHoverPopup');
  if (!popup || !task || !targetElement) return;

  const project = task.project_id ? state.projects.find(p => p.id === task.project_id) : null;
  const assignee = task.assignee_id ? state.personnelList.find(p => p.id === task.assignee_id) : null;

  // Görevi Atayan Personel ve Atama Zamanı Çözümleme
  let assignerName = task.assigned_by_name;
  if (!assignerName && task.assigned_by_user_id) {
    const u = state.personnelList.find(p => p.id === task.assigned_by_user_id);
    if (u) assignerName = u.name;
  }
  if (!assignerName && project?.created_by_user_id) {
    const creator = state.personnelList.find(p => p.id === project.created_by_user_id);
    if (creator) assignerName = creator.name;
  }
  if (!assignerName) {
    assignerName = task.project_id ? 'Proje Yetkilisi' : 'Sistem';
  }

  const assignedAtRaw = task.assigned_at || task.created_at;
  const assignedAtFormatted = assignedAtRaw ? formatDateTimeTR(assignedAtRaw) : '-';

  const prog = task.work_status === 'COMPLETED' ? 100 : (task.progress || 0);

  const statusText = {
    BLOCKED: 'Öncül Bekliyor',
    READY: 'Başlamaya Hazır',
    IN_PROGRESS: 'Devam Ediyor',
    COMPLETED: 'Tamamlandı'
  }[task.work_status] || task.work_status;

  const statusColor = {
    BLOCKED: '#dc2626',
    READY: '#2563eb',
    IN_PROGRESS: '#d97706',
    COMPLETED: '#059669'
  }[task.work_status] || '#64748b';

  const isOverdue = task.work_status !== 'COMPLETED' && new Date(task.current_due_date) < new Date();
  const stepColor = task.workflow_step ? getStepColor(task.workflow_step) : '#8b5cf6';
  const blockingSucc = getBlockingSuccessorSummary(task);

  const startFormatted = task.current_start_date ? formatDateTR(task.current_start_date) : '-';
  const dueFormatted = task.current_due_date ? formatDateTR(task.current_due_date) : '-';

  popup.innerHTML = `
    <div class="gh-header-row">
      <div class="gh-tags">
        ${task.workflow_step ? `<span class="gh-step-badge" style="background:${stepColor};">🏷️ ${escapeHtml(task.workflow_step)}</span>` : ''}
        <span class="gh-id-badge">#${task.id.slice(0, 6)}</span>
      </div>
      <span style="font-size:0.72rem; font-weight:700; color:${statusColor}; background:${statusColor}18; padding:2px 7px; border-radius:12px;">
        ${statusText}
      </span>
    </div>

    <div class="gh-title">${escapeHtml(task.title)}</div>

    <div class="gh-progress-box">
      <div class="gh-progress-header">
        <span>İlerleme Oranı</span>
        <strong style="color:${prog === 100 ? '#059669' : '#2563eb'};">%${prog}</strong>
      </div>
      <div class="gh-progress-track">
        <div class="gh-progress-fill ${prog === 100 ? 'done' : ''}" style="width:${prog}%;"></div>
      </div>
    </div>

    <div class="gh-meta-grid">
      <div class="gh-meta-item">
        <span class="gh-meta-lbl">📁 Proje</span>
        <span class="gh-meta-val" title="${escapeHtml(project?.title || 'Bireysel Takip')}">${escapeHtml(project?.title || 'Bireysel Takip')}</span>
      </div>
      <div class="gh-meta-item">
        <span class="gh-meta-lbl">👤 Görev Sahibi</span>
        <span class="gh-meta-val" title="${escapeHtml(assignee ? `${assignee.name} (${assignee.department || 'Genel'})` : 'Atanmamış')}">
          ${escapeHtml(assignee ? `${assignee.name}` : 'Atanmamış')}
        </span>
      </div>
      <div class="gh-meta-item">
        <span class="gh-meta-lbl">🎯 Görevi Atayan</span>
        <span class="gh-meta-val" style="color:#2563eb; font-weight:700;" title="${escapeHtml(assignerName)}">${escapeHtml(assignerName)}</span>
      </div>
      <div class="gh-meta-item">
        <span class="gh-meta-lbl">⏰ Atama Zamanı</span>
        <span class="gh-meta-val" style="color:var(--text-primary); font-weight:600;" title="${assignedAtFormatted}">${assignedAtFormatted}</span>
      </div>
      <div class="gh-meta-item">
        <span class="gh-meta-lbl">📅 Zaman Planı</span>
        <span class="gh-meta-val ${isOverdue ? 'style="color:#dc2626;"' : ''}">${startFormatted} → ${dueFormatted}</span>
      </div>
      ${blockingSucc.count > 0 ? `
        <div class="gh-meta-item">
          <span class="gh-meta-lbl" style="color:#d97706;">🔥 Bekletilen Ardıllar</span>
          <span class="gh-meta-val" style="color:#d97706;" title="${escapeHtml(blockingSucc.titles.join(', '))}">
            ${blockingSucc.count} Görevi Bekletiyor
          </span>
        </div>
      ` : ''}
    </div>

    ${task.description ? `
      <div class="gh-desc-box" title="${escapeHtml(task.description)}">
        💬 ${escapeHtml(task.description)}
      </div>
    ` : ''}

    <div class="gh-footer-hint" style="justify-content: flex-end;">
      <span>${task.priority === 'HIGH' ? '🔥 Yüksek Öncelik' : 'Normal'}</span>
    </div>
  `;

  popup.style.display = 'block';

  const rect = targetElement.getBoundingClientRect();
  const popupWidth = 330;
  const popupHeight = popup.offsetHeight || 260;

  let left = rect.right + 12;
  if (left + popupWidth > window.innerWidth - 12) {
    left = rect.left - popupWidth - 12;
  }
  if (left < 12) left = 12;

  let top = rect.top + (rect.height / 2) - (popupHeight / 2);
  if (top + popupHeight > window.innerHeight - 12) {
    top = window.innerHeight - popupHeight - 12;
  }
  if (top < 12) top = 12;

  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;

  requestAnimationFrame(() => {
    popup.classList.add('visible');
  });
}

function hideGanttTaskHoverPopup() {
  const popup = document.getElementById('ganttTaskHoverPopup');
  if (!popup) return;
  popup.classList.remove('visible');
  setTimeout(() => {
    if (!popup.classList.contains('visible')) {
      popup.style.display = 'none';
    }
  }, 100);
}

function renderTimeline() {
  setupGanttInteractions();

  // Aktif Zoom Butonu Durumunu Güncelle
  document.querySelectorAll('#ganttZoomGroup .zoom-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.zoom === ganttZoomLevel);
  });

  const chartContainer = document.getElementById('timelineChart');
  const tableBody = document.getElementById('opGanttTableBody');
  const chartPane = document.getElementById('opGanttChartPane');

  if (!chartContainer || !tableBody) return;

  chartContainer.innerHTML = '';
  tableBody.innerHTML = '';

  const activeProj = state.projects.find(p => p.id === state.currentProjectId);
  const titleEl = document.getElementById('timelineProjectName');
  if (titleEl) {
    titleEl.textContent = activeProj ? activeProj.title : 'Proje Çizelgesi';
  }

  // Arama / Filtreleme (Başlık, Açıklama veya Sorumlu Personel)
  // Kullanıcı özellikle bir şey aramadıysa kutunun kesinlikle boş ve tüm görevlerin görünür olmasını sağla
  if (!state.searchQuery) {
    const ganttInput = document.getElementById('ganttSearchInput');
    if (ganttInput && ganttInput.value !== '') {
      ganttInput.value = '';
    }
    ganttFilterQuery = '';
  }
  const activeGanttQuery = state.searchQuery || ganttFilterQuery;
  const tasksToRender = state.tasks.filter(t => {
    // Kişisel görevler şirket gantt takvimine karışmaz, yalnızca seçili projeye ait görevler çizilir
    if (t.project_id !== state.currentProjectId) return false;
    if (!activeGanttQuery) return true;
    return matchesTaskQuery(t, activeGanttQuery);
  });

  if (tasksToRender.length === 0) {
    tableBody.innerHTML = '<div style="padding:24px; color:#64748b; font-size:0.85rem; text-align:center;">Kayıtlı veya filtreyle eşleşen görev yok.</div>';
    chartContainer.innerHTML = '<div style="padding:24px; color:#64748b; font-size:0.85rem; text-align:center;">Zaman çizelgesinde gösterilecek görev yok.</div>';
    return;
  }

  // 1. Tarih Aralığı Hesaplama (Gün sonları tam dahil edilir)
  let minTime = Infinity;
  let maxTime = -Infinity;

  tasksToRender.forEach(t => {
    const s = new Date(t.current_start_date);
    const d = new Date(t.current_due_date);
    const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0).getTime();
    const dDayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
    if (sDay < minTime) minTime = sDay;
    if (dDayEnd > maxTime) maxTime = dDayEnd;
  });

  if (minTime === Infinity) {
    minTime = Date.now();
    maxTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }

  // 2. Çoklu Zoom Seviyesine Göre Ölçek ve Başlıklar
  const scale = calculateGanttScale(minTime, maxTime, ganttZoomLevel);

  // 3. SOL PANELİ DOLDUR (İş Paketi Tablosu)
  tasksToRender.forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'g-table-row';
    row.dataset.id = t.id;

    const shortId = idx + 1;
    const typeIcon = t.type === 'MILESTONE' ? '🏁' : (t.type === 'BUG' ? '🐞' : '📌');
    const prog = t.work_status === 'COMPLETED' ? 100 : (t.progress || 0);

    const statusText = {
      BLOCKED: 'Öncül Bekliyor',
      READY: 'Başlamaya Hazır',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı'
    }[t.work_status] || t.work_status;

    const chipClass = {
      BLOCKED: 'chip-blocked',
      READY: 'chip-ready',
      IN_PROGRESS: 'chip-progress',
      COMPLETED: 'chip-done'
    }[t.work_status] || 'chip-ready';

    // Atanan Kişi
    const assignee = state.personnelList.find(p => p.id === t.assignee_id);
    const assigneeInitials = assignee ? assignee.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
    const assigneeName = assignee ? assignee.name : 'Atanmadı';

    row.innerHTML = `
      <div class="g-col g-col-id">#${shortId}</div>
      <div class="g-col g-col-title">
        <span class="g-type-icon">${typeIcon}</span>
        ${t.workflow_step ? `<span class="op-step-badge" style="font-size:0.68rem; padding:1px 5px; border-radius:3px; font-weight:700; color:#fff; background:${getStepColor(t.workflow_step)}; margin-right:4px;">${escapeHtml(t.workflow_step)}</span>` : ''}
        <span class="g-title-text">${t.title}</span>
        <span class="g-progress-pill">${prog}%</span>
      </div>
      <div class="g-col g-col-status">
        <span class="g-status-chip ${chipClass}">${statusText}</span>
      </div>
      <div class="g-col g-col-assignee" title="${assigneeName}">
        <div class="g-assignee-info">
          <div class="g-assignee-avatar">${assigneeInitials}</div>
          <span class="g-assignee-name">${assigneeName}</span>
        </div>
      </div>
      <div class="g-col g-col-dates">
        ${formatDate(t.current_start_date)} - ${formatDate(t.current_due_date)}
      </div>
    `;

    const titleCol = row.querySelector('.g-col-title');
    if (titleCol) {
      titleCol.addEventListener('mouseenter', () => showGanttTaskHoverPopup(t, titleCol));
      titleCol.addEventListener('mouseleave', () => hideGanttTaskHoverPopup());
    }

    // Tıklanınca görev çekmecesini aç
    row.addEventListener('click', () => openTaskDrawer(t.id));

    // Senkronize Hover
    row.addEventListener('mouseenter', () => {
      row.classList.add('row-highlighted');
      const track = document.getElementById(`gantt-track-${t.id}`);
      if (track) track.classList.add('row-highlighted');
    });
    row.addEventListener('mouseleave', () => {
      row.classList.remove('row-highlighted');
      const track = document.getElementById(`gantt-track-${t.id}`);
      if (track) track.classList.remove('row-highlighted');
    });

    tableBody.appendChild(row);
  });

  // 4. SAĞ PANELİ DOLDUR (Zaman Çizelgesi Izgarası ve Çubukları)
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'timeline-scroll-wrap';
  scrollWrap.style.width = `${scale.timelineWidth}px`;

  // Üst Başlık (Aylar/Yıllar + Günler/Haftalar/Aylar/Çeyrekler)
  const header = document.createElement('div');
  header.className = 'gantt-grid-header';
  header.style.width = `${scale.timelineWidth}px`;

  // Üst Takvim Şeridi
  const topRow = document.createElement('div');
  topRow.className = 'gantt-months-track';
  topRow.innerHTML = scale.topHeaderHtml;

  // Alt Takvim Şeridi
  const subRow = document.createElement('div');
  subRow.className = 'gantt-days-track';
  subRow.innerHTML = scale.subHeaderHtml;

  header.appendChild(topRow);
  header.appendChild(subRow);
  scrollWrap.appendChild(header);

  // Görev Satırları ve Izgara Gövdesi
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'gantt-rows-container';
  rowsContainer.id = 'ganttRowsContainer';
  rowsContainer.style.width = `${scale.timelineWidth}px`;

  // Arka Plan Dikey Izgara Çizgileri
  const gridLines = document.createElement('div');
  gridLines.className = 'gantt-grid-lines';
  gridLines.style.width = `${scale.timelineWidth}px`;
  gridLines.innerHTML = scale.gridLinesHtml;
  rowsContainer.appendChild(gridLines);

  // Dikey 'Bugün' Çizgisi
  if (scale.todayOffsetPx >= 0) {
    const todayLine = document.createElement('div');
    todayLine.className = 'gantt-today-line';
    todayLine.style.left = `${scale.todayOffsetPx}px`;
    todayLine.innerHTML = `<span class="gantt-today-badge">Bugün</span>`;
    rowsContainer.appendChild(todayLine);
  }

  // SVG Bağlantı Çizgileri Katmanı
  const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('class', 'gantt-svg-overlay');
  svgOverlay.setAttribute('id', 'ganttSvgOverlay');
  svgOverlay.setAttribute('width', scale.timelineWidth);
  svgOverlay.setAttribute('height', '100%');
  svgOverlay.innerHTML = `
    <defs>
      <marker id="gantt-arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
      </marker>
    </defs>
  `;
  rowsContainer.appendChild(svgOverlay);

  // Her görev için bir satır (tam 48px yükseklikte)
  tasksToRender.forEach((t) => {
    const track = document.createElement('div');
    track.className = 'gantt-row-track';
    track.id = `gantt-track-${t.id}`;
    track.dataset.id = t.id;
    track.style.width = `${scale.timelineWidth}px`;

    const s = new Date(t.current_start_date);
    const d = new Date(t.current_due_date);
    const tStart = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0).getTime();
    // Bitiş tarihi günün tamamını kapsayacak şekilde (bir sonraki günün 00:00:00'ına kadar) hesaplanır
    const tDueEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();

    const leftPx = Math.round(scale.dateToPx(tStart));
    const rightPx = Math.round(scale.dateToPx(tDueEnd));

    // Çubuğun genişliği takvimdeki tarih aralığını (bitiş gününün sonuna kadar tam) kapsar
    const colWidth = scale.colWidth || 44;
    const widthPx = Math.max(colWidth, rightPx - leftPx);

    const barClass = {
      BLOCKED: 'bar-blocked',
      READY: 'bar-ready',
      IN_PROGRESS: 'bar-progress',
      COMPLETED: 'bar-done'
    }[t.work_status] || 'bar-ready';

    const prog = t.work_status === 'COMPLETED' ? 100 : (t.progress || 0);

    // KİLOMETRE TAŞI MI YOKSA NORMAL GÖREV Mİ?
    if (t.type === 'MILESTONE') {
      const mLeftPx = Math.round(scale.dateToPx(tStart + 12 * 60 * 60 * 1000));

      const marker = document.createElement('div');
      marker.className = `gantt-milestone-marker ${t.work_status === 'COMPLETED' ? 'done' : ''}`;
      marker.id = `gantt-bar-${t.id}`;
      marker.style.left = `${mLeftPx}px`;
      marker.dataset.id = t.id;

      marker.innerHTML = `
        <div class="milestone-diamond" title="Kilometre Taşı: ${t.title}"></div>
        <span class="milestone-label">${t.title} (${formatDateTR(t.current_due_date)})</span>
      `;
      marker.addEventListener('click', () => openTaskDrawer(t.id));
      marker.addEventListener('mouseenter', () => showGanttTaskHoverPopup(t, marker));
      marker.addEventListener('mouseleave', () => hideGanttTaskHoverPopup());
      track.appendChild(marker);
    } else {
      // Normal Görev Barı (2 Satırlı, İş Adımı Etiketli ve Dinamik Font Boyutlandırmalı)
      const pill = document.createElement('div');
      pill.className = `gantt-pill-bar ${barClass}`;
      pill.id = `gantt-bar-${t.id}`;
      pill.style.left = `${leftPx}px`;
      pill.style.width = `${widthPx}px`;
      pill.dataset.id = t.id;

      const typeIcon = t.type === 'BUG' ? '🐞' : '📌';
      const stepColor = t.workflow_step ? getStepColor(t.workflow_step) : '#8b5cf6';

      // Dinamik Font Boyutlandırma (Metin uzunluğuna göre küçültme)
      const combinedLength = (t.workflow_step ? t.workflow_step.length + 3 : 0) + (t.title ? t.title.length : 0);
      let fontClass = '';
      if (combinedLength > 36) {
        fontClass = 'font-compact-xs';
      } else if (combinedLength > 22) {
        fontClass = 'font-compact-sm';
      }

      pill.innerHTML = `
        <div class="pill-progress-fill" style="width: ${prog}%;"></div>
        <div class="pill-content-col">
          <div class="pill-row-top">
            <span class="pill-icon">${typeIcon}</span>
            ${t.workflow_step ? `<span class="pill-step-tag" style="background:${stepColor};">${escapeHtml(t.workflow_step)}</span>` : ''}
            <span class="pill-title ${fontClass}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
          </div>
          <div class="pill-row-bottom">
            <span class="pill-progress">${prog}%</span>
            <span class="pill-dates">📅 ${formatDate(t.current_start_date)} - ${formatDate(t.current_due_date)}</span>
          </div>
        </div>
      `;

      pill.addEventListener('click', () => openTaskDrawer(t.id));
      pill.addEventListener('mouseenter', () => showGanttTaskHoverPopup(t, pill));
      pill.addEventListener('mouseleave', () => hideGanttTaskHoverPopup());
      track.appendChild(pill);
    }

    // Senkronize Hover
    track.addEventListener('mouseenter', () => {
      track.classList.add('row-highlighted');
      const row = tableBody.querySelector(`.g-table-row[data-id="${t.id}"]`);
      if (row) row.classList.add('row-highlighted');
    });
    track.addEventListener('mouseleave', () => {
      track.classList.remove('row-highlighted');
      const row = tableBody.querySelector(`.g-table-row[data-id="${t.id}"]`);
      if (row) row.classList.remove('row-highlighted');
    });

    rowsContainer.appendChild(track);
  });

  scrollWrap.appendChild(rowsContainer);
  chartContainer.appendChild(scrollWrap);

  // 5. ÇİFT TARAFLI DİKEY KAYDIRMA SENKRONİZASYONU (Vertical Scroll Sync)
  let isSyncing = false;
  tableBody.onscroll = () => {
    hideGanttTaskHoverPopup();
    if (!isSyncing && chartPane) {
      isSyncing = true;
      chartPane.scrollTop = tableBody.scrollTop;
      requestAnimationFrame(() => { isSyncing = false; });
    }
  };
  chartPane.onscroll = () => {
    hideGanttTaskHoverPopup();
    if (!isSyncing && tableBody) {
      isSyncing = true;
      tableBody.scrollTop = chartPane.scrollTop;
      requestAnimationFrame(() => { isSyncing = false; });
    }
  };

  // 6. Bağımlılık Oklarını Çiz (SVG Overlay)
  setTimeout(() => {
    drawDependencyArrows(svgOverlay, rowsContainer);
  }, 60);

  // İlk açılışta bugüne hafif odaklan
  if (scale.todayOffsetPx > 200) {
    setTimeout(() => {
      chartPane.scrollLeft = Math.max(0, scale.todayOffsetPx - (chartPane.clientWidth / 2) + 20);
    }, 120);
  }
}

function drawDependencyArrows(svg, container) {
  if (!svg || !container) return;

  // Önceki çizgileri temizle (defs hariç)
  const oldElements = svg.querySelectorAll('circle, path:not([marker-id])');
  oldElements.forEach(el => el.remove());

  state.dependencies.forEach(dep => {
    const predEl = document.getElementById(`gantt-bar-${dep.predecessor_id}`);
    const succEl = document.getElementById(`gantt-bar-${dep.successor_id}`);

    if (predEl && succEl) {
      const predTrack = predEl.closest('.gantt-row-track');
      const succTrack = succEl.closest('.gantt-row-track');
      if (!predTrack || !succTrack) return;

      const x1 = predEl.offsetLeft + predEl.offsetWidth;
      const y1 = predTrack.offsetTop + (predTrack.offsetHeight / 2);

      const x2 = succEl.offsetLeft;
      const y2 = succTrack.offsetTop + (succTrack.offsetHeight / 2);

      const dx = Math.max(25, Math.abs(x2 - x1) * 0.45);
      let d;

      if (x2 >= x1 + 8) {
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      } else {
        const midY = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1 + 35} ${y1}, ${x1 + 35} ${midY}, ${(x1 + x2) / 2} ${midY} S ${x2 - 35} ${y2}, ${x2} ${y2}`;
      }

      // Başlangıç noktası yuvarlağı
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
      path.setAttribute('stroke-width', '2.2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('marker-end', 'url(#gantt-arrow-gold)');
      svg.appendChild(path);
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 4. İŞ PANOSU (KANBAN)
function renderBoard() {
  const lists = {
    TODO: document.getElementById('bListTodo'),
    DOING: document.getElementById('bListDoing'),
    DONE: document.getElementById('bListDone')
  };

  if (!lists.TODO || !lists.DOING || !lists.DONE) return;

  const counts = { TODO: 0, DOING: 0, DONE: 0 };
  Object.values(lists).forEach(l => l.innerHTML = '');

  if (!state.searchQuery) {
    const kanbanInput = document.getElementById('kanbanSearchInput');
    if (kanbanInput && kanbanInput.value !== '') {
      kanbanInput.value = '';
    }
    state.kanbanSearchQuery = '';
  }
  const activeBoardQuery = state.searchQuery || state.kanbanSearchQuery || '';
  const filteredTasks = state.tasks.filter(t => {
    if (state.currentProjectId && t.project_id !== state.currentProjectId) return false;
    if (!activeBoardQuery) return true;
    return matchesTaskQuery(t, activeBoardQuery);
  });

  filteredTasks.forEach(t => {
    const card = document.createElement('div');
    const isBlocked = t.work_status === 'BLOCKED';
    const assignee = state.personnelList.find(p => p.id === t.assignee_id);
    const isMyTask = !t.assignee_id || t.assignee_id === state.currentUser?.id;

    card.className = `board-card ${isBlocked ? 'is-blocked' : ''} ${!isMyTask ? 'not-my-task' : ''}`;
    card.setAttribute('draggable', isMyTask ? 'true' : 'false');
    card.setAttribute('data-task-id', t.id);
    card.setAttribute('data-status', t.work_status);
    if (!isMyTask) {
      card.setAttribute('title', `Bu görev ${assignee ? assignee.name : 'başka bir personel'} için atanmıştır. Başkasının görevini taşıyamaz veya müdahale edemezsiniz.`);
    }

    const isOverdue = t.work_status !== 'COMPLETED' && new Date(t.current_due_date) < new Date();
    const typeIcon = t.type === 'MILESTONE' ? '🏁' : (t.type === 'BUG' ? '🐞' : '📌');
    const typeLabel = t.type === 'MILESTONE' ? 'Kilometre Taşı' : (t.type === 'BUG' ? 'Hata' : 'Görev');
    const typeClass = t.type === 'MILESTONE' ? 'milestone' : (t.type === 'BUG' ? 'bug' : '');

    const priorityLabel = t.priority === 'HIGH' ? '🔥 Yüksek' : (t.priority === 'LOW' ? 'Düşük' : 'Normal');
    const priorityClass = t.priority === 'HIGH' ? 'high' : '';

    const initials = assignee ? assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
    const dueDateText = t.current_due_date ? formatDate(t.current_due_date) : '';
    const progressVal = typeof t.progress === 'number' ? t.progress : (t.work_status === 'COMPLETED' ? 100 : 0);
    const blockingSucc = getBlockingSuccessorSummary(t);

    card.innerHTML = `
      <div class="board-card-header">
        ${t.workflow_step ? `<span class="op-step-badge" style="font-size:0.68rem; padding:1px 6px; border-radius:4px; font-weight:700; color:#fff; background:${getStepColor(t.workflow_step)}; display:inline-block;">${escapeHtml(t.workflow_step)}</span>` : ''}
        <span class="board-card-type ${typeClass}">${typeIcon} ${typeLabel}</span>
        <span class="board-card-priority ${priorityClass}">${priorityLabel}</span>
      </div>
      <div class="board-card-title">${escapeHtml(t.title)}</div>
      ${isBlocked ? `
        <div class="board-card-blocked-pill" title="Öncül görevler bitmeden başlatılamaz">
          🔒 Öncül Bekliyor (BLOCKED)
        </div>
      ` : ''}
      ${blockingSucc.count > 0 ? `
        <div class="board-card-bottleneck-pill" title="Bekleyen ardıllar: ${escapeHtml(blockingSucc.titles.join(', '))}">
          🔥 ${blockingSucc.count} Ardıl Görevi Bekletiyor
        </div>
      ` : ''}
      <div class="board-card-progress-bar">
        <div class="board-card-progress-fill ${t.work_status === 'COMPLETED' ? 'fill-done' : ''}" style="width: ${progressVal}%;"></div>
      </div>
      <div class="board-card-footer">
        <div class="board-card-assignee" title="${assignee ? assignee.name : t('label_unassigned', 'Atanmamış')}">
          <div class="assignee-avatar-sm">${initials}</div>
          <span class="assignee-name-sm" style="font-size:0.75rem; font-weight:500; color:#334155;">${assignee ? assignee.name : t('label_unassigned', 'Atanmamış')}</span>
        </div>
        <div class="board-card-due ${isOverdue ? 'overdue' : ''}">
          <span title="${t('label_due', 'Bitiş Tarihi')}">📅 ${dueDateText}</span>
          <span class="board-card-pct">%${progressVal}</span>
        </div>
      </div>
    `;

    // Sürükleme Başlangıcı
    card.addEventListener('dragstart', (e) => {
      if (!isMyTask) {
        e.preventDefault();
        showToast(`Bu görev ${assignee ? assignee.name : 'başka personele'} atanmıştır. Başkasının görevini taşıyamaz veya müdahale edemezsiniz.`, 'warning');
        return false;
      }
      e.dataTransfer.setData('text/plain', t.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    // Sürükleme Bitişi
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
    });

    // Tıklanınca sağ çekmeceyi aç
    card.addEventListener('click', (e) => {
      if (!card.classList.contains('is-dragging')) {
        openTaskDrawer(t.id);
      }
    });

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

  // Boş Sütun Göstergeleri
  Object.keys(lists).forEach(k => {
    if (lists[k].children.length === 0) {
      lists[k].innerHTML = `<div class="board-empty-placeholder"><span>Bu sütunda henüz görev yok</span></div>`;
    }
  });

  document.getElementById('bCountTodo').textContent = counts.TODO;
  document.getElementById('bCountDoing').textContent = counts.DOING;
  document.getElementById('bCountDone').textContent = counts.DONE;

  // Sütun drop listener'larını bağla
  setupKanbanDropListeners();
}

let kanbanDropListenersSetup = false;
function setupKanbanDropListeners() {
  if (kanbanDropListenersSetup) return;
  kanbanDropListenersSetup = true;

  const cols = document.querySelectorAll('.board-column');
  cols.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const targetStatus = col.getAttribute('data-status'); // 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
      const task = state.tasks.find(x => x.id === taskId);
      if (!task) return;

      // Zaten aynı durumdaysa işlem yapma
      if (targetStatus === 'COMPLETED' && task.work_status === 'COMPLETED') return;
      if (targetStatus === 'IN_PROGRESS' && task.work_status === 'IN_PROGRESS') return;
      if (targetStatus === 'TODO' && (task.work_status === 'READY' || task.work_status === 'BLOCKED')) return;

      // BLOCKED Kontrolü (DAG Kuralı: KAB04/KAB05/KAB06)
      if (task.work_status === 'BLOCKED' && (targetStatus === 'IN_PROGRESS' || targetStatus === 'COMPLETED')) {
        showToast('⚠️ Görev Başlatılamaz: Öncül görevler tamamlanmadığı için bu görev BLOCKED durumundadır!', 'error');
        const cardEl = document.querySelector(`.board-card[data-task-id="${taskId}"]`);
        if (cardEl) {
          cardEl.classList.add('shake-card');
          setTimeout(() => cardEl.classList.remove('shake-card'), 600);
        }
        return;
      }

      try {
        const targetTitle = targetStatus === 'COMPLETED' ? 'Tamamlandı' : (targetStatus === 'IN_PROGRESS' ? 'Devam Ediyor' : 'Yapılacak');
        await apiCall(`/api/tasks/${taskId}/status`, 'POST', { status: targetStatus });
        showToast(`✅ Görev durumu güncellendi: ${targetTitle}`, 'success');
        await loadProjectTasks(state.currentProjectId);
      } catch (err) {
        showToast(err.message, 'error');
        const cardEl = document.querySelector(`.board-card[data-task-id="${taskId}"]`);
        if (cardEl) {
          cardEl.classList.add('shake-card');
          setTimeout(() => cardEl.classList.remove('shake-card'), 600);
        }
      }
    });
  });
}

// ================= OPENPROJECT SPLIT SCREEN DRAWER =================
async function openTaskDrawer(taskId) {
  state.activeTaskId = taskId;
  const drawer = document.getElementById('workPackageDrawer');
  const backdrop = document.getElementById('wpDrawerBackdrop');
  if (!drawer) return;

  try {
    const details = await apiCall(`/api/tasks/${taskId}/details`);
    const { task, project, assignee, predecessors, successors, delays, plan_changes, can_manage_plan, can_edit } = details;

    document.getElementById('wpProjectTitle').textContent = project?.title || 'FG Group Projesi';
    document.getElementById('wpId').textContent = `#${task.id.slice(0, 6)}`;

    // İş Adımı Rozeti
    const stepBadge = document.getElementById('wpStepBadge');
    if (stepBadge) {
      if (task.workflow_step) {
        stepBadge.style.display = 'inline-block';
        stepBadge.textContent = task.workflow_step;
        stepBadge.style.backgroundColor = details.workflow_step_info?.color || getStepColor(task.workflow_step);
      } else {
        stepBadge.style.display = 'none';
      }
    }

    const typeBadge = document.getElementById('wpType');
    typeBadge.textContent = task.type === 'MILESTONE' ? '🏁 KİLOMETRE TAŞI' : (task.type === 'BUG' ? '🐞 HATA' : '📌 GÖREV');
    typeBadge.className = `op-type-badge ${task.type === 'MILESTONE' ? 'milestone' : (task.type === 'BUG' ? 'bug' : '')}`;

    const priorityBadge = document.getElementById('wpPriority');
    priorityBadge.textContent = task.priority === 'HIGH' ? '🔥 Yüksek' : (task.priority === 'LOW' ? 'Düşük' : 'Normal');
    priorityBadge.className = `op-priority-badge ${task.priority === 'HIGH' ? 'high' : ''}`;

    const prioritySelect = document.getElementById('wpPrioritySelect');
    if (prioritySelect) {
      prioritySelect.value = task.priority || 'NORMAL';
      prioritySelect.disabled = !can_edit;
    }

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

    const isAssignee = details.is_assignee ?? (!task.assignee_id || task.assignee_id === state.currentUser?.id);

    // Başkasına Atanmış Görev Müdahale Kısıtlama Bandı
    const lockBanner = document.getElementById('wpTaskLockBanner');
    if (lockBanner) {
      if (!isAssignee) {
        lockBanner.style.display = 'flex';
        const assignedName = assignee ? escapeHtml(assignee.name) : 'başka personele';
        lockBanner.innerHTML = `🔒 <strong>Müdahale Kısıtlaması:</strong> Bu görev <strong>${assignedName}</strong> adlı personele atanmıştır. Görevi başlatma, tamamlama, durumunu veya ilerleme yüzdesini değiştirme yetkisi yalnızca atanmış sorumluya aittir; başkası yerine müdahale edilemez ve başkası adına not eklenemez.`;
      } else {
        lockBanner.style.display = 'none';
      }
    }

    const prog = task.work_status === 'COMPLETED' ? 100 : (task.progress || 0);
    document.getElementById('wpProgressText').textContent = `%${prog}`;
    document.getElementById('wpProgressFill').style.width = `${prog}%`;
    const progSlider = document.getElementById('wpProgressSlider');
    if (progSlider) {
      progSlider.value = String(prog);
      progSlider.disabled = !isAssignee || task.work_status === 'COMPLETED' || task.work_status === 'BLOCKED';
    }

    const quickBox = document.getElementById('wpProgressQuickActionsBox');
    if (quickBox) {
      quickBox.style.display = isAssignee && task.work_status !== 'COMPLETED' && task.work_status !== 'BLOCKED' ? 'block' : 'none';
    }

    // Not ekleme kısıtlaması (Başkası adına not veya gecikme açıklaması eklenemez)
    const inlineExpForm = document.getElementById('wpInlineExpForm');
    const inlineExpNotice = document.getElementById('wpInlineExpNotice');
    const inlineExpText = document.getElementById('wpInlineExpText');
    const inlineExpAssigneeName = document.getElementById('wpInlineExpAssigneeName');

    if (!isAssignee) {
      if (inlineExpForm) inlineExpForm.style.display = 'none';
      if (inlineExpNotice) {
        inlineExpNotice.style.display = 'flex';
        if (inlineExpAssigneeName) {
          inlineExpAssigneeName.textContent = assignee ? assignee.name : 'atanmış personele';
        }
      }
      if (inlineExpText) inlineExpText.disabled = true;
    } else {
      if (inlineExpForm) inlineExpForm.style.display = 'flex';
      if (inlineExpNotice) inlineExpNotice.style.display = 'none';
      if (inlineExpText) {
        inlineExpText.disabled = false;
        inlineExpText.placeholder = 'Gecikme gerekçesi veya durum notu yazınız...';
      }
    }

    // Sorumlu Personel Seçici & Kartı
    const assigneeSelect = document.getElementById('wpAssigneeSelect');
    if (assigneeSelect) {
      assigneeSelect.innerHTML = '<option value="">(Atanmamış)</option>' +
        state.personnelList.filter(u => u.is_active !== false || u.id === task.assignee_id).map(u => `<option value="${u.id}">${escapeHtml(u.name)}${u.is_active === false ? ' [Devre Dışı / Ayrıldı]' : ''} (${escapeHtml(u.department || 'Genel')})</option>`).join('');
      assigneeSelect.value = task.assignee_id || '';
      assigneeSelect.disabled = !can_manage_plan;
    }

    const avatar = document.getElementById('wpAssigneeAvatar');
    const nameEl = document.getElementById('wpAssigneeName');
    const deptEl = document.getElementById('wpAssigneeDept');
    const emailEl = document.getElementById('wpAssigneeEmail');
    const phoneEl = document.getElementById('wpAssigneePhone');

    if (assignee) {
      applyAvatarToElement(avatar, assignee);
      nameEl.textContent = assignee.name;
      deptEl.textContent = `${assignee.department || 'Genel'} (${assignee.country || 'Türkiye'})`;
      emailEl.textContent = assignee.email;
      phoneEl.textContent = assignee.phone || 'Telefon belirtilmemiş';
    } else {
      avatar.innerHTML = '';
      avatar.textContent = '?';
      nameEl.textContent = 'Atanmamış';
      deptEl.textContent = '-';
      emailEl.textContent = '-';
      phoneEl.textContent = '-';
    }

    // Görevi Atayan Yetkili Satırı (Excel "Görevi Atayan: Musa" formatı)
    const assignerRow = document.getElementById('wpAssignerRow');
    const assignerNameEl = document.getElementById('wpAssignerName');
    if (assignerRow && assignerNameEl) {
      if (details.assigner) {
        assignerRow.style.display = 'flex';
        const atamaZamani = details.assigner.assigned_at ? ` • Atama: ${formatDateTimeTR(details.assigner.assigned_at)}` : '';
        assignerNameEl.textContent = `${details.assigner.name} (${details.assigner.department || 'Proje Yetkilisi'})${atamaZamani}`;
      } else {
        assignerRow.style.display = 'none';
      }
    }

    // Tarihler, İlk Plan & Plan Revizyonu
    const rawCurStart = task.current_start_date ? task.current_start_date.slice(0, 10) : '';
    const rawCurDue = task.current_due_date ? task.current_due_date.slice(0, 10) : '';
    const rawInitStart = task.initial_start_date ? task.initial_start_date.slice(0, 10) : rawCurStart;
    const rawInitDue = task.initial_due_date ? task.initial_due_date.slice(0, 10) : rawCurDue;

    const curStart = task.current_start_date ? formatDate(task.current_start_date) : '-';
    const curDue = task.current_due_date ? formatDate(task.current_due_date) : '-';
    const initStart = task.initial_start_date ? formatDate(task.initial_start_date) : curStart;
    const initDue = task.initial_due_date ? formatDate(task.initial_due_date) : curDue;

    document.getElementById('wpStartDate').textContent = curStart;
    document.getElementById('wpDueDate').textContent = curDue;

    const initDatesEl = document.getElementById('wpInitialDates');
    if (initDatesEl) {
      const isRevised = rawInitStart !== rawCurStart || rawInitDue !== rawCurDue;
      initDatesEl.innerHTML = `📌 <strong>${t('label_initial_plan', 'İlk Plan (Baz)')}:</strong> ${initStart} → ${initDue} ${isRevised ? `<span class="wp-rev-pill">${t('label_revised', 'Revize Edildi')}</span>` : `<span style="color:#10b981;">(${t('label_original_plan', 'Orijinal Plan')})</span>`}`;
    }

    // Kişisel Takvim Butonları (.ics, Outlook Web, Google Calendar)
    const calDownloadBtn = document.getElementById('wpDownloadIcsBtn');
    const calOutlookBtn = document.getElementById('wpOutlookWebBtn');
    const calGoogleBtn = document.getElementById('wpGoogleCalBtn');
    if (calDownloadBtn) {
      calDownloadBtn.href = `/api/tasks/${task.id}/calendar.ics`;
    }
    if (details.calendar_links) {
      if (calOutlookBtn) calOutlookBtn.href = details.calendar_links.outlookWebUrl;
      if (calGoogleBtn) calGoogleBtn.href = details.calendar_links.googleCalendarUrl;
    } else {
      const projTitle = project?.title || 'FG Group Projesi';
      const calTitle = encodeURIComponent(`[${projTitle}] 📌 ${task.title}`);
      const calDesc = encodeURIComponent(`Proje: ${projTitle}\nDurum: ${task.work_status} (%${task.progress || 0})\n${task.description || ''}`);
      if (calOutlookBtn) {
        calOutlookBtn.href = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${calTitle}&body=${calDesc}`;
      }
      if (calGoogleBtn) {
        calGoogleBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&details=${calDesc}`;
      }
    }

    const newStartInput = document.getElementById('wpNewStart');
    const newDueInput = document.getElementById('wpNewDue');
    const planReasonInput = document.getElementById('wpPlanReason');
    if (newStartInput) newStartInput.value = rawCurStart;
    if (newDueInput) newDueInput.value = rawCurDue;
    if (planReasonInput) planReasonInput.value = '';

    const togglePlanBtn = document.getElementById('wpTogglePlanRevBtn');
    if (togglePlanBtn) {
      togglePlanBtn.style.display = can_manage_plan ? 'inline-flex' : 'none';
    }
    const planForm = document.getElementById('wpPlanReviseForm');
    if (planForm) planForm.style.display = 'none';

    const planHistoryEl = document.getElementById('wpPlanHistoryList');
    if (planHistoryEl) {
      if (plan_changes && plan_changes.length > 0) {
        planHistoryEl.innerHTML = plan_changes.map(pc => `
          <div class="wp-plan-history-item">
            <div>🔄 <strong>${t('label_revised', 'Plan Revizyonu')}:</strong> ${formatDate(pc.old_due_date)} → <strong>${formatDate(pc.new_due_date)}</strong></div>
            <div style="color:var(--text-secondary); margin-top:2px;">Neden: ${escapeHtml(pc.reason || '-')}</div>
          </div>
        `).join('');
      } else {
        planHistoryEl.innerHTML = '';
      }
    }

    const delayAlert = document.getElementById('wpDelayBadge');
    const isOverdue = task.work_status !== 'COMPLETED' && new Date(task.current_due_date) < new Date();
    if (isOverdue) {
      delayAlert.style.display = 'flex';
      delayAlert.innerHTML = '⚠️ <strong>Teslim Tarihi Aşıldı:</strong> Bu görev planlanan bitiş tarihini geçti.';
    } else {
      delayAlert.style.display = 'none';
    }

    document.getElementById('wpDesc').textContent = task.description || 'Bu görev için detaylı açıklama girilmemiş.';

    // Öncül Listesi (Silme Butonu ile)
    const predContainer = document.getElementById('wpPredecessorsList');
    if (predecessors && predecessors.length > 0) {
      predContainer.innerHTML = predecessors.map(p => `
        <div class="op-rel-item">
          <div>
            <span class="rel-title">${escapeHtml(p.title)}</span>
            <div class="rel-user">👤 ${escapeHtml(p.assignee_name)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="task-status-pill ${p.work_status === 'COMPLETED' ? 'pill-status-done' : 'pill-status-progress'}">${p.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'}</span>
            ${can_manage_plan ? `<button type="button" class="btn-remove-dep" data-pred="${p.id}" data-succ="${task.id}" title="Öncül Bağımlılığı Kaldır">&times;</button>` : ''}
          </div>
        </div>
      `).join('');
    } else {
      predContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">(Öncül görev yok - hemen başlayabilir)</span>';
    }

    // Ardıl Listesi (Silme Butonu ile)
    const succContainer = document.getElementById('wpSuccessorsList');
    if (successors && successors.length > 0) {
      succContainer.innerHTML = successors.map(s => `
        <div class="op-rel-item">
          <div>
            <span class="rel-title">${escapeHtml(s.title)}</span>
            <div class="rel-user">👤 ${escapeHtml(s.assignee_name)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="task-status-pill ${s.work_status === 'COMPLETED' ? 'pill-status-done' : 'pill-status-blocked'}">${s.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'}</span>
            ${can_manage_plan ? `<button type="button" class="btn-remove-dep" data-pred="${task.id}" data-succ="${s.id}" title="Ardıl Bağımlılığı Kaldır">&times;</button>` : ''}
          </div>
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
      eligibleTasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');

    // Gecikme & Aktivite Akışı (explanation_source ve detected_at/reported_at uyumlu)
    const delaysContainer = document.getElementById('wpDelaysList');
    if (delays && delays.length > 0) {
      delaysContainer.innerHTML = delays.map(d => {
        const isSystem = d.explanation_source === 'SYSTEM' || d.explanation_type === 'SYSTEM_DEPENDENCY_BLOCK';
        const text = d.explanation_text || d.reason || d.delay_reason || 'Gecikme kaydedildi.';
        const timestamp = d.reported_at || d.detected_at || d.logged_at;
        const timeText = timestamp ? formatDateTime(timestamp) : '';
        return `
          <div class="op-activity-item ${isSystem ? 'system' : ''}">
            <div><strong>${isSystem ? '⚙️ Sistem Tespiti' : '👤 Personel Açıklaması'}:</strong> ${escapeHtml(text)}</div>
            <div class="op-activity-time">${timeText}</div>
          </div>
        `;
      }).join('');
    } else {
      delaysContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">Henüz gecikme kaydı veya aktivite bulunmuyor.</span>';
    }

    // Butonlar
    const startBtn = document.getElementById('wpStartBtn');
    const compBtn = document.getElementById('wpCompleteBtn');

    if (!isAssignee) {
      startBtn.style.display = 'none';
      compBtn.style.display = 'none';
    } else if (task.work_status === 'READY') {
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
    'Turkiye': '🇹🇷 Türkiye',
    'Almanya': '🇩🇪 Almanya',
    'İngiltere': '🇬🇧 İngiltere',
    'Ingiltere': '🇬🇧 İngiltere',
    'USA': '🇺🇸 ABD',
    'ABD': '🇺🇸 ABD'
  };

  function getCountryDisplay(rawCountry) {
    if (!rawCountry) return '🇹🇷 Türkiye';
    let cleaned = rawCountry.replace(/\ufffd/g, 'ü').trim();
    if (cleaned.toLowerCase().includes('turk') || cleaned.toLowerCase().includes('türk') || cleaned.toLowerCase().includes('trkiye')) {
      cleaned = 'Türkiye';
    }
    return countryFlags[cleaned] || countryFlags[rawCountry] || cleaned;
  }

  function getLangDisplay(u) {
    const c = (u.country || '').replace(/\ufffd/g, 'ü').trim().toLowerCase();
    if (c.includes('türk') || c.includes('turk') || c.includes('trkiye') || c === 'tr') return 'TR';
    if (c.includes('alman') || c.includes('german') || c.includes('deutsch')) return 'DE';
    return (u.language || 'tr').toUpperCase();
  }

  state.personnelList.forEach(u => {
    const isSelf = u.id === state.currentUser?.id;
    const isDeactivated = u.is_active === false;
    const tr = document.createElement('tr');
    if (isDeactivated) {
      tr.style.opacity = '0.75';
      tr.style.backgroundColor = 'rgba(239, 68, 68, 0.04)';
    }
    const avatarContent = u.avatar_url
      ? `<img src="${u.avatar_url}" alt="${escapeHtml(u.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`
      : u.name.slice(0, 1).toUpperCase();

    const statusBadge = isDeactivated
      ? `<span class="nav-badge danger" style="padding:2px 8px; font-weight:700; font-size:0.75rem;" title="${escapeHtml(u.deactivation_reason || 'Devre dışı bırakıldı')}">⛔ Devre Dışı</span>`
      : `<span class="nav-badge success" style="padding:2px 8px; font-weight:700; font-size:0.75rem;">🟢 Aktif</span>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="profile-avatar" style="width:30px; height:30px; font-size:0.75rem; overflow:hidden; padding:0; ${isDeactivated ? 'filter:grayscale(1); opacity:0.6;' : ''}">${avatarContent}</div>
          <div>
            <strong>${u.name}</strong> ${isSelf ? '<span class="nav-badge neutral">Siz</span>' : ''}
            ${isDeactivated ? '<div style="font-size:0.7rem; color:#dc2626; font-weight:600;">(Erişim Kapalı)</div>' : ''}
          </div>
        </div>
      </td>
      <td>
        <div>${u.email}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${u.phone || '-'}</div>
      </td>
      <td>
        <span>${getCountryDisplay(u.country)} (${getLangDisplay(u)})</span>
      </td>
      <td>${u.department || 'Genel'}</td>
      <td>${statusBadge}</td>
      <td>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
          <input type="checkbox" class="perm-toggle" data-id="${u.id}" ${u.can_create_project ? 'checked' : ''} ${isSelf || isDeactivated ? 'disabled' : ''}>
          <span>${u.can_create_project ? 'Yetkili' : 'Standart'}</span>
        </label>
      </td>
      <td>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
          <input type="checkbox" class="report-perm-toggle" data-id="${u.id}" ${u.can_build_reports ? 'checked' : ''} ${isSelf || isDeactivated ? 'disabled' : ''}>
          <span style="color:${u.can_build_reports ? '#34d399' : '#94a3b8'}; font-weight:600;">${u.can_build_reports ? 'Yetkili' : 'Yetkisiz'}</span>
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
    'view-team': 'Ekip & Personel',
    'view-report-builder': 'Özel Rapor Oluşturucu (Sürükle-Bırak)',
    'view-microsoft-todo': 'Microsoft To Do & Outlook Görevleri',
    'view-email-automation': 'Exchange Online (SMTP) & Otomatik Raporlar',
    'view-backup-recovery': 'Yedekleme & Felaket Kurtarma Merkezi'
  };
  document.getElementById('currentViewTitle').textContent = titles[viewId] || 'Panel';

  // Görünüm geçişlerinde kullanıcı arama yapmamışsa arama alanlarının temiz kalmasını sağla
  if (!state.searchQuery) {
    clearAllSearchFilters();
  }

  // Proje seçici göster/gizle
  const projContainer = document.getElementById('projectSelectorContainer');
  if (viewId === 'view-team' || viewId === 'view-projects' || viewId === 'view-report-builder' || viewId === 'view-microsoft-todo' || viewId === 'view-email-automation' || viewId === 'view-backup-recovery') {
    projContainer.style.display = 'none';
  } else {
    projContainer.style.display = 'flex';
  }

  if (viewId === 'view-timeline') {
    renderTimeline();
  }

  if (viewId === 'view-report-builder') {
    initReportBuilder();
  }

  if (viewId === 'view-microsoft-todo') {
    loadAndRenderMicrosoftTodo();
  }

  if (viewId === 'view-email-automation') {
    loadEmailAutomationDashboard();
  }

  if (viewId === 'view-backup-recovery') {
    loadBackupDashboard();
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
    } catch (err) { }
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
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    logout();
  });

  // Tema Değiştirme Butonları (Hızlı Geçiş)
  document.getElementById('topbarThemeToggleBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('sidebarThemeToggleBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTheme();
  });

  // Mobil Menü Hamburger Butonu & Karartma
  const mobileToggle = document.getElementById('mobileMenuToggleBtn');
  const sidebar = document.querySelector('.app-sidebar');
  const mobileBackdrop = document.getElementById('sidebarMobileBackdrop');

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mobileBackdrop?.classList.toggle('active');
    });
  }

  mobileBackdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    mobileBackdrop?.classList.remove('active');
  });

  // Mobil cihazlarda menü öğesine tıklandığında menüyü otomatik kapat
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 850) {
        sidebar?.classList.remove('mobile-open');
        mobileBackdrop?.classList.remove('active');
      }
    });
  });

  // Profil & Tema Ayarları Modalı
  document.getElementById('userProfileBtn')?.addEventListener('click', openUserProfileModal);

  // Profil Modalı Tema Kartı Seçimi
  document.querySelectorAll('#userProfileModal .theme-choice-card').forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.dataset.setTheme;
      applyTheme(selectedTheme);
      if (state.currentUser) {
        state.currentUser.theme = selectedTheme;
        apiCall('/api/profile/theme', 'PUT', { theme: selectedTheme }).catch(() => { });
      }
    });
  });

  // Profil Modalı Tercihleri Uygula
  document.getElementById('saveProfilePreferencesBtn')?.addEventListener('click', () => {
    const langSelect = document.getElementById('modalLangSelect');
    if (langSelect && langSelect.value !== state.currentLang) {
      setLanguage(langSelect.value);
    }
    document.getElementById('userProfileModal')?.classList.remove('open');
    showToast('Profil ve tema tercihleri uygulandı.', 'success');
  });

  // 📷 Profil Fotoğrafı Yükleme / Değiştirme / Kaldırma
  const avatarFileInput = document.getElementById('profileAvatarFileInput');
  document.getElementById('uploadProfileAvatarBtn')?.addEventListener('click', () => {
    avatarFileInput?.click();
  });
  document.getElementById('modalUserAvatar')?.addEventListener('click', () => {
    avatarFileInput?.click();
  });

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Lütfen geçerli bir görsel dosyası (PNG, JPG, WEBP) seçiniz.', 'error');
        return;
      }
      try {
        const compressedDataUrl = await compressAvatarImageFile(file);
        const res = await apiCall('/api/profile/avatar', 'PUT', { avatar_url: compressedDataUrl });
        if (state.currentUser) {
          state.currentUser.avatar_url = res.user?.avatar_url || compressedDataUrl;
          localStorage.setItem('fg_user', JSON.stringify(state.currentUser));
        }
        applyAvatarToElement(document.getElementById('userAvatar'), state.currentUser);
        applyAvatarToElement(document.getElementById('modalUserAvatar'), state.currentUser);
        const removeBtn = document.getElementById('removeProfileAvatarBtn');
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        await loadPersonnel();
        showToast('📷 Profil fotoğrafınız başarıyla yüklendi ve kaydedildi!', 'success');
      } catch (err) {
        showToast('Profil resmi yüklenemedi: ' + err.message, 'error');
      } finally {
        avatarFileInput.value = '';
      }
    });
  }

  document.getElementById('removeProfileAvatarBtn')?.addEventListener('click', async () => {
    try {
      await apiCall('/api/profile/avatar', 'PUT', { avatar_url: '' });
      if (state.currentUser) {
        delete state.currentUser.avatar_url;
        localStorage.setItem('fg_user', JSON.stringify(state.currentUser));
      }
      applyAvatarToElement(document.getElementById('userAvatar'), state.currentUser);
      applyAvatarToElement(document.getElementById('modalUserAvatar'), state.currentUser);
      const removeBtn = document.getElementById('removeProfileAvatarBtn');
      if (removeBtn) removeBtn.style.display = 'none';
      await loadPersonnel();
      showToast('🗑️ Profil fotoğrafınız kaldırıldı.', 'info');
    } catch (err) {
      showToast('Profil resmi kaldırılamadı: ' + err.message, 'error');
    }
  });

  // 🔐 Kullanıcı Kendi Şifresini Oluşturma / Değiştirme
  document.getElementById('toggleProfilePasswordVisBtn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const fields = ['profileCurrentPassword', 'profileNewPassword', 'profileConfirmPassword']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    const isPass = fields[0]?.type === 'password';
    fields.forEach(f => { f.type = isPass ? 'text' : 'password'; });
    btn.textContent = isPass ? '🙈 Gizle' : '👁️ Göster';
  });

  document.getElementById('changeUserPasswordBtn')?.addEventListener('click', async () => {
    const curEl = document.getElementById('profileCurrentPassword');
    const newEl = document.getElementById('profileNewPassword');
    const confEl = document.getElementById('profileConfirmPassword');
    const msgEl = document.getElementById('profilePasswordStatusMsg');

    const current_password = (curEl?.value || '').trim();
    const new_password = (newEl?.value || '').trim();
    const confirm_password = (confEl?.value || '').trim();

    if (!current_password) {
      showToast('⚠️ Lütfen mevcut (veya ilk giriş) şifrenizi giriniz.', 'error');
      curEl?.focus();
      return;
    }
    if (new_password.length < 3) {
      showToast('⚠️ Yeni şifreniz en az 3 karakter olmalıdır.', 'error');
      newEl?.focus();
      return;
    }
    if (new_password !== confirm_password) {
      showToast('⚠️ Yeni şifre ile şifre tekrarı birbiriyle eşleşmiyor!', 'error');
      confEl?.focus();
      return;
    }

    try {
      const res = await apiCall('/api/profile/password', 'PUT', {
        current_password,
        new_password
      });
      if (curEl) curEl.value = '';
      if (newEl) newEl.value = '';
      if (confEl) confEl.value = '';
      if (msgEl) {
        msgEl.textContent = '✅ Şifreniz başarıyla güncellendi! Bir sonraki girişinizde yeni şifreniz geçerlidir.';
        msgEl.style.color = '#059669';
      }
      showToast(res.message || '🔑 Şifreniz başarıyla güncellendi!', 'success');
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = '❌ ' + (err.message || 'Şifre güncellenemedi.');
        msgEl.style.color = '#dc2626';
      }
    }
  });

  // Dil Değiştirici
  document.getElementById('langSelect')?.addEventListener('change', (e) => {
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

  // Küresel Görev Arama Çubuğu (Üst Bar)
  const globalSearchInput = document.getElementById('globalTaskSearchInput');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      applyGlobalTaskSearch(e.target.value, 'globalTaskSearchInput');
    });
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        applyGlobalTaskSearch('', '');
        globalSearchInput.blur();
      }
    });
  }

  const globalSearchClearBtn = document.getElementById('globalSearchClearBtn');
  if (globalSearchClearBtn) {
    globalSearchClearBtn.addEventListener('click', () => {
      applyGlobalTaskSearch('', '');
      document.getElementById('globalTaskSearchInput')?.focus();
    });
  }

  // Klavye Kısayolu (Ctrl+K / Cmd+K ile Küresel Aramaya Odaklan)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('globalTaskSearchInput');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });

  // OpenProject Filtre ve Arama Çubuğu
  const searchInput = document.getElementById('taskSearchInput');
  if (searchInput) {
    if (!state.searchQuery) searchInput.value = '';
    searchInput.addEventListener('input', (e) => {
      applyGlobalTaskSearch(e.target.value, 'taskSearchInput');
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        applyGlobalTaskSearch('', '');
        searchInput.blur();
      }
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

  // Bildirim Çanı ve Çekmecesi
  document.getElementById('notifBellBtn')?.addEventListener('click', async () => {
    const drawer = document.getElementById('notifDrawer');
    if (!drawer) return;
    drawer.classList.add('open');
    await loadNotifications();

    // Çekmece açıldığında okunmamış bildirim sayacı sıfırlansın ve sunucuda okundu işaretlensin
    try {
      await apiCall('/api/notifications/read-all', 'POST');
      if (state.notifications) {
        state.notifications.forEach(n => { n.is_read = true; });
      }
      const badge = document.getElementById('notifBadge');
      if (badge) badge.style.display = 'none';
    } catch (err) {
      // ignore
    }
  });

  document.getElementById('clearAllNotifsBtn')?.addEventListener('click', async () => {
    try {
      await apiCall('/api/notifications/clear-all', 'POST');
      state.notifications = [];
      renderNotifications();
      showToast('Tüm bildirimler temizlendi.', 'info');
    } catch (err) {
      showToast('Bildirimler temizlenemedi: ' + err.message, 'error');
    }
  });

  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
    document.getElementById('notifDrawer')?.classList.remove('open');
  });

  document.getElementById('notifDrawer')?.addEventListener('click', (e) => {
    if (e.target.id === 'notifDrawer') {
      document.getElementById('notifDrawer')?.classList.remove('open');
    }
  });

  document.getElementById('runWorkerScanBtn')?.addEventListener('click', async () => {
    await triggerWorkerAndLoadNotifications(false);
  });

  // OpenProject Split Screen Çekmece Eylemleri
  document.getElementById('wpCloseBtn')?.addEventListener('click', closeTaskDrawer);
  document.getElementById('wpCloseFooterBtn')?.addEventListener('click', closeTaskDrawer);
  document.getElementById('wpDrawerBackdrop')?.addEventListener('click', closeTaskDrawer);

  // Çekmece İçi İlerleme Kaydırıcısı & Zorunlu Notlu Hızlı İlerleme (%20, %40, %50, %60, %80, %100)
  const wpProgressSlider = document.getElementById('wpProgressSlider');
  if (wpProgressSlider) {
    wpProgressSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      document.getElementById('wpProgressText').textContent = `%${val}`;
      document.getElementById('wpProgressFill').style.width = `${val}%`;
    });
    wpProgressSlider.addEventListener('change', () => {
      const noteEl = document.getElementById('wpProgressNoteInput');
      if (noteEl && !noteEl.value.trim()) {
        noteEl.focus();
        showToast('📝 Lütfen seçtiğiniz ilerleme oranı için aşağıya yapılan iş / açıklama notunu yazıp Kaydet butonuna basın.', 'info');
      }
    });
  }

  document.querySelectorAll('.wp-quick-prog-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const progVal = Number(btn.dataset.prog) || 50;
      const slider = document.getElementById('wpProgressSlider');
      if (slider && !slider.disabled) {
        slider.value = String(progVal);
        document.getElementById('wpProgressText').textContent = `%${progVal}`;
        document.getElementById('wpProgressFill').style.width = `${progVal}%`;
      }
      const noteEl = document.getElementById('wpProgressNoteInput');
      if (noteEl) {
        noteEl.focus();
      }
    });
  });

  document.getElementById('wpSaveProgressWithNoteBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    const slider = document.getElementById('wpProgressSlider');
    const noteEl = document.getElementById('wpProgressNoteInput');
    const progress = Number(slider?.value || 50);
    const note_text = (noteEl?.value || '').trim();

    if (note_text.length < 2) {
      if (noteEl) {
        noteEl.style.borderColor = '#ef4444';
        noteEl.focus();
        setTimeout(() => { noteEl.style.borderColor = ''; }, 2500);
      }
      showToast('⚠️ İlerleme oranı (%40, %50, %60 vb.) güncellerken yapılan çalışmayı açıklayan bir not yazmanız zorunludur!', 'error');
      return;
    }

    try {
      await apiCall(`/api/tasks/${state.activeTaskId}/progress`, 'POST', { progress, note_text });
      if (noteEl) noteEl.value = '';
      showToast(
        progress >= 100
          ? `✅ Görev %100 tamamlandı, notunuz kaydedildi ve proje yetkililerine bilgi e-postası gönderildi!`
          : `📊 İlerleme %${progress} olarak güncellendi, zorunlu notunuz kaydedildi ve proje yetkililerine mail gönderildi!`,
        'success'
      );
      await loadProjectTasks(state.currentProjectId);
      await loadProjects();
      await openTaskDrawer(state.activeTaskId);
      await loadNotifications();
    } catch (err) {
      showToast('İlerleme kaydedilemedi: ' + err.message, 'error');
    }
  });

  // Çekmece İçi Öncelik Değişimi
  document.getElementById('wpPrioritySelect')?.addEventListener('change', async (e) => {
    if (!state.activeTaskId) return;
    try {
      await apiCall(`/api/tasks/${state.activeTaskId}`, 'PATCH', { priority: e.target.value });
      showToast('Görev önceliği güncellendi.', 'success');
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
    } catch (err) {
      showToast('Öncelik güncellenemedi: ' + err.message, 'error');
    }
  });

  // Çekmece İçi Sorumlu Personel Değişimi
  document.getElementById('wpAssigneeSelect')?.addEventListener('change', async (e) => {
    if (!state.activeTaskId) return;
    try {
      await apiCall(`/api/tasks/${state.activeTaskId}/assign`, 'POST', { assignee_id: e.target.value || null });
      showToast('Sorumlu personel güncellendi.', 'success');
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
      await loadNotifications();
    } catch (err) {
      showToast('Personel ataması yapılamadı: ' + err.message, 'error');
    }
  });

  // Çekmece İçi Plan Revizyonu Aç/Kapa ve Kaydet
  document.getElementById('wpTogglePlanRevBtn')?.addEventListener('click', () => {
    const form = document.getElementById('wpPlanReviseForm');
    if (form) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.getElementById('wpCancelPlanRevBtn')?.addEventListener('click', () => {
    const form = document.getElementById('wpPlanReviseForm');
    if (form) form.style.display = 'none';
  });

  document.getElementById('wpPlanReviseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeTaskId) return;
    const new_start_date = new Date(document.getElementById('wpNewStart').value).toISOString();
    const new_due_date = new Date(document.getElementById('wpNewDue').value).toISOString();
    const reason = document.getElementById('wpPlanReason').value.trim();
    try {
      await apiCall(`/api/tasks/${state.activeTaskId}/plan`, 'POST', {
        new_start_date,
        new_due_date,
        reason
      });
      showToast('📅 Görev zaman planı revize edildi (İlk plan korundu).', 'success');
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
    } catch (err) {
      showToast('Plan revize edilemedi: ' + err.message, 'error');
    }
  });

  // Çekmece İçi Bağımlılık Silme (Öncül veya Ardıl)
  document.getElementById('workPackageDrawer')?.addEventListener('click', async (e) => {
    const rmBtn = e.target.closest('.btn-remove-dep');
    if (!rmBtn || !state.activeTaskId) return;
    const predecessor_id = rmBtn.dataset.pred;
    const successor_id = rmBtn.dataset.succ;
    try {
      await apiCall('/api/dependencies', 'DELETE', { predecessor_id, successor_id });
      showToast('🔗 Bağımlılık kaldırıldı ve görev durumu güncellendi.', 'info');
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
    } catch (err) {
      showToast('Bağımlılık kaldırılamadı: ' + err.message, 'error');
    }
  });

  document.getElementById('wpStartBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    await apiCall(`/api/tasks/${state.activeTaskId}/start`, 'POST');
    showToast('Görev başlatıldı.', 'success');
    await loadProjectTasks(state.currentProjectId);
    await openTaskDrawer(state.activeTaskId);
  });

  document.getElementById('wpCompleteBtn')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    const progNote = document.getElementById('wpProgressNoteInput')?.value.trim();
    const inlineNote = document.getElementById('wpInlineExpText')?.value.trim();
    const note_text = progNote || inlineNote || '';
    await apiCall(`/api/tasks/${state.activeTaskId}/complete`, 'POST', { note_text });
    if (document.getElementById('wpProgressNoteInput')) document.getElementById('wpProgressNoteInput').value = '';
    if (document.getElementById('wpInlineExpText')) document.getElementById('wpInlineExpText').value = '';
    showToast('✅ Görev tamamlandı ve projedeki yetkili kişilere tamamlama e-postası gönderildi!', 'success');
    await loadProjectTasks(state.currentProjectId);
    await loadProjects();
    await openTaskDrawer(state.activeTaskId);
    await loadNotifications();
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
    const expInput = document.getElementById('wpInlineExpText');
    const text = expInput ? expInput.value.trim() : '';
    if (!text) return;
    try {
      await apiCall(`/api/tasks/${state.activeTaskId}/explanation`, 'POST', { explanation_text: text });
      showToast('Gerekçe / durum notu kaydedildi.', 'success');
      if (expInput) expInput.value = '';
      await loadProjectTasks(state.currentProjectId);
      await openTaskDrawer(state.activeTaskId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ESC tuşu ile görev detay modalını veya bildirim çekmecesini kapatma
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const notifDrawer = document.getElementById('notifDrawer');
      if (notifDrawer && notifDrawer.classList.contains('open')) {
        notifDrawer.classList.remove('open');
        return;
      }
      const drawer = document.getElementById('workPackageDrawer');
      if (drawer && drawer.classList.contains('open')) {
        closeTaskDrawer();
      }
    }
  });

  // Proje Ekip, Plan ve Görünürlük Yönetimi Modalı Dinleyicileri
  setupProjectManageModalListeners();

  // Yeni Görev Modalı Aç
  document.getElementById('newTaskBtn').addEventListener('click', () => {
    populateTaskModalSelects();
    document.getElementById('taskModal').classList.add('open');
  });

  // Kanban Yeni Görev Modalı
  const kanbanNewBtn = document.getElementById('kanbanNewTaskBtn');
  if (kanbanNewBtn) {
    kanbanNewBtn.addEventListener('click', () => {
      populateTaskModalSelects();
      document.getElementById('taskModal').classList.add('open');
    });
  }

  // Kanban Canlı Filtre / Arama (Küresel arama ile senkronize)
  const kanbanSearchInput = document.getElementById('kanbanSearchInput');
  if (kanbanSearchInput) {
    if (!state.searchQuery) kanbanSearchInput.value = '';
    kanbanSearchInput.addEventListener('input', (e) => {
      applyGlobalTaskSearch(e.target.value, 'kanbanSearchInput');
    });
    kanbanSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        applyGlobalTaskSearch('', '');
        kanbanSearchInput.blur();
      }
    });
  }

  // Yeni Görev Kaydet (Proje Görevi veya Bireysel To-Do)
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('tType')?.value || 'TASK';
    const priority = document.getElementById('tPriority')?.value || 'NORMAL';
    const selectedProjectId = document.getElementById('tProject')?.value || null;
    const workflow_step = document.getElementById('tWorkflowStep')?.value || undefined;
    let task_definition = document.getElementById('tTaskDefinition')?.value || undefined;
    const customDef = document.getElementById('tCustomDefInput')?.value?.trim();
    if (task_definition === '__custom__' || !task_definition) {
      task_definition = customDef || undefined;
    }

    const title = (workflow_step && task_definition)
      ? `[${workflow_step}] ${task_definition}`
      : (task_definition || workflow_step || 'Yeni Görev');

    const finalAssigneeId = selectedProjectId
      ? (document.getElementById('tAssignee').value || undefined)
      : state.currentUser?.id;
    const initial_start_date = new Date(document.getElementById('tStart').value).toISOString();
    const initial_due_date = new Date(document.getElementById('tDue').value).toISOString();
    const description = document.getElementById('tDesc').value.trim();
    const predecessor_id = selectedProjectId ? document.getElementById('tPredecessor')?.value : undefined;

    const newTask = await apiCall('/api/tasks', 'POST', {
      project_id: selectedProjectId,
      title,
      type,
      priority,
      workflow_step,
      task_definition,
      assignee_id: finalAssigneeId,
      initial_start_date,
      initial_due_date,
      description,
      predecessor_id
    });

    const isPersonal = !selectedProjectId;
    showToast(isPersonal ? '📌 Kişisel To-Do başarıyla oluşturuldu.' : '✅ Proje görevi başarıyla oluşturuldu.', 'success');
    document.getElementById('taskModal').classList.remove('open');
    e.target.reset();
    const customInput = document.getElementById('tCustomDefInput');
    if (customInput) customInput.style.display = 'none';
    await loadProjectTasks(selectedProjectId || state.currentProjectId || '');
  });

  // Tekstil Şablonunu Uygula Butonu Dinleyicisi
  document.getElementById('applyTextileTemplateBtn')?.addEventListener('click', async () => {
    if (!state.currentProjectId) {
      showToast('Lütfen önce bir proje seçiniz.', 'warning');
      return;
    }
    const currProj = state.projects.find(p => p.id === state.currentProjectId);
    const projTitle = currProj?.title || 'Seçili Proje';
    if (!confirm(`"${projTitle}" projesine FG Group Tekstil İş Akışı şablonundaki 8 standart adım (Koleksiyon, Kumaş, Teknik Çizim, Yıkama, Kalıp, Dikim, Yıkama 2, Finishing) ve ardışık bağımlılıkları eklensin mi?`)) {
      return;
    }
    try {
      const res = await apiCall(`/api/projects/${state.currentProjectId}/apply-textile-template`, 'POST');
      showToast(`⚡ ${res.message || 'Tekstil şablonu başarıyla uygulandı.'}`, 'success');
      await loadProjectTasks(state.currentProjectId);
    } catch (err) {
      showToast(err.message || 'Şablon uygulanırken bir hata oluştu.', 'error');
    }
  });

  // Yeni İş Adımı ve Görev Tanımı Modalları Dinleyicileri
  document.getElementById('tAddStepBtn')?.addEventListener('click', () => {
    document.getElementById('newWorkflowStepForm')?.reset();
    document.getElementById('newWorkflowStepModal')?.classList.add('open');
  });

  document.getElementById('newWorkflowStepForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stepInputName').value.trim().toUpperCase();
    const color = document.getElementById('stepInputColor').value;
    const department = document.getElementById('stepInputDept').value.trim() || undefined;

    try {
      const created = await apiCall('/api/workflow-steps', 'POST', { name, color, department });
      showToast(`🏷️ "${created.name}" iş adımı kataloğa eklendi.`, 'success');
      document.getElementById('newWorkflowStepModal')?.classList.remove('open');
      await loadWorkflowCatalog();
      populateWorkflowStepDropdown(created.name);
      document.getElementById('tWorkflowStep')?.dispatchEvent(new Event('change'));
    } catch (err) {
      showToast(err.message || 'İş adımı eklenemedi.', 'error');
    }
  });

  document.getElementById('tAddDefBtn')?.addEventListener('click', () => {
    const stepSelect = document.getElementById('defInputStep');
    if (stepSelect) {
      stepSelect.innerHTML = (state.workflowSteps || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
      const currentStep = document.getElementById('tWorkflowStep')?.value;
      if (currentStep) stepSelect.value = currentStep;
    }
    document.getElementById('newTaskDefForm')?.reset();
    document.getElementById('newTaskDefModal')?.classList.add('open');
  });

  document.getElementById('newTaskDefForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const workflow_step = document.getElementById('defInputStep').value;
    const title = document.getElementById('defInputTitle').value.trim();
    const duration = parseInt(document.getElementById('defInputDuration').value, 10) || 7;
    const department = document.getElementById('defInputDept').value.trim() || undefined;

    try {
      const created = await apiCall('/api/task-definitions', 'POST', {
        workflow_step,
        title,
        default_duration_days: duration,
        department
      });
      showToast(`📝 "${created.title}" görev tanımı kataloğa eklendi.`, 'success');
      document.getElementById('newTaskDefModal')?.classList.remove('open');
      await loadWorkflowCatalog();
      populateTaskDefinitionDropdown(workflow_step, created.title);
      document.getElementById('tTaskDefinition')?.dispatchEvent(new Event('change'));
    } catch (err) {
      showToast(err.message || 'Görev tanımı eklenemedi.', 'error');
    }
  });

  // Yeni Proje Modalı
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    const checklistEl = document.getElementById('newProjectMembersChecklist');
    if (checklistEl) {
      const otherUsers = (state.personnelList || []).filter(u => u.id !== state.currentUser?.id && u.is_active !== false);
      if (otherUsers.length === 0) {
        checklistEl.innerHTML = '<div style="font-size:0.78rem; color:var(--text-tertiary);">Eklenebilecek başka personel bulunmuyor.</div>';
      } else {
        checklistEl.innerHTML = otherUsers.map(u => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border-radius:8px; background:var(--surface, #ffffff); border:1px solid var(--border-color, #e2e8f0);">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; font-size:0.8rem; margin:0;">
              <input type="checkbox" class="new-proj-member-cb" value="${u.id}">
              <div>
                <div style="font-weight:700; color:var(--text-primary);">${escapeHtml(u.name)} <span style="font-weight:400; color:var(--text-secondary);">(${escapeHtml(u.department || 'Genel')})</span></div>
                <div style="font-size:0.73rem; color:var(--text-tertiary);">📧 ${escapeHtml(u.email)}</div>
              </div>
            </label>
            <select class="styled-select sm-select new-proj-member-role" data-user-id="${u.id}" style="width:auto; min-width:130px; padding:4px 8px; font-size:0.75rem;">
              <option value="EDITOR" selected>✏️ Düzenleyici (Editor)</option>
              <option value="PROJECT_MANAGER">👑 Proje Yöneticisi</option>
              <option value="VIEWER">👁️ Görüntüleyici (Viewer)</option>
            </select>
          </div>
        `).join('');
      }
    }
    document.getElementById('projectModal').classList.add('open');
  });

  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('pTitle').value.trim();
    const description = document.getElementById('pDesc').value.trim();
    const initial_start_date = new Date(document.getElementById('pStart').value).toISOString();
    const initial_due_date = new Date(document.getElementById('pDue').value).toISOString();

    const members = [];
    document.querySelectorAll('#newProjectMembersChecklist .new-proj-member-cb:checked').forEach(cb => {
      const uid = cb.value;
      const roleSel = document.querySelector(`#newProjectMembersChecklist .new-proj-member-role[data-user-id="${uid}"]`);
      members.push({
        user_id: uid,
        role: roleSel ? roleSel.value : 'EDITOR'
      });
    });

    const newProj = await apiCall('/api/projects', 'POST', {
      title,
      description,
      initial_start_date,
      initial_due_date,
      members
    });

    showToast(
      members.length > 0
        ? `📁 Yeni proje oluşturuldu ve seçilen ${members.length} kişiye "Projeye Dahil Edildiniz" Adaptive Card e-postası gönderildi!`
        : '📁 Yeni proje oluşturuldu.',
      'success'
    );
    document.getElementById('projectModal').classList.remove('open');
    e.target.reset();
    await loadProjects();
    await loadProjectTasks(newProj.id);
    await loadNotifications();
  });

  let editingPersonnelId = null;

  // Yeni Personel Modalı (Admin)
  document.getElementById('newPersonnelBtn')?.addEventListener('click', () => {
    editingPersonnelId = null;
    document.getElementById('personnelForm').reset();
    const deactCheck = document.getElementById('persIsDeactivated');
    if (deactCheck) {
      deactCheck.checked = false;
      deactCheck.disabled = false;
    }
    const reasonRow = document.getElementById('persDeactivateReasonRow');
    if (reasonRow) reasonRow.style.display = 'none';
    const reasonInput = document.getElementById('persDeactivationReason');
    if (reasonInput) reasonInput.value = '';
    const statusBadge = document.getElementById('persStatusBadge');
    if (statusBadge) {
      statusBadge.className = 'nav-badge success';
      statusBadge.textContent = '🟢 Aktif Personel';
    }
    const modalTitle = document.querySelector('#personnelModal .modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Yeni Personel Kartı Ekle';
    document.getElementById('personnelModal').classList.add('open');
  });

  // Personel Devre Dışı Bırakma Checkbox Değişim Dinleyicisi
  document.getElementById('persIsDeactivated')?.addEventListener('change', (e) => {
    const isDeact = e.target.checked;
    const reasonRow = document.getElementById('persDeactivateReasonRow');
    const statusBadge = document.getElementById('persStatusBadge');
    if (reasonRow) reasonRow.style.display = isDeact ? 'block' : 'none';
    if (statusBadge) {
      statusBadge.className = isDeact ? 'nav-badge danger' : 'nav-badge success';
      statusBadge.textContent = isDeact ? '⛔ Devre Dışı (Erişim Engellendi)' : '🟢 Aktif Personel';
    }
  });

  // Personel Düzenle Butonu Tıklaması
  document.getElementById('personnelTable')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-personnel');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const u = state.personnelList.find(p => p.id === id);
      if (!u) return;
      editingPersonnelId = id;
      document.getElementById('persName').value = u.name || '';
      document.getElementById('persEmail').value = u.email || '';
      document.getElementById('persPhone').value = u.phone || '';
      document.getElementById('persPassword').value = u.password || '123';
      const normCountry = (u.country || '').replace(/\ufffd/g, 'ü');
      document.getElementById('persCountry').value = (normCountry.includes('Türk') || normCountry.includes('Trk')) ? 'Türkiye' : (u.country || 'Türkiye');
      document.getElementById('persDept').value = u.department || '';
      document.getElementById('persCanCreateProj').checked = !!u.can_create_project;
      const repToggle = document.getElementById('persCanBuildReports');
      if (repToggle) repToggle.checked = !!u.can_build_reports;

      // Devre Dışı Durumu ve Gerekçesi
      const isDeact = u.is_active === false;
      const isSelf = u.id === state.currentUser?.id;
      const deactCheck = document.getElementById('persIsDeactivated');
      const reasonRow = document.getElementById('persDeactivateReasonRow');
      const reasonInput = document.getElementById('persDeactivationReason');
      const statusBadge = document.getElementById('persStatusBadge');

      if (deactCheck) {
        deactCheck.checked = isDeact;
        deactCheck.disabled = isSelf;
        deactCheck.title = isSelf ? 'Sistem Yöneticisi kendi hesabını devre dışı bırakamaz.' : '';
      }
      if (reasonRow) reasonRow.style.display = isDeact ? 'block' : 'none';
      if (reasonInput) reasonInput.value = u.deactivation_reason || '';
      if (statusBadge) {
        statusBadge.className = isDeact ? 'nav-badge danger' : 'nav-badge success';
        statusBadge.textContent = isDeact ? '⛔ Devre Dışı (Erişim Engellendi)' : '🟢 Aktif Personel';
      }

      const modalTitle = document.querySelector('#personnelModal .modal-header h3');
      if (modalTitle) modalTitle.textContent = 'Personel Bilgilerini Düzenle';
      document.getElementById('personnelModal').classList.add('open');
    }
  });

  document.getElementById('personnelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isDeact = document.getElementById('persIsDeactivated')?.checked || false;
    const deactReason = document.getElementById('persDeactivationReason')?.value.trim() || '';

    const body = {
      name: document.getElementById('persName').value.trim(),
      email: document.getElementById('persEmail').value.trim(),
      phone: document.getElementById('persPhone').value.trim(),
      password: document.getElementById('persPassword').value.trim() || '123',
      country: document.getElementById('persCountry').value,
      department: document.getElementById('persDept').value.trim() || 'Genel',
      can_create_project: document.getElementById('persCanCreateProj').checked,
      can_build_reports: document.getElementById('persCanBuildReports')?.checked || false,
      is_active: !isDeact,
      deactivation_reason: isDeact ? (deactReason || 'İşten ayrılma / Erişim engellendi') : ''
    };

    if (editingPersonnelId) {
      await apiCall(`/api/admin/personnel/${editingPersonnelId}`, 'PUT', body);
      showToast(isDeact ? '⛔ Personel devre dışı bırakıldı ve erişimi engellendi.' : 'Personel bilgileri güncellendi.', isDeact ? 'info' : 'success');
      editingPersonnelId = null;
    } else {
      const created = await apiCall('/api/admin/personnel', 'POST', body);
      if (created?.welcome_outbox_id) {
        emailAutoState.selectedOutboxId = created.welcome_outbox_id;
      }
      showToast(
        `🎉 ${body.name} eklendi ve "${body.email}" adresine Sistem Erişim Bilgileri & İlk Giriş Şifresi içeren Karşılama E-postası otomatik gönderildi!`,
        'success'
      );
    }
    document.getElementById('personnelModal').classList.remove('open');
    await loadPersonnel();
    await loadNotifications();
  });

  // Personel Yetki Toggles (Proje Açma & Rapor Oluşturma)
  document.getElementById('personnelTable')?.addEventListener('change', async (e) => {
    const projToggle = e.target.closest('.perm-toggle');
    if (projToggle) {
      await apiCall(`/api/admin/personnel/${projToggle.dataset.id}`, 'PUT', {
        can_create_project: projToggle.checked
      });
      showToast('Personel proje yetkisi güncellendi.', 'success');
      await loadPersonnel();
    }

    const reportToggle = e.target.closest('.report-perm-toggle');
    if (reportToggle) {
      await apiCall(`/api/admin/personnel/${reportToggle.dataset.id}`, 'PUT', {
        can_build_reports: reportToggle.checked
      });
      showToast('Personel rapor yetkisi güncellendi.', 'success');
      await loadPersonnel();
      if (reportToggle.dataset.id === state.currentUser?.id) {
        state.currentUser.can_build_reports = reportToggle.checked;
        const reportsNavBtn = document.getElementById('navReportsBuilderBtn');
        if (reportsNavBtn) {
          reportsNavBtn.style.display = (state.currentUser.system_role === 'ADMIN' || state.currentUser.can_build_reports) ? 'flex' : 'none';
        }
      }
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

  // İçe ve Dışa Aktarma (Excel, CSV, JSON, Yazdır) Dinleyicileri
  setupImportExportListeners();
}

// ==============================================================
// 5.1. İÇE VE DIŞA AKTARMA (EXCEL / CSV / JSON / YAZDIR)
// ==============================================================

let parsedImportTasks = [];

function setupImportExportListeners() {
  // Dışa Aktar Dropdown Açma / Kapama
  const exportBtn = document.getElementById('exportMenuBtn');
  const exportWrapper = document.getElementById('exportDropdownWrapper');

  if (exportBtn && exportWrapper) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportWrapper.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!exportWrapper.contains(e.target)) {
        exportWrapper.classList.remove('open');
      }
    });
  }

  // 1. Excel (CSV) Dışa Aktar
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    exportWrapper?.classList.remove('open');
    exportProjectToCsv();
  });

  // 2. JSON Dışa Aktar
  document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
    exportWrapper?.classList.remove('open');
    exportProjectToJson();
  });

  // 3. Yazdır / PDF
  document.getElementById('printReportBtn')?.addEventListener('click', () => {
    exportWrapper?.classList.remove('open');
    window.print();
  });

  // 4. İçe Aktar Modalı Aç
  document.getElementById('importTasksBtn')?.addEventListener('click', () => {
    resetCsvImportModal();
    document.getElementById('importModal')?.classList.add('open');
  });

  // 5. Örnek CSV Şablonu İndir
  document.getElementById('downloadCsvTemplateBtn')?.addEventListener('click', () => {
    downloadCsvTemplate();
  });

  // 6. CSV Dosya Seçimi & Sürükle Bırak (Dropzone)
  const dropzone = document.getElementById('csvDropzone');
  const fileInput = document.getElementById('csvFileInput');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleCsvFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleCsvFile(e.target.files[0]);
      }
    });
  }

  // 7. CSV Seçimini Temizle
  document.getElementById('clearCsvFileBtn')?.addEventListener('click', () => {
    resetCsvImportModal();
  });

  // 8. İçe Aktarımı Onayla ve Gönder
  document.getElementById('confirmImportBtn')?.addEventListener('click', async () => {
    if (!state.currentProjectId) {
      showToast('Lütfen önce bir proje seçin.', 'error');
      return;
    }

    if (!parsedImportTasks || parsedImportTasks.length === 0) {
      showToast('Yüklenecek görev bulunamadı.', 'error');
      return;
    }

    const btn = document.getElementById('confirmImportBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Yükleniyor...';

    try {
      const res = await apiCall(`/api/projects/${state.currentProjectId}/tasks/bulk`, 'POST', {
        tasks: parsedImportTasks
      });

      showToast(`🎉 ${res.count} görev başarıyla projeye aktarıldı!`, 'success');
      document.getElementById('importModal')?.classList.remove('open');
      resetCsvImportModal();
      await loadProjectTasks(state.currentProjectId);
    } catch (err) {
      showToast('İçe aktarma hatası: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Görevleri Projeye Aktar';
    }
  });
}

function resetCsvImportModal() {
  parsedImportTasks = [];
  const fileInput = document.getElementById('csvFileInput');
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('csvPreviewContainer');
  if (preview) preview.style.display = 'none';
  const tableBody = document.getElementById('csvPreviewTableBody');
  if (tableBody) tableBody.innerHTML = '';
  const confirmBtn = document.getElementById('confirmImportBtn');
  if (confirmBtn) confirmBtn.disabled = true;
}

// CSV Dosyasını Oku ve Ayrıştır
function handleCsvFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseAndPreviewCsv(text);
  };
  reader.readAsText(file, 'UTF-8');
}

function parseAndPreviewCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast('CSV dosyasında en az bir başlık satırı ve bir veri satırı bulunmalıdır.', 'error');
    return;
  }

  // Ayırıcı Tespiti: Noktalı virgül (;) veya virgül (,)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // CSV Satır Bölücü (Tırnak içindeki ayırıcıları korur)
  function splitCsvRow(row, delim) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(s => s.replace(/^["']|["']$/g, '').trim());
  }

  const rawHeaders = splitCsvRow(lines[0], delimiter).map(h => h.toLowerCase());

  // Sütun Eşleştirici
  const colMap = {
    title: rawHeaders.findIndex(h => h.includes('başlık') || h.includes('baslik') || h.includes('title') || h.includes('görev') || h.includes('gorev') || h.includes('ad')),
    type: rawHeaders.findIndex(h => h.includes('tür') || h.includes('tur') || h.includes('type')),
    priority: rawHeaders.findIndex(h => h.includes('öncelik') || h.includes('oncelik') || h.includes('priority')),
    assignee: rawHeaders.findIndex(h => h.includes('sorumlu') || h.includes('assignee') || h.includes('kişi') || h.includes('kisi') || h.includes('eposta') || h.includes('email')),
    start: rawHeaders.findIndex(h => h.includes('başlangıç') || h.includes('baslangic') || h.includes('start')),
    due: rawHeaders.findIndex(h => h.includes('bitiş') || h.includes('bitis') || h.includes('due') || h.includes('teslim') || h.includes('hedef')),
    description: rawHeaders.findIndex(h => h.includes('açıklama') || h.includes('aciklama') || h.includes('desc') || h.includes('not'))
  };

  if (colMap.title === -1) {
    showToast("CSV dosyasında 'Görev Başlığı' sütunu bulunamadı. Lütfen örnek şablonu kullanın.", 'error');
    return;
  }

  const now = new Date();
  parsedImportTasks = [];
  const tbody = document.getElementById('csvPreviewTableBody');
  if (tbody) tbody.innerHTML = '';

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvRow(lines[i], delimiter);
    const title = row[colMap.title] || '';
    if (!title) continue;

    let type = 'TASK';
    if (colMap.type !== -1 && row[colMap.type]) {
      const tVal = row[colMap.type].toUpperCase();
      if (tVal.includes('MILESTONE') || tVal.includes('KİLOMETRE') || tVal.includes('TAŞ')) type = 'MILESTONE';
      else if (tVal.includes('BUG') || tVal.includes('HATA')) type = 'BUG';
    }

    let priority = 'NORMAL';
    if (colMap.priority !== -1 && row[colMap.priority]) {
      const pVal = row[colMap.priority].toUpperCase();
      if (pVal.includes('HIGH') || pVal.includes('YÜKSEK')) priority = 'HIGH';
      else if (pVal.includes('LOW') || pVal.includes('DÜŞÜK')) priority = 'LOW';
    }

    const assigneeStr = colMap.assignee !== -1 ? row[colMap.assignee] : '';
    const startStr = colMap.start !== -1 ? row[colMap.start] : '';
    const dueStr = colMap.due !== -1 ? row[colMap.due] : '';
    const descStr = colMap.description !== -1 ? row[colMap.description] : '';

    const taskObj = {
      title,
      type,
      priority,
      assignee_email_or_name: assigneeStr,
      initial_start_date: startStr ? new Date(startStr).toISOString() : now.toISOString(),
      initial_due_date: dueStr ? new Date(dueStr).toISOString() : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: descStr
    };

    parsedImportTasks.push(taskObj);

    // Tablo Satırı Oluştur
    if (tbody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${parsedImportTasks.length}</td>
        <td><strong>${escapeHtml(taskObj.title)}</strong></td>
        <td><span class="op-type-badge ${type.toLowerCase()}">${type === 'MILESTONE' ? '🏁 Taş' : (type === 'BUG' ? '🐞 Hata' : '📌 Görev')}</span></td>
        <td><span class="op-priority-badge ${priority === 'HIGH' ? 'high' : ''}">${priority === 'HIGH' ? '🔥 Yüksek' : 'Normal'}</span></td>
        <td>${escapeHtml(assigneeStr || 'Atanmamış')}</td>
        <td>${formatDate(taskObj.initial_start_date)}</td>
        <td>${formatDate(taskObj.initial_due_date)}</td>
        <td><span class="badge-status-ready">✅ Hazır</span></td>
      `;
      tbody.appendChild(tr);
    }
  }

  document.getElementById('csvParsedCount').textContent = parsedImportTasks.length;
  document.getElementById('csvPreviewContainer').style.display = 'block';
  document.getElementById('confirmImportBtn').disabled = parsedImportTasks.length === 0;
  showToast(`✅ ${parsedImportTasks.length} adet görev başarıyla okundu ve listelendi.`, 'info');
}

// Örnek CSV Şablonu İndirme
function downloadCsvTemplate() {
  const headers = ['Görev Başlığı', 'Tür', 'Öncelik', 'Sorumlu', 'Başlangıç Tarihi', 'Bitiş Tarihi', 'Açıklama'];
  const sampleRows = [
    ['Arayüz Wireframe ve Tasarım Hazırlığı', 'TASK', 'HIGH', 'ahmet@fggroup.com.tr', '2026-11-01', '2026-11-05', 'Figma tasarımları oluşturulacak'],
    ['Kullanıcı Onayı ve Tasarım Kilometre Taşı', 'MILESTONE', 'HIGH', 'admin@fggroup.com.tr', '2026-11-06', '2026-11-06', 'Müşteri sunumu ve onay'],
    ['Giriş Butonu Hizalama Düzeltmesi', 'BUG', 'NORMAL', 'hans@fggroup.com.tr', '2026-11-07', '2026-11-08', 'CSS responsive kayma sorunu']
  ];

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
  ].join('\r\n');

  downloadFileBlob(csvContent, 'ornek_gorev_sablonu.csv', 'text/csv;charset=utf-8;');
  showToast('📄 Örnek CSV şablonu indirildi.', 'success');
}

// Projeyi Excel CSV Olarak Dışa Aktarma (UTF-8 BOM ile Türkçe Karakter Garantili)
function exportProjectToCsv() {
  if (!state.tasks || state.tasks.length === 0) {
    showToast('Dışa aktarılacak görev bulunamadı.', 'error');
    return;
  }

  const currentProj = state.projects.find(p => p.id === state.currentProjectId);
  const projTitle = currentProj ? currentProj.title.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Proje';

  const headers = [
    'ID',
    'Görev Başlığı',
    'Tür',
    'Öncelik',
    'Çalışma Durumu',
    'İlerleme (%)',
    'Sorumlu Kişi',
    'Sorumlu E-Posta',
    'Başlangıç Hedefi',
    'Bitiş Hedefi',
    'Gerçek Başlangıç',
    'Gerçek Bitiş',
    'Açıklama'
  ];

  const rows = state.tasks.map(t => {
    const assignee = state.personnelList.find(p => p.id === t.assignee_id);
    const statusText = {
      BLOCKED: 'Öncül Bekliyor (BLOCKED)',
      READY: 'Başlamaya Hazır (READY)',
      IN_PROGRESS: 'Devam Ediyor (IN_PROGRESS)',
      COMPLETED: 'Tamamlandı (COMPLETED)'
    }[t.work_status] || t.work_status;

    return [
      t.id.slice(0, 8),
      t.title,
      t.type,
      t.priority,
      statusText,
      t.progress || 0,
      assignee ? assignee.name : 'Atanmamış',
      assignee ? assignee.email : '',
      t.current_start_date ? t.current_start_date.slice(0, 10) : '',
      t.current_due_date ? t.current_due_date.slice(0, 10) : '',
      t.actual_start_date ? t.actual_start_date.slice(0, 10) : '',
      t.actual_completion_date ? t.actual_completion_date.slice(0, 10) : '',
      t.description || ''
    ];
  });

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
  ].join('\r\n');

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFileBlob(csvContent, `${projTitle}_Gorevleri_${dateStr}.csv`, 'text/csv;charset=utf-8;');
  showToast('📊 Excel (CSV) dosyası başarıyla indirildi.', 'success');
}

// Projeyi Tam JSON Olarak Dışa Aktarma
function exportProjectToJson() {
  const currentProj = state.projects.find(p => p.id === state.currentProjectId);
  const projTitle = currentProj ? currentProj.title.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Proje';

  const exportPayload = {
    exported_at: new Date().toISOString(),
    system: 'FG Group Görev ve Bağımlılık Yönetim Sistemi v0.3',
    project: currentProj,
    tasks: state.tasks,
    dependencies: state.dependencies
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFileBlob(jsonStr, `${projTitle}_Yedek_${dateStr}.json`, 'application/json;charset=utf-8;');
  showToast('💾 JSON proje yedeği indirildi.', 'success');
}

// Dosya İndirme Yardımcısı
function downloadFileBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function openExplanationModal(taskId, title) {
  const form = document.getElementById('explanationForm');
  form.dataset.taskId = taskId;
  document.getElementById('expTaskTitle').textContent = title;
  document.getElementById('explanationModal').classList.add('open');
}

function populateTaskModalAssignees(recommendedDept = null) {
  const assigneeEl = document.getElementById('tAssignee');
  if (!assigneeEl || assigneeEl.disabled) return;
  const activeUsers = (state.personnelList || []).filter(p => p.is_active !== false);
  const currentVal = assigneeEl.value;

  if (!recommendedDept) {
    assigneeEl.innerHTML = '<option value="">(Atanmamış)</option>' +
      activeUsers.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.department || 'Genel')})</option>`).join('');
    if (currentVal) assigneeEl.value = currentVal;
    return;
  }

  const normDept = recommendedDept.toLowerCase().trim();
  const recUsers = activeUsers.filter(p => {
    const d = (p.department || '').toLowerCase();
    const t = (p.job_title || '').toLowerCase();
    const n = (p.name || '').toLowerCase();
    return d.includes(normDept) || t.includes(normDept) || n.includes(normDept);
  });
  const otherUsers = activeUsers.filter(p => !recUsers.some(r => r.id === p.id));

  let html = '<option value="">(Atanmamış)</option>';
  if (recUsers.length > 0) {
    html += `<optgroup label="⭐ Önerilen Personel (${escapeHtml(recommendedDept)})">` +
      recUsers.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.department || 'Genel')})</option>`).join('') +
      '</optgroup>';
  }
  if (otherUsers.length > 0) {
    html += '<optgroup label="Diğer Ekip Üyeleri">' +
      otherUsers.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.department || 'Genel')})</option>`).join('') +
      '</optgroup>';
  }
  assigneeEl.innerHTML = html;
  if (currentVal && activeUsers.some(u => u.id === currentVal)) {
    assigneeEl.value = currentVal;
  } else if (recUsers.length === 1) {
    assigneeEl.value = recUsers[0].id;
  }
}

function populateWorkflowStepDropdown(selectedName = '') {
  const stepSelect = document.getElementById('tWorkflowStep');
  if (!stepSelect) return;
  let options = '<option value="">İş Adımı Seçiniz (KUMAŞ, DİKİM, YIKAMA, vb.)...</option>';
  (state.workflowSteps || []).forEach(s => {
    const isSel = s.name === selectedName ? 'selected' : '';
    options += `<option value="${escapeHtml(s.name)}" ${isSel}>${escapeHtml(s.name)}</option>`;
  });
  stepSelect.innerHTML = options;
  if (selectedName) stepSelect.value = selectedName;
}

function populateTaskDefinitionDropdown(stepName = '', selectedTitle = '') {
  const defSelect = document.getElementById('tTaskDefinition');
  const customInput = document.getElementById('tCustomDefInput');
  if (!defSelect) return;

  const defaultTemplates = [
    { step_name: 'KOLEKSİYON OLUŞTURMA', title: 'AW27 koleksiyonun eksiklerini oluşturma', default_duration_days: 21, suggested_department: 'Moda Tasarım & Koleksiyon' },
    { step_name: 'KUMAŞ', title: 'Tasarım ve satış departmanının beklentisi doğrultusunda kumaşların organize edilmesi', default_duration_days: 9, suggested_department: 'Kumaş & Tedarik' },
    { step_name: 'TEKNİK ÇİZİM', title: 'Koleksiyonun teknik çizimlerinin hazırlanması', default_duration_days: 7, suggested_department: 'Moda Tasarım & Koleksiyon' },
    { step_name: 'YIKAMA', title: 'Koleksiyon model hazırlığı yıkamaların belirlenmesi', default_duration_days: 7, suggested_department: 'Yıkama & AR-GE' },
    { step_name: 'KALIP MODELHANE', title: 'Modellerin kalıp departmanına aktarılması', default_duration_days: 7, suggested_department: 'Kalıp & Modelhane' },
    { step_name: 'DİKİM', title: 'Modellerin dikim departmanına aktarılması', default_duration_days: 12, suggested_department: 'Dikim Atölyesi' },
    { step_name: 'YIKAMA', title: 'Modellerin yıkama bölümüne aktarılması', default_duration_days: 14, suggested_department: 'Yıkama & AR-GE' },
    { step_name: 'FINISHING', title: 'Modellerin finish bölümüne aktarılması', default_duration_days: 12, suggested_department: 'Finishing & Paket' }
  ];

  // state.taskDefinitions ile defaultTemplates birleştir (tekilleştir)
  const combined = [...(state.taskDefinitions || [])];
  defaultTemplates.forEach(dt => {
    if (!combined.some(c => c.title?.toLowerCase() === dt.title.toLowerCase())) {
      combined.push(dt);
    }
  });

  let options = '<option value="">Görev Tanımı Seçiniz...</option>';

  if (stepName) {
    const matching = combined.filter(d => (d.step_name || d.workflow_step || '').toUpperCase() === stepName.toUpperCase());
    const others = combined.filter(d => (d.step_name || d.workflow_step || '').toUpperCase() !== stepName.toUpperCase());

    if (matching.length > 0) {
      options += `<optgroup label="⭐ ${escapeHtml(stepName)} Adımına Özel Tanımlar">`;
      matching.forEach(d => {
        const isSel = d.title === selectedTitle ? 'selected' : '';
        options += `<option value="${escapeHtml(d.title)}" data-step="${escapeHtml(d.step_name || d.workflow_step || '')}" data-duration="${d.default_duration_days || 7}" data-dept="${escapeHtml(d.suggested_department || d.department || '')}" ${isSel}>${escapeHtml(d.title)}</option>`;
      });
      options += '</optgroup>';
    }

    if (others.length > 0) {
      options += '<optgroup label="📋 Diğer Standart Tekstil Görev Tanımları">';
      others.forEach(d => {
        const isSel = d.title === selectedTitle ? 'selected' : '';
        options += `<option value="${escapeHtml(d.title)}" data-step="${escapeHtml(d.step_name || d.workflow_step || '')}" data-duration="${d.default_duration_days || 7}" data-dept="${escapeHtml(d.suggested_department || d.department || '')}" ${isSel}>[${escapeHtml(d.step_name || d.workflow_step || '')}] ${escapeHtml(d.title)}</option>`;
      });
      options += '</optgroup>';
    }
  } else {
    // İş adımı henüz seçilmemişse tüm standart tanımları listele
    options += '<optgroup label="📋 Standart Tekstil Görev Tanımları (8 Adım)">';
    combined.forEach(d => {
      const isSel = d.title === selectedTitle ? 'selected' : '';
      options += `<option value="${escapeHtml(d.title)}" data-step="${escapeHtml(d.step_name || d.workflow_step || '')}" data-duration="${d.default_duration_days || 7}" data-dept="${escapeHtml(d.suggested_department || d.department || '')}" ${isSel}>[${escapeHtml(d.step_name || d.workflow_step || '')}] ${escapeHtml(d.title)}</option>`;
    });
    options += '</optgroup>';
  }

  options += '<option value="__custom__">✍️ Farklı / Özel Tanım Yaz (Sezon Kodu vb.)...</option>';
  defSelect.innerHTML = options;
  if (selectedTitle) defSelect.value = selectedTitle;
  defSelect.title = defSelect.selectedOptions?.[0]?.text || '';
  if (customInput) customInput.style.display = (defSelect.value === '__custom__') ? 'block' : 'none';
}

function setupWorkflowModalStepListeners() {
  const stepSelect = document.getElementById('tWorkflowStep');
  const defSelect = document.getElementById('tTaskDefinition');
  const customInput = document.getElementById('tCustomDefInput');
  const titleInput = document.getElementById('tTitle');
  const startInput = document.getElementById('tStart');
  const dueInput = document.getElementById('tDue');

  const syncTitle = () => {
    const s = stepSelect ? stepSelect.value : '';
    let d = defSelect ? defSelect.value : '';
    if (d === '__custom__' && customInput) {
      d = customInput.value.trim();
    }
    const finalT = (s && d) ? `[${s}] ${d}` : (d || s || '');
    if (titleInput) titleInput.value = finalT;
  };

  if (stepSelect && !stepSelect.dataset.listenerAttached) {
    stepSelect.dataset.listenerAttached = 'true';
    stepSelect.addEventListener('change', () => {
      stepSelect.title = stepSelect.selectedOptions?.[0]?.text || '';
      const stepVal = stepSelect.value;
      populateTaskDefinitionDropdown(stepVal);
      syncTitle();

      const stepObj = (state.workflowSteps || []).find(s => s.name === stepVal);
      if (stepVal) {
        const projSelect = document.getElementById('tProject');
        if (projSelect && projSelect.value) {
          populateTaskModalAssignees(stepObj?.department || null);
        }
      }
    });
  }

  if (defSelect && !defSelect.dataset.listenerAttached) {
    defSelect.dataset.listenerAttached = 'true';
    defSelect.addEventListener('change', () => {
      defSelect.title = defSelect.selectedOptions?.[0]?.text || '';
      const defVal = defSelect.value;
      if (defVal === '__custom__') {
        if (customInput) {
          customInput.style.display = 'block';
          customInput.placeholder = 'Örn: AW27 / SS27 model eksikleri veya özel iş tanımı...';
          customInput.focus();
        }
      } else {
        if (customInput) customInput.style.display = 'none';
        const selOption = defSelect.selectedOptions ? defSelect.selectedOptions[0] : null;
        if (selOption && selOption.dataset.step && stepSelect) {
          const stepVal = selOption.dataset.step;
          if (stepSelect.value !== stepVal) {
            stepSelect.value = stepVal;
            const stepObj = (state.workflowSteps || []).find(s => s.name === stepVal);
            populateTaskModalAssignees(stepObj?.department || selOption.dataset.dept || null);
          }
        }
      }
      syncTitle();

      if (defVal && defVal !== '__custom__') {
        const selOption = defSelect.selectedOptions ? defSelect.selectedOptions[0] : null;
        const durationDays = selOption?.dataset?.duration ? parseInt(selOption.dataset.duration, 10) : 7;
        const now = new Date();
        const due = new Date();
        due.setDate(due.getDate() + durationDays);

        if (startInput) startInput.value = now.toISOString().slice(0, 10);
        if (dueInput) dueInput.value = due.toISOString().slice(0, 10);

        const defDept = selOption?.dataset?.dept;
        if (defDept) {
          populateTaskModalAssignees(defDept);
        }
      }
    });
  }

  if (customInput && !customInput.dataset.listenerAttached) {
    customInput.dataset.listenerAttached = 'true';
    customInput.addEventListener('input', () => {
      customInput.title = customInput.value;
      syncTitle();
    });
  }
}

function populateTaskModalSelects() {
  const u = state.currentUser;
  const isAdmin = u?.system_role === 'ADMIN';
  const canCreate = !!u?.can_create_project;

  // Yetkili olunan projeler listesi
  const authorizedProjects = (state.projects || []).filter(p => {
    if (isAdmin || canCreate) return true;
    if (p.created_by_user_id === u?.id) return true;
    const isMember = (p.members || []).some(m => m.user_id === u?.id && (m.role === 'PROJECT_MANAGER' || m.role === 'EDITOR'));
    return isMember;
  });

  const projSelect = document.getElementById('tProject');
  const projBadge = document.getElementById('tProjectBadge');
  const personalNotice = document.getElementById('tPersonalNotice');
  const assigneeEl = document.getElementById('tAssignee');
  const predEl = document.getElementById('tPredecessor');
  const addStepBtn = document.getElementById('tAddStepBtn');
  const addDefBtn = document.getElementById('tAddDefBtn');

  // Adım ve Tanım Seçicilerini Doldur
  populateWorkflowStepDropdown();
  populateTaskDefinitionDropdown('');
  setupWorkflowModalStepListeners();

  if (!projSelect) return;

  const updateCatalogBtnVisibility = (selectedProjId) => {
    const currProj = state.projects.find(p => p.id === selectedProjId);
    const isManager = currProj?.created_by_user_id === u?.id || (currProj?.members || []).some(m => m.user_id === u?.id && m.role === 'PROJECT_MANAGER');
    const canManageCatalog = isAdmin || canCreate || isManager || (selectedProjId != null && authorizedProjects.length > 0);
    if (addStepBtn) addStepBtn.style.display = canManageCatalog ? 'inline-block' : 'none';
    if (addDefBtn) addDefBtn.style.display = canManageCatalog ? 'inline-block' : 'none';
  };

  if (authorizedProjects.length === 0) {
    // STANDART ÇALIŞAN (Yalnızca Bireysel Görev / Kişisel To-Do açabilir)
    projSelect.innerHTML = '<option value="">📌 Bireysel Görev / Kişisel To-Do (Kendi Takibiniz)</option>';
    projSelect.value = '';
    projSelect.disabled = true;

    if (projBadge) {
      projBadge.textContent = 'Standart Personel (Yalnızca Kişisel To-Do)';
      projBadge.style.background = '#fef3c7';
      projBadge.style.color = '#b45309';
    }
    if (personalNotice) personalNotice.style.display = 'block';

    if (assigneeEl) {
      assigneeEl.innerHTML = `<option value="${u?.id || ''}">${u?.name || 'Siz'} (Siz - Kişisel Görev)</option>`;
      assigneeEl.value = u?.id || '';
      assigneeEl.disabled = true;
    }

    if (predEl) {
      predEl.innerHTML = '<option value="">(Bireysel görevlerde öncül bağımlılık bulunmaz)</option>';
      predEl.disabled = true;
    }
    const stepSelect = document.getElementById('tWorkflowStep');
    const defSelect = document.getElementById('tTaskDefinition');
    const customInput = document.getElementById('tCustomDefInput');
    if (stepSelect) {
      stepSelect.innerHTML = '<option value="KİŞİSEL" selected>📌 KİŞİSEL / BİREYSEL</option>';
    }
    if (defSelect) {
      defSelect.innerHTML = '<option value="__custom__" selected>✍️ Kişisel Görevinizi / Notunuzu Yazınız...</option>';
    }
    if (customInput) {
      customInput.style.display = 'block';
      customInput.placeholder = 'Kişisel yapılacak işi yazınız...';
    }
    updateCatalogBtnVisibility(null);
  } else {
    // PROJE YETKİLİSİ / ADMİN (Şirket projesi seçebilir veya bireysel to-do açabilir)
    projSelect.disabled = false;
    let projOptions = '<option value="">📌 Bireysel Görev / Kişisel To-Do (Projesiz Takip)</option>';
    projOptions += authorizedProjects.map(p => `<option value="${p.id}">📁 ${escapeHtml(p.title)}</option>`).join('');
    projSelect.innerHTML = projOptions;

    // Varsayılan seçim: Aktif proje yetkiliyse o proje seçili gelsin
    const activeProjValid = authorizedProjects.some(p => p.id === state.currentProjectId);
    projSelect.value = activeProjValid ? state.currentProjectId : '';

    const updateFieldsForSelection = (selectedId) => {
      updateCatalogBtnVisibility(selectedId);
      if (!selectedId) {
        // Bireysel görev seçildi
        if (projBadge) {
          projBadge.textContent = 'Bireysel Takip (Projesiz)';
          projBadge.style.background = '#ede9fe';
          projBadge.style.color = '#6d28d9';
        }
        if (personalNotice) personalNotice.style.display = 'block';

        if (assigneeEl) {
          assigneeEl.innerHTML = `<option value="${u?.id || ''}">${u?.name || 'Siz'} (Siz - Bireysel Görev)</option>`;
          assigneeEl.value = u?.id || '';
          assigneeEl.disabled = true;
        }

        if (predEl) {
          predEl.innerHTML = '<option value="">(Bireysel görevlerde öncül bağımlılık bulunmaz)</option>';
          predEl.disabled = true;
        }

        const stepSelect = document.getElementById('tWorkflowStep');
        const defSelect = document.getElementById('tTaskDefinition');
        const customInput = document.getElementById('tCustomDefInput');
        if (stepSelect) {
          stepSelect.innerHTML = '<option value="KİŞİSEL" selected>📌 KİŞİSEL / BİREYSEL</option><option value="GÖREV">📌 GÖREV</option><option value="NOT">📝 NOT / HATIRLATMA</option>' +
            (state.workflowSteps || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
        }
        if (defSelect) {
          defSelect.innerHTML = '<option value="__custom__" selected>✍️ Kişisel Görevinizi / Notunuzu Yazınız...</option>';
        }
        if (customInput) {
          customInput.style.display = 'block';
          customInput.placeholder = 'Kişisel yapılacak işi yazınız...';
        }
      } else {
        // Şirket projesi seçildi
        if (projBadge) {
          projBadge.textContent = 'Şirket Projesi Görevi';
          projBadge.style.background = '#dcfce7';
          projBadge.style.color = '#15803d';
        }
        if (personalNotice) personalNotice.style.display = 'none';

        if (assigneeEl) {
          assigneeEl.disabled = false;
          populateTaskModalAssignees(null);
        }

        if (predEl) {
          predEl.disabled = false;
          const projTasks = (state.tasks || []).filter(t => t.project_id === selectedId);
          predEl.innerHTML = '<option value="">(Hiçbir görevi beklemiyor - Hemen başlayabilir)</option>' +
            projTasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${t.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'})</option>`).join('');
        }

        populateWorkflowStepDropdown();
        populateTaskDefinitionDropdown('');
        const customInput = document.getElementById('tCustomDefInput');
        if (customInput) customInput.style.display = 'none';
      }
    };

    updateFieldsForSelection(projSelect.value);

    projSelect.onchange = (e) => {
      updateFieldsForSelection(e.target.value);
    };
  }
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

// ==============================================================
// 6. ÖZEL RAPOR OLUŞTURUCU (DRAG & DROP REPORT BUILDER)
// ==============================================================

let reportState = {
  data: null,
  selectedProjectId: 'all',
  widgets: [], // Array of { id, widgetType, width: 'full' | 'half', noteText }
  draggedWidgetType: null
};

async function initReportBuilder() {
  // Proje Seçimini Doldur
  const projectSelect = document.getElementById('reportProjectSelect');
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="all">Tüm Projeler (Konsolide)</option>' +
      state.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    projectSelect.value = reportState.selectedProjectId;
  }

  // Varsayılan widget seti boşsa şablonla başlat
  if (reportState.widgets.length === 0) {
    applyReportTemplate('executive');
  }

  await Promise.all([
    loadReportBuilderData(),
    loadSavedReportLayouts()
  ]);
  setupReportDragAndDrop();
  setupReportControls();
}

let savedCustomReportLayouts = [];

async function loadSavedReportLayouts() {
  try {
    savedCustomReportLayouts = await apiCall('/api/reports/custom-layouts');
    renderSavedReportLayoutsMenu();
  } catch (err) {
    savedCustomReportLayouts = [];
  }
}

function renderSavedReportLayoutsMenu() {
  const section = document.getElementById('savedReportLayoutsSection');
  const listEl = document.getElementById('savedReportLayoutsList');
  if (!section || !listEl) return;

  if (!savedCustomReportLayouts || savedCustomReportLayouts.length === 0) {
    section.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  listEl.innerHTML = savedCustomReportLayouts.map(layout => `
    <button type="button" class="template-item saved-layout-item" data-layout-id="${layout.id}">
      <strong>📌 ${escapeHtml(layout.name)}</strong>
      <span>${(layout.widgets || []).length} bileşen • ${formatDate(layout.created_at)}</span>
    </button>
  `).join('');

  listEl.querySelectorAll('.saved-layout-item').forEach(btn => {
    btn.onclick = async () => {
      const layout = savedCustomReportLayouts.find(l => l.id === btn.dataset.layoutId);
      if (!layout) return;
      const titleEl = document.getElementById('reportDisplayTitle');
      if (titleEl && layout.name) titleEl.textContent = layout.name;
      if (layout.project_id) {
        reportState.selectedProjectId = layout.project_id;
        const projSelect = document.getElementById('reportProjectSelect');
        if (projSelect) projSelect.value = layout.project_id;
        await loadReportBuilderData();
      }
      reportState.widgets = Array.isArray(layout.widgets) ? JSON.parse(JSON.stringify(layout.widgets)) : [];
      renderReportCanvas();
      const tmplMenu = document.getElementById('reportTemplateMenu');
      if (tmplMenu) tmplMenu.style.display = 'none';
      showToast(`"${layout.name}" rapor düzeni yüklendi.`, 'success');
    };
  });
}

let managingProjectId = null;

async function openProjectManageModal(projectId) {
  managingProjectId = projectId;
  const modal = document.getElementById('projectManageModal');
  if (!modal) return;

  try {
    const details = await apiCall(`/api/projects/${projectId}`);
    const { project, members, visibilityRequests, planChanges } = details;

    document.getElementById('pmModalTitle').textContent = `📁 ${project.title}`;

    // Üye ekleme personel listesi
    const userSelect = document.getElementById('pmUserSelect');
    if (userSelect) {
      userSelect.innerHTML = state.personnelList.filter(u => u.is_active !== false).map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.department || 'Genel')})</option>`).join('');
    }

    // Mevcut üyeler
    const roleNames = {
      PROJECT_MANAGER: '👑 Proje Yöneticisi',
      EDITOR: '✏️ Düzenleyici (Editor)',
      VIEWER: '👁️ Tam Görüntüleyici'
    };
    const membersListEl = document.getElementById('pmMembersList');
    if (membersListEl) {
      if (members && members.length > 0) {
        membersListEl.innerHTML = members.map(m => {
          const u = state.personnelList.find(p => p.id === m.user_id);
          return `
            <div class="pm-member-row">
              <div>
                <strong>${escapeHtml(u ? u.name : m.user_id)}</strong>
                <span style="font-size:0.75rem; color:var(--text-tertiary); margin-left:6px;">${escapeHtml(u?.email || '')}</span>
              </div>
              <span class="nav-badge neutral">${roleNames[m.role] || m.role}</span>
            </div>
          `;
        }).join('');
      } else {
        membersListEl.innerHTML = '<span style="font-size:0.8rem; color:var(--text-tertiary);">Henüz atanmış proje üyesi yok.</span>';
      }
    }

    // Görünürlük talepleri (KAB03)
    const visSection = document.getElementById('pmVisibilitySection');
    const visList = document.getElementById('pmVisibilityRequestsList');
    const pendingReqs = (visibilityRequests || []).filter(r => r.status === 'PENDING');
    if (visSection && visList) {
      if (pendingReqs.length > 0) {
        visSection.style.display = 'block';
        visList.innerHTML = pendingReqs.map(r => {
          const reqUid = r.user_id || r.requester_user_id;
          const u = state.personnelList.find(p => p.id === reqUid);
          return `
            <div class="pm-member-row">
              <div>
                <strong>${escapeHtml(u ? u.name : reqUid)}</strong>
                <span style="font-size:0.75rem; color:var(--text-tertiary); margin-left:6px;">Tüm projeyi görüntüleme yetkisi talep ediyor</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="action-btn success-btn sm-btn btn-vis-decide" data-req="${r.id}" data-approve="true">Onayla</button>
                <button type="button" class="action-btn secondary-btn sm-btn btn-vis-decide" data-req="${r.id}" data-approve="false">Reddet</button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        visSection.style.display = 'none';
        visList.innerHTML = '';
      }
    }

    // Plan Karşılaştırma ve Revizyon Formu
    const rawCurStart = project.current_start_date ? project.current_start_date.slice(0, 10) : '';
    const rawCurDue = project.current_due_date ? project.current_due_date.slice(0, 10) : '';
    const initStart = formatDate(project.initial_start_date);
    const initDue = formatDate(project.initial_due_date);
    const curStart = formatDate(project.current_start_date);
    const curDue = formatDate(project.current_due_date);

    const compareBar = document.getElementById('pmPlanCompareBar');
    if (compareBar) {
      compareBar.innerHTML = `
        <div>📌 <strong>${t('label_initial_plan', 'İlk Plan (Baz)')}:</strong> ${initStart} → ${initDue}</div>
        <div>📅 <strong>${t('label_current', 'Güncel Plan')}:</strong> ${curStart} → ${curDue}</div>
      `;
    }

    document.getElementById('pmNewStart').value = rawCurStart;
    document.getElementById('pmNewDue').value = rawCurDue;
    document.getElementById('pmPlanReason').value = '';

    const histEl = document.getElementById('pmPlanHistoryList');
    if (histEl) {
      if (planChanges && planChanges.length > 0) {
        histEl.innerHTML = planChanges.map(pc => `
          <div class="wp-plan-history-item">
            <div>🔄 <strong>${formatDate(pc.old_due_date)} → ${formatDate(pc.new_due_date)}</strong> (${formatDate(pc.changed_at)})</div>
            <div style="color:var(--text-secondary);">Gerekçe: ${escapeHtml(pc.reason)}</div>
          </div>
        `).join('');
      } else {
        histEl.innerHTML = '';
      }
    }

    modal.classList.add('open');
  } catch (err) {
    showToast('Proje yönetim bilgileri alınamadı: ' + err.message, 'error');
  }
}

let pmListenersAttached = false;
function setupProjectManageModalListeners() {
  if (pmListenersAttached) return;
  pmListenersAttached = true;

  document.getElementById('pmAddMemberForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!managingProjectId) return;
    const user_id = document.getElementById('pmUserSelect').value;
    const role = document.getElementById('pmRoleSelect').value;
    try {
      await apiCall(`/api/projects/${managingProjectId}/members`, 'POST', { user_id, role });
      showToast('👥 Proje ekip rolü güncellendi.', 'success');
      await openProjectManageModal(managingProjectId);
      await loadProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('pmPlanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!managingProjectId) return;
    const new_start_date = new Date(document.getElementById('pmNewStart').value).toISOString();
    const new_due_date = new Date(document.getElementById('pmNewDue').value).toISOString();
    const reason = document.getElementById('pmPlanReason').value.trim();
    try {
      await apiCall(`/api/projects/${managingProjectId}/plan`, 'POST', { new_start_date, new_due_date, reason });
      showToast('📅 Proje planı revize edildi (İlk plan korundu).', 'success');
      await openProjectManageModal(managingProjectId);
      await loadProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('pmVisibilityRequestsList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-vis-decide');
    if (!btn || !managingProjectId) return;
    const request_id = btn.dataset.req;
    const approve = btn.dataset.approve === 'true';
    try {
      await apiCall(`/api/projects/${managingProjectId}/visibility-decide`, 'POST', { request_id, approve });
      showToast(approve ? '✅ Görünürlük talebi onaylandı.' : 'Görünürlük talebi reddedildi.', 'info');
      await openProjectManageModal(managingProjectId);
      await loadProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadReportBuilderData() {
  try {
    const url = `/api/reports/builder-data?project_id=${reportState.selectedProjectId}`;
    reportState.data = await apiCall(url);
    renderReportCanvas();
  } catch (err) {
    showToast('Rapor verileri alınamadı: ' + err.message, 'error');
  }
}

function setupReportDragAndDrop() {
  // 1. Sol Paneldeki Sürüklenebilir Kartlar
  document.querySelectorAll('.toolbox-widget-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      const type = card.dataset.widget;
      reportState.draggedWidgetType = type;
      e.dataTransfer.setData('text/plain', type);
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      reportState.draggedWidgetType = null;
      document.getElementById('reportDropCanvas')?.classList.remove('drag-over');
    });
  });

  // Doğrudan "+" Butonu ile Ekleme
  document.querySelectorAll('.add-widget-direct-btn').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.add;
      addReportWidget(type);
    };
  });

  // 2. Tuval Bırakma Alanı (Canvas Dropzone)
  const canvas = document.getElementById('reportDropCanvas');
  if (!canvas) return;

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvas.classList.add('drag-over');
  });

  canvas.addEventListener('dragleave', (e) => {
    if (e.target === canvas) {
      canvas.classList.remove('drag-over');
    }
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const type = e.dataTransfer.getData('text/plain') || reportState.draggedWidgetType;
    if (type) {
      addReportWidget(type);
    }
  });
}

function setupReportControls() {
  // Proje Filtresi Değişimi
  const projSelect = document.getElementById('reportProjectSelect');
  if (projSelect) {
    projSelect.onchange = async (e) => {
      reportState.selectedProjectId = e.target.value;
      await loadReportBuilderData();
    };
  }

  // Şablon Menüsü Aç/Kapa
  const tmplBtn = document.getElementById('reportTemplateBtn');
  const tmplMenu = document.getElementById('reportTemplateMenu');
  if (tmplBtn && tmplMenu) {
    tmplBtn.onclick = (e) => {
      e.stopPropagation();
      tmplMenu.style.display = tmplMenu.style.display === 'none' ? 'flex' : 'none';
    };

    document.addEventListener('click', (e) => {
      if (!tmplMenu.contains(e.target) && e.target !== tmplBtn) {
        tmplMenu.style.display = 'none';
      }
    });

    tmplMenu.querySelectorAll('.template-item[data-template]').forEach(item => {
      item.onclick = () => {
        const key = item.dataset.template;
        applyReportTemplate(key);
        tmplMenu.style.display = 'none';
        showToast('Şablon uygulandı.', 'success');
      };
    });
  }

  // Temizle Butonu
  const clearBtn = document.getElementById('clearReportCanvasBtn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      reportState.widgets = [];
      renderReportCanvas();
      showToast('Tuval temizlendi.', 'info');
    };
  }

  // Kaydet Butonu
  const saveBtn = document.getElementById('saveReportLayoutBtn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const title = document.getElementById('reportDisplayTitle')?.textContent.trim() || 'Özel Rapor';
      try {
        await apiCall('/api/reports/custom-layouts', 'POST', {
          name: title,
          widgets: reportState.widgets,
          project_id: reportState.selectedProjectId
        });
        await loadSavedReportLayouts();
        showToast('Rapor düzeni başarıyla kaydedildi! (Şablonlar menüsünden geri yükleyebilirsiniz)', 'success');
      } catch (err) {
        showToast('Rapor kaydedilemedi: ' + err.message, 'error');
      }
    };
  }

  // Yazdır / PDF Al Butonu
  const printBtn = document.getElementById('printReportBtn');
  if (printBtn) {
    printBtn.onclick = () => {
      window.print();
    };
  }
}

function addReportWidget(widgetType, width = 'full', noteText = '') {
  const newWidget = {
    id: 'w_' + Math.random().toString(36).substr(2, 9),
    widgetType,
    width,
    noteText
  };
  reportState.widgets.push(newWidget);
  renderReportCanvas();
  showToast('Bileşen rapora eklendi.', 'info');
}

function removeReportWidget(widgetId) {
  reportState.widgets = reportState.widgets.filter(w => w.id !== widgetId);
  renderReportCanvas();
}

function toggleWidgetWidth(widgetId) {
  const w = reportState.widgets.find(w => w.id === widgetId);
  if (w) {
    w.width = w.width === 'full' ? 'half' : 'full';
    renderReportCanvas();
  }
}

function applyReportTemplate(templateKey) {
  if (templateKey === 'executive') {
    reportState.widgets = [
      { id: 'w_kpi', widgetType: 'kpis', width: 'full' },
      { id: 'w_dist', widgetType: 'distribution', width: 'half' },
      { id: 'w_crit', widgetType: 'delayed', width: 'half' },
      { id: 'w_note', widgetType: 'note', width: 'full', noteText: 'FG Group Yönetim Değerlendirmesi: Proje teslim hedefleri ve gecikme riskleri yukarıdaki tabloda özetlenmiştir.' }
    ];
  } else if (templateKey === 'performance') {
    reportState.widgets = [
      { id: 'w_kpi', widgetType: 'kpis', width: 'full' },
      { id: 'w_perf', widgetType: 'performance', width: 'full' },
      { id: 'w_note', widgetType: 'note', width: 'full', noteText: 'Personel Performans Notu: Puanlama Şartname v0.3 kabul kurallarına (100 * (0.70*Z + 0.30*T)) göre hesaplanmıştır.' }
    ];
  } else if (templateKey === 'bottleneck') {
    reportState.widgets = [
      { id: 'w_bottle', widgetType: 'bottlenecks', width: 'half' },
      { id: 'w_crit', widgetType: 'delayed', width: 'half' },
      { id: 'w_expl', widgetType: 'explanations', width: 'full' }
    ];
  } else if (templateKey === 'all') {
    reportState.widgets = [
      { id: 'w_kpi', widgetType: 'kpis', width: 'full' },
      { id: 'w_perf', widgetType: 'performance', width: 'full' },
      { id: 'w_dist', widgetType: 'distribution', width: 'half' },
      { id: 'w_crit', widgetType: 'delayed', width: 'half' },
      { id: 'w_bottle', widgetType: 'bottlenecks', width: 'half' },
      { id: 'w_ms', widgetType: 'milestones', width: 'half' },
      { id: 'w_expl', widgetType: 'explanations', width: 'full' },
      { id: 'w_note', widgetType: 'note', width: 'full', noteText: '' }
    ];
  }
  renderReportCanvas();
}

function renderReportCanvas() {
  const canvas = document.getElementById('reportDropCanvas');
  if (!canvas) return;

  if (reportState.widgets.length === 0) {
    canvas.innerHTML = `
      <div class="canvas-empty-state" id="canvasEmptyState">
        <div class="empty-drop-illustration">📥</div>
        <h4>Rapor Tuvaliniz Boş</h4>
        <p>Soldaki bileşenleri buraya sürükleyip bırakın veya yukarıdaki <strong>📑 Şablonlar</strong> menüsünden hazır bir rapor seçin.</p>
      </div>
    `;
    return;
  }

  const d = reportState.data;
  canvas.innerHTML = '';

  reportState.widgets.forEach(w => {
    const card = document.createElement('div');
    card.className = `canvas-widget-item ${w.width === 'half' ? 'col-span-6' : 'col-span-12'}`;
    card.dataset.id = w.id;

    const titles = {
      kpis: '📊 Proje İlerleme & KPI Özeti',
      performance: '👥 Personel Performans Tablosu',
      distribution: '📈 Görev Durum Dağılımı',
      delayed: '⏳ Kritik Yol & Geciken Görevler',
      bottlenecks: '🔗 Bağımlılık & Darboğaz Akışı',
      explanations: '📝 Gecikme Gerekçeleri & Loglar',
      milestones: '🎯 Kilometre Taşları & Hedefler',
      note: '✍️ Yönetici Notu & Değerlendirme'
    };

    const title = titles[w.widgetType] || 'Bileşen';

    card.innerHTML = `
      <div class="widget-chrome-header">
        <div class="widget-chrome-title">
          <span class="widget-chrome-handle" title="Yeniden Sırala">⠿</span>
          <span>${title}</span>
        </div>
        <div class="widget-chrome-actions">
          <button class="chrome-btn btn-toggle-width" title="Genişliği Değiştir (Yarım / Tam)">
            ${w.width === 'half' ? '⤢ Tam Genişlik' : '⤡ Yarım'}
          </button>
          <button class="chrome-btn delete-btn btn-delete-widget" title="Kaldır">✕</button>
        </div>
      </div>
      <div class="widget-chrome-body">
        ${renderWidgetContent(w, d)}
      </div>
    `;

    // Buton Eylemleri
    card.querySelector('.btn-toggle-width').onclick = () => toggleWidgetWidth(w.id);
    card.querySelector('.btn-delete-widget').onclick = () => removeReportWidget(w.id);

    // Not alanında metin değişimi
    const noteTextarea = card.querySelector('.executive-note-textarea');
    if (noteTextarea) {
      noteTextarea.value = w.noteText || '';
      noteTextarea.oninput = (e) => {
        w.noteText = e.target.value;
      };
    }

    canvas.appendChild(card);
  });
}

function renderWidgetContent(widget, data) {
  if (!data) return '<div style="color:#94a3b8; font-size:0.85rem;">Veri yükleniyor...</div>';

  switch (widget.widgetType) {
    case 'kpis': {
      const k = data.kpis;
      return `
        <div class="kpi-stat-grid">
          <div class="kpi-tile">
            <span class="kpi-tile-num">${k.total_tasks}</span>
            <span class="kpi-tile-label">Toplam Görev</span>
          </div>
          <div class="kpi-tile" style="border-left: 3px solid #10b981;">
            <span class="kpi-tile-num" style="color:#34d399;">${k.completed_tasks}</span>
            <span class="kpi-tile-label">Tamamlanan</span>
          </div>
          <div class="kpi-tile" style="border-left: 3px solid #3b82f6;">
            <span class="kpi-tile-num" style="color:#60a5fa;">${k.in_progress_tasks}</span>
            <span class="kpi-tile-label">Devam Eden</span>
          </div>
          <div class="kpi-tile" style="border-left: 3px solid #6366f1;">
            <span class="kpi-tile-num" style="color:#a5b4fc;">${k.ready_tasks}</span>
            <span class="kpi-tile-label">Başlamaya Hazır</span>
          </div>
          <div class="kpi-tile" style="border-left: 3px solid #ef4444;">
            <span class="kpi-tile-num" style="color:#f87171;">${k.blocked_tasks}</span>
            <span class="kpi-tile-label">Öncül Bekleyen</span>
          </div>
          <div class="kpi-tile" style="border-left: 3px solid #f59e0b;">
            <span class="kpi-tile-num" style="color:#fbbf24;">${k.delayed_tasks}</span>
            <span class="kpi-tile-label">Geciken İşler</span>
          </div>
        </div>
        <div class="kpi-progress-bar-wrap">
          <div class="kpi-progress-header">
            <span>Genel Tamamlanma Oranı</span>
            <span style="color:#34d399; font-weight:700;">%${k.completion_rate}</span>
          </div>
          <div class="kpi-progress-track">
            <div class="kpi-progress-fill" style="width: ${k.completion_rate}%;"></div>
          </div>
        </div>
      `;
    }

    case 'performance': {
      if (!data.personnel_performance || data.personnel_performance.length === 0) {
        return '<div style="color:#94a3b8; font-size:0.85rem;">Personel verisi bulunamadı.</div>';
      }
      return `
        <div class="perf-table-wrap">
          <table class="styled-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Departman / Ülke</th>
                <th>Atanan</th>
                <th>Tamamlanan</th>
                <th>Zamanında</th>
                <th>Geciken</th>
                <th>Performans Puanı</th>
              </tr>
            </thead>
            <tbody>
              ${data.personnel_performance.map(u => {
        const s = u.performance_score;
        const badgeClass = s !== null ? (s >= 80 ? 'high' : (s >= 60 ? 'mid' : 'low')) : 'mid';
        return `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div class="profile-avatar" style="width:24px; height:24px; font-size:0.7rem;">${u.name.slice(0, 1)}</div>
                        <strong>${u.name}</strong>
                      </div>
                    </td>
                    <td>${u.department || 'Genel'} (${u.country})</td>
                    <td>${u.assigned_count}</td>
                    <td>${u.completed_count}</td>
                    <td><span style="color:#34d399; font-weight:600;">${u.on_time_count}</span></td>
                    <td><span style="color:${u.delayed_count > 0 ? '#f87171' : '#94a3b8'}; font-weight:600;">${u.delayed_count}</span></td>
                    <td>
                      <span class="perf-score-badge ${badgeClass}">${u.score_display}</span>
                    </td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    case 'distribution': {
      const dist = data.status_distribution || [];
      const total = data.kpis.total_tasks || 1;
      return `
        <div class="status-dist-list">
          ${dist.map(item => {
        const pct = Math.round((item.count / total) * 100);
        return `
              <div class="status-dist-row">
                <div class="status-dist-info">
                  <span>${item.label}</span>
                  <span>${item.count} görev (%${pct})</span>
                </div>
                <div class="status-dist-track">
                  <div class="status-dist-bar" style="width: ${pct}%; background-color: ${item.color};"></div>
                </div>
              </div>
            `;
      }).join('')}
        </div>
      `;
    }

    case 'delayed': {
      const list = data.critical_tasks || [];
      if (list.length === 0) {
        return '<div style="color:#34d399; font-size:0.86rem; padding:12px; background:rgba(16,185,129,0.1); border-radius:6px;">✨ Tebrikler! Şu anda gecikmede olan kritik görev bulunmuyor.</div>';
      }
      return `
        <div class="critical-tasks-list">
          ${list.map(t => `
            <div class="critical-task-item">
              <div>
                <div class="critical-task-title">${t.title}</div>
                <div class="critical-task-meta">
                  <span>👤 ${t.assignee_name}</span>
                  <span>📅 Vade: ${formatDate(t.current_due_date)}</span>
                </div>
              </div>
              <span class="op-priority-badge high">Gecikti</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    case 'bottlenecks': {
      const list = data.bottlenecks || [];
      if (list.length === 0) {
        return '<div style="color:#94a3b8; font-size:0.85rem;">Henüz bağımlılık darboğazı tespit edilmedi.</div>';
      }
      return `
        <div class="bottlenecks-list">
          ${list.slice(0, 5).map(b => `
            <div class="bottleneck-item">
              <div>
                <div style="font-weight:600; color:#ffffff; font-size:0.88rem;">${b.title}</div>
                <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">Sorumlu: ${b.assignee_name}</div>
              </div>
              <span class="waiting-badge">⚠️ ${b.waiting_successors_count} Ardıl Bekliyor</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    case 'explanations': {
      const list = data.delay_explanations || [];
      if (list.length === 0) {
        return '<div style="color:#94a3b8; font-size:0.85rem;">Kayıtlı gecikme gerekçesi veya açıklama logu bulunmamaktadır.</div>';
      }
      return `
        <div class="explanations-feed">
          ${list.slice(0, 5).map(e => `
            <div class="explanation-entry">
              <div class="explanation-entry-header">
                <strong>📌 ${e.task_title}</strong>
                <span>${formatDateTime(e.detected_at)} (${e.reported_by})</span>
              </div>
              <div class="explanation-text">${e.explanation_text || e.reason || 'Durum gerekçesi girildi.'}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    case 'milestones': {
      const list = data.milestones || [];
      if (list.length === 0) {
        return '<div style="color:#94a3b8; font-size:0.85rem;">Projeye ait kilometre taşı (Milestone) tanımlanmamış.</div>';
      }
      return `
        <div class="critical-tasks-list">
          ${list.map(m => `
            <div class="critical-task-item" style="border-left-color: #f59e0b;">
              <div>
                <div class="critical-task-title">🏁 ${m.title}</div>
                <div class="critical-task-meta">
                  <span>Hedef: ${formatDate(m.current_due_date)}</span>
                  <span>Sorumlu: ${m.assignee_name}</span>
                </div>
              </div>
              <span class="task-status-pill ${m.work_status === 'COMPLETED' ? 'pill-status-done' : 'pill-status-progress'}">
                ${m.work_status === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }

    case 'note': {
      return `
        <textarea class="executive-note-textarea" placeholder="Yönetici değerlendirme notunuzu, proje hedeflerini veya özel açıklamaları buraya yazabilirsiniz..."></textarea>
      `;
    }

    default:
      return '<div>Bileşen render edilemedi.</div>';
  }
}

// ==============================================================
// 7. MICROSOFT TO DO & OUTLOOK FRONTEND ENTEGRASYONU
// ==============================================================

let msTodoState = {
  items: [],
  showCompleted: false
};

async function loadAndRenderMicrosoftTodo() {
  if (!state.currentUser) return;
  try {
    const items = await apiCall('/api/todo/items');
    msTodoState.items = Array.isArray(items) ? items : [];
    renderMicrosoftTodoList();
  } catch (err) {
    console.warn('To Do yükleme hatası:', err);
  }
}

function renderMicrosoftTodoList() {
  const activeContainer = document.getElementById('msActiveTodoList');
  const completedContainer = document.getElementById('msCompletedTodoList');
  if (!activeContainer || !completedContainer) return;

  if (!Array.isArray(msTodoState.items)) {
    msTodoState.items = [];
  }

  const q = normalizeSearchText(state.searchQuery);
  const filteredTodoItems = msTodoState.items.filter(item => {
    if (!q) return true;
    const linkedTask = item.linked_task_id ? state.tasks.find(t => t.id === item.linked_task_id) : null;
    if (linkedTask && matchesTaskQuery(linkedTask, state.searchQuery)) return true;
    const assignee = state.personnelList.find(p => p.id === item.user_id);
    return (
      normalizeSearchText(item.title).includes(q) ||
      normalizeSearchText(item.body_content).includes(q) ||
      normalizeSearchText(assignee?.name).includes(q)
    );
  });

  const activeItems = filteredTodoItems.filter(item => !item.is_completed);
  const completedItems = filteredTodoItems.filter(item => item.is_completed);

  // Sayaçları Güncelle
  const activeCountEl = document.getElementById('msActiveCount');
  if (activeCountEl) activeCountEl.textContent = activeItems.length;

  const completedCountEl = document.getElementById('msCompletedCount');
  if (completedCountEl) completedCountEl.textContent = completedItems.length;

  const sidebarCountEl = document.getElementById('msTodoCount');
  if (sidebarCountEl) sidebarCountEl.textContent = activeItems.length;

  // 1. Aktif Görevler
  if (activeItems.length === 0) {
    activeContainer.innerHTML = '<div style="color:#64748b; font-size:0.86rem; padding:12px; text-align:center;">🎉 Harika! Bekleyen hiçbir yapılacak işiniz yok.</div>';
  } else {
    activeContainer.innerHTML = activeItems.map(item => renderSingleTodoCard(item)).join('');
  }

  // 2. Tamamlanan Görevler
  completedContainer.innerHTML = completedItems.map(item => renderSingleTodoCard(item)).join('');

  // Etkinlikleri bağla
  attachTodoItemEventListeners();
}

function renderSingleTodoCard(item) {
  const now = new Date();
  const isOverdue = item.due_date && !item.is_completed && new Date(item.due_date) < now;
  const isStarred = !!item.is_starred;
  const isFgTask = item.source === 'FG_SYSTEM';

  let dateDisplay = '';
  if (item.due_date) {
    const dateFormatted = formatDate(item.due_date);
    dateDisplay = `<span class="ms-due-pill ${isOverdue ? 'overdue' : ''}">📅 ${isOverdue ? 'Süresi geçmiş, ' : ''}${dateFormatted}</span>`;
  }

  return `
    <div class="ms-todo-card ${item.is_completed ? 'completed' : ''}" data-id="${item.id}">
      <button type="button" class="ms-check-btn ${item.is_completed ? 'checked' : ''}" data-id="${item.id}" title="${item.is_completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}">
        ✓
      </button>
      <div class="ms-todo-content">
        <div class="ms-todo-title">${item.title}</div>
        <div class="ms-todo-meta">
          ${dateDisplay}
          <span class="ms-source-pill ${isFgTask ? 'fg' : 'outlook'}">
            ${isFgTask ? '🏢 FG Group Görevi' : '👤 Kişisel To Do'}
          </span>
          <button type="button" class="btn-add-todo-note" data-id="${item.id}" style="background:transparent; border:none; color:#38bdf8; font-size:0.75rem; cursor:pointer;">
            ${item.body_content ? '📝 Notu Düzenle' : '+ Not Ekle'}
          </button>
        </div>
        ${item.body_content ? `<div class="ms-note-text">📝 ${item.body_content}</div>` : ''}
      </div>
      <button type="button" class="ms-star-btn ${isStarred ? 'starred' : ''}" data-id="${item.id}" title="${isStarred ? 'Önemi kaldır' : 'Önemli olarak işaretle'}">
        ${isStarred ? '★' : '☆'}
      </button>
    </div>
  `;
}

function attachTodoItemEventListeners() {
  // Tamamlama Butonları
  document.querySelectorAll('.ms-check-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const isCompletedNow = btn.classList.contains('checked');
      try {
        await apiCall(`/api/todo/items/${id}`, 'PATCH', { is_completed: !isCompletedNow });
        showToast(isCompletedNow ? 'Görev yapılara alındı.' : 'Görev tamamlandı!', 'success');
        await loadAndRenderMicrosoftTodo();
        // Eğer bağlı görev varsa proje görevlerini de tazele
        if (state.currentProjectId) await loadProjectTasks(state.currentProjectId);
      } catch (err) {
        showToast('To Do güncellenemedi: ' + err.message, 'error');
      }
    };
  });

  // Yıldız Butonları
  document.querySelectorAll('.ms-star-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        await apiCall(`/api/todo/items/${id}/star`, 'POST');
        await loadAndRenderMicrosoftTodo();
      } catch (err) { }
    };
  });

  // Not Ekle / Düzenle Butonları
  document.querySelectorAll('.btn-add-todo-note').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const currentItem = msTodoState.items.find(i => i.id === id);
      const note = prompt('Microsoft To Do Görev Notu / Açıklama giriniz:', currentItem?.body_content || '');
      if (note !== null) {
        try {
          await apiCall(`/api/todo/items/${id}`, 'PATCH', { noteText: note });
          showToast('Not Outlook / To Do ile eşitlendi.', 'success');
          await loadAndRenderMicrosoftTodo();
          if (state.currentProjectId) await loadProjectTasks(state.currentProjectId);
        } catch (err) {
          showToast('Not kaydedilemedi: ' + err.message, 'error');
        }
      }
    };
  });
}

// Microsoft To Do Kontrolleri
document.addEventListener('DOMContentLoaded', () => {
  // Akordeon Aç / Kapat
  const toggleAccordionBtn = document.getElementById('toggleCompletedTodoBtn');
  const completedList = document.getElementById('msCompletedTodoList');
  const accordionArrow = document.getElementById('msAccordionArrow');
  if (toggleAccordionBtn && completedList) {
    toggleAccordionBtn.onclick = () => {
      msTodoState.showCompleted = !msTodoState.showCompleted;
      completedList.style.display = msTodoState.showCompleted ? 'flex' : 'none';
      if (accordionArrow) {
        accordionArrow.classList.toggle('closed', !msTodoState.showCompleted);
      }
    };
  }

  // Yıldız Seçim Butonu Form İçi
  const starCheck = document.getElementById('msTodoStarCheck');
  const starIcon = document.getElementById('msStarIconDisplay');
  if (starCheck && starIcon) {
    starCheck.onchange = () => {
      starIcon.classList.toggle('active', starCheck.checked);
      starIcon.textContent = starCheck.checked ? '★' : '☆';
    };
  }

  // Yeni To Do Ekle Formu (Outlook Stili)
  const addForm = document.getElementById('msAddTodoForm');
  if (addForm) {
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('msTodoTitleInput');
      const dateInput = document.getElementById('msTodoDueDateInput');
      const starInput = document.getElementById('msTodoStarCheck');

      const title = titleInput.value.trim();
      if (!title) return;

      const due_date = dateInput.value ? new Date(dateInput.value).toISOString() : undefined;
      const is_starred = starInput ? starInput.checked : false;

      try {
        await apiCall('/api/todo/items', 'POST', {
          title,
          due_date,
          importance: is_starred ? 'high' : 'normal',
          is_starred
        });
        showToast('Kişisel görev Microsoft To Do listesine eklendi!', 'success');
        titleInput.value = '';
        if (dateInput) dateInput.value = '';
        if (starInput) {
          starInput.checked = false;
          if (starIcon) {
            starIcon.classList.remove('active');
            starIcon.textContent = '☆';
          }
        }
        await loadAndRenderMicrosoftTodo();
      } catch (err) {
        showToast('To Do eklenemedi: ' + err.message, 'error');
      }
    };
  }

  // Şimdi Eşitle Butonu
  const syncBtn = document.getElementById('msSyncNowBtn');
  if (syncBtn) {
    syncBtn.onclick = async () => {
      try {
        const res = await apiCall('/api/todo/sync', 'POST');
        showToast(`Yerel görevler eşitlendi (${res.count} kayıt). Canlı Outlook eşitlemesi için Azure yapılandırması gereklidir.`, 'info');
        await loadAndRenderMicrosoftTodo();
      } catch (err) {
        showToast('Eşitleme hatası: ' + err.message, 'error');
      }
    };
  }

  // Azure / Microsoft 365 Canlı Bağlantı Ayarları Butonu
  const azureBtn = document.getElementById('openAzureConfigBtn');
  if (azureBtn) {
    azureBtn.onclick = () => {
      document.getElementById('azureConfigModal')?.classList.add('open');
    };
  }

  // Azure Config Form Submit
  const azureForm = document.getElementById('azureConfigForm');
  if (azureForm) {
    azureForm.onsubmit = async (e) => {
      e.preventDefault();
      const tenantId = document.getElementById('azureTenantId').value.trim();
      const clientId = document.getElementById('azureClientId').value.trim();
      const clientSecret = document.getElementById('azureClientSecret').value.trim();

      try {
        await apiCall('/api/todo/azure-config', 'POST', {
          tenant_id: tenantId,
          client_id: clientId,
          client_secret: clientSecret
        });
        showToast('Azure Entra ID kimlik bilgileri kaydedildi.', 'success');
        document.getElementById('azureConfigModal')?.classList.remove('open');
      } catch (err) {
        showToast('Azure ayarları kaydedilemedi: ' + err.message, 'error');
      }
    };
  }

  // İlk tema başlatması
  applyTheme(getActiveTheme());
});

// Anında tema uygula
applyTheme(getActiveTheme());






// ================= EXCHANGE ONLINE (SMTP), OUTLOOK ACTIONABLE CARDS & ZAMANLANMIŞ RAPORLAR =================
let emailAutoState = {
  smtpConfig: null,
  scheduledReports: [],
  outboxItems: [],
  selectedOutboxId: null
};

async function loadEmailAutomationDashboard() {
  try {
    const [smtpCfg, schedList, outboxList, dbStatus] = await Promise.all([
      apiCall('/api/admin/smtp-config'),
      apiCall('/api/admin/scheduled-reports'),
      apiCall('/api/email/outbox'),
      apiCall('/api/admin/db-status').catch(() => null)
    ]);

    emailAutoState.smtpConfig = smtpCfg;
    emailAutoState.scheduledReports = schedList || [];
    emailAutoState.outboxItems = outboxList || [];
    emailAutoState.dbStatus = dbStatus;

    renderSmtpConfigForm(smtpCfg, dbStatus);
    renderScheduledReportFormOptions();
    renderScheduledReportsList();
    renderEmailOutboxList();
  } catch (err) {
    console.warn('Email automation dashboard load warning:', err);
  }
}

function renderSmtpConfigForm(cfg, dbStatus) {
  if (!cfg) return;
  const hostEl = document.getElementById('smtpHostInput');
  const portEl = document.getElementById('smtpPortInput');
  const userEl = document.getElementById('smtpUsernameInput');
  const passEl = document.getElementById('smtpPasswordInput');
  const fromNameEl = document.getElementById('smtpFromNameInput');
  const baseUrlEl = document.getElementById('smtpBaseUrlInput');
  const enableCardsEl = document.getElementById('smtpEnableActionableCards');
  const badgeEl = document.getElementById('smtpStatusBadge');
  const hintEl = document.getElementById('smtpLastSavedInfo');
  const testRecipEl = document.getElementById('smtpTestRecipientInput');

  if (hostEl) hostEl.value = cfg.host || 'smtp.office365.com';
  if (portEl) portEl.value = cfg.port || 587;
  if (userEl) userEl.value = cfg.username || 'bildirim@fggroup.com.tr';
  if (passEl) passEl.value = cfg.has_password ? '••••••••' : '';
  if (fromNameEl) fromNameEl.value = cfg.from_name || 'FG Group Proje Sistemi';
  if (baseUrlEl) baseUrlEl.value = cfg.public_base_url || window.location.origin;
  if (enableCardsEl) enableCardsEl.checked = cfg.enable_actionable_cards !== false;
  if (testRecipEl && !testRecipEl.value) {
    testRecipEl.value = state.currentUser?.email || 'ahmet@fggroup.com.tr';
  }
  const inlineTestEl = document.getElementById('smtpInlineTestRecipient');
  if (inlineTestEl && !inlineTestEl.value) {
    inlineTestEl.value = cfg.username || state.currentUser?.email || 'admin@fggroup.com.tr';
  }

  if (badgeEl) {
    if (cfg.has_password) {
      badgeEl.className = 'smtp-status-pill live';
      badgeEl.textContent = `🟢 Canlı Exchange Online SMTP Aktif (${cfg.username} ➔ ${cfg.host}:${cfg.port})`;
    } else {
      badgeEl.className = 'smtp-status-pill simulated';
      badgeEl.textContent = '🟡 Yerel Outbox Simülasyon Modu (Exchange Şifresi Girildiğinde Canlı SMTP Aktif Olur)';
    }
  }

  if (hintEl && cfg.updated_at) {
    const encText = cfg.is_encrypted_at_rest
      ? ' • 🔐 Şifre AES-256-GCM Kasasında Kalıcı Kayıtlı'
      : '';
    hintEl.textContent = `Son güncelleme: ${formatDateTime(cfg.updated_at)}${encText}`;
  }

  const pgBadge = document.getElementById('pgVaultStatusBadge');
  if (pgBadge && (dbStatus || emailAutoState.dbStatus)) {
    const st = dbStatus || emailAutoState.dbStatus;
    const modeName = st.engine === 'EXTERNAL_POSTGRES'
      ? 'Harici PostgreSQL Sunucusu (DATABASE_URL)'
      : 'Gömülü PostgreSQL 16 (PGlite .work/pgdata)';
    pgBadge.textContent = `🐘 ${modeName} • 🔐 ${st.vault_encryption || 'AES-256-GCM'} Şifre Kasası Aktif`;
  }

  const vaultTag = document.getElementById('smtpVaultEncTag');
  if (vaultTag) {
    if (cfg.has_password) {
      vaultTag.textContent = '🔐 AES-256-GCM Kasada Kayıtlı (Unutulmaz)';
      vaultTag.style.color = '#059669';
      vaultTag.style.background = '#ecfdf5';
      vaultTag.style.borderColor = '#a7f3d0';
    } else {
      vaultTag.textContent = '🔐 AES-256-GCM Şifreleme Hazır';
      vaultTag.style.color = '#2563eb';
      vaultTag.style.background = '#eff6ff';
      vaultTag.style.borderColor = '#bfdbfe';
    }
  }
}

function renderScheduledReportFormOptions() {
  const projSel = document.getElementById('schedProjectSelect');
  if (projSel) {
    const currentVal = projSel.value || 'all';
    projSel.innerHTML = '<option value="all">Tüm Projeler (Konsolide)</option>' +
      state.projects.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    projSel.value = currentVal;
  }

  const chipsEl = document.getElementById('schedQuickRecipients');
  const recipInput = document.getElementById('schedRecipients');
  if (chipsEl && recipInput) {
    if (!recipInput.value) {
      recipInput.value = 'admin@fggroup.com.tr, ahmet@fggroup.com.tr';
    }
    chipsEl.innerHTML = state.personnelList.map(u => `
      <button type="button" class="recipient-chip-btn" data-email="${escapeHtml(u.email)}">
        + ${escapeHtml(u.name)} (${escapeHtml(u.email)})
      </button>
    `).join('');

    chipsEl.querySelectorAll('.recipient-chip-btn').forEach(btn => {
      btn.onclick = () => {
        const email = btn.dataset.email;
        const existing = recipInput.value.split(',').map(s => s.trim()).filter(Boolean);
        if (!existing.includes(email)) {
          existing.push(email);
          recipInput.value = existing.join(', ');
        }
      };
    });
  }
}

function renderScheduledReportsList() {
  const container = document.getElementById('scheduledReportsList');
  if (!container) return;

  const jobs = emailAutoState.scheduledReports || [];
  if (jobs.length === 0) {
    container.innerHTML = '<div style="padding:14px; text-align:center; color:var(--text-tertiary); font-size:0.82rem;">Henüz zamanlanmış otomatik rapor kuralı eklenmemiş.</div>';
    return;
  }

  const freqMap = { DAILY: 'Her Gün', WEEKLY: 'Her Hafta', MONTHLY: 'Her Ay' };
  const typeMap = {
    EXECUTIVE_SUMMARY: 'Yönetici & İlerleme Özeti',
    PERFORMANCE_SCORECARD: 'Ekip Performans Karnesi',
    BOTTLENECK_DELAY: 'Darboğaz & Gecikme Raporu',
    FULL_REPORT: 'Kapsamlı Tam Rapor'
  };

  container.innerHTML = jobs.map(job => {
    const proj = state.projects.find(p => p.id === job.project_id);
    const scopeName = proj ? proj.title : 'Tüm Projeler';
    const lastSent = job.last_sent_at ? formatDateTime(job.last_sent_at) : 'Henüz gönderilmedi';

    return `
      <div class="sched-job-row">
        <div class="sched-job-info">
          <strong>${escapeHtml(job.name)}</strong>
          <div class="sched-job-meta">
            <span>📁 ${escapeHtml(scopeName)}</span> •
            <span>📑 ${typeMap[job.report_type] || job.report_type}</span> •
            <span>⏰ ${freqMap[job.frequency] || job.frequency} Saat <strong>${escapeHtml(job.send_time)}</strong></span>
          </div>
          <div class="sched-job-meta">
            <span>📩 Alıcılar: ${escapeHtml((job.recipients || []).join(', '))}</span> •
            <span>Son Gönderim: ${lastSent}</span>
          </div>
        </div>
        <div class="sched-job-actions">
          <button type="button" class="action-btn primary-btn sm-btn btn-send-sched-now" data-id="${job.id}" title="Bu raporu hemen üret ve alıcılara gönder">
            🚀 Şimdi Gönder
          </button>
          <button type="button" class="action-btn secondary-btn sm-btn btn-toggle-sched" data-id="${job.id}" data-active="${job.is_active}">
            ${job.is_active ? '🟢 Aktif' : '⚪ Pasif'}
          </button>
          <button type="button" class="action-btn danger-bare-btn sm-btn btn-del-sched" data-id="${job.id}" title="Kuralı Sil">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-send-sched-now').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        btn.disabled = true;
        btn.textContent = 'Gönderiliyor...';
        const res = await apiCall(`/api/admin/scheduled-reports/${id}/send-now`, 'POST');
        showToast('📊 Zamanlanmış rapor başarıyla oluşturuldu ve gönderildi!', 'success');
        if (res.item) {
          emailAutoState.selectedOutboxId = res.item.id;
        }
        await loadEmailAutomationDashboard();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '🚀 Şimdi Gönder';
      }
    };
  });

  container.querySelectorAll('.btn-toggle-sched').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const isActive = btn.dataset.active === 'true';
      await apiCall(`/api/admin/scheduled-reports/${id}`, 'PATCH', { is_active: !isActive });
      showToast(!isActive ? 'Rapor zamanlaması aktifleştirildi.' : 'Rapor zamanlaması duraklatıldı.', 'info');
      await loadEmailAutomationDashboard();
    };
  });

  container.querySelectorAll('.btn-del-sched').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      await apiCall(`/api/admin/scheduled-reports/${id}`, 'DELETE');
      showToast('Zamanlanmış rapor kuralı silindi.', 'info');
      await loadEmailAutomationDashboard();
    };
  });
}

function renderEmailOutboxList() {
  const listEl = document.getElementById('emailOutboxList');
  if (!listEl) return;

  const items = emailAutoState.outboxItems || [];
  if (items.length === 0) {
    listEl.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-tertiary);">Henüz gönderilmiş e-posta veya Actionable Card bulunmuyor.</div>';
    return;
  }

  if (!emailAutoState.selectedOutboxId || !items.some(i => i.id === emailAutoState.selectedOutboxId)) {
    emailAutoState.selectedOutboxId = items[0].id;
  }

  const catLabels = {
    ACTIONABLE_TASK_CARD: '🔔 Sıra Sizde (Adaptive Card)',
    TASK_ASSIGNED_CARD: '📌 Yeni Görev Atandı Kartı',
    PROJECT_MEMBER_CARD: '📁 Projeye Dahil Edildiniz',
    USER_WELCOME_CARD: '🎉 Yeni Kullanıcı Karşılama & Erişim Maili',
    TASK_COMPLETED_MANAGER_CARD: '✅ İş Tamamlandı (Yetkili Bilgi)',
    TASK_PROGRESS_MANAGER_CARD: '📊 %40-%60 İlerleme & Not (Yetkili Bilgi)',
    DELAY_EXPLANATION_CARD: '⚠️ Gecikme Mazereti Kartı (Sorumlu)',
    OVERDUE_MANAGER_ALERT: '🚨 Geciken Görev Uyarısı (Yetkili)',
    APPROVAL_CARD: '👁️ Yönetici Onay Kartı (KAB03)',
    SCHEDULED_REPORT: '📊 Zamanlanmış Otomatik Rapor',
    SMTP_TEST: '🧪 Exchange SMTP Testi'
  };

  listEl.innerHTML = items.map(item => {
    const isSelected = item.id === emailAutoState.selectedOutboxId;
    const modeLabel = item.delivery_mode === 'SMTP_LIVE'
      ? (item.status === 'SENT' ? '🟢 SMTP Gönderildi' : '🔴 SMTP Hatası')
      : '🟡 Yerel Outbox';
    const timeStr = formatTime(item.sent_at);

    return `
      <div class="outbox-mail-item ${isSelected ? 'active' : ''}" data-id="${item.id}">
        <div class="outbox-mail-top">
          <span class="outbox-cat-badge">${catLabels[item.category] || item.category}</span>
          <span style="font-size:0.7rem; color:var(--text-tertiary);">${modeLabel} • ${timeStr}</span>
        </div>
        <div class="outbox-mail-subj">${escapeHtml(item.subject)}</div>
        <div class="outbox-mail-to">Kime: ${escapeHtml((item.to || []).join(', '))}</div>
        ${item.action_taken ? `<div style="margin-top:4px; font-size:0.72rem; color:#059669; font-weight:600;">✓ ${escapeHtml(item.action_taken)}</div>` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.outbox-mail-item').forEach(el => {
    el.onclick = () => {
      emailAutoState.selectedOutboxId = el.dataset.id;
      renderEmailOutboxList();
      renderSelectedOutboxPreview();
    };
  });

  renderSelectedOutboxPreview();
}

function renderSelectedOutboxPreview() {
  const previewEl = document.getElementById('liveAdaptiveCardPreview');
  if (!previewEl) return;

  const item = (emailAutoState.outboxItems || []).find(i => i.id === emailAutoState.selectedOutboxId);
  if (!item) {
    previewEl.innerHTML = '<div class="outbox-empty-preview"><span>📩</span><p>Önizlemek için sol listeden bir e-posta seçin.</p></div>';
    return;
  }

  const card = item.adaptive_card_json;
  let cardHtml = '';

  if (card && Array.isArray(card.body)) {
    const bodyBlocks = card.body.map(block => {
      if (block.type === 'TextBlock') {
        const isLarge = block.size === 'Large';
        const isSmall = block.size === 'Small';
        const colorStyle = block.color === 'Accent' ? 'color:#2563eb;' : (block.color === 'Warning' ? 'color:#d97706;' : '');
        return `<div style="${isLarge ? 'font-size:1.05rem;font-weight:700;margin:4px 0;' : isSmall ? 'font-size:0.74rem;font-weight:700;text-transform:uppercase;' : 'font-size:0.84rem;color:var(--text-secondary);margin-bottom:8px;'}${colorStyle}">${escapeHtml(block.text || '')}</div>`;
      }
      if (block.type === 'FactSet' && Array.isArray(block.facts)) {
        return `
          <div class="ac-fact-grid">
            ${block.facts.map(f => `
              <div class="ac-fact-title">${escapeHtml(f.title)}</div>
              <div class="ac-fact-val">${escapeHtml(f.value)}</div>
            `).join('')}
          </div>
        `;
      }
      if (block.type === 'Input.ChoiceSet' && Array.isArray(block.choices)) {
        const defVal = block.value || '50';
        return `
          <div style="margin-top:10px; padding:10px; border-radius:8px; background:var(--surface-hover, #f8fafc); border:1px solid var(--border-color, #e2e8f0);">
            <label style="display:block; font-size:0.76rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">
              ${escapeHtml(block.label || '📊 İlerleme Oranı Seçin (%40, %50, %60 vb.):')}
            </label>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:6px;">
              ${block.choices.map(c => `
                <button type="button" class="action-btn secondary-btn sm-btn ac-prog-chip" data-val="${escapeHtml(c.value)}" style="padding:3px 8px; font-size:0.72rem;">
                  %${escapeHtml(c.value)}
                </button>
              `).join('')}
            </div>
            <select id="acLiveProgress_${item.id}" class="styled-select sm-select" style="width:100%;">
              ${block.choices.map(c => `
                <option value="${escapeHtml(c.value)}" ${String(c.value) === String(defVal) ? 'selected' : ''}>
                  ${escapeHtml(c.title)}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      }
      if (block.type === 'Input.Text') {
        return `
          <div style="margin-top:8px;">
            ${block.label ? `<label style="display:block; font-size:0.76rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">${escapeHtml(block.label)}</label>` : ''}
            <input type="text" id="acLiveInput_${item.id}" class="styled-input" placeholder="${escapeHtml(block.placeholder || 'Açıklama notu yazınız (Zorunlu)...')}">
          </div>
        `;
      }
      return '';
    }).join('');

    const actionsHtml = Array.isArray(card.actions) ? card.actions.map((act, idx) => {
      if (act.type === 'Action.OpenUrl') {
        return `<a href="${escapeHtml(act.url)}" class="action-btn secondary-btn sm-btn" style="text-decoration:none;">${escapeHtml(act.title)}</a>`;
      }
      const btnClass = act.title.includes('Tamamla') || act.title.includes('Onayla')
        ? 'primary-btn'
        : (act.title.includes('Reddet') ? 'danger-bare-btn' : 'secondary-btn');
      return `
        <button type="button" class="action-btn ${btnClass} sm-btn btn-exec-ac-action" data-idx="${idx}">
          ${escapeHtml(act.title)}
        </button>
      `;
    }).join('') : '';

    cardHtml = `
      <div class="adaptive-card-simulator-box">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span class="ac-header-tag">⚡ Microsoft Outlook Actionable Message (Adaptive Card v1.4)</span>
          <span style="font-size:0.72rem; color:var(--text-tertiary);">Alıcı: ${escapeHtml((item.to || []).join(', '))}</span>
        </div>
        ${bodyBlocks}
        ${item.action_taken ? `
          <div style="margin-top:10px; padding:10px 12px; border-radius:8px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#059669; font-size:0.82rem; font-weight:600;">
            ${escapeHtml(item.action_taken)}
          </div>
        ` : ''}
        ${actionsHtml ? `<div class="ac-actions-bar">${actionsHtml}</div>` : ''}
      </div>
    `;
  }

  previewEl.innerHTML = `
    ${item.error_message ? `
      <div style="margin-bottom:12px; padding:10px 12px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#dc2626; font-size:0.8rem;">
        <strong>SMTP Uyarı Notu:</strong> ${escapeHtml(item.error_message)} (E-posta yerel Outbox'a kaydedildi, aşağıdaki karttan canlı test edebilirsiniz.)
      </div>
    ` : ''}
    ${cardHtml}
    <div style="margin-top:10px;">
      <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); margin-bottom:6px; text-transform:uppercase;"> Gönderilen E-posta HTML Gövdesi Önizlemesi:</div>
      <div style="background:#ffffff; color:#0f172a; border-radius:8px; border:1px solid var(--border-color); padding:12px;">
        ${item.html_preview || ''}
      </div>
    </div>
  `;

  previewEl.querySelectorAll('.ac-prog-chip').forEach(chip => {
    chip.onclick = () => {
      const sel = document.getElementById(`acLiveProgress_${item.id}`);
      if (sel) sel.value = chip.dataset.val;
      const inp = document.getElementById(`acLiveInput_${item.id}`);
      if (inp) inp.focus();
    };
  });

  previewEl.querySelectorAll('.btn-exec-ac-action').forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      const act = card.actions[idx];
      if (!act || !act.body) return;

      try {
        const payload = JSON.parse(act.body);
        payload.outboxId = item.id;
        const liveInput = document.getElementById(`acLiveInput_${item.id}`);
        const liveProg = document.getElementById(`acLiveProgress_${item.id}`);
        const typedNote = liveInput ? liveInput.value.trim() : '';

        if (liveProg && liveProg.value) {
          payload.progress_value = Number(liveProg.value);
        }

        if (typedNote) {
          payload.explanation_text = typedNote;
        } else {
          payload.explanation_text = '';
        }

        if ((payload.action === 'UPDATE_PROGRESS' || payload.action === 'SUBMIT_EXPLANATION') && typedNote.length < 2) {
          if (liveInput) {
            liveInput.style.borderColor = '#ef4444';
            liveInput.focus();
            setTimeout(() => { liveInput.style.borderColor = ''; }, 2500);
          }
          showToast('⚠️ İlerleme oranı (%40, %50, %60 vb.) veya durum kaydederken açıklama notu yazılması zorunludur!', 'error');
          return;
        }

        btn.disabled = true;
        const res = await apiCall('/api/outlook/action', 'POST', payload);
        showToast(res.message || 'Outlook kart aksiyonu uygulandı!', 'success');

        await loadEmailAutomationDashboard();
        if (state.currentProjectId) {
          await loadProjectTasks(state.currentProjectId);
        }
        await loadNotifications();
      } catch (err) {
        btn.disabled = false;
      }
    };
  });
}

function renderSmtpDiagnosticResult(res) {
  const box = document.getElementById('smtpDiagnosticResultBox');
  const badgeEl = document.getElementById('smtpStatusBadge');
  if (!box) return;

  box.style.display = 'block';

  if (res.verified && res.mail_sent) {
    if (badgeEl) {
      badgeEl.className = 'smtp-status-pill live';
      badgeEl.style.background = '';
      badgeEl.style.color = '';
      badgeEl.style.borderColor = '';
      badgeEl.textContent = `🟢 Canlı Exchange Online Aktif (${res.username} ➔ ${res.host}:${res.port})`;
    }
    box.innerHTML = `
      <div style="padding:14px 16px; border-radius:10px; background:#ecfdf5; border:1px solid #10b981; color:#065f46; font-size:0.84rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:0.92rem; color:#047857;">✅ Exchange Online Bağlantısı & Canlı E-posta Gönderimi Başarılı!</strong>
          <span style="font-size:0.75rem; font-weight:700; background:#d1fae5; padding:2px 8px; border-radius:999px;">${res.duration_ms || 0} ms</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(16,185,129,0.25); font-size:0.8rem;">
          <div><strong>Sunucu:</strong> ${escapeHtml(res.host)}:${escapeHtml(String(res.port))}</div>
          <div><strong>Gönderici:</strong> ${escapeHtml(res.username)} ✓</div>
          <div><strong>Test Alıcısı:</strong> ${escapeHtml(res.recipient)}</div>
          <div><strong>Sunucu Yanıtı:</strong> ${escapeHtml(res.smtp_response || '250 OK')}</div>
        </div>
      </div>
    `;
  } else if (res.direct_send_used && res.mail_sent) {
    if (badgeEl) {
      badgeEl.className = 'smtp-status-pill live';
      badgeEl.style.background = '';
      badgeEl.style.color = '';
      badgeEl.style.borderColor = '';
      badgeEl.textContent = `🟢 Exchange Online Direct Send İle Gönderildi (Port 587 Geçici Şifre Uyarısı)`;
    }
    box.innerHTML = `
      <div style="padding:14px 16px; border-radius:10px; background:#ecfdf5; border:1px solid #10b981; color:#065f46; font-size:0.84rem; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:0.92rem; color:#047857;">✅ Test E-postası Exchange Online Direct Send İle Posta Kutunuza (${escapeHtml(res.recipient)}) İletildi!</strong>
          <span style="font-size:0.75rem; font-weight:700; background:#d1fae5; padding:2px 8px; border-radius:999px;">${res.duration_ms || 0} ms</span>
        </div>
        <div style="font-size:0.79rem; color:#065f46;">
          <strong>Microsoft Sunucu Yanıtı:</strong> <code>${escapeHtml(res.smtp_response || '250 2.6.0 Queued mail for delivery')}</code>
        </div>
      </div>
      <div style="padding:14px 16px; border-radius:10px; background:#fffbeb; border:1px solid #f59e0b; color:#92400e; font-size:0.82rem;">
        <div style="font-weight:700; font-size:0.88rem; margin-bottom:6px; color:#b45309;">
          ⚠️ Neden Port 587 (${escapeHtml(res.host)}:587) Şifreli Giriş Reddedildi?
        </div>
        <div style="margin-bottom:8px; font-family:'JetBrains Mono', monospace; font-size:0.76rem; background:#ffffff; padding:8px 10px; border-radius:6px; border:1px solid #fde68a; color:#b45309; word-break:break-word;">
          ${escapeHtml(res.error_message || '')}
        </div>
        <div style="line-height:1.5; background:#fef3c7; padding:10px 12px; border-radius:6px; border-left:3px solid #d97706;">
          ${escapeHtml(res.troubleshooting_hint || '')}
        </div>
      </div>
    `;
  } else if (res.mode === 'SIMULATED') {
    if (badgeEl) {
      badgeEl.className = 'smtp-status-pill simulated';
      badgeEl.textContent = '🟡 Yerel Outbox Simülasyon Modu (Exchange Şifresi Girilmedi)';
    }
    box.innerHTML = `
      <div style="padding:14px 16px; border-radius:10px; background:#fffbeb; border:1px solid #f59e0b; color:#92400e; font-size:0.84rem;">
        <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px;">🟡 Şifre Girilmediği İçin Simülasyon Modunda Çalıştı</div>
        <div style="margin-bottom:6px;">${escapeHtml(res.error_message || '')}</div>
        <div style="padding:8px 10px; background:rgba(245,158,11,0.12); border-radius:6px; font-size:0.79rem;">
          <strong>💡 Bilgi:</strong> ${escapeHtml(res.troubleshooting_hint || '')}
        </div>
      </div>
    `;
  } else {
    if (badgeEl) {
      badgeEl.className = 'smtp-status-pill simulated';
      badgeEl.style.background = 'rgba(239, 68, 68, 0.14)';
      badgeEl.style.color = '#ef4444';
      badgeEl.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      badgeEl.textContent = `🔴 Exchange Online SMTP Bağlantı Hatası (${res.host}:${res.port})`;
    }
    box.innerHTML = `
      <div style="padding:14px 16px; border-radius:10px; background:#fef2f2; border:1px solid #ef4444; color:#991b1b; font-size:0.84rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:0.92rem; color:#b91c1c;">❌ Exchange Online SMTP Bağlantı / Kimlik Doğrulama Hatası!</strong>
          <span style="font-size:0.75rem; font-weight:700; background:#fee2e2; padding:2px 8px; border-radius:999px;">${res.duration_ms || 0} ms</span>
        </div>
        <div style="margin-bottom:8px; font-family:'JetBrains Mono', monospace; font-size:0.78rem; background:#ffffff; padding:8px 10px; border-radius:6px; border:1px solid #fecaca; color:#dc2626; word-break:break-word;">
          <strong>Sunucu Hata Mesajı:</strong> ${escapeHtml(res.error_message || 'Bağlantı kurulamadı')}
        </div>
        ${res.troubleshooting_hint ? `
          <div style="padding:10px 12px; background:#fff1f2; border-left:3px solid #e11d48; border-radius:6px; font-size:0.8rem; color:#881337; line-height:1.45;">
            <strong>💡 Nasıl Çözülür?</strong><br>${escapeHtml(res.troubleshooting_hint)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Hızlı geçiş butonları
  document.getElementById('gotoEmailAutomationFromTeamBtn')?.addEventListener('click', () => {
    switchView('view-email-automation');
  });
  document.getElementById('gotoScheduledReportsBtn')?.addEventListener('click', () => {
    switchView('view-email-automation');
  });
  document.getElementById('refreshOutboxBtn')?.addEventListener('click', () => {
    loadEmailAutomationDashboard();
  });

  // Preset Mod Seçiciler (Standart SMTP 587 vs Exchange Direct Send 25)
  document.getElementById('presetSmtpAuthBtn')?.addEventListener('click', () => {
    const h = document.getElementById('smtpHostInput');
    const p = document.getElementById('smtpPortInput');
    if (h) h.value = 'smtp.office365.com';
    if (p) p.value = '587';
    showToast('🔐 Standart SMTP Auth (smtp.office365.com:587) seçildi.', 'info');
  });
  document.getElementById('presetDirectSendBtn')?.addEventListener('click', () => {
    const h = document.getElementById('smtpHostInput');
    const p = document.getElementById('smtpPortInput');
    const u = document.getElementById('smtpUsernameInput')?.value.trim() || 'bildirim@fggroup.com.tr';
    const dom = (u.split('@')[1] || 'fggroup.com.tr').toLowerCase().replace(/\./g, '-');
    if (h) h.value = `${dom}.mail.protection.outlook.com`;
    if (p) p.value = '25';
    showToast(`⚡ Exchange Direct Send (${dom}.mail.protection.outlook.com:25) seçildi. Kaydet veya Test Et butonuna basabilirsiniz.`, 'info');
  });

  // Şifre Göster / Gizle Butonu
  const togglePassBtn = document.getElementById('toggleSmtpPassBtn');
  const passInput = document.getElementById('smtpPasswordInput');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.textContent = '🙈';
      } else {
        passInput.type = 'password';
        togglePassBtn.textContent = '👁️';
      }
    });
    passInput.addEventListener('focus', () => {
      if (passInput.value === '••••••••') {
        passInput.select();
      }
    });
  }

  // Kart İçi Doğrudan "🔌 Bağlantıyı Test Et & Test Maili Gönder" Butonu
  const verifySmtpBtn = document.getElementById('verifySmtpConnectionBtn');
  if (verifySmtpBtn) {
    verifySmtpBtn.addEventListener('click', async () => {
      const diagBox = document.getElementById('smtpDiagnosticResultBox');
      const host = document.getElementById('smtpHostInput')?.value.trim() || 'smtp.office365.com';
      const port = Number(document.getElementById('smtpPortInput')?.value) || 587;
      const username = document.getElementById('smtpUsernameInput')?.value.trim() || '';
      const password = document.getElementById('smtpPasswordInput')?.value || '';
      const from_name = document.getElementById('smtpFromNameInput')?.value.trim() || 'FG Group Proje Sistemi';
      const public_base_url = document.getElementById('smtpBaseUrlInput')?.value.trim() || window.location.origin;
      const enable_actionable_cards = document.getElementById('smtpEnableActionableCards')?.checked !== false;
      const test_recipient = document.getElementById('smtpInlineTestRecipient')?.value.trim() || username || state.currentUser?.email;

      verifySmtpBtn.disabled = true;
      const origText = verifySmtpBtn.innerHTML;
      verifySmtpBtn.innerHTML = '⏳ Sunucu Doğrulanıyor...';

      if (diagBox) {
        diagBox.style.display = 'block';
        diagBox.innerHTML = `
          <div style="padding:12px 16px; border-radius:10px; background:#eff6ff; border:1px solid #93c5fd; color:#1e40af; font-size:0.84rem;">
            ⏳ <strong>${escapeHtml(host)}:${port}</strong> sunucusuna bağlanılıyor, STARTTLS el sıkışması ve <strong>${escapeHtml(username)}</strong> kimlik doğrulaması test ediliyor...
          </div>
        `;
      }

      try {
        const res = await apiCall('/api/admin/smtp-verify', 'POST', {
          host,
          port,
          username,
          password,
          from_name,
          public_base_url,
          enable_actionable_cards,
          test_recipient
        });

        renderSmtpDiagnosticResult(res);

        if (res.outbox_item) {
          emailAutoState.selectedOutboxId = res.outbox_item.id;
        }

        if (res.verified && res.mail_sent) {
          showToast(`✅ Exchange Online SMTP bağlantısı doğrulandı ve test maili (${res.recipient}) adresine gönderildi!`, 'success');
        } else if (res.mode === 'SIMULATED') {
          showToast('🟡 Şifre girilmediği için test simülasyon modunda çalıştı.', 'info');
        } else {
          showToast(`❌ SMTP Bağlantı Hatası: ${res.error_message || 'Kimlik doğrulama başarısız'}`, 'error');
        }

        await loadEmailAutomationDashboard();
      } catch (err) {
        if (diagBox) {
          diagBox.style.display = 'block';
          diagBox.innerHTML = `
            <div style="padding:12px 16px; border-radius:10px; background:#fef2f2; border:1px solid #ef4444; color:#991b1b; font-size:0.84rem;">
              ❌ <strong>Test sırasında hata oluştu:</strong> ${escapeHtml(err.message || 'Bilinmeyen hata')}
            </div>
          `;
        }
      } finally {
        verifySmtpBtn.disabled = false;
        verifySmtpBtn.innerHTML = origText;
      }
    });
  }

  // Exchange Online SMTP Kaydet Formu
  const smtpForm = document.getElementById('smtpConfigForm');
  if (smtpForm) {
    smtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        host: document.getElementById('smtpHostInput').value.trim(),
        port: Number(document.getElementById('smtpPortInput').value) || 587,
        username: document.getElementById('smtpUsernameInput').value.trim(),
        password: document.getElementById('smtpPasswordInput').value,
        from_name: document.getElementById('smtpFromNameInput').value.trim(),
        public_base_url: document.getElementById('smtpBaseUrlInput').value.trim(),
        enable_actionable_cards: document.getElementById('smtpEnableActionableCards').checked
      };
      const saved = await apiCall('/api/admin/smtp-config', 'PUT', body);
      emailAutoState.smtpConfig = saved;
      renderSmtpConfigForm(saved);
      showToast('💾 Exchange Online Plan 1 (SMTP) ayarları başarıyla kaydedildi!', 'success');
    });
  }

  // Test Canlı Görev Kartı Gönder
  const testCardBtn = document.getElementById('sendTestActionableCardBtn');
  if (testCardBtn) {
    testCardBtn.addEventListener('click', async () => {
      const recipient_email = document.getElementById('smtpTestRecipientInput')?.value.trim() || state.currentUser?.email;
      testCardBtn.disabled = true;
      try {
        const res = await apiCall('/api/admin/smtp-test', 'POST', { recipient_email });
        if (res.item) {
          emailAutoState.selectedOutboxId = res.item.id;
          if (res.item.status === 'SENT') {
            showToast(`✅ Canlı Görev Kartı Exchange Online üzerinden (${recipient_email}) adresine gönderildi!`, 'success');
          } else {
            showToast(`📩 Canlı Görev Kartı oluşturuldu ve Giden Kutusu Simülatöründe açıldı!`, 'info');
          }
        }
        await loadEmailAutomationDashboard();
      } finally {
        testCardBtn.disabled = false;
      }
    });
  }

  // Outlook Adaptive Cards Rehberi (outlook_adaptive_cards_rehberi.md) 5 Senaryo Tetikleyicileri
  document.querySelectorAll('.btn-trigger-card-scenario').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scenario = btn.dataset.scenario;
      if (!scenario) return;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Gönderiliyor...';
      try {
        const res = await apiCall('/api/admin/trigger-card-scenario', 'POST', { scenario });
        if (res.item) {
          emailAutoState.selectedOutboxId = res.item.id;
          showToast(`📬 "${res.item.subject}" oluşturuldu, gönderildi ve aşağıdaki simülatörde açıldı!`, 'success');
        }
        await loadEmailAutomationDashboard();
        await loadNotifications();
      } catch (err) {
        showToast('Senaryo tetiklenemedi: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    });
  });

  // Zamanlanmış Rapor Kuralı Ekle Formu
  const schedForm = document.getElementById('scheduledReportForm');
  if (schedForm) {
    schedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('schedReportName').value.trim();
      const project_id = document.getElementById('schedProjectSelect').value;
      const report_type = document.getElementById('schedReportType').value;
      const frequency = document.getElementById('schedFrequency').value;
      const send_time = document.getElementById('schedSendTime').value || '09:00';
      const recipientsRaw = document.getElementById('schedRecipients').value;
      const include_adaptive_card = document.getElementById('schedIncludeAdaptiveCard').checked;

      const recipients = recipientsRaw.split(',').map(s => s.trim()).filter(Boolean);
      await apiCall('/api/admin/scheduled-reports', 'POST', {
        name,
        project_id,
        report_type,
        frequency,
        send_time,
        recipients,
        include_adaptive_card
      });

      document.getElementById('schedReportName').value = '';
      showToast('⏰ Yeni zamanlanmış otomatik rapor kuralı eklendi!', 'success');
      await loadEmailAutomationDashboard();
    });
  }

  // ================= 10. YEDEKLEME & FELAKET KURTARMA (DISASTER RECOVERY) =================
  const backupForm = document.getElementById('backupScheduleForm');
  if (backupForm) {
    backupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          daily_enabled: document.getElementById('schedDailyEnabled').checked,
          daily_time: document.getElementById('schedDailyTime').value || '02:00',
          daily_retention_days: parseInt(document.getElementById('schedDailyRetention').value, 10) || 14,
          weekly_enabled: document.getElementById('schedWeeklyEnabled').checked,
          weekly_day: parseInt(document.getElementById('schedWeeklyDay').value, 10) || 0,
          weekly_time: document.getElementById('schedWeeklyTime').value || '03:00',
          weekly_retention_weeks: parseInt(document.getElementById('schedWeeklyRetention').value, 10) || 8,
          notify_email: document.getElementById('schedNotifyEmail').value.trim()
        };

        const res = await apiCall('/api/admin/backups/schedule', 'PUT', payload);
        if (res.success) {
          showToast('✅ Otomatik yedekleme planı ve saklama kuralları başarıyla güncellendi.', 'success');
          await loadBackupDashboard();
        }
      } catch (err) {
        showToast('Plan kaydedilemedi: ' + err.message, 'error');
      }
    });
  }

  // Anlık Manuel Yedek Al Butonu
  document.getElementById('createBackupNowBtn')?.addEventListener('click', async () => {
    const desc = prompt('Alınacak yedek için kısa bir açıklama veya not giriniz:', 'Manuel Yönetici Yedeği');
    if (desc === null) return;

    const btn = document.getElementById('createBackupNowBtn');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Yedek Alınıyor...';

    try {
      const res = await apiCall('/api/admin/backups/create', 'POST', { description: desc || 'Manuel Yedek' });
      if (res.success) {
        showToast(`✅ Tam sistem yedeği başarıyla oluşturuldu! (${(res.backup.file_size_bytes / 1024).toFixed(1)} KB)`, 'success');
        await loadBackupDashboard();
      }
    } catch (err) {
      showToast('Yedek alınamadı: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });

  // Yenile Butonu
  document.getElementById('refreshBackupsBtn')?.addEventListener('click', () => {
    loadBackupDashboard();
  });

  // Dışarıdan Yedek İçe Aktar Butonu
  const backupFileInput = document.getElementById('backupFileInput');
  document.getElementById('importBackupBtn')?.addEventListener('click', () => {
    backupFileInput?.click();
  });

  backupFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`"${file.name}" isimli yedek dosyası sisteme içe aktarılacak. Onaylıyor musunuz?`)) {
      backupFileInput.value = '';
      return;
    }

    try {
      const fileText = await file.text();
      const payload = JSON.parse(fileText);

      const res = await apiCall('/api/admin/backups/import', 'POST', { payload });
      if (res.success) {
        showToast('✅ Dış yedek başarıyla doğrulandı ve sisteme aktarıldı!', 'success');
        await loadBackupDashboard();
      }
    } catch (err) {
      showToast('Yedek yükleme başarısız: ' + (err.message || 'Geçersiz JSON'), 'error');
    } finally {
      backupFileInput.value = '';
    }
  });

  // Tekil Proje Kurtarma Formu
  const restoreProjectForm = document.getElementById('restoreProjectForm');
  if (restoreProjectForm) {
    restoreProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const backupId = document.getElementById('restoreBackupId').value;
      const projectId = document.getElementById('restoreProjectSelect').value;
      if (!backupId || !projectId) {
        showToast('Lütfen kurtarılacak bir proje seçin.', 'warning');
        return;
      }

      if (!confirm('⚠️ Seçilen proje bu yedekteki haliyle geri yüklenecektir. Diğer projelere dokunulmaz. Onaylıyor musunuz?')) {
        return;
      }

      const submitBtn = document.getElementById('confirmRestoreProjectBtn');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Kurtarılıyor...';

      try {
        const res = await apiCall(`/api/admin/backups/${backupId}/restore-project`, 'POST', { projectId });
        if (res.success) {
          showToast('🎯 Proje başarıyla kurtarıldı ve güncellendi!', 'success');
          document.getElementById('restoreProjectModal')?.classList.remove('open');
          await init();
          await loadBackupDashboard();
        }
      } catch (err) {
        showToast('Proje kurtarılamadı: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }

  // Proje Seçildiğinde Önizleme Kutusunu Güncelle
  document.getElementById('restoreProjectSelect')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions?.[0];
    const previewBox = document.getElementById('restoreProjectPreviewBox');
    if (!previewBox) return;

    if (!opt || !opt.value) {
      previewBox.style.display = 'none';
      return;
    }

    const tasksCount = opt.dataset.tasks || '0';
    const membersCount = opt.dataset.members || '0';
    previewBox.innerHTML = `📦 <strong>Kurtarılacak İçerik:</strong> ${opt.text} projesi kapsamında <strong>${tasksCount} adet görev</strong> ve <strong>${membersCount} adet ekip üyesi</strong> geri yüklenecektir.`;
    previewBox.style.display = 'block';
  });
});

// ================= YEDEKLEME & FELAKET KURTARMA YARDIMCI FONKSİYONLARI =================
let cachedBackupProjects = {};

async function loadBackupDashboard() {
  try {
    const res = await apiCall('/api/admin/backups');
    if (!res || !res.success) return;

    const schedule = res.schedule || {};
    const backups = res.backups || [];

    // KPI Kartları
    if (backups.length > 0) {
      const last = backups[0];
      document.getElementById('kpiLastBackupTime').textContent = formatDateTime(last.created_at);

      const typeLabels = {
        'SCHEDULED_DAILY': '📅 Günlük Otomatik',
        'SCHEDULED_WEEKLY': '🗓️ Haftalık Arşiv',
        'MANUAL': '⚡ Manuel Alınan',
        'PRE_RESTORE_SAFETY': '🛡️ Güvenlik Yedeği',
        'IMPORTED': '📥 Dışarıdan Aktarılan'
      };
      document.getElementById('kpiLastBackupType').textContent = typeLabels[last.type] || last.type;
    } else {
      document.getElementById('kpiLastBackupTime').textContent = '-';
      document.getElementById('kpiLastBackupType').textContent = 'Henüz yedek alınmadı';
    }

    document.getElementById('kpiTotalBackups').textContent = `${backups.length} Adet`;
    const totalBytes = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
    document.getElementById('kpiTotalBackupSize').textContent = `${(totalBytes / 1024).toFixed(1)} KB Disk Alanı`;

    // Günlük & Haftalık KPI
    if (schedule.daily_enabled) {
      document.getElementById('kpiDailyStatus').textContent = `Aktif (${schedule.daily_time || '02:00'})`;
      document.getElementById('kpiDailyStatus').style.color = '#059669';
    } else {
      document.getElementById('kpiDailyStatus').textContent = 'Devre Dışı';
      document.getElementById('kpiDailyStatus').style.color = '#64748b';
    }
    document.getElementById('kpiDailyRetention').textContent = `${schedule.daily_retention_days || 14} gün saklama süresi`;

    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    if (schedule.weekly_enabled) {
      const dayName = dayNames[schedule.weekly_day ?? 0] || 'Pazar';
      document.getElementById('kpiWeeklyStatus').textContent = `Aktif (${dayName} ${schedule.weekly_time || '03:00'})`;
      document.getElementById('kpiWeeklyStatus').style.color = '#2563eb';
    } else {
      document.getElementById('kpiWeeklyStatus').textContent = 'Devre Dışı';
      document.getElementById('kpiWeeklyStatus').style.color = '#64748b';
    }
    document.getElementById('kpiWeeklyRetention').textContent = `${schedule.weekly_retention_weeks || 8} hafta saklama süresi`;

    // Form Alanlarını Doldur
    const dailyEnabledEl = document.getElementById('schedDailyEnabled');
    if (dailyEnabledEl) dailyEnabledEl.checked = !!schedule.daily_enabled;
    const dailyTimeEl = document.getElementById('schedDailyTime');
    if (dailyTimeEl && schedule.daily_time) dailyTimeEl.value = schedule.daily_time;
    const dailyRetEl = document.getElementById('schedDailyRetention');
    if (dailyRetEl && schedule.daily_retention_days) dailyRetEl.value = schedule.daily_retention_days;

    const weeklyEnabledEl = document.getElementById('schedWeeklyEnabled');
    if (weeklyEnabledEl) weeklyEnabledEl.checked = !!schedule.weekly_enabled;
    const weeklyDayEl = document.getElementById('schedWeeklyDay');
    if (weeklyDayEl && schedule.weekly_day !== undefined) weeklyDayEl.value = schedule.weekly_day;
    const weeklyTimeEl = document.getElementById('schedWeeklyTime');
    if (weeklyTimeEl && schedule.weekly_time) weeklyTimeEl.value = schedule.weekly_time;
    const weeklyRetEl = document.getElementById('schedWeeklyRetention');
    if (weeklyRetEl && schedule.weekly_retention_weeks) weeklyRetEl.value = schedule.weekly_retention_weeks;

    const notifyEmailEl = document.getElementById('schedNotifyEmail');
    if (notifyEmailEl) notifyEmailEl.value = schedule.notify_email || '';

    // Tabloyu Oluştur
    renderBackupTable(backups);
  } catch (err) {
    showToast('Yedekleme kontrol paneli yüklenemedi: ' + err.message, 'error');
  }
}

function renderBackupTable(backups) {
  const tbody = document.getElementById('backupHistoryTableBody');
  if (!tbody) return;

  if (!backups || backups.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--text-tertiary);">
          <div style="font-size:2rem; margin-bottom:8px;">📦</div>
          <div style="font-weight:600; color:var(--text-secondary);">Henüz oluşturulmuş bir sistem yedeği bulunmuyor.</div>
          <div style="font-size:0.8rem; margin-top:4px;">Yukarıdaki "Hemen Tam Yedek Al" butonuna tıklayarak ilk yedeğinizi anında oluşturabilirsiniz.</div>
        </td>
      </tr>
    `;
    return;
  }

  const typeConfig = {
    'SCHEDULED_DAILY': { label: 'Günlük Otomatik', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '📅' },
    'SCHEDULED_WEEKLY': { label: 'Haftalık Arşiv', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', icon: '🗓️' },
    'MANUAL': { label: 'Manuel Alınan', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '⚡' },
    'PRE_RESTORE_SAFETY': { label: 'Güvenlik Yedeği', bg: '#fff1f2', color: '#be123c', border: '#fecdd3', icon: '🛡️' },
    'IMPORTED': { label: 'İçe Aktarılan', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: '📥' }
  };

  tbody.innerHTML = backups.map(b => {
    const dateFormatted = formatDateTime(b.created_at);
    const tc = typeConfig[b.type] || { label: b.type, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '📦' };

    const shaShort = b.sha256 ? `${b.sha256.substring(0, 8)}...` : 'n/a';
    const sizeKb = ((b.size_bytes || 0) / 1024).toFixed(1);
    const projCount = b.summary?.project_count ?? 0;
    const taskCount = b.summary?.task_count ?? 0;
    const userCount = b.summary?.user_count ?? 0;

    return `
      <tr>
        <td style="font-weight:600; white-space:nowrap;">
          <div>${dateFormatted}</div>
          <div style="font-size:0.72rem; color:var(--text-tertiary); font-weight:normal;">${b.id.substring(0, 8)}</div>
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:${tc.bg}; color:${tc.color}; border:1px solid ${tc.border};">
            <span>${tc.icon}</span> ${tc.label}
          </span>
        </td>
        <td>
          <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">
            ${b.name || 'Sistem Yedeği'}
          </div>
          ${b.note ? `<div style="font-size:0.76rem; color:var(--text-tertiary); margin-top:2px;">${b.note}</div>` : ''}
        </td>
        <td style="font-size:0.78rem; color:var(--text-secondary); white-space:nowrap;">
          <div>📁 <strong>${projCount}</strong> Proje</div>
          <div>📌 <strong>${taskCount}</strong> Görev | 👥 <strong>${userCount}</strong> Üye</div>
        </td>
        <td style="font-size:0.75rem; color:var(--text-tertiary); white-space:nowrap;">
          <div>💾 ${sizeKb} KB</div>
          <div title="${b.sha256 || ''}" style="cursor:help;">🔒 ${shaShort}</div>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          <button type="button" class="action-btn secondary-btn sm-btn" onclick="openRestoreProjectModal('${b.id}')" title="Yalnızca tek bir projeyi kurtar" style="font-size:0.75rem; padding:4px 8px; margin-right:4px;">
            🎯 Proje Kurtar
          </button>
          <button type="button" class="action-btn sm-btn" onclick="triggerFullRestore('${b.id}', '${dateFormatted}')" title="Tüm sistemi bu tarihe geri yükle" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:0.75rem; padding:4px 8px; margin-right:4px;">
            🔄 Tam Geri Yükle
          </button>
          <button type="button" class="action-btn secondary-btn sm-btn" onclick="downloadBackupFile('${b.id}', 'backup_${b.id.substring(0, 8)}.json')" title="İndir" style="font-size:0.75rem; padding:4px 8px; margin-right:4px;">
            📥
          </button>
          <button type="button" class="action-btn secondary-btn sm-btn" onclick="deleteBackupFile('${b.id}', '${(b.name || b.id).replace(/['"]/g, '')}')" title="Sil" style="color:#dc2626; font-size:0.75rem; padding:4px 8px;">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openRestoreProjectModal = async function (backupId) {
  try {
    const res = await apiCall(`/api/admin/backups/${backupId}/preview`);
    if (!res || !res.success) throw new Error('Yedek içeriği okunamadı');

    const backup = res.backup;
    const projects = res.projects || [];

    document.getElementById('restoreBackupId').value = backupId;
    document.getElementById('restoreModalBackupInfo').innerHTML = `
      <div>📦 <strong>Seçili Yedek:</strong> ${backup.filename}</div>
      <div style="color:var(--text-secondary); margin-top:2px;">Tarih: ${formatDateTime(backup.created_at)} | Not: ${backup.description || '-'}</div>
    `;

    const select = document.getElementById('restoreProjectSelect');
    if (projects.length === 0) {
      select.innerHTML = '<option value="">Bu yedek içinde kayıtlı proje bulunamadı</option>';
      document.getElementById('restoreProjectPreviewBox').style.display = 'none';
    } else {
      select.innerHTML = `
        <option value="">-- Kurtarmak istediğiniz projeyi seçin (${projects.length} Proje) --</option>
        ${projects.map(p => `
          <option value="${p.id}" data-tasks="${p.tasks_count}" data-members="${p.members_count}">
            ${p.title} (${p.tasks_count} Görev, ${p.members_count} Üye)
          </option>
        `).join('')}
      `;
      document.getElementById('restoreProjectPreviewBox').style.display = 'none';
    }

    document.getElementById('restoreProjectModal')?.classList.add('open');
  } catch (err) {
    showToast('Proje kurtarma penceresi açılamadı: ' + err.message, 'error');
  }
};

window.triggerFullRestore = async function (backupId, dateText) {
  const confirmMsg = `⚠️ DİKKAT: TAM SİSTEM GERİ YÜKLEME\n\nTüm projeler, görevler, bağımlılıklar ve ayarlar seçilen yedeğin (${dateText}) alındığı durumuna dönecektir.\n\nİşlem başlamadan önce sistem OTOMATİK olarak mevcut anlık durumun güvenlik yedeğini (Pre-Restore Safety) alacaktır. Yanlışlıkla geri yükleseniz bile son duruma geri dönebilirsiniz.\n\nDevam etmek istiyor musunuz?`;

  if (!confirm(confirmMsg)) return;

  try {
    showToast('⏳ Geri yükleme yapılıyor, lütfen bekleyin...', 'info');
    const res = await apiCall(`/api/admin/backups/${backupId}/restore-full`, 'POST');
    if (res.success) {
      showToast('🔄 Tam sistem başarıyla geri yüklendi!', 'success');
      await init();
      await loadBackupDashboard();
    }
  } catch (err) {
    showToast('Geri yükleme başarısız: ' + err.message, 'error');
  }
};

window.downloadBackupFile = async function (backupId, filename) {
  try {
    const res = await fetch(`/api/admin/backups/${backupId}/download`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('İndirme başarısız');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `backup_${backupId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('📥 Yedek dosyası başarıyla indirildi.', 'success');
  } catch (err) {
    showToast('Yedek indirilemedi: ' + err.message, 'error');
  }
};

window.deleteBackupFile = async function (backupId, filename) {
  if (!confirm(`"${filename}" isimli yedek dosyasını kalıcı olarak silmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const res = await apiCall(`/api/admin/backups/${backupId}`, 'DELETE');
    if (res.success) {
      showToast('🗑️ Yedek dosyası başarıyla silindi.', 'success');
      await loadBackupDashboard();
    }
  } catch (err) {
    showToast('Yedek silinemedi: ' + err.message, 'error');
  }
};
