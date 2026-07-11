/* =========================================================
   TaskFlow — Single-Page Application
   =========================================================
   Sections:
     1. Config
     2. State & Storage
     3. API Client
     4. Router
     5. Utilities  (toast, modal, avatar, badges, date)
     6. Views
        a. Auth (login / register)
        b. Teams Dashboard
        c. Team Detail   (projects | members | activity)
        d. Project Detail (kanban board)
        e. Task Modal
     7. Modals  (create team, create project, create task,
                 invite member, change role)
     8. Init
   ========================================================= */

'use strict';

// =========================================================
// 1. CONFIG
// =========================================================
// When served from Django (http://localhost:8000), use relative paths — no CORS.
// When opened as a plain file (file://...), fall back to localhost:8000.
const API = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

// =========================================================
// 2. STATE & STORAGE
// =========================================================
const state = {
  user:         null,
  accessToken:  null,
  refreshToken: null,
  // navigation context
  teamId:       null,
  projectId:    null,
  activeTab:    'projects',
};

function saveAuth(access, refresh, user) {
  state.accessToken  = access;
  state.refreshToken = refresh;
  state.user         = user;
  localStorage.setItem('tf_access',  access);
  localStorage.setItem('tf_refresh', refresh);
  localStorage.setItem('tf_user',    JSON.stringify(user));
}

function loadAuth() {
  state.accessToken  = localStorage.getItem('tf_access');
  state.refreshToken = localStorage.getItem('tf_refresh');
  const u = localStorage.getItem('tf_user');
  state.user = u ? JSON.parse(u) : null;
}

function clearAuth() {
  state.accessToken  = null;
  state.refreshToken = null;
  state.user         = null;
  localStorage.removeItem('tf_access');
  localStorage.removeItem('tf_refresh');
  localStorage.removeItem('tf_user');
}

// =========================================================
// 3. API CLIENT
// =========================================================
let _refreshing = false;

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });

  // Auto-refresh on 401
  if (res.status === 401 && state.refreshToken && !_refreshing) {
    _refreshing = true;
    try {
      const r = await fetch(`${API}/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: state.refreshToken }),
      });
      if (r.ok) {
        const d = await r.json();
        state.accessToken = d.access;
        localStorage.setItem('tf_access', d.access);
        headers['Authorization'] = `Bearer ${d.access}`;
        _refreshing = false;
        return fetch(`${API}${path}`, { ...opts, headers });
      }
    } catch (_) {}
    _refreshing = false;
    clearAuth();
    navigate('#login');
    throw new Error('Session expired.');
  }

  return res;
}

async function apiJSON(path, opts = {}) {
  const res = await apiFetch(path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.message ||
      data.detail ||
      Object.values(data.errors || data || {}).flat().join(' ') ||
      `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// =========================================================
// 4. ROUTER
// =========================================================
function navigate(hash) {
  window.location.hash = hash;
}

function router() {
  if (!state.user) { renderAuth(); return; }

  const hash = window.location.hash || '#teams';

  if (hash === '#teams' || hash === '') {
    renderTeams();
  } else if (hash.startsWith('#team/')) {
    state.teamId = hash.split('/')[1];
    renderTeamDetail(state.teamId);
  } else if (hash.startsWith('#project/')) {
    state.projectId = hash.split('/')[1];
    renderProjectDetail(state.projectId);
  } else if (hash === '#login' || hash === '#register') {
    renderAuth(hash === '#register' ? 'register' : 'login');
  } else {
    renderTeams();
  }
}

// =========================================================
// 5. UTILITIES
// =========================================================

/* ---- Toast ---- */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || '✓'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---- Modal ---- */
function openModal(html, size = '') {
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  box.className = `modal-box${size ? ' ' + size : ''}`;
  box.innerHTML = html;
  overlay.classList.remove('hidden');

  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  const closeBtn = box.querySelector('.modal-close');
  if (closeBtn) closeBtn.onclick = closeModal;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

/* ---- Avatar ---- */
function initials(name = '') {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  '#5b6af0','#06b6d4','#8b5cf6','#ec4899','#f59e0b','#22c55e','#ef4444',
];
function avatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function avatarEl(name, sizeClass = '') {
  const bg  = avatarColor(name);
  const cls = `avatar${sizeClass ? ' ' + sizeClass : ''}`;
  return `<div class="${cls}" style="background:${bg}">${initials(name)}</div>`;
}

/* ---- Badges ---- */
function statusBadge(s) {
  const map = { TODO: ['badge-todo','To Do'], IN_PROGRESS: ['badge-progress','In Progress'], DONE: ['badge-done','Done'] };
  const [cls, label] = map[s] || ['badge-todo', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function priorityBadge(p) {
  const map = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high' };
  return `<span class="badge ${map[p] || 'badge-low'}">${p}</span>`;
}

function roleBadge(r) {
  const map = { OWNER: 'badge-owner', MAINTAINER: 'badge-maintainer', MEMBER: 'badge-member', VIEWER: 'badge-viewer' };
  return `<span class="badge ${map[r] || 'badge-member'}">${r}</span>`;
}

/* ---- Date ---- */
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return d.toLocaleDateString();
}

/* ---- Role check helpers ---- */
function myRole(team) {
  const me = state.user?.id || state.user?.email;
  const m  = (team.members || []).find(
    m => m.user?.id === me || m.user?.email === me
  );
  return m?.role || null;
}

function canManage(team) {
  const r = myRole(team);
  return r === 'OWNER' || r === 'MAINTAINER';
}

/* ---- App shell ---- */
function appHTML(breadcrumbs, actions, content) {
  const isTeams = window.location.hash === '#teams' || window.location.hash === '';
  const isTeam  = window.location.hash.startsWith('#team/');

  return `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo-icon">T</div>
        <span class="sidebar-logo-name">TaskFlow</span>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Navigation</div>
        <div class="sidebar-link${isTeams ? ' active' : ''}" onclick="navigate('#teams')">
          <span class="nav-icon">🏠</span> Dashboard
        </div>
        ${state.teamId ? `
        <div class="sidebar-link${isTeam ? ' active' : ''}" onclick="navigate('#team/${state.teamId}')">
          <span class="nav-icon">👥</span> Current Team
        </div>` : ''}
      </nav>
      <div class="sidebar-footer">
        <div class="user-row">
          ${avatarEl(state.user?.username || state.user?.email)}
          <div class="user-info">
            <div class="user-name">${state.user?.username || 'User'}</div>
            <div class="user-email">${state.user?.email || ''}</div>
          </div>
          <button class="logout-btn" title="Logout" id="logout-btn">⏻</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-breadcrumb">${breadcrumbs}</div>
        <div class="topbar-actions">${actions}</div>
      </header>
      <main class="content" id="main-content">
        ${content}
      </main>
    </div>
  </div>`;
}

function setApp(html) {
  document.getElementById('app').innerHTML = html;
  const lb = document.getElementById('logout-btn');
  if (lb) lb.onclick = logout;
}

async function logout() {
  try {
    await apiFetch('/api/v1/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh: state.refreshToken }),
    });
  } catch (_) {}
  clearAuth();
  navigate('#login');
}

/* ---- Loading placeholder ---- */
function setMainContent(html) {
  const mc = document.getElementById('main-content');
  if (mc) mc.innerHTML = html;
}

// =========================================================
// 6a. AUTH VIEW
// =========================================================
function renderAuth(tab = 'login') {
  document.getElementById('app').innerHTML = `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">T</div>
        <span class="auth-logo-name">TaskFlow</span>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab${tab === 'login' ? ' active' : ''}" id="tab-login">Sign In</button>
        <button class="auth-tab${tab === 'register' ? ' active' : ''}" id="tab-register">Create Account</button>
      </div>
      <div id="auth-form-area">
        ${tab === 'login' ? loginFormHTML() : registerFormHTML()}
      </div>
    </div>
  </div>`;

  document.getElementById('tab-login').onclick = () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('auth-form-area').innerHTML = loginFormHTML();
    bindLoginForm();
  };
  document.getElementById('tab-register').onclick = () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('auth-form-area').innerHTML = registerFormHTML();
    bindRegisterForm();
  };

  if (tab === 'login') bindLoginForm(); else bindRegisterForm();
}

function loginFormHTML() {
  return `
  <div id="auth-error" class="form-error" style="display:none"></div>
  <form id="login-form">
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" id="login-email" type="email" placeholder="you@example.com" required />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" id="login-password" type="password" placeholder="••••••••" required />
    </div>
    <button class="btn btn-primary btn-full" id="login-submit" type="submit">Sign In</button>
  </form>`;
}

function registerFormHTML() {
  return `
  <div id="auth-error" class="form-error" style="display:none"></div>
  <form id="register-form">
    <div class="form-group">
      <label class="form-label">Username</label>
      <input class="form-input" id="reg-username" type="text" placeholder="johndoe" required />
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" id="reg-email" type="email" placeholder="you@example.com" required />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" id="reg-password" type="password" placeholder="Min 8 characters" required />
    </div>
    <button class="btn btn-primary btn-full" id="reg-submit" type="submit">Create Account</button>
  </form>`;
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}

function bindLoginForm() {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      const data = await apiJSON('/api/v1/auth/login/', {
        method: 'POST',
        body: JSON.stringify({
          email:    document.getElementById('login-email').value,
          password: document.getElementById('login-password').value,
        }),
      });
      saveAuth(data.access, data.refresh, data.user);
      navigate('#teams');
    } catch (err) {
      showAuthError(err.message);
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function bindRegisterForm() {
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON('/api/v1/auth/signup/', {
        method: 'POST',
        body: JSON.stringify({
          username: document.getElementById('reg-username').value,
          email:    document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
        }),
      });
      toast('Account created! Please sign in.', 'success');
      renderAuth('login');
    } catch (err) {
      showAuthError(err.message);
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

// =========================================================
// 6b. TEAMS DASHBOARD
// =========================================================
async function renderTeams() {
  state.teamId    = null;
  state.projectId = null;

  const breadcrumbs = `<span class="crumb-current">Dashboard</span>`;
  const actions = `<button class="btn btn-primary btn-sm" id="new-team-btn">＋ New Team</button>`;

  setApp(appHTML(breadcrumbs, actions, `<div class="loading-state"><div class="spinner"></div></div>`));
  document.getElementById('new-team-btn').onclick = () => openCreateTeamModal();

  try {
    const teams = await apiJSON('/api/v1/teams/');
    const items = teams.results ?? teams;

    let grid = '';
    if (items.length === 0) {
      grid = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-title">No teams yet</div>
        <div class="empty-desc">Create a team to get started or join one with its ID.</div>
        <button class="btn btn-primary mt-4" id="empty-new-team-btn">＋ Create Team</button>
      </div>`;
    } else {
      grid = `<div class="card-grid">${items.map(teamCard).join('')}
        <div class="card card-add" id="add-team-card">
          <span class="card-add-icon">＋</span>
          <span>Create New Team</span>
        </div>
      </div>`;
    }

    setMainContent(`
      <div class="section-header">
        <div>
          <div class="section-title">Your Teams</div>
          <div class="section-subtitle">Teams you belong to or manage</div>
        </div>
      </div>
      ${grid}
    `);

    // bind cards
    items.forEach(t => {
      document.getElementById(`team-card-${t.id}`)?.addEventListener('click', () => navigate(`#team/${t.id}`));
    });
    document.getElementById('add-team-card')?.addEventListener('click', openCreateTeamModal);
    document.getElementById('empty-new-team-btn')?.addEventListener('click', openCreateTeamModal);

  } catch (err) {
    setMainContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">${err.message}</div></div>`);
  }
}

function teamCard(t) {
  const memberCount = (t.members || []).length;
  return `
  <div class="card" id="team-card-${t.id}">
    <div class="card-icon">👥</div>
    <div class="card-title">${t.name}</div>
    <div class="card-desc">${t.description || 'No description'}</div>
    <div class="card-meta">
      <div class="card-meta-item">👤 ${memberCount} member${memberCount !== 1 ? 's' : ''}</div>
      <div class="card-meta-item">${timeAgo(t.created_at)}</div>
    </div>
  </div>`;
}

// =========================================================
// 6c. TEAM DETAIL
// =========================================================
async function renderTeamDetail(teamId) {
  const breadcrumbs = `
    <span class="sidebar-link text-muted" style="padding:0;background:none;cursor:pointer" onclick="navigate('#teams')">Dashboard</span>
    <span class="crumb-sep">›</span>
    <span class="crumb-current" id="team-breadcrumb">Team</span>`;
  const actions = '';
  setApp(appHTML(breadcrumbs, actions, `<div class="loading-state"><div class="spinner"></div></div>`));

  try {
    const [team, projects] = await Promise.all([
      apiJSON(`/api/v1/teams/${teamId}/`),
      apiJSON('/api/v1/projects/'),
    ]);

    const bc = document.getElementById('team-breadcrumb');
    if (bc) bc.textContent = team.name;

    const role        = myRole(team);
    const canManageT  = role === 'OWNER' || role === 'MAINTAINER';
    const isOwner     = role === 'OWNER';

    const allProjects = (projects.results ?? projects).filter(p => p.team === team.id);
    state.activeTab   = state.activeTab || 'projects';

    function renderTeamContent(tab) {
      state.activeTab = tab;
      let tabContent = '';

      if (tab === 'projects') {
        if (allProjects.length === 0) {
          tabContent = `<div class="empty-state">
            <div class="empty-icon">📁</div>
            <div class="empty-title">No projects yet</div>
            <div class="empty-desc">${canManageT ? 'Create the first project for this team.' : 'No projects have been created yet.'}</div>
            ${canManageT ? `<button class="btn btn-primary mt-4" id="empty-new-proj">＋ New Project</button>` : ''}
          </div>`;
        } else {
          tabContent = `<div class="card-grid">
            ${allProjects.map(projectCard).join('')}
            ${canManageT ? `<div class="card card-add" id="add-proj-card"><span class="card-add-icon">＋</span><span>New Project</span></div>` : ''}
          </div>`;
        }
      } else if (tab === 'members') {
        tabContent = `<div class="member-list">
          ${(team.members || []).map(m => memberRow(m, team, isOwner)).join('')}
          ${canManageT ? `<div style="margin-top:14px"><button class="btn btn-secondary btn-sm" id="invite-btn">＋ Invite Member</button></div>` : ''}
        </div>`;
      } else if (tab === 'activity') {
        tabContent = `<div class="loading-state"><div class="spinner"></div></div>`;
        loadActivity(teamId);
      }

      const mc = document.getElementById('main-content');
      if (!mc) return;
      mc.innerHTML = `
        <div class="section-header">
          <div>
            <div class="section-title">${team.name}</div>
            <div class="section-subtitle">${team.description || ''} ${roleBadge(role || 'MEMBER')}</div>
          </div>
          <div class="flex gap-2">
            ${canManageT && tab === 'projects' ? `<button class="btn btn-primary btn-sm" id="new-proj-btn">＋ New Project</button>` : ''}
            ${tab === 'members' && canManageT  ? '' : ''}
          </div>
        </div>
        <div class="tabs">
          <button class="tab-btn${tab === 'projects' ? ' active' : ''}" data-tab="projects">Projects</button>
          <button class="tab-btn${tab === 'members'  ? ' active' : ''}" data-tab="members">Members</button>
          <button class="tab-btn${tab === 'activity' ? ' active' : ''}" data-tab="activity">Activity</button>
        </div>
        <div id="tab-body">${tabContent}</div>`;

      // bind tabs
      mc.querySelectorAll('.tab-btn').forEach(b => {
        b.onclick = () => renderTeamContent(b.dataset.tab);
      });

      // bind actions per tab
      if (tab === 'projects') {
        allProjects.forEach(p => {
          document.getElementById(`proj-card-${p.id}`)?.addEventListener('click', () => navigate(`#project/${p.id}`));
        });
        document.getElementById('new-proj-btn')?.addEventListener('click', () => openCreateProjectModal(team, allProjects, () => renderTeamDetail(teamId)));
        document.getElementById('add-proj-card')?.addEventListener('click', () => openCreateProjectModal(team, allProjects, () => renderTeamDetail(teamId)));
        document.getElementById('empty-new-proj')?.addEventListener('click', () => openCreateProjectModal(team, allProjects, () => renderTeamDetail(teamId)));
      } else if (tab === 'members') {
        document.getElementById('invite-btn')?.addEventListener('click', () => openInviteModal(team, () => renderTeamDetail(teamId)));
        mc.querySelectorAll('.change-role-btn').forEach(b => {
          b.onclick = () => openChangeRoleModal(team, b.dataset.userId, b.dataset.userName, () => renderTeamDetail(teamId));
        });
      }
    }

    renderTeamContent(state.activeTab);

  } catch (err) {
    setMainContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">${err.message}</div></div>`);
  }
}

async function loadActivity(teamId) {
  try {
    const logs = await apiJSON(`/api/v1/teams/${teamId}/activity/`);
    const items = (Array.isArray(logs) ? logs : (logs.results ?? []));
    const tabBody = document.getElementById('tab-body');
    if (!tabBody) return;
    tabBody.innerHTML = items.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No activity yet</div></div>`
      : `<div class="activity-list">${items.map(activityItem).join('')}</div>`;
  } catch (_) {}
}

function activityItem(log) {
  return `<div class="activity-item">
    <div class="activity-dot"></div>
    <div>
      <div class="activity-text">${log.description}</div>
      <div class="activity-time">${timeAgo(log.created_at)}</div>
    </div>
  </div>`;
}

function projectCard(p) {
  const taskCount = (p.tasks || []).length;
  return `
  <div class="card" id="proj-card-${p.id}">
    <div class="card-icon">📁</div>
    <div class="card-title">${p.name}</div>
    <div class="card-desc">${p.description || 'No description'}</div>
    <div class="card-meta">
      <div class="card-meta-item">✅ ${taskCount} task${taskCount !== 1 ? 's' : ''}</div>
      <div class="card-meta-item">${timeAgo(p.created_at)}</div>
    </div>
  </div>`;
}

function memberRow(m, team, isOwner) {
  const me = state.user?.email;
  const isMe = m.user?.email === me;
  return `
  <div class="member-row">
    ${avatarEl(m.user?.username || m.user?.email, 'avatar-sm')}
    <div class="member-info">
      <div class="member-name">${m.user?.username || '—'} ${isMe ? '<span class="text-muted text-sm">(you)</span>' : ''}</div>
      <div class="member-email">${m.user?.email || ''}</div>
    </div>
    <div class="member-actions">
      ${roleBadge(m.role)}
      ${isOwner && !isMe ? `<button class="btn btn-ghost btn-sm change-role-btn" data-user-id="${m.user.id}" data-user-name="${m.user.username || m.user.email}">Change role</button>` : ''}
    </div>
  </div>`;
}

// =========================================================
// 6d. PROJECT DETAIL — KANBAN
// =========================================================
async function renderProjectDetail(projectId) {
  state.projectId = projectId;

  const breadcrumbs = `
    <span class="text-muted" style="cursor:pointer" onclick="navigate('#teams')">Dashboard</span>
    <span class="crumb-sep">›</span>
    ${state.teamId ? `<span class="text-muted" style="cursor:pointer" onclick="navigate('#team/${state.teamId}')">Team</span><span class="crumb-sep">›</span>` : ''}
    <span class="crumb-current" id="proj-breadcrumb">Project</span>`;

  setApp(appHTML(breadcrumbs, '', `<div class="loading-state"><div class="spinner"></div></div>`));

  try {
    const [project, tasksRes] = await Promise.all([
      apiJSON(`/api/v1/projects/${projectId}/`),
      apiJSON('/api/v1/tasks/'),
    ]);

    if (!state.teamId) state.teamId = project.team;
    const bc = document.getElementById('proj-breadcrumb');
    if (bc) bc.textContent = project.name;

    const allTasks = (tasksRes.results ?? tasksRes).filter(t => t.project === project.id);

    function renderKanban(tasks) {
      const cols = {
        TODO:        tasks.filter(t => t.status === 'TODO'),
        IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
        DONE:        tasks.filter(t => t.status === 'DONE'),
      };
      return `
        <div class="kanban">
          ${kanbanCol('TODO',        '📋', '#6b7280', cols.TODO,        projectId)}
          ${kanbanCol('IN_PROGRESS', '🔄', '#f59e0b', cols.IN_PROGRESS, projectId)}
          ${kanbanCol('DONE',        '✅', '#22c55e', cols.DONE,        projectId)}
        </div>`;
    }

    setMainContent(`
      <div class="section-header">
        <div>
          <div class="section-title">${project.name}</div>
          <div class="section-subtitle">${project.description || ''}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" id="search-btn" title="Filter tasks">🔍 Filter</button>
          <button class="btn btn-primary btn-sm" id="new-task-btn">＋ New Task</button>
        </div>
      </div>
      ${renderKanban(allTasks)}
    `);

    bindKanbanClicks(allTasks, projectId, project.team);
    document.getElementById('new-task-btn').onclick = () =>
      openCreateTaskModal(project, () => renderProjectDetail(projectId));
    document.getElementById('search-btn').onclick   = () =>
      openFilterModal(projectId);

  } catch (err) {
    setMainContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">${err.message}</div></div>`);
  }
}

function kanbanCol(status, icon, iconColor, tasks, projectId) {
  const labels = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
  return `
  <div class="kanban-column">
    <div class="kanban-column-header">
      <div class="kanban-column-title">
        <span style="color:${iconColor}">${icon}</span>
        ${labels[status] || status}
      </div>
      <span class="kanban-column-count">${tasks.length}</span>
    </div>
    ${tasks.length === 0
      ? `<div class="text-muted text-sm" style="padding:12px 0;text-align:center">No tasks</div>`
      : tasks.map(t => taskCardHTML(t)).join('')
    }
  </div>`;
}

function taskCardHTML(t) {
  const assignees = (t.assigned_to || []);
  const commentCount = (t.comments || []).length;
  return `
  <div class="task-card" data-task-id="${t.id}">
    <div class="task-card-title">${t.title}</div>
    <div>${priorityBadge(t.priority)}</div>
    <div class="task-card-footer">
      <div class="task-assignees">
        ${assignees.slice(0, 3).map(u => avatarEl(u.username || u.email, 'avatar-xs')).join('')}
        ${assignees.length > 3 ? `<div class="avatar avatar-xs" style="background:#94a3b8">+${assignees.length - 3}</div>` : ''}
      </div>
      <div class="task-meta-right">
        ${commentCount > 0 ? `<span class="comment-count">💬 ${commentCount}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function bindKanbanClicks(tasks, projectId, teamId) {
  document.querySelectorAll('.task-card').forEach(card => {
    card.onclick = () => {
      const task = tasks.find(t => t.id === card.dataset.taskId);
      if (task) openTaskModal(task, teamId, () => renderProjectDetail(projectId));
    };
  });
}

// =========================================================
// 6e. TASK MODAL (view + edit + comments)
// =========================================================
async function openTaskModal(task, teamId, onRefresh) {
  // Fetch fresh task data and team members
  const [freshTask, members] = await Promise.all([
    apiJSON(`/api/v1/tasks/${task.id}/`).catch(() => task),
    apiJSON(`/api/v1/teams/${teamId}/members/`).catch(() => []),
  ]).catch(() => [task, []]);

  const memberList = Array.isArray(members) ? members : (members.results ?? []);
  const assignedIds = (freshTask.assigned_to || []).map(u => u.id);
  const myEmail = state.user?.email;
  const isAuthor = freshTask.created_by?.email === myEmail;
  // Check if user is owner/maintainer for delete
  const myM = memberList.find(m => m.user?.email === myEmail);
  const canDelete = myM && (myM.role === 'OWNER' || myM.role === 'MAINTAINER');
  const canEdit = isAuthor || canDelete ||
    (myM?.role === 'MEMBER' && (freshTask.assigned_to || []).some(u => u.email === myEmail));

  openModal(`
    <div class="modal-header">
      <span class="modal-title">Task Detail</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">${freshTask.title}</h2>

      <div class="task-detail-meta">
        <div class="task-detail-field">
          <label>Status</label>
          ${canEdit ? `
          <select class="form-select" id="task-status-sel">
            <option value="TODO"${freshTask.status==='TODO'?' selected':''}>To Do</option>
            <option value="IN_PROGRESS"${freshTask.status==='IN_PROGRESS'?' selected':''}>In Progress</option>
            <option value="DONE"${freshTask.status==='DONE'?' selected':''}>Done</option>
          </select>` : statusBadge(freshTask.status)}
        </div>
        <div class="task-detail-field">
          <label>Priority</label>
          ${canEdit ? `
          <select class="form-select" id="task-priority-sel">
            <option value="LOW"${freshTask.priority==='LOW'?' selected':''}>Low</option>
            <option value="MEDIUM"${freshTask.priority==='MEDIUM'?' selected':''}>Medium</option>
            <option value="HIGH"${freshTask.priority==='HIGH'?' selected':''}>High</option>
          </select>` : priorityBadge(freshTask.priority)}
        </div>
      </div>

      <div class="task-detail-desc">
        <label>Description</label>
        ${canEdit
          ? `<textarea class="form-input" id="task-desc-inp" rows="3">${freshTask.description || ''}</textarea>`
          : `<div class="desc-text">${freshTask.description || '<span class="text-muted">No description</span>'}</div>`}
      </div>

      <div class="task-detail-field" style="margin-bottom:18px">
        <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);display:block;margin-bottom:8px">Assigned To</label>
        ${(freshTask.assigned_to || []).length === 0
          ? `<span class="text-muted text-sm">Unassigned</span>`
          : `<div class="assignees-list">
              ${(freshTask.assigned_to || []).map(u =>
                `<div class="assignee-pill">${avatarEl(u.username||u.email,'avatar-xs')} ${u.username||u.email}</div>`
              ).join('')}
             </div>`}
      </div>

      ${canDelete ? `
      <div class="task-detail-field" style="margin-bottom:20px">
        <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);display:block;margin-bottom:8px">Assign Members</label>
        <select class="form-select" id="task-assign-sel" multiple style="height:90px">
          ${memberList.map(m =>
            `<option value="${m.user.id}"${assignedIds.includes(m.user.id)?' selected':''}>${m.user.username||m.user.email} (${m.role})</option>`
          ).join('')}
        </select>
        <div class="text-muted text-sm mt-2">Hold Ctrl/Cmd to select multiple</div>
      </div>` : ''}

      <hr class="divider" />

      <div style="font-size:13px;font-weight:600;margin-bottom:14px">
        💬 Comments (${(freshTask.comments || []).length})
      </div>
      <div class="comment-list" id="comment-list">
        ${(freshTask.comments || []).length === 0
          ? `<div class="text-muted text-sm">No comments yet. Be the first!</div>`
          : (freshTask.comments || []).map(commentHTML).join('')}
      </div>
      <div class="comment-input-row">
        ${avatarEl(state.user?.username || state.user?.email, 'avatar-sm')}
        <textarea class="form-input" id="comment-inp" placeholder="Add a comment…" rows="2"></textarea>
        <button class="btn btn-primary btn-sm" id="comment-submit-btn">Send</button>
      </div>
    </div>
    ${canEdit ? `
    <div class="modal-footer">
      ${canDelete ? `<button class="btn btn-danger btn-sm" id="task-delete-btn">Delete Task</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" id="task-save-btn">Save Changes</button>
    </div>` : ''}
  `, 'modal-lg');

  // Save task changes
  document.getElementById('task-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('task-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      const body = {
        status:   document.getElementById('task-status-sel')?.value,
        priority: document.getElementById('task-priority-sel')?.value,
        description: document.getElementById('task-desc-inp')?.value,
      };
      const assignSel = document.getElementById('task-assign-sel');
      if (assignSel) {
        body.assigned_to_ids = Array.from(assignSel.selectedOptions).map(o => o.value);
      }
      await apiJSON(`/api/v1/tasks/${freshTask.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast('Task updated!', 'success');
      closeModal();
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

  // Delete task
  document.getElementById('task-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`Delete task "${freshTask.title}"?`)) return;
    try {
      await apiFetch(`/api/v1/tasks/${freshTask.id}/`, { method: 'DELETE' });
      toast('Task deleted.', 'info');
      closeModal();
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Submit comment
  document.getElementById('comment-submit-btn')?.addEventListener('click', async () => {
    const inp = document.getElementById('comment-inp');
    const content = inp?.value.trim();
    if (!content) return;
    const btn = document.getElementById('comment-submit-btn');
    btn.disabled = true;
    try {
      const comment = await apiJSON('/api/v1/comments/', {
        method: 'POST',
        body: JSON.stringify({ task: freshTask.id, content }),
      });
      const list = document.getElementById('comment-list');
      if (list) {
        if (list.querySelector('.text-muted')) list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', commentHTML(comment));
      }
      inp.value = '';
    } catch (err) {
      toast(err.message, 'error');
    }
    btn.disabled = false;
  });
}

function commentHTML(c) {
  const name = c.author?.username || c.author?.email || 'User';
  return `
  <div class="comment-item">
    ${avatarEl(name, 'avatar-sm')}
    <div class="comment-content">
      <div class="flex items-center gap-2">
        <span class="comment-author">${name}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
      </div>
      <div class="comment-text">${c.content}</div>
    </div>
  </div>`;
}

// =========================================================
// 7. MODALS — Create / Invite / Change Role / Filter
// =========================================================

/* ---- Create Team ---- */
function openCreateTeamModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Create Team</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-error" class="form-error" style="display:none"></div>
      <div class="form-group">
        <label class="form-label">Team Name</label>
        <input class="form-input" id="ct-name" placeholder="e.g. Engineering" />
      </div>
      <div class="form-group">
        <label class="form-label">Description <span class="text-muted">(optional)</span></label>
        <textarea class="form-input" id="ct-desc" placeholder="What does this team work on?"></textarea>
      </div>

      <hr class="divider" />
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">— or join an existing team —</div>
      <div class="form-group">
        <label class="form-label">Team ID</label>
        <input class="form-input" id="join-id" placeholder="Paste team UUID here" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary btn-sm" id="join-team-btn">Join Team</button>
      <button class="btn btn-primary" id="create-team-btn">Create Team</button>
    </div>
  `);

  document.getElementById('create-team-btn').onclick = async () => {
    const name = document.getElementById('ct-name').value.trim();
    const desc = document.getElementById('ct-desc').value.trim();
    if (!name) { showModalError('Team name is required.'); return; }
    const btn = document.getElementById('create-team-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON('/api/v1/teams/', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
      toast('Team created!', 'success');
      closeModal();
      renderTeams();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Create Team';
    }
  };

  document.getElementById('join-team-btn').onclick = async () => {
    const id = document.getElementById('join-id').value.trim();
    if (!id) { showModalError('Please enter a team ID.'); return; }
    const btn = document.getElementById('join-team-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON(`/api/v1/teams/${id}/join/`, { method: 'POST' });
      toast('Joined team!', 'success');
      closeModal();
      renderTeams();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Join Team';
    }
  };
}

/* ---- Create Project ---- */
function openCreateProjectModal(team, existingProjects, onRefresh) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Project</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-error" class="form-error" style="display:none"></div>
      <div class="form-group">
        <label class="form-label">Project Name</label>
        <input class="form-input" id="cp-name" placeholder="e.g. Website Redesign" />
      </div>
      <div class="form-group">
        <label class="form-label">Description <span class="text-muted">(optional)</span></label>
        <textarea class="form-input" id="cp-desc" placeholder="What is this project about?"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="create-proj-btn">Create Project</button>
    </div>
  `);

  document.getElementById('create-proj-btn').onclick = async () => {
    const name = document.getElementById('cp-name').value.trim();
    const desc = document.getElementById('cp-desc').value.trim();
    if (!name) { showModalError('Project name is required.'); return; }
    const btn = document.getElementById('create-proj-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON('/api/v1/projects/', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc, team: team.id }),
      });
      toast('Project created!', 'success');
      closeModal();
      onRefresh();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Create Project';
    }
  };
}

/* ---- Create Task ---- */
async function openCreateTaskModal(project, onRefresh) {
  // fetch team members for assignee selection
  let members = [];
  try {
    const res = await apiJSON(`/api/v1/teams/${project.team}/members/`);
    members = Array.isArray(res) ? res : (res.results ?? []);
  } catch (_) {}

  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Task</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-error" class="form-error" style="display:none"></div>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="nt-title" placeholder="What needs to be done?" />
      </div>
      <div class="form-group">
        <label class="form-label">Description <span class="text-muted">(optional)</span></label>
        <textarea class="form-input" id="nt-desc" placeholder="More details…"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="nt-status">
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="nt-priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM" selected>Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>
      ${members.length > 0 ? `
      <div class="form-group">
        <label class="form-label">Assign To <span class="text-muted">(optional)</span></label>
        <select class="form-select" id="nt-assign" multiple style="height:90px">
          ${members.map(m => `<option value="${m.user.id}">${m.user.username||m.user.email} (${m.role})</option>`).join('')}
        </select>
        <div class="text-muted text-sm mt-2">Hold Ctrl/Cmd to select multiple</div>
      </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="create-task-btn">Create Task</button>
    </div>
  `);

  document.getElementById('create-task-btn').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    if (!title) { showModalError('Title is required.'); return; }
    const btn = document.getElementById('create-task-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      const body = {
        project:  project.id,
        title,
        description: document.getElementById('nt-desc').value.trim(),
        status:   document.getElementById('nt-status').value,
        priority: document.getElementById('nt-priority').value,
      };
      const assignSel = document.getElementById('nt-assign');
      if (assignSel) body.assigned_to_ids = Array.from(assignSel.selectedOptions).map(o => o.value);
      await apiJSON('/api/v1/tasks/', { method: 'POST', body: JSON.stringify(body) });
      toast('Task created!', 'success');
      closeModal();
      onRefresh();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Create Task';
    }
  };
}

/* ---- Invite Member ---- */
function openInviteModal(team, onRefresh) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Invite Member</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-error" class="form-error" style="display:none"></div>
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input class="form-input" id="inv-email" type="email" placeholder="member@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="inv-role">
          <option value="MEMBER">Member</option>
          <option value="MAINTAINER">Maintainer</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="inv-submit-btn">Send Invite</button>
    </div>
  `);

  document.getElementById('inv-submit-btn').onclick = async () => {
    const email = document.getElementById('inv-email').value.trim();
    const role  = document.getElementById('inv-role').value;
    if (!email) { showModalError('Email is required.'); return; }
    const btn = document.getElementById('inv-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON(`/api/v1/teams/${team.id}/invite/`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      toast('Member invited!', 'success');
      closeModal();
      onRefresh();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Send Invite';
    }
  };
}

/* ---- Change Role ---- */
function openChangeRoleModal(team, userId, userName, onRefresh) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Change Role — ${userName}</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-error" class="form-error" style="display:none"></div>
      <div class="form-group">
        <label class="form-label">New Role</label>
        <select class="form-select" id="cr-role">
          <option value="MAINTAINER">Maintainer</option>
          <option value="MEMBER">Member</option>
          <option value="VIEWER">Viewer</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="cr-submit-btn">Update Role</button>
    </div>
  `);

  document.getElementById('cr-submit-btn').onclick = async () => {
    const role = document.getElementById('cr-role').value;
    const btn  = document.getElementById('cr-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';
    try {
      await apiJSON(`/api/v1/teams/${team.id}/members/${userId}/role/`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      toast('Role updated!', 'success');
      closeModal();
      onRefresh();
    } catch (err) {
      showModalError(err.message);
      btn.disabled = false; btn.textContent = 'Update Role';
    }
  };
}

/* ---- Filter Tasks (for kanban) ---- */
function openFilterModal(projectId) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Filter Tasks</span>
      <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Search Title</label>
        <input class="form-input" id="fl-search" placeholder="Search by title…" />
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-select" id="fl-priority">
          <option value="">All</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="fl-apply-btn">Apply Filter</button>
    </div>
  `);

  document.getElementById('fl-apply-btn').onclick = async () => {
    const search   = document.getElementById('fl-search').value.trim();
    const priority = document.getElementById('fl-priority').value;
    let qs = '';
    if (search)   qs += `search=${encodeURIComponent(search)}&`;
    if (priority) qs += `priority=${priority}&`;

    const btn = document.getElementById('fl-apply-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>';

    try {
      const res  = await apiJSON(`/api/v1/tasks/?${qs}`);
      const all  = (res.results ?? res).filter(t => t.project === projectId);
      closeModal();

      // Re-render just the kanban section
      const cols = {
        TODO:        all.filter(t => t.status === 'TODO'),
        IN_PROGRESS: all.filter(t => t.status === 'IN_PROGRESS'),
        DONE:        all.filter(t => t.status === 'DONE'),
      };
      const kanbanEl = document.querySelector('.kanban');
      if (kanbanEl) {
        kanbanEl.innerHTML = [
          kanbanCol('TODO',        '📋','#6b7280', cols.TODO,        projectId),
          kanbanCol('IN_PROGRESS', '🔄','#f59e0b', cols.IN_PROGRESS, projectId),
          kanbanCol('DONE',        '✅','#22c55e', cols.DONE,        projectId),
        ].map(c => c.replace('<div class="kanban-column">', '<div class="kanban-column">'))
          .join('');
        // bind clicks with partial data (no comments/details)
        document.querySelectorAll('.task-card').forEach(card => {
          const task = all.find(t => t.id === card.dataset.taskId);
          if (task) card.onclick = () => openTaskModal(task, task.project, () => renderProjectDetail(projectId));
        });
      }
      if (search || priority) toast(`Showing ${all.length} filtered task${all.length !== 1 ? 's' : ''}.`, 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

/* ---- Modal error helper ---- */
function showModalError(msg) {
  const el = document.getElementById('modal-error');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}

// =========================================================
// 8. INIT
// =========================================================
function init() {
  loadAuth();
  router();
}

window.addEventListener('hashchange', router);
window.addEventListener('load', init);
