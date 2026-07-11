// ============================================================================
// AnfieldVoice Web — Estate View (Body Corp Admin)
// ============================================================================

export async function renderEstate() {
  const { escHtml, formatDate, getMyProfile, getMyApartments, getResidents, getPermissions, getAuditLog, assignPropertyAdmin, revokePropertyAdmin } = await import('../api.js');

  const user = await getMyProfile();
  const apartments = await getMyApartments();

  let aptCards = '';
  for (const apt of apartments) {
    const residents = await getResidents(apt.apartment_id);
    const perms = await getPermissions(apt.apartment_id);
    const audit = await getAuditLog(apt.apartment_id);

    aptCards += `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${escHtml(apt.building || '')} ${escHtml(apt.unit_number)}</h3>
            <span class="subtitle">${residents.length} residents · Apartment #${apt.apartment_id}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showAssignPA(${apt.apartment_id})">+ Assign PA</button>
        </div>

        ${perms ? `
          <div style="margin-bottom:12px;padding:12px;background:rgba(37,99,235,0.05);border-radius:8px">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">YOUR PERMISSIONS</div>
            <div class="perms-grid">
              ${Object.entries(perms).filter(([k]) => !['user_id','apartment_id','is_resident','is_property_admin','admin_type'].includes(k)).map(([k,v]) => `
                <div class="perm-item">
                  <span class="perm-icon ${v ? 'yes' : 'no'}">${v ? '✓' : '✗'}</span>
                  <span>${k.replace(/_/g, ' ')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="tabs">
          <button class="tab active" onclick="switchAptTab(this,'residents-${apt.apartment_id}')">Residents (${residents.length})</button>
          <button class="tab" onclick="switchAptTab(this,'audit-${apt.apartment_id}')">Activity (${audit.length})</button>
        </div>

        <div id="residents-${apt.apartment_id}">
          ${residents.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No residents</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                <tbody>
                  ${residents.map(r => `<tr><td style="font-weight:600">${escHtml(r.full_name)} ${r.is_primary ? '⭐' : ''}</td><td style="color:var(--text-secondary)">${escHtml(r.email)}</td><td><span class="status-badge ${r.is_active ? 'active' : 'suspended'}">${r.is_active ? 'Active' : 'Suspended'}</span></td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div id="audit-${apt.apartment_id}" style="display:none">
          ${audit.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No activity recorded</div>' : audit.slice(0, 20).map(e => `
            <div class="audit-entry">
              <div class="audit-action">${escHtml(e.action.replace(/_/g, ' '))}</div>
              <div class="audit-meta">${e.admin_name ? 'by ' + escHtml(e.admin_name) : ''} · ${formatDate(e.created_at)}${e.reason ? ' · ' + escHtml(e.reason) : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('app').innerHTML = layout(`
    <div class="page-header">
      <h2>Estate Management</h2>
      <div style="display:flex;gap:8px">
        <span style="color:var(--text-secondary);font-size:14px">${apartments.length} apartments</span>
      </div>
    </div>
    <div class="page-body">
      ${aptCards || '<div class="empty-state"><div class="empty-icon">🏢</div><h3>No apartments</h3></div>'}
    </div>
  `);
}

window.switchAptTab = (btn, target) => {
  const parent = btn.closest('.card');
  parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  parent.querySelectorAll('[id^="residents-"], [id^="audit-"]').forEach(el => el.style.display = 'none');
  const tgt = document.getElementById(target);
  if (tgt) tgt.style.display = 'block';
};

window.showAssignPA = (aptId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Assign Property Administrator</h3>
      <p class="modal-desc">Assign a user as property administrator for this apartment.</p>
      <form id="assign-pa-form">
        <div class="form-group">
          <label for="pa-user-id">User ID</label>
          <input type="number" id="pa-user-id" placeholder="Enter user ID" required>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="pa-is-resident" style="width:auto;margin-right:8px">
            Also a resident of this apartment
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Assign</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('assign-pa-form').onsubmit = async (e) => {
    e.preventDefault();
    const { assignPropertyAdmin } = await import('../api.js');
    await assignPropertyAdmin({
      user_id: parseInt(document.getElementById('pa-user-id').value),
      apartment_id: aptId,
      is_resident: document.getElementById('pa-is-resident').checked,
      reason: 'Assigned via web portal',
    });
    closeModal();
    location.reload();
  };
};

window.closeModal = () => {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
};

function layout(body) {
  const roles = JSON.parse(sessionStorage.getItem('av_user') || '{}')?.roles?.map(r => r.role_name) || [];
  const isBodyCorp = roles.includes('body_corp_admin') || roles.includes('super_admin');
  const isManager = roles.includes('property_admin') || isBodyCorp;
  const isResident = roles.includes('resident');

  const links = [
    { hash: '#/', label: 'Dashboard', icon: '🏠' },
    ...(isResident || roles.includes('property_admin') ? [{ hash: '#/gate', label: 'Gate', icon: '📞' }] : []),
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
