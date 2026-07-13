// ============================================================================
// AnfieldVoice — TypeScript types matching the FastAPI backend models
// ============================================================================

export type RoleName =
  | 'resident'
  | 'property_admin'
  | 'security'
  | 'maintenance'
  | 'body_corp_admin'
  | 'super_admin';

export interface Role {
  role_id: number;
  role_name: RoleName;
  description?: string;
}

export interface UserProfile {
  user_id: number;
  email: string;
  phone?: string;
  full_name: string;
  is_active: boolean;
  roles: Role[];
  created_at: string;
}

export interface Apartment {
  apartment_id: number;
  building?: string;
  unit_number: string;
  max_residents: number;
  is_active: boolean;
  created_at: string;
}

export interface Resident {
  resident_id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  is_primary: boolean;
  is_active: boolean;
  move_in_date?: string;
}

export interface PropertyAdminAssignment {
  assignment_id: number;
  user_id: number;
  apartment_id: number;
  is_resident: boolean;
  admin_type: 'Resident Property Administrator' | 'Non-Resident Property Administrator';
  assigned_at: string;
  full_name?: string;
  email?: string;
}

export interface UserPermissions {
  user_id: number;
  apartment_id: number;
  receive_gate_calls: boolean;
  generate_visitor_pin: boolean;
  create_expected_arrival: boolean;
  add_tenants: boolean;
  remove_tenants: boolean;
  activate_residents: boolean;
  view_apartment_activity: boolean;
  estate_administration: boolean;
  is_resident: boolean;
  is_property_admin: boolean;
  admin_type?: string;
}

export interface PermissionCheck {
  allowed: boolean;
  action: string;
  apartment_id: number;
  reason?: string;
}

export interface AddResidentRequest {
  user_id?: number;
  email?: string;
  full_name?: string;
  phone?: string;
  is_primary?: boolean;
  reason?: string;
}

export interface AssignPropertyAdminRequest {
  user_id: number;
  apartment_id: number;
  is_resident?: boolean;
  reason?: string;
}

export interface Invitation {
  invitation_id: number;
  apartment_id: number;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface AuditEntry {
  audit_id: number;
  admin_user_id: number;
  admin_name?: string;
  apartment_id?: number;
  action: string;
  target_type?: string;
  target_id?: number;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================================================
// Gate Calls (Slice 1 — WebSocket Signalling)
// ============================================================================

export interface GateCall {
  call_id: number;
  apartment_id: number;
  caller_unit: string;
  call_status: 'ringing' | 'answered' | 'missed' | 'rejected' | 'completed';
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_secs?: number;
}

export interface WsIncomingCall {
  type: 'incoming_call';
  call_id: number;
  apartment_id: number;
  caller_unit: string;
  started_at: string;
}

export interface WsCallUpdated {
  type: 'call_updated';
  call_id: number;
  call_status: string;
}

export interface WsConnected {
  type: 'connected';
  user_id: number;
  apartment_ids: number[];
}

export type WsMessage = WsIncomingCall | WsCallUpdated | WsConnected;

// ============================================================================
// NFC Credentials — Phone-as-Tag Gate Access (Slice 9)
// ============================================================================

export interface NfcCredential {
  credential_id: number;
  user_id: number;
  apartment_id: number;
  tag_uid?: string;
  phone_token?: string;
  credential_type: 'tag' | 'phone';
  is_active: boolean;
  activated_at?: string;
  deactivated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivatePhoneNfcRequest {
  apartment_id: number;
}

export interface RegisterTagRequest {
  user_id: number;
  apartment_id: number;
  tag_uid: string;
}

export interface NfcVerifyResponse {
  granted: boolean;
  apartment_id?: number;
  resident_name?: string;
  reason?: string;
}

export interface GateAccessLogEntry {
  access_id: number;
  credential_id: number;
  apartment_id: number;
  gate_unit: string;
  access_type: 'tag' | 'phone';
  granted: boolean;
  reason?: string;
  created_at: string;
}


// ============================================================================
// Recurring Visitors (Slice 8)
// ============================================================================

export interface RecurringVisitor {
  recurring_id: number;
  apartment_id: number;
  created_by: number;
  created_by_name?: string;
  visitor_name: string;
  vehicle_plate?: string;
  schedule_type: 'daily' | 'weekly' | 'weekdays' | 'custom';
  schedule_data?: Record<string, unknown>;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringVisitorCreate {
  apartment_id: number;
  visitor_name: string;
  vehicle_plate?: string;
  schedule_type: 'daily' | 'weekly' | 'weekdays' | 'custom';
  schedule_data?: Record<string, unknown>;
  valid_from?: string;
  valid_until?: string;
}

export interface RecurringVisitorUpdate {
  visitor_name?: string;
  vehicle_plate?: string;
  schedule_type?: string;
  schedule_data?: Record<string, unknown>;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
}

