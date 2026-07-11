// ============================================================================
// AnfieldVoice Web — Dashboard View
// ============================================================================

export async function renderDashboard() {
  const { escHtml, formatDate, getMyProfile, getMyApartments, getToken } = await import('../api.js');
  const user = await getMyProfile();
  const apartments = await getMyApartments();
  const isPropertyAdmin = user.roles.some(r => r.role_name === 'property_admin');
  const isBodyCorp = user.roles.some(r => ['body_corp_admin', 'super_admin'].includes(r.role_name));

  const roleBadges = user.roles.map(r =>
    `<span class="role-badge ${r.role_name}">${escHtml(r.role_name.replace(/_/g, ' '))}</span>`
  ).join('');

  const aptCards = apartments.length
    ? apartments.map(a => `
      <a href="#/apartment/${a.apartment_id}" class="card" style="display:block;cursor:pointer">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:10px;background:rgba(37,99,235,0.15);display:flex;align-items:center;justify-content:center;font-size:20px">🏢</div>
          <div>
            <div style="font-weight:600;color:var(--text)">${escHtml(a.building || '')} ${escHtml(a.unit_number)}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Max ${a.max_residents} residents</div>
          </div>
        </div>
      </a>
    `).join('')
    : '<div class="card" style="text-align:center;color:var(--text-secondary);padding:40px">No apartment assignments yet.</div>';

  document.getElementById('app').innerHTML = layout(`
    <div class="page-header">
      <h2>Dashboard</h2>
      <div style="display:flex;align-items:center;gap:12px">
        ${roleBadges}
      </div>
    </div>
    <div class="page-body">
      <div style="margin-bottom:8px">
        <span style="font-size:22px;font-weight:700">Welcome back, ${escHtml(user.full_name.split(' ')[0])}</span>
      </div>

      <div class="quick-actions">
        <div class="quick-action-card" onclick="location.hash='#/gate'">
          <div class="qa-icon" style="background:rgba(59,130,246,0.15);color:var(--role-security)">📞</div>
          <div class="qa-label">Gate Call</div>
          <div class="qa-desc">Answer the gate</div>
        </div>
        <div class="quick-action-card" onclick="location.hash='#/gate'">
          <div class="qa-icon" style="background:rgba(245,158,11,0.15);color:var(--role-property-admin)">🔑</div>
          <div class="qa-label">Visitor PIN</div>
          <div class="qa-desc">Generate a PIN</div>
        </div>
        <div class="quick-action-card" onclick="location.hash='#/gate'">
          <div class="qa-icon" style="background:rgba(16,185,129,0.15);color:var(--success)">📅</div>
          <div class="qa-label">Expected</div>
          <div class="qa-desc">Schedule arrival</div>
        </div>
        <div class="quick-action-card" onclick="location.hash='#/tenants'">
          <div class="qa-icon" style="background:rgba(16,185,129,0.15);color:var(--role-resident)">👥</div>
          <div class="qa-label">Directory</div>
          <div class="qa-desc">Neighbours</div>
        </div>
      </div>

      ${isPropertyAdmin || isBodyCorp ? `
        <h3 style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
          ${isBodyCorp ? 'All Apartments' : 'Your Apartments'}
        </h3>
        ${aptCards}
      ` : ''}
    </div>
  `);
}

function layout(body) {
  const { getToken, logout } = _getApi();
  const user = _getUser();
  const roles = user?.roles?.map(r => r.role_name) || [];
  const isBodyCorp = roles.includes('body_corp_admin') || roles.includes('super_admin');
  const isManager = roles.includes('property_admin') || isBodyCorp;
  const isResident = roles.includes('resident');

  const links = [
    { hash: '#/', label: 'Dashboard', icon: '🏠' },
    ...(isResident || roles.includes('property_admin') ? [{ hash: '#/gate', label: 'Gate', icon: '📞' }] : []),
    ...(isResident || isManager ? [{ hash: '#/visitors', label: 'Visitors', icon: '🔑' }] : []),
    ...(isManager ? [{ hash: '#/tenants', label: 'Tenants', icon: '👥' }] : []),
    ...(isBodyCorp ? [{ hash: '#/estate', label: 'Estate', icon: '🏢' }] : []),
    { hash: '#/profile', label: 'Profile', icon: '👤' },
  ];

  const currentHash = window.location.hash || '#/';
  const navLinks = links.map(l =>
    `<a href="${l.hash}" class="${currentHash.startsWith(l.hash) && l.hash !== '#/' ? 'active' : currentHash === l.hash ? 'active' : ''}">
      <span class="nav-icon">${l.icon}</span> ${l.label}
    </a>`
  ).join('');

  return `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div style="width:32px;height:32px;background:var(--primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:white">AV</div>
          <div>
            <h1>AnfieldVoice</h1>
            <span class="badge">Web Portal</span>
          </div>
        </div>
        <nav class="sidebar-nav">${navLinks}</nav>
        <div class="sidebar-footer">
          <span id="ws-status-sidebar" style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span class="ws-dot disconnected"></span> Connecting...
          </span>
          ${user ? `<div>${user.full_name}</div>` : ''}
          <div style="opacity:0.6;margin-top:2px">Red Cape Technologies</div>
        </div>
      </aside>
      <main class="main-content">${body}</main>
    </div>
  `;
}

function _getApi() {
  // Inline because import is async and layout is called synchronously
  const t = localStorage.getItem('av_token');
  return {
    getToken: () => t,
    logout: () => { localStorage.removeItem('av_token'); window.location.hash = '#/login'; },
  };
}

function _getUser() {
  try { return JSON.parse(sessionStorage.getItem('av_user') || 'null'); } catch { return null; }
}

// Store user in sessionStorage on first render
try {
  import('../api.js').then(async ({ getMyProfile }) => {
    const user = await getMyProfile();
    sessionStorage.setItem('av_user', JSON.stringify(user));
  });
} catch {}
