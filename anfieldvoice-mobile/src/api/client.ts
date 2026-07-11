// ============================================================================
// AnfieldVoice — API Client
// Handles all HTTP communication with the FastAPI backend
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import type {
  UserProfile,
  Apartment,
  Resident,
  UserPermissions,
  PermissionCheck,
  AddResidentRequest,
  AssignPropertyAdminRequest,
  Invitation,
  AuditEntry,
  GateCall,
} from '../types';

// Change this to your production API URL
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:8000'  // Local dev — update to your server IP
  : 'https://api.anfieldvoice.co.za';

const TOKEN_KEY = 'anfieldvoice_auth_token';

// ============================================================================
// Token Management
// ============================================================================

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// HTTP Client
// ============================================================================

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth: boolean = true,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getStoredToken();
    if (!token) {
      return { status: 401, error: 'Not authenticated' };
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return { status: 204 };
    }

    const text = await response.text();
    let data: T | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text as unknown as T;
    }

    if (!response.ok) {
      return {
        status: response.status,
        error: (data as Record<string, unknown>)?.detail as string || text || 'Request failed',
      };
    }

    return { data: data as T, status: response.status };
  } catch (err) {
    return {
      status: 0,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// ============================================================================
// Authentication Endpoints
// ============================================================================

export async function login(email: string, password: string): Promise<ApiResponse<{ access_token: string; token_type: string }>> {
  const result = await request<{ access_token: string; token_type: string }>(
    'POST',
    '/api/v1/auth/login',
    { email, password },
    false,
  );
  // Store token immediately on success
  if (result.data?.access_token) {
    await setStoredToken(result.data.access_token);
  }
  return result;
}

export const logout = clearStoredToken;

// ============================================================================
// User Endpoints
// ============================================================================

export function getMyProfile(): Promise<ApiResponse<UserProfile>> {
  return request<UserProfile>('GET', '/api/v1/me');
}

export function deleteMyAccount(reason?: string): Promise<ApiResponse<{ status: string; message: string }>> {
  return request<{ status: string; message: string }>(
    'POST',
    '/api/v1/me/delete-account',
    { confirm: true, reason: reason || 'User requested account deletion' },
  );
}

// ============================================================================
// Permissions Endpoints
// ============================================================================

export function getPermissions(apartmentId: number): Promise<ApiResponse<UserPermissions>> {
  return request<UserPermissions>('GET', `/api/v1/permissions/${apartmentId}`);
}

export function checkPermission(apartmentId: number, action: string): Promise<ApiResponse<PermissionCheck>> {
  return request<PermissionCheck>('GET', `/api/v1/permissions/${apartmentId}/check/${action}`);
}

// ============================================================================
// Apartment Endpoints
// ============================================================================

export function getMyApartments(): Promise<ApiResponse<Apartment[]>> {
  return request<Apartment[]>('GET', '/api/v1/my-apartments');
}

export function getResidents(apartmentId: number): Promise<ApiResponse<Resident[]>> {
  return request<Resident[]>('GET', `/api/v1/apartments/${apartmentId}/residents`);
}

export function addResident(apartmentId: number, req: AddResidentRequest): Promise<ApiResponse<Resident>> {
  return request<Resident>('POST', `/api/v1/apartments/${apartmentId}/residents`, req);
}

export function removeResident(apartmentId: number, userId: number, reason?: string): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('DELETE', `/api/v1/apartments/${apartmentId}/residents/${userId}`, { reason });
}

export function activateResident(apartmentId: number, userId: number): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('POST', `/api/v1/apartments/${apartmentId}/residents/${userId}/activate`);
}

export function deactivateResident(apartmentId: number, userId: number): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('POST', `/api/v1/apartments/${apartmentId}/residents/${userId}/deactivate`);
}

// ============================================================================
// Property Admin Assignment
// ============================================================================

export function assignPropertyAdmin(req: AssignPropertyAdminRequest): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('POST', '/api/v1/property-admins', req);
}

export function revokePropertyAdmin(apartmentId: number, userId: number, reason?: string): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('DELETE', `/api/v1/property-admins/${apartmentId}/${userId}`, { reason });
}

// ============================================================================
// Invitations
// ============================================================================

export function createInvitation(apartmentId: number, email: string, reason?: string): Promise<ApiResponse<Invitation>> {
  return request<Invitation>('POST', '/api/v1/invitations', { apartment_id: apartmentId, email, reason });
}

export function getInvitations(apartmentId: number): Promise<ApiResponse<Invitation[]>> {
  return request<Invitation[]>('GET', `/api/v1/invitations/${apartmentId}`);
}

// ============================================================================
// Audit Log
// ============================================================================

export function getAuditLog(apartmentId: number): Promise<ApiResponse<AuditEntry[]>> {
  return request<AuditEntry[]>('GET', `/api/v1/audit/${apartmentId}`);
}

// ============================================================================
// Health Check
// ============================================================================

export function healthCheck(): Promise<ApiResponse<Record<string, unknown>>> {
  return request<Record<string, unknown>>('GET', '/health', undefined, false);
}

// ============================================================================
// Gate Call Endpoints (Slice 1 — WebSocket Signalling)
// ============================================================================

export function initiateGateCall(apartmentId: number, callerUnit?: string): Promise<ApiResponse<GateCall>> {
  return request<GateCall>('POST', '/api/v1/gate-calls', {
    apartment_id: apartmentId,
    caller_unit: callerUnit || 'Main Gate',
  });
}

export function gateCallAction(callId: number, action: 'answer' | 'reject'): Promise<ApiResponse<{ call_id: number; status: string }>> {
  return request<{ call_id: number; status: string }>(
    'POST',
    `/api/v1/gate-calls/${callId}/action`,
    { action },
  );
}

export function getGateCalls(apartmentId?: number, limit = 50, offset = 0): Promise<ApiResponse<GateCall[]>> {
  const params = new URLSearchParams();
  if (apartmentId) params.set('apartment_id', String(apartmentId));
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request<GateCall[]>('GET', `/api/v1/gate-calls?${params.toString()}`);
}
