// ============================================================================
// AnfieldVoice Web — Main Application
// Router + Auth Guard + WebSocket Initialization
// ============================================================================

import { getToken, logout as apiLogout } from './api.js';
import { connectWs, disconnectWs, setWsCallbacks } from './ws.js';
import { showIncomingCall, hideIncomingCall } from './views/gate.js';

// ── Router ──
const routes = {
  '/login': async () => {
    const { renderLogin } = await import('./views/login.js');
    renderLogin();
  },
  '/': async () => {
    const { renderDashboard } = await import('./views/dashboard.js');
    await renderDashboard();
  },
  '/gate': async () => {
    const { renderGate } = await import('./views/gate.js');
    await renderGate();
  },
  '/tenants': async () => {
    const { renderTenants } = await import('./views/tenants.js');
    await renderTenants();
  },
  '/estate': async () => {
    const { renderEstate } = await import('./views/estate.js');
    await renderEstate();
  },
  '/profile': async () => {
    const { renderProfile } = await import('./views/profile.js');
    await renderProfile();
  },
};

async function router() {
  let hash = window.location.hash.slice(1) || '/';
  // Strip query params from hash
  hash = hash.split('?')[0];

  // Auth guard
  if (!getToken()) {
    if (hash !== '/login') {
      window.location.hash = '#/login';
      return;
    }
  }

  const route = routes[hash];
  if (route) {
    document.getElementById('app').innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Loading...</p></div>';
    try {
      await route();
    } catch (err) {
      console.error('Route error:', err);
      if (err.message?.includes('401') || err.message?.includes('No token')) {
        apiLogout();
        window.location.hash = '#/login';
      } else {
        document.getElementById('app').innerHTML = `
          <div class="loading-page">
            <div style="font-size:40px;margin-bottom:16px">⚠️</div>
            <h3 style="color:var(--error);margin-bottom:8px">Error</h3>
            <p style="color:var(--text-secondary)">${err.message || 'Something went wrong'}</p>
            <button class="btn btn-primary mt-md" onclick="location.reload()">Retry</button>
          </div>
        `;
      }
    }
  } else {
    // Unknown route, try apartment detail
    const match = hash.match(/^\/apartment\/(\d+)$/);
    if (match) {
      const { renderApartmentDetail } = await import('./views/tenants.js');
      // We need to scroll to the specific apartment card
      window.location.hash = '#/tenants';
    } else {
      window.location.hash = '#/';
    }
  }

  // Update sidebar active link
  updateSidebar(hash);
}

function updateSidebar(hash) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.remove('active');
    const linkHash = a.getAttribute('href')?.slice(1) || '/';
    if (hash.startsWith(linkHash) && linkHash !== '/') {
      a.classList.add('active');
    } else if (hash === linkHash) {
      a.classList.add('active');
    }
  });
}

// ── WebSocket ──
function initWs() {
  setWsCallbacks({
    onConnect: (connected, apartmentIds) => {
      const dot = document.querySelector('.ws-dot');
      const label = document.getElementById('ws-label');
      if (dot) {
        dot.className = `ws-dot ${connected ? 'connected' : 'disconnected'}`;
      }
      if (label) {
        label.textContent = connected ? 'Connected' : 'Disconnected';
      }
      // Also update sidebar WS status
      const sideDot = document.querySelector('#ws-status-sidebar .ws-dot');
      if (sideDot) {
        sideDot.className = `ws-dot ${connected ? 'connected' : 'disconnected'}`;
      }
      const sideLabel = document.querySelector('#ws-status-sidebar');
      if (sideLabel && !connected) {
        // Don't change the label text, just the dot
      }
    },
    onIncomingCall: (data) => {
      showIncomingCall(data);
    },
    onCallUpdated: (data) => {
      if (data.call_status !== 'ringing') {
        hideIncomingCall();
      }
    },
  });

  connectWs();
}

// ── Start ──
window.addEventListener('hashchange', router);

// Global logout
window.logout = () => {
  disconnectWs();
  apiLogout();
  window.location.hash = '#/login';
};

// Boot
if (getToken()) {
  initWs();
}
router();
