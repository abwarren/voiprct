// ============================================================================
// AnfieldVoice Web — Visitors View (Slice 3 + Slice 8)
// PIN management + expected arrivals + recurring visitors
// ============================================================================

export async function renderVisitors() {
  const { escHtml, formatDate, getMyProfile, getMyApartments, getVisitorPins, createVisitorPin, revokeVisitorPin, getExpectedArrivals, createExpectedArrival, arrivalAction, getRecurringVisitors } = await import('../api.js');

  const user = await getMyProfile();
  const apartments = await getMyApartments();

  let body = `<div class="page-header"><h2>Visitors</h2></div><div class="page-body">`;

  for (const apt of apartments) {
    const pins = await getVisitorPins(apt.apartment_id);
    const arrivals = await getExpectedArrivals(apt.apartment_id);
    let recurring = [];
    try { recurring = await getRecurringVisitors(apt.apartment_id); } catch(e) { /* empty */ }

    body += `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${escHtml(apt.building || '')} ${escHtml(apt.unit_number)}</h3>
            <span class="subtitle">${pins.length} active PINs · ${arrivals.filter(a => a.status === 'scheduled').length} scheduled · ${recurring.filter(r => r.is_active).length} recurring</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="showGeneratePin(${apt.apartment_id})">+ Generate PIN</button>
            <button class="btn btn-ghost btn-sm" onclick="showScheduleArrival(${apt.apartment_id})">+ Schedule</button>
            <button class="btn btn-ghost btn-sm" onclick="showAddRecurring(${apt.apartment_id})">+ Recurring</button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" onclick="switchVTab(this,'vpins-${apt.apartment_id}')">PINs (${pins.length})</button>
          <button class="tab" onclick="switchVTab(this,'varrivals-${apt.apartment_id}')">Arrivals (${arrivals.length})</button>
          <button class="tab" onclick="switchVTab(this,'vrecurring-${apt.apartment_id}')">Recurring (${recurring.length})</button>
        </div>

        <div id="vpins-${apt.apartment_id}">
          ${pins.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No active PINs</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>PIN</th><th>Visitor</th><th>Purpose</th><th>Expires</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${pins.map(p => `
                    <tr>
                      <td style="font-weight:700;font-size:18px;letter-spacing:3px;color:var(--success)">${escHtml(p.pin_code)}</td>
                      <td>${escHtml(p.visitor_name || '-')}</td>
                      <td style="color:var(--text-secondary)">${escHtml(p.purpose || '-')}</td>
                      <td style="font-size:13px;color:var(--text-secondary)">${formatDate(p.expires_at)}</td>
                      <td><span class="status-badge ${p.is_active ? 'active' : 'suspended'}">${p.is_active ? 'Active' : 'Used'}</span></td>
                      <td>${p.is_active ? `<button class="btn btn-sm btn-danger" onclick="window.revokePin(${p.pin_id})">Revoke</button>` : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div id="varrivals-${apt.apartment_id}" style="display:none">
          ${arrivals.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No arrivals scheduled</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>Visitor</th><th>Vehicle</th><th>Expected</th><th>Status</th></tr></thead>
                <tbody>
                  ${arrivals.map(a => `
                    <tr>
                      <td style="font-weight:600">${escHtml(a.visitor_name)}</td>
                      <td style="color:var(--text-secondary)">${escHtml(a.vehicle_plate || '-')}</td>
                      <td style="font-size:13px;color:var(--text-secondary)">${formatDate(a.expected_at)}</td>
                      <td><span class="status-badge ${a.status}">${a.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div id="vrecurring-${apt.apartment_id}" style="display:none">
          ${recurring.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No recurring visitors</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>Visitor</th><th>Vehicle</th><th>Schedule</th><th>Valid Until</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${recurring.map(r => `
                    <tr>
                      <td style="font-weight:600">${escHtml(r.visitor_name)}</td>
                      <td style="color:var(--text-secondary)">${escHtml(r.vehicle_plate || '-')}</td>
                      <td><span class="status-badge">${r.schedule_type}</span></td>
                      <td style="font-size:13px;color:var(--text-secondary)">${r.valid_until ? formatDate(r.valid_until) : 'Ongoing'}</td>
                      <td><span class="status-badge ${r.is_active ? 'active' : 'suspended'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <button class="btn btn-sm btn-ghost" onclick="showEditRecurring(${r.recurring_id}, ${apt.apartment_id}, '${escHtml(r.visitor_name)}', '${escHtml(r.vehicle_plate || '')}', '${r.schedule_type}', ${r.is_active})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteRecurring(${r.recurring_id})">Delete</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  body += `</div>`;
  document.getElementById('app').innerHTML = layout(body);
}

// ── Tab switching ──
window.switchVTab = (btn, target) => {
  const parent = btn.closest('.card');
  parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  parent.querySelectorAll('[id^="vpins-"], [id^="varrivals-"], [id^="vrecurring-"]').forEach(el => el.style.display = 'none');
  const tgt = document.getElementById(target);
  if (tgt) tgt.style.display = 'block';
};

// ── Generate PIN Modal ──
window.showGeneratePin = (aptId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Generate Visitor PIN</h3>
      <p class="modal-desc">Create a time-bound PIN for your visitor.</p>
      <form id="genpin-form">
        <div class="form-group">
          <label>Visitor Name</label>
          <input type="text" id="pin-visitor" placeholder="John Doe">
        </div>
        <div class="form-group">
          <label>Purpose</label>
          <input type="text" id="pin-purpose" placeholder="Delivery, Guest, etc.">
        </div>
        <div class="form-group">
          <label>Expires In (hours)</label>
          <input type="number" id="pin-hours" value="24" min="1" max="168">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Generate</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('genpin-form').onsubmit = async (e) => {
    e.preventDefault();
    const { createVisitorPin } = await import('../api.js');
    const pin = await createVisitorPin({
      apartment_id: aptId,
      visitor_name: document.getElementById('pin-visitor').value || null,
      purpose: document.getElementById('pin-purpose').value || null,
      expires_in_hours: parseInt(document.getElementById('pin-hours').value) || 24,
    });
    closeModal();
    alert(`PIN generated: ${pin.pin_code}\\nExpires: ${new Date(pin.expires_at).toLocaleString()}`);
    location.reload();
  };
};

// ── Schedule Arrival Modal ──
window.showScheduleArrival = (aptId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Schedule Arrival</h3>
      <p class="modal-desc">Pre-register a visitor for gate notification.</p>
      <form id="arrival-form">
        <div class="form-group">
          <label>Visitor Name *</label>
          <input type="text" id="arr-visitor" placeholder="John Doe" required>
        </div>
        <div class="form-group">
          <label>Vehicle Plate</label>
          <input type="text" id="arr-plate" placeholder="CA 123-456">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date *</label>
            <input type="date" id="arr-date" required>
          </div>
          <div class="form-group">
            <label>Time *</label>
            <input type="time" id="arr-time" required>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="arr-notes" placeholder="Anything security should know..." rows="2"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Schedule</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('arrival-form').onsubmit = async (e) => {
    e.preventDefault();
    const { createExpectedArrival } = await import('../api.js');
    const date = document.getElementById('arr-date').value;
    const time = document.getElementById('arr-time').value;
    await createExpectedArrival({
      apartment_id: aptId,
      visitor_name: document.getElementById('arr-visitor').value,
      vehicle_plate: document.getElementById('arr-plate').value || null,
      expected_at: `${date}T${time}:00`,
      notes: document.getElementById('arr-notes').value || null,
    });
    closeModal();
    alert('Arrival scheduled!');
    location.reload();
  };
};

// ── Add Recurring Visitor Modal ──
window.showAddRecurring = (aptId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Add Recurring Visitor</h3>
      <p class="modal-desc">Set up a recurring visitor (cleaner, gardener, regular delivery).</p>
      <form id="recurring-form">
        <div class="form-group">
          <label>Visitor Name *</label>
          <input type="text" id="rc-name" placeholder="Jane Doe" required>
        </div>
        <div class="form-group">
          <label>Vehicle Plate</label>
          <input type="text" id="rc-plate" placeholder="CA 123-456">
        </div>
        <div class="form-group">
          <label>Schedule Type *</label>
          <select id="rc-schedule" required>
            <option value="daily">Daily</option>
            <option value="weekly" selected>Weekly</option>
            <option value="weekdays">Weekdays</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Valid From</label>
            <input type="date" id="rc-from">
          </div>
          <div class="form-group">
            <label>Valid Until</label>
            <input type="date" id="rc-until">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Recurring</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('recurring-form').onsubmit = async (e) => {
    e.preventDefault();
    const { createRecurringVisitor } = await import('../api.js');
    await createRecurringVisitor({
      apartment_id: aptId,
      visitor_name: document.getElementById('rc-name').value,
      vehicle_plate: document.getElementById('rc-plate').value || null,
      schedule_type: document.getElementById('rc-schedule').value,
      valid_from: document.getElementById('rc-from').value || null,
      valid_until: document.getElementById('rc-until').value || null,
    });
    closeModal();
    alert('Recurring visitor added!');
    location.reload();
  };
};

// ── Edit Recurring Visitor Modal ──
window.showEditRecurring = (recurringId, aptId, name, plate, schedule, isActive) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Edit Recurring Visitor</h3>
      <form id="recurring-edit-form">
        <div class="form-group">
          <label>Visitor Name</label>
          <input type="text" id="rc-edit-name" value="${name}" required>
        </div>
        <div class="form-group">
          <label>Vehicle Plate</label>
          <input type="text" id="rc-edit-plate" value="${plate}">
        </div>
        <div class="form-group">
          <label>Schedule</label>
          <select id="rc-edit-schedule">
            <option value="daily" ${schedule === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${schedule === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="weekdays" ${schedule === 'weekdays' ? 'selected' : ''}>Weekdays</option>
            <option value="custom" ${schedule === 'custom' ? 'selected' : ''}>Custom</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="rc-edit-active" ${isActive ? 'checked' : ''}> Active</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);

  document.getElementById('recurring-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const { updateRecurringVisitor } = await import('../api.js');
    await updateRecurringVisitor(recurringId, {
      visitor_name: document.getElementById('rc-edit-name').value,
      vehicle_plate: document.getElementById('rc-edit-plate').value || null,
      schedule_type: document.getElementById('rc-edit-schedule').value,
      is_active: document.getElementById('rc-edit-active').checked,
    });
    closeModal();
    location.reload();
  };
};

// ── Delete Recurring Visitor ──
window.deleteRecurring = async (recurringId) => {
  if (!confirm('Delete this recurring visitor?')) return;
  const { deleteRecurringVisitor } = await import('../api.js');
  await deleteRecurringVisitor(recurringId);
  location.reload();
};

// ── Revoke PIN ──
window.revokePin = async (pinId) => {
  if (!confirm('Revoke this PIN?')) return;
  const { revokeVisitorPin } = await import('../api.js');
  await revokeVisitorPin(pinId);
  location.reload();
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
  const isSecurity = roles.includes('security');

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
