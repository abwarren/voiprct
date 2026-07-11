// ============================================================================
// AnfieldVoice — Estate Management (Body Corp / Super Admin)
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import * as api from '../../src/api/client';
import type { Apartment } from '../../src/types';

export default function EstateScreen() {
  const [apartments, setApartments] = useState<(Apartment & { residentCount?: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    // Get all apartments via body corp's managed list
    // (In production, there would be a dedicated endpoint for all apartments)
    const result = await api.getMyApartments();
    if (result.data) {
      // Load resident counts for each
      const withCounts = await Promise.all(
        result.data.map(async (apt) => {
          const res = await api.getResidents(apt.apartment_id);
          return {
            ...apt,
            residentCount: res.data?.length ?? 0,
          };
        })
      );
      setApartments(withCounts);
    }
  }

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalResidents = apartments.reduce((sum, a) => sum + (a.residentCount || 0), 0);
  const totalCapacity = apartments.reduce((sum, a) => sum + a.max_residents, 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Estate Overview */}
      <View style={styles.statsRow}>
        <StatCard icon="business" label="Apartments" value={apartments.length} color={Colors.primary} />
        <StatCard icon="people" label="Residents" value={totalResidents} color={Colors.success} />
        <StatCard icon="home" label="Capacity" value={`${totalResidents}/${totalCapacity}`} color={Colors.rolePropertyAdmin} />
      </View>

      {/* Apartment List */}
      <Text style={styles.sectionTitle}>Apartment Overview</Text>
      {apartments.map((apt) => (
        <TouchableOpacity
          key={apt.apartment_id}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Card style={styles.aptCard}>
            <View style={styles.aptRow}>
              <View style={[styles.aptDot, { backgroundColor: (apt.residentCount || 0) > 0 ? Colors.success : Colors.textSecondary }]} />
              <View style={styles.aptInfo}>
                <Text style={styles.aptName}>
                  {apt.building ? `${apt.building} ` : ''}{apt.unit_number}
                </Text>
                <Text style={styles.aptOccupancy}>
                  {apt.residentCount} / {apt.max_residents} residents
                </Text>
              </View>
              <View style={styles.occupancyBar}>
                <View style={[styles.occupancyFill, {
                  width: `${((apt.residentCount || 0) / apt.max_residents) * 100}%`,
                }]} />
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Quick Admin Actions */}
      <Text style={styles.sectionTitle}>Administration</Text>
      <Card style={styles.adminCard}>
        <AdminAction icon="shield-checkmark" label="Assign Property Admin" desc="Grant admin rights to an apartment" onPress={() => Alert.alert('Coming Soon', 'This feature will be available in the next update.')} />
        <AdminAction icon="document-text" label="Audit Log" desc="View estate-wide activity" onPress={() => Alert.alert('Coming Soon', 'Audit log viewer coming soon.')} />
        <AdminAction icon="settings" label="Estate Settings" desc="Configure buildings and apartments" onPress={() => Alert.alert('Coming Soon', 'Settings panel coming in v1.1.')} />
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AdminAction({ icon, label, desc, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.adminAction} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={24} color={Colors.primary} />
      <View style={styles.adminActionInfo}>
        <Text style={styles.adminActionLabel}>{label}</Text>
        <Text style={styles.adminActionDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '500',
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
  aptCard: {
    marginBottom: Spacing.sm,
  },
  aptRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aptDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  aptInfo: {
    flex: 1,
  },
  aptName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  aptOccupancy: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  occupancyBar: {
    width: 60,
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  adminCard: {
    marginBottom: Spacing.sm,
  },
  adminAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  adminActionInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  adminActionLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  adminActionDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});
