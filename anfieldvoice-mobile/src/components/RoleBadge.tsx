// ============================================================================
// AnfieldVoice — Role Badge Component
// Shows a user's role with color coding
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import type { RoleName } from '../types';

const roleLabels: Record<RoleName, string> = {
  resident: 'Resident',
  property_admin: 'Property Admin',
  security: 'Security',
  maintenance: 'Maintenance',
  body_corp_admin: 'Body Corp',
  super_admin: 'Super Admin',
};

const roleColors: Record<RoleName, string> = {
  resident: Colors.roleResident,
  property_admin: Colors.rolePropertyAdmin,
  security: Colors.roleSecurity,
  maintenance: Colors.roleMaintenance,
  body_corp_admin: Colors.roleBodyCorp,
  super_admin: Colors.roleSuperAdmin,
};

interface RoleBadgeProps {
  role: RoleName;
  compact?: boolean;
}

export function RoleBadge({ role, compact = false }: RoleBadgeProps) {
  const label = roleLabels[role] || role;
  const color = roleColors[role] || Colors.textSecondary;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + '20', borderColor: color + '40' },
        compact && styles.compact,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, compact && styles.labelCompact, { color }]}>
        {compact ? label.split(' ')[0] : label}
      </Text>
    </View>
  );
}

interface RoleBadgeListProps {
  roles: RoleName[];
  compact?: boolean;
}

export function RoleBadgeList({ roles, compact = false }: RoleBadgeListProps) {
  return (
    <View style={styles.list}>
      {roles.map((role, idx) => (
        <RoleBadge key={`${role}-${idx}`} role={role} compact={compact} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  compact: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 10,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
