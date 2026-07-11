// ============================================================================
// AnfieldVoice Web — Profile View
// ============================================================================

export async function renderProfile() {
  const { escHtml, formatDate, getMyProfile, deleteMyAccount, logout } = await import('../api.js');
  const user = await getMyProfile();

  const roleBadges = user.roles.map(r =>
    `<span class="role-badge ${r.role_name}">${escHtml(r.role_name.replace(/_/g, ' '))}</span>`
  ).join('');

  document.getElementById('app').innerHTML = layout(`
    <div class="page-header">
      <h2>My Profile</h2>
    </div>
    <div class="page-body">
      <div class="grid-2">
        <div>
          <div class="card" style="text-align:center;padding:40px">
            <div style="width:80px;height:80px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;font-weight:700;color:white">
              ${user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <h3 style="font-size:20px;font-weight:700;margin-bottom:4px">${escHtml(user.full_name)}</h3>
            <div style="color:var(--text-secondary)">${escHtml(user.email)}</div>
            ${user.phone ? `<div style="color:var(--text-secondary);font-size:13px">${escHtml(user.phone)}</div>` : ''}
            <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${roleBadges}</div>
          </div>

          <div class="card">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Account</h3>
            <div class="table-container">
              <table>
                <tbody>
                  <tr><td style="color:var(--text-secondary);width:140px">User ID</td><td>#${user.user_id}</td></tr>
                  <tr><td style="color:var(--text-secondary)">Member Since</td><td>${formatDate(user.created_at)}</td></tr>
                  <tr><td style="color:var(--text-secondary)">Status</td><td><span class="status-badge ${user.is_active ? 'active' : 'suspended'}">${user.is_active ? 'Active' : 'Inactive'}</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">About</h3>
            <div class="table-container">
              <table>
                <tbody>
                  <tr><td style="color:var(--text-secondary);width:140px">Version</td><td>1.0.0</td></tr>
                  <tr><td style="color:var(--text-secondary)">Provider</td><td>Red Cape Technologies (Pty) Ltd</td></tr>
                  <tr><td style="color:var(--text-secondary)">Reg</td><td>2022/762895/07</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Actions</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-ghost" onclick="location.href='/privacy'">📋 Privacy Policy</button>
              <button class="btn btn-ghost" onclick="logout()">🚪 Sign Out</button>
              <button class="btn btn-danger" onclick="showDeleteAccount()" style="margin-top:8px">🗑️ Delete Account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

window.showDeleteAccount = () => {
  const { logout } = _getApi();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Delete Account</h3>
      <p class="modal-desc">
        This will permanently anonymize your personal data. You will lose access to all apartments and properties. This action cannot be undone.
      </p>
      <form id="delete-form">
        <div class="form-group">
          <label for="delete-reason">Reason (optional)</label>
          <input type="text" id="delete-reason" placeholder="Tell us why you're leaving...">
        </div>
        <div class="form-group">
          <label for="delete-confirm">Type <strong style="color:var(--error)">DELETE</strong> to confirm</label>
          <input type="text" id="delete-confirm" placeholder="Type DELETE" autocomplete="off">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-danger" id="delete-btn" disabled>Permanently Delete</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('delete-confirm').oninput = function() {
    document.getElementById('delete-btn').disabled = this.value !== 'DELETE';
  };

  document.getElementById('delete-form').onsubmit = async (e) => {
    e.preventDefault();
    const { deleteMyAccount } = await import('../api.js');
    await deleteMyAccount(document.getElementById('delete-reason').value || undefined);
    closeModal();
    alert('Your account has been deleted.');
    logout();
    window.location.hash = '#/login';
  };
};

window.closeModal = () => {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
};

function _getApi() {
  return {
    logout: () => { localStorage.removeItem('av_token'); window.location.hash = '#/login'; },
  };
}

function layout(body) {
  const roles = JSON.parse(sessionStorage.getItem('av_user') || '{}')?.roles?.map(r => r.role_name) || [];
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
    `<a href="${l.hash}" class="${currentHash.startsWith(l.hash) && l.hash !== '#/' ? 'active' : currentHash === l.hash ? 'active' : ''}"><span class="nav-icon">${l.icon}</span> ${l.label}</a>`
  ).join('');
  return `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div style="width:32px;height:32px;background:var(--primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:white">AV</div>
          <div><h1>AnfieldVoice</h1><span class="badge">Web Portal</span></div>
        </div>
        <nav class="sidebar-nav">${navLinks}</nav>
        <div class="sidebar-footer"><div>Red Cape Technologies</div></div>
      </aside>
      <main class="main-content">${body}</main>
    </div>
  `;
}
