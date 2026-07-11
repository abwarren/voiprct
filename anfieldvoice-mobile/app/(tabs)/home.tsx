// ============================================================================
// AnfieldVoice — Home Dashboard
// Role-based home screen showing relevant quick actions
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { RoleBadgeList } from '../../src/components/RoleBadge';
import * as api from '../../src/api/client';
import type { Apartment } from '../../src/types';

export default function HomeScreen() {
  const { user, roles, logout } = useAuth();
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResident = roles.includes('resident');
  const isPropertyAdmin = roles.includes('property_admin');
  const isBodyCorp = roles.includes('body_corp_admin') || roles.includes('super_admin');

  const loadApartments = useCallback(async () => {
    if (!isPropertyAdmin && !isBodyCorp) return;
    const result = await api.getMyApartments();
    if (result.data) {
      setApartments(result.data);
      setError(null);
    } else if (result.status !== 401) {
      setError('Could not load apartments');
    }
  }, [isPropertyAdmin, isBodyCorp]);

  useFocusEffect(
    useCallback(() => {
      loadApartments();
    }, [loadApartments])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApartments();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.greeting}>
          Welcome back{user ? `, ${user.full_name.split(' ')[0]}` : ''}
        </Text>
        <RoleBadgeList roles={roles} compact />
      </View>

      {/* Resident Quick Actions */}
      {isResident && (
        <>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <QuickActionCard
              icon="call"
              label="Gate Call"
              desc="Answer the gate"
              color={Colors.roleSecurity}
              onPress={() => {}}
            />
            <QuickActionCard
              icon="key"
              label="Visitor PIN"
              desc="Generate a PIN"
              color={Colors.rolePropertyAdmin}
              onPress={() => {}}
            />
            <QuickActionCard
              icon="calendar"
              label="Expected"
              desc="Schedule arrival"
              color={Colors.success}
              onPress={() => {}}
            />
            <QuickActionCard
              icon="people"
              label="Directory"
              desc="Neighbours"
              color={Colors.roleResident}
              onPress={() => {}}
            />
          </View>
        </>
      )}

      {/* Property Admin — Managed Apartments */}
      {(isPropertyAdmin || isBodyCorp) && (
        <>
          <Text style={styles.sectionTitle}>
            {isBodyCorp ? 'All Apartments' : 'Your Apartments'}
          </Text>
          {error && (
            <Card style={styles.card}>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}
          {apartments.length === 0 && !error && (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>
                No apartment assignments yet.
              </Text>
              <Text style={styles.emptySubtext}>
                {isBodyCorp
                  ? 'Navigate to the Estate tab to manage assignments.'
                  : 'Contact body corporate to get assigned.'}
              </Text>
            </Card>
          )}
          {apartments.map((apt) => (
            <TouchableOpacity
              key={apt.apartment_id}
              onPress={() => router.push(`/apartment/${apt.apartment_id}`)}
              activeOpacity={0.7}
            >
              <Card style={styles.aptCard}>
                <View style={styles.aptHeader}>
                  <View style={styles.aptIcon}>
                    <Ionicons name="business" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.aptInfo}>
                    <Text style={styles.aptUnit}>
                      {apt.building ? `${apt.building} ` : ''}{apt.unit_number}
                    </Text>
                    <Text style={styles.aptMeta}>
                      Max {apt.max_residents} residents
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function QuickActionCard({
  icon,
  label,
  desc,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  welcome: {
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  greeting: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '47%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  actionDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  card: {
    marginBottom: Spacing.md,
  },
  aptCard: {
    marginBottom: Spacing.sm,
  },
  aptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aptIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  aptInfo: {
    flex: 1,
  },
  aptUnit: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  aptMeta: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    marginTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  logoutText: {
    color: Colors.error,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
