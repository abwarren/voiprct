// ============================================================================
// AnfieldVoice — Design Tokens
// Dark premium theme matching the Red Cape Technologies brand
// ============================================================================

export const Colors = {
  // Primary palette
  primary: '#2563EB',        // Bold blue — actions, active states
  primaryDark: '#1D4ED8',    // Pressed states
  primaryLight: '#93C5FD',   // Highlights

  // Background
  bg: '#0F172A',             // Deep navy — main background
  bgCard: '#1E293B',         // Card background
  bgElevated: '#334155',     // Modal / sheet background
  bgInput: '#1E293B',        // Input fields

  // Text
  text: '#F1F5F9',           // Primary text
  textSecondary: '#94A3B8',  // Secondary / muted text
  textInverse: '#0F172A',    // Text on light backgrounds

  // Status
  success: '#10B981',        // Green — active, verified
  warning: '#F59E0B',        // Amber — pending
  error: '#EF4444',          // Red — errors, removed
  info: '#3B82F6',           // Blue — information

  // Borders
  border: '#334155',         // Subtle borders
  borderLight: '#475569',    // Medium borders

  // Misc
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Role-specific accent colors
  roleResident: '#10B981',
  rolePropertyAdmin: '#F59E0B',
  roleSecurity: '#3B82F6',
  roleMaintenance: '#8B5CF6',
  roleBodyCorp: '#EC4899',
  roleSuperAdmin: '#EF4444',

  // Sector colors (roulette-inspired, for gate zones)
  sectorA: '#3B82F6',
  sectorB: '#F59E0B',
  sectorC: '#10B981',
  sectorD: '#EF4444',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};
