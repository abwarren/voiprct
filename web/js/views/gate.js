// ============================================================================
// AnfieldVoice Web — Gate Call View
// ============================================================================

export async function renderGate() {
  const { escHtml, formatDate, getGateCalls } = await import('../api.js');
  const { getWsState, sendWs } = await import('../ws.js');

  const history = await getGateCalls();

  document.getElementById('app').innerHTML = layout(`
    <div class="page-header">
      <h2>Gate Calls</h2>
      <div class="ws-badge">
        <span class="ws-dot ${getWsState()}"></span>
        <span id="ws-label">${getWsState() === 'connected' ? 'Connected' : getWsState() === 'connecting' ? 'Connecting...' : 'Offline'}</span>
      </div>
    </div>
    <div class="page-body">
      ${history.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📞</div>
          <h3>No call history</h3>
          <p>Gate calls will appear here when someone rings your apartment.</p>
        </div>
      ` : `
        <div class="card">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(c => `
                  <tr>
                    <td style="font-weight:600">${escHtml(c.caller_unit)}</td>
                    <td style="color:var(--text-secondary);font-size:13px">${formatDate(c.started_at)}</td>
                    <td style="color:var(--text-secondary)">${c.duration_secs ? c.duration_secs + 's' : '-'}</td>
                    <td><span class="status-badge ${c.call_status}">${c.call_status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `);
}

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

export function showIncomingCall(data) {
  const overlay = document.getElementById('call-overlay');
  overlay.innerHTML = `
    <div class="call-card">
      <div class="call-icon">📞</div>
      <h3>Incoming Call</h3>
      <div class="call-unit">${data.caller_unit || 'Main Gate'}</div>
      <div class="call-meta">Gate call from building entrance</div>
      <div class="call-actions">
        <button class="call-btn answer" onclick="handleAnswer(${data.call_id})">
          <span style="font-size:24px">📞</span>
          <span>Answer</span>
        </button>
        <button class="call-btn reject" onclick="handleReject(${data.call_id})">
          <span>✕</span>
          <span>Reject</span>
        </button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
}

export function hideIncomingCall() {
  document.getElementById('call-overlay').classList.add('hidden');
}

// Global handlers for inline onclick
window.handleAnswer = async (callId) => {
  const { sendWs } = await import('../ws.js');
  const { gateCallAction } = await import('../api.js');
  sendWs({ type: 'answer_call', call_id: callId, action: 'answer' });
  await gateCallAction(callId, 'answer');
  hideIncomingCall();
};

window.handleReject = async (callId) => {
  const { sendWs } = await import('../ws.js');
  const { gateCallAction } = await import('../api.js');
  sendWs({ type: 'answer_call', call_id: callId, action: 'reject' });
  await gateCallAction(callId, 'reject');
  hideIncomingCall();
};
