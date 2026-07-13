// ============================================================================
// AnfieldVoice Web — NFC Phone-as-Tag View (Slice 9)
// ============================================================================

export async function renderNfc() {
  const { escHtml, formatDate, getNfcCredentials, activatePhoneNfc, deactivatePhoneNfc, getNfcAccessLog, getMyProfile, getMyApartments } = await import('../api.js');

  const user = await getMyProfile();
  const creds = await getNfcCredentials();
  const apartments = await getMyApartments();

  const activePhone = creds.find(c => c.credential_type === 'phone' && c.is_active);
  const activeTag = creds.find(c => c.credential_type === 'tag' && c.is_active);

  let body = `<div class="page-header"><h2>NFC Gate Access</h2></div><div class="page-body">`;

  // iOS Notification
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    body += `
      <div style="background:#1E3A5F;border-radius:10px;padding:14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">📱</span>
        <div><strong style="color:#60A5FA">iPhone NFC Limited</strong><br><span style="color:#93C5FD;font-size:13px">Apple does not support phone-as-tag mode. Use the QR code at the gate reader or your physical tag fob.</span></div>
      </div>`;
  }

  // Status Card
  body += `
    <div class="card">
      <div class="card-header"><h3>NFC Credentials</h3></div>
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">Phone as Tag</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${activePhone ? '#00D68F' : '#6B7280'};margin-right:6px"></span>${activePhone ? 'Active' : 'Inactive'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">Physical Tag</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${activeTag ? '#00D68F' : '#6B7280'};margin-right:6px"></span>${activeTag ? 'Active' : activePhone ? 'Deactivated' : 'Not registered'}</span>
        </div>
      </div>
    </div>`;

  // Activation Controls
  for (const apt of apartments) {
    body += `
      <div class="card">
        <div class="card-header">
          <h3>${escHtml(apt.building || '')} ${escHtml(apt.unit_number)}</h3>
        </div>
        <div style="padding:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="window.activateNfcPhone(${apt.apartment_id})">
            Activate Phone NFC
          </button>
          <button class="btn btn-danger" onclick="window.deactivateNfcPhone(${apt.apartment_id})">
            Deactivate Phone NFC
          </button>
        </div>
      </div>`;
  }

  // Access History
  const log = await getNfcAccessLog(null, 20);
  body += `
    <div class="card">
      <div class="card-header"><h3>Recent Access</h3></div>
      <div style="padding:8px">
        ${log.length === 0
          ? '<div style="color:var(--text-secondary);text-align:center;padding:20px">No recent access logs</div>'
          : '<div class="table-container"><table><thead><tr><th>Gate</th><th>Type</th><th>Result</th><th>Time</th></tr></thead><tbody>' +
            log.slice(0, 20).map(e => `
              <tr>
                <td>${escHtml(e.gate_unit)}</td>
                <td>${e.access_type === 'phone' ? '📱 Phone' : '🏷️ Tag'}</td>
                <td><span class="status-badge ${e.granted ? 'active' : 'suspended'}">${e.granted ? 'Granted' : 'Denied'}</span></td>
                <td style="color:var(--text-secondary);font-size:13px">${formatDate(e.created_at)}</td>
              </tr>
            `).join('') +
            '</tbody></table></div>'
        }
      </div>
    </div>`;

  // Note
  body += `
    <div style="background:var(--bg-card);border-radius:10px;padding:16px;margin-bottom:24px;border-left:3px solid var(--primary)">
      <span style="color:var(--text-secondary);font-size:14px">💡 Your physical tag remains a backup even when phone NFC is active. Keep it handy in case your phone battery runs out.</span>
    </div>`;

  body += `</div>`;
  document.getElementById('app').innerHTML = layout(body);
}

// ── Activate Phone NFC ──
window.activateNfcPhone = async (aptId) => {
  const { activatePhoneNfc } = await import('../api.js');
  try {
    const result = await activatePhoneNfc(aptId);
    alert(`Phone NFC activated! Hold your phone near the gate reader.`);
    location.reload();
  } catch (e) {
    alert(`Error: ${e.message || 'Something went wrong'}`);
  }
};

// ── Deactivate Phone NFC ──
window.deactivateNfcPhone = async (aptId) => {
  if (!confirm('Deactivate phone NFC? The physical tag will become active again.')) return;
  const { deactivatePhoneNfc } = await import('../api.js');
  try {
    await deactivatePhoneNfc(aptId);
    alert('Phone NFC deactivated. Physical tag is now active.');
    location.reload();
  } catch (e) {
    alert(`Error: ${e.message || 'Something went wrong'}`);
  }
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
    ...(isResident ? [{ hash: '#/nfc', label: 'NFC', icon: '📱' }] : []),
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
