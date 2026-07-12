// ============================================================================
// AnfieldVoice Web — Security Dashboard (Slice 7)
// Estate-wide view: expected arrivals, active PINs, recent gate calls
// ============================================================================

export async function renderSecurity() {
  const { escHtml, formatDate, getSecurityOverview } = await import('../api.js');

  let arrivals = [], pins = [], calls = [];
  try {
    const data = await getSecurityOverview();
    arrivals = data.expected_arrivals || [];
    pins = data.active_pins || [];
    calls = data.recent_calls || [];
  } catch (err) {
    document.getElementById('app').innerHTML = layout(`<div class="page-body"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load security data</h3><p style="color:var(--text-secondary)">${err.message}</p></div></div>`);
    return;
  }

  document.getElementById('app').innerHTML = layout(`
    <div class="page-header">
      <h2>Security Dashboard</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <span class="ws-badge"><span class="ws-dot connected"></span> Live</span>
        <span style="color:var(--text-secondary);font-size:13px">Updated just now</span>
      </div>
    </div>
    <div class="page-body">
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div class="card" style="text-align:center">
          <div style="font-size:32px;font-weight:800;color:var(--primary)">${arrivals.length}</div>
          <div style="color:var(--text-secondary);font-size:13px;font-weight:600">Expected Today</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:32px;font-weight:800;color:var(--success)">${pins.length}</div>
          <div style="color:var(--text-secondary);font-size:13px;font-weight:600">Active PINs</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:32px;font-weight:800;color:var(--info)">${calls.length}</div>
          <div style="color:var(--text-secondary);font-size:13px;font-weight:600">Calls Today</div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- Left: Expected arrivals -->
        <div class="card">
          <div class="card-header">
            <h3>Expected Arrivals</h3>
            <span class="subtitle">Today</span>
          </div>
          ${arrivals.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px;font-size:13px">No expected arrivals for today</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>Time</th><th>Visitor</th><th>Unit</th><th>Vehicle</th><th>Status</th></tr></thead>
                <tbody>
                  ${arrivals.map(a => `
                    <tr>
                      <td style="font-size:13px;color:var(--text-secondary)">${new Date(a.expected_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                      <td style="font-weight:600">${escHtml(a.visitor_name)}</td>
                      <td>${escHtml(a.building || '')} ${escHtml(a.unit_number)}</td>
                      <td style="color:var(--text-secondary)">${escHtml(a.vehicle_plate || '-')}</td>
                      <td><span class="status-badge scheduled">Scheduled</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Right: Active PINs -->
        <div class="card">
          <div class="card-header">
            <h3>Active Visitor PINs</h3>
            <span class="subtitle">${pins.length} active</span>
          </div>
          ${pins.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px;font-size:13px">No active PINs</div>' : `
            <div class="table-container">
              <table>
                <thead><tr><th>PIN</th><th>Visitor</th><th>Unit</th><th>Resident</th><th>Expires</th></tr></thead>
                <tbody>
                  ${pins.slice(0, 15).map(p => `
                    <tr>
                      <td style="font-weight:700;letter-spacing:3px;font-size:16px;color:var(--success)">${escHtml(p.pin_code)}</td>
                      <td>${escHtml(p.visitor_name || '-')}</td>
                      <td>${escHtml(p.building || '')} ${escHtml(p.unit_number)}</td>
                      <td style="color:var(--text-secondary);font-size:13px">${escHtml(p.created_by_name)}</td>
                      <td style="font-size:12px;color:var(--text-secondary)">${formatDate(p.expires_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>

      <!-- Recent gate calls -->
      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <h3>Recent Gate Calls</h3>
          <span class="subtitle">Last 24 hours</span>
        </div>
        ${calls.length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:20px;font-size:13px">No calls today</div>' : `
          <div class="table-container">
            <table>
              <thead><tr><th>Time</th><th>Gate</th><th>Unit</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                ${calls.map(c => `
                  <tr>
                    <td style="font-size:13px;color:var(--text-secondary)">${formatDate(c.started_at)}</td>
                    <td style="font-weight:600">${escHtml(c.caller_unit)}</td>
                    <td>${escHtml(c.building || '')} ${escHtml(c.unit_number)}</td>
                    <td><span class="status-badge ${c.call_status}">${c.call_status}</span></td>
                    <td style="color:var(--text-secondary)">${c.duration_secs ? c.duration_secs + 's' : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `);
}

function layout(body) {
  const roles = JSON.parse(sessionStorage.getItem('av_user') || '{}')?.roles?.map(r => r.role_name) || [];
  const isBodyCorp = roles.includes('body_corp_admin') || roles.includes('super_admin');
  const isManager = roles.includes('property_admin') || isBodyCorp;
  const isResident = roles.includes('resident');
  const isSecurity = roles.includes('security');

  const links = [
    { hash: '#/', label: 'Dashboard', icon: '🏠' },
    ...(isSecurity || isBodyCorp ? [{ hash: '#/security', label: 'Security', icon: '🛡️' }] : []),
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
          <div><h1>AnfieldVoice</h1><span class="badge">Security</span></div>
        </div>
        <nav class="sidebar-nav">${navLinks}</nav>
        <div class="sidebar-footer"><div>Red Cape Technologies</div></div>
      </aside>
      <main class="main-content">${body}</main>
    </div>
  `;
}
