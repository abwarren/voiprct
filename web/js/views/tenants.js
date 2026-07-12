// ============================================================================
// AnfieldVoice Web — Tenants View
// ============================================================================

export async function renderTenants() {
  const { escHtml, getMyApartments, getResidents, addResident, removeResident, activateResident, deactivateResident, createInvitation } = await import('../api.js');
  const apartments = await getMyApartments();

  let view = `<div class="page-header"><h2>Tenant Management</h2></div><div class="page-body">`;

  if (apartments.length === 0) {
    view += `<div class="empty-state"><div class="empty-icon">👥</div><h3>No apartment assignments</h3><p>You are not assigned to manage any apartments yet.</p></div></div>`;
    document.getElementById('app').innerHTML = layout(view);
    return;
  }

  for (const apt of apartments) {
    const residents = await getResidents(apt.apartment_id);
    view += `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${escHtml(apt.building || '')} ${escHtml(apt.unit_number)}</h3>
            <span class="subtitle">${residents.length} / ${apt.max_residents} residents</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" onclick="showAddResident(${apt.apartment_id})">+ Add Resident</button>
            <button class="btn btn-ghost btn-sm" onclick="showInviteResident(${apt.apartment_id})">✉️ Invite</button>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th style="width:120px">Actions</th></tr></thead>
            <tbody>
              ${residents.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">No residents</td></tr>' : ''}
              ${residents.map(r => `
                <tr>
                  <td style="font-weight:600">${escHtml(r.full_name)} ${r.is_primary ? '<span style="font-size:11px;color:var(--role-property-admin);font-weight:600">PRIMARY</span>' : ''}</td>
                  <td style="color:var(--text-secondary)">${escHtml(r.email)}</td>
                  <td><span class="status-badge ${r.is_active ? 'active' : 'suspended'}">${r.is_active ? 'Active' : 'Suspended'}</span></td>
                  <td>
                    <button class="btn btn-sm ${r.is_active ? 'btn-ghost' : 'btn-success'}" onclick="toggleResident(${apt.apartment_id},${r.user_id},${r.is_active})">
                      ${r.is_active ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="showRemoveResident(${apt.apartment_id},${r.user_id},'${escHtml(r.full_name)}')">Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  view += `</div>`;
  document.getElementById('app').innerHTML = layout(view);
}

// ── Add Resident Modal ──
window.showAddResident = (aptId) => {
  showModal(`
    <h3>Add Resident</h3>
    <p class="modal-desc">Add an existing user to this apartment.</p>
    <form id="add-resident-form">
      <div class="form-group">
        <label for="add-user-id">User ID</label>
        <input type="number" id="add-user-id" placeholder="Enter user ID">
      </div>
      <div class="form-group">
        <label for="add-reason">Reason (audit trail)</label>
        <input type="text" id="add-reason" placeholder="e.g. New tenant moved in">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Resident</button>
      </div>
    </form>
  `);
  document.getElementById('add-resident-form').onsubmit = async (e) => {
    e.preventDefault();
    const { addResident } = await import('../api.js');
    const uid = parseInt(document.getElementById('add-user-id').value);
    await addResident(aptId, { user_id: uid, reason: document.getElementById('add-reason').value || 'Added via web portal' });
    closeModal();
    renderTenants();
  };
};

window.showInviteResident = (aptId) => {
  showModal(`
    <h3>Invite Resident</h3>
    <p class="modal-desc">Send an invitation email to a new resident.</p>
    <form id="invite-form">
      <div class="form-group">
        <label for="invite-email">Email</label>
        <input type="email" id="invite-email" placeholder="new-resident@example.com" required>
      </div>
      <div class="form-group">
        <label for="invite-name">Full Name</label>
        <input type="text" id="invite-name" placeholder="John Doe">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Send Invitation</button>
      </div>
    </form>
  `);
  document.getElementById('invite-form').onsubmit = async (e) => {
    e.preventDefault();
    const { createInvitation } = await import('../api.js');
    await createInvitation({
      apartment_id: aptId,
      email: document.getElementById('invite-email').value,
      reason: 'Invited via web portal',
    });
    closeModal();
    alert('Invitation sent!');
  };
};

window.showRemoveResident = (aptId, userId, name) => {
  showModal(`
    <h3>Remove Resident</h3>
    <p class="modal-desc">Remove <strong>${name}</strong> from this apartment? This action is logged in the audit trail.</p>
    <form id="remove-form">
      <div class="form-group">
        <label for="remove-reason">Reason</label>
        <input type="text" id="remove-reason" placeholder="e.g. Moved out" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-danger">Remove</button>
      </div>
    </form>
  `);
  document.getElementById('remove-form').onsubmit = async (e) => {
    e.preventDefault();
    const { removeResident } = await import('../api.js');
    await removeResident(aptId, userId, document.getElementById('remove-reason').value);
    closeModal();
    renderTenants();
  };
};

window.toggleResident = async (aptId, userId, isActive) => {
  const { activateResident, deactivateResident } = await import('../api.js');
  if (isActive) await deactivateResident(aptId, userId);
  else await activateResident(aptId, userId);
  renderTenants();
};

// ── Modal Helpers ──
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `<div class="modal-content">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
window.closeModal = () => {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
};

// ── Layout ──
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
    ...(isSecurity || isBodyCorp ? [{ hash: '#/security', label: 'Security', icon: '🛡️' }] : []),
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
