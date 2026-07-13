// ============================================================================
// AnfieldVoice Web — API Client
// ============================================================================

const API_BASE = location.origin;
const TOKEN_KEY = 'av_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export async function api(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (!token) { window.location.hash = '#/login'; throw new Error('No token'); }
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  if (!res.ok) throw new Error(data?.detail || data || 'Request failed');
  return data;
}

export const apiGet = (p) => api('GET', p);
export const apiPost = (p, b) => api('POST', p, b);
export const apiDelete = (p, b) => api('DELETE', p, b);
export const apiPatch = (p, b) => api('PATCH', p, b);

// ── Auth ──
export async function login(email, password) {
  const data = await apiPost('/api/v1/auth/login', { email, password }, false);
  setToken(data.access_token);
  return data;
}

export function logout() { clearToken(); window.location.hash = '#/login'; }

// ── User ──
export const getMyProfile = () => apiGet('/api/v1/me');
export const deleteMyAccount = (reason) => apiPost('/api/v1/me/delete-account', { confirm: true, reason });

// ── Apartments ──
export const getMyApartments = () => apiGet('/api/v1/my-apartments');
export const getResidents = (id) => apiGet(`/api/v1/apartments/${id}/residents`);
export const addResident = (id, data) => apiPost(`/api/v1/apartments/${id}/residents`, data);
export const removeResident = (id, uid, reason) => apiDelete(`/api/v1/apartments/${id}/residents/${uid}`, { reason });
export const activateResident = (id, uid) => apiPost(`/api/v1/apartments/${id}/residents/${uid}/activate`);
export const deactivateResident = (id, uid) => apiPost(`/api/v1/apartments/${id}/residents/${uid}/deactivate`);

// ── Permissions ──
export const getPermissions = (id) => apiGet(`/api/v1/permissions/${id}`);

// ── Property Admins ──
export const assignPropertyAdmin = (data) => apiPost('/api/v1/property-admins', data);
export const revokePropertyAdmin = (aptId, userId, reason) => apiDelete(`/api/v1/property-admins/${aptId}/${userId}`, { reason });

// ── Invitations ──
export const createInvitation = (data) => apiPost('/api/v1/invitations', data);
export const getInvitations = (id) => apiGet(`/api/v1/invitations/${id}`);

// ── Audit ──
export const getAuditLog = (id) => apiGet(`/api/v1/audit/${id}`);

// ── Gate Calls ──
export const initiateGateCall = (apartmentId, callerUnit) => apiPost('/api/v1/gate-calls', { apartment_id: apartmentId, caller_unit: callerUnit || 'Main Gate' });
export const gateCallAction = (callId, action) => apiPost(`/api/v1/gate-calls/${callId}/action`, { action });
export const getGateCalls = (aptId, limit = 50, offset = 0) => {
  const p = new URLSearchParams();
  if (aptId) p.set('apartment_id', aptId);
  p.set('limit', limit); p.set('offset', offset);
  return apiGet(`/api/v1/gate-calls?${p}`);
};

// ── Utility ──
export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

export function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Visitor PINs ──
export const createVisitorPin = (data) => apiPost('/api/v1/visitor-pins', data);
export const getVisitorPins = (aptId, showExpired) => apiGet(`/api/v1/visitor-pins/${aptId}?show_expired=${showExpired || false}`);
export const verifyVisitorPin = (pinCode, gateUnit) => apiPost('/api/v1/visitor-pins/verify', { pin_code: pinCode, gate_unit: gateUnit || 'Main Gate' });
export const revokeVisitorPin = (pinId) => apiDelete(`/api/v1/visitor-pins/${pinId}`);

// ── Expected Arrivals ──
export const createExpectedArrival = (data) => apiPost('/api/v1/arrivals', data);
export const getExpectedArrivals = (aptId, statusFilter) => {
  const p = new URLSearchParams();
  if (statusFilter) p.set('status_filter', statusFilter);
  const qs = p.toString() ? `?${p}` : '';
  return apiGet(`/api/v1/arrivals/${aptId}${qs}`);
};
export const arrivalAction = (arrivalId, action) => apiPost(`/api/v1/arrivals/${arrivalId}/action`, { action });

// ── Push Notification Tokens ──
export const registerPushToken = (platform, token) => apiPost('/api/v1/push-tokens', { platform, token });
export const getPushTokens = () => apiGet('/api/v1/push-tokens');
export const removePushToken = (tokenId) => apiDelete(`/api/v1/push-tokens/${tokenId}`);

// ── Security Dashboard ──
export const getSecurityOverview = () => apiGet('/api/v1/security/overview');

// ── Directory Search ──
export const directorySearch = (unit) => apiGet(`/api/v1/directory/search?unit=${encodeURIComponent(unit)}`);
// ── Recurring Visitors ──
export const getRecurringVisitors = (aptId) => apiGet(`/api/v1/recurring-visitors/${aptId}`);
export const createRecurringVisitor = (data) => apiPost('/api/v1/recurring-visitors', data);
export const updateRecurringVisitor = (id, data) => apiPatch(`/api/v1/recurring-visitors/${id}`, data);
export const deleteRecurringVisitor = (id) => apiDelete(`/api/v1/recurring-visitors/${id}`);

