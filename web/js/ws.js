// ============================================================================
// AnfieldVoice Web — WebSocket Client
// ============================================================================

let ws = null;
let reconnectTimer = null;
let onIncomingCall = null;
let onCallUpdated = null;
let onConnect = null;
const WS_BASE = location.origin.replace(/^http/, 'ws');

export function setWsCallbacks(callbacks) {
  onIncomingCall = callbacks.onIncomingCall || null;
  onCallUpdated = callbacks.onCallUpdated || null;
  onConnect = callbacks.onConnect || null;
}

export function connectWs() {
  import('./api.js').then(({ getToken }) => {
    const token = getToken();
    if (!token) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;

    ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      console.log('[WS] Connected');
      if (onConnect) onConnect(true);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case 'connected':
            if (onConnect) onConnect(true, data.apartment_ids);
            break;
          case 'incoming_call':
            if (onIncomingCall) onIncomingCall(data);
            break;
          case 'call_updated':
            if (onCallUpdated) onCallUpdated(data);
            break;
        }
      } catch (err) {
        console.warn('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...');
      if (onConnect) onConnect(false);
      ws = null;
      reconnectTimer = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => { if (ws) ws.close(); };
  });
}

export function disconnectWs() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) { ws.close(); ws = null; }
}

export function sendWs(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function getWsState() {
  if (!ws) return 'disconnected';
  if (ws.readyState === WebSocket.OPEN) return 'connected';
  if (ws.readyState === WebSocket.CONNECTING) return 'connecting';
  return 'disconnected';
}
