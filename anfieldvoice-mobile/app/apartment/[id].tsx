// ============================================================================
// AnfieldVoice — Apartment Detail Screen
// Detailed view with resident management, audit log, and permissions
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { RoleBadge } from '../../src/components/RoleBadge';
import * as api from '../../src/api/client';
import type { Apartment, Resident, UserPermissions, AuditEntry } from '../../src/types';

export default function ApartmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const apartmentId = parseInt(id, 10);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'residents' | 'audit'>('residents');

  const loadData = useCallback(async () => {
    const [aptResult, resResult, permResult, auditResult] = await Promise.all([
      api.getMyApartments().then(r => r.data?.find(a => a.apartment_id === apartmentId) ?? null),
      api.getResidents(apartmentId),
      api.getPermissions(apartmentId),
      api.getAuditLog(apartmentId),
    ]);

    if (aptResult) setApartment(aptResult);
    if (resResult.data) setResidents(resResult.data);
    if (permResult.data) setPermissions(permResult.data);
    if (auditResult.data) setAuditLog(auditResult.data);
  }, [apartmentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!apartment) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading apartment...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${apartment.building ? apartment.building + ' ' : ''}${apartment.unit_number}`,
        }}
      />

      {/* Apartment Header */}
      <View style={styles.header}>
        <Text style={styles.aptName}>
          {apartment.building} {apartment.unit_number}
        </Text>
        <Text style={styles.aptMeta}>
          {residents.length} / {apartment.max_residents} residents
        </Text>
      </View>

      {/* Permissions Snapshot */}
      {permissions && (
        <Card style={styles.permsCard}>
          <Text style={styles.sectionTitle}>Your Permissions</Text>
          <View style={styles.permsGrid}>
            <PermItem label="Gate Calls" value={permissions.receive_gate_calls} />
            <PermItem label="Visitor PIN" value={permissions.generate_visitor_pin} />
            <PermItem label="Add Tenants" value={permissions.add_tenants} />
            <PermItem label="Remove Tenants" value={permissions.remove_tenants} />
            <PermItem label="Activate" value={permissions.activate_residents} />
            <PermItem label="View Activity" value={permissions.view_apartment_activity} />
          </View>
          {permissions.admin_type && (
            <Text style={styles.adminType}>{permissions.admin_type}</Text>
          )}
        </Card>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'residents' && styles.tabActive]}
          onPress={() => setActiveTab('residents')}
        >
          <Text style={[styles.tabText, activeTab === 'residents' && styles.tabTextActive]}>
            Residents ({residents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'audit' && styles.tabActive]}
          onPress={() => setActiveTab('audit')}
        >
          <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>
            Activity
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {activeTab === 'residents' ? (
          <>
            {residents.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>No residents in this apartment</Text>
              </Card>
            ) : (
              residents.map((resident) => (
                <ResidentCard key={resident.resident_id} resident={resident} apartmentId={apartmentId} onUpdate={loadData} />
              ))
            )}
          </>
        ) : (
          <>
            {auditLog.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>No activity recorded yet</Text>
              </Card>
            ) : (
              auditLog.slice(0, 50).map((entry) => (
                <Card key={entry.audit_id} style={styles.auditCard}>
                  <View style={styles.auditRow}>
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.auditTime}>{new Date(entry.created_at).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.auditAction}>{entry.action.replace('_', ' ')}</Text>
                  {entry.reason && <Text style={styles.auditReason}>{entry.reason}</Text>}
                  {entry.admin_name && <Text style={styles.auditAdmin}>by {entry.admin_name}</Text>}
                </Card>
              ))
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function PermItem({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.permItem}>
      <Ionicons name={value ? 'checkmark-circle' : 'close-circle'} size={16} color={value ? Colors.success : Colors.textSecondary} />
      <Text style={[styles.permLabel, !value && { color: Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ResidentCard({ resident, apartmentId, onUpdate }: { resident: Resident; apartmentId: number; onUpdate: () => void }) {
  async function handleToggleActive() {
    if (resident.is_active) {
      const result = await api.deactivateResident(apartmentId, resident.user_id);
      if (result.error) Alert.alert('Error', result.error);
    } else {
      const result = await api.activateResident(apartmentId, resident.user_id);
      if (result.error) Alert.alert('Error', result.error);
    }
    onUpdate();
  }

  return (
    <Card style={styles.residentCard}>
      <View style={styles.residentRow}>
        <View style={styles.residentAvatar}>
          <Text style={styles.residentAvatarText}>{resident.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}</Text>
        </View>
        <View style={styles.residentInfo}>
          <Text style={styles.residentName}>{resident.full_name}</Text>
          <Text style={styles.residentEmail}>{resident.email}</Text>
          <View style={styles.badges}>
            {resident.is_primary && <RoleBadge role="property_admin" />}
            <Text style={[styles.statusBadge, { color: resident.is_active ? Colors.success : Colors.error }]}>
              {resident.is_active ? 'Active' : 'Suspended'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleToggleActive} style={styles.toggleBtn}>
          <Ionicons
            name={resident.is_active ? 'pause-circle' : 'play-circle'}
            size={28}
            color={resident.is_active ? Colors.warning : Colors.success}
          />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },
  header: { padding: Spacing.xxl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  aptName: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  aptMeta: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: Spacing.xs },
  permsCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  permsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  permItem: { flexDirection: 'row', alignItems: 'center', width: '48%', gap: Spacing.xs, paddingVertical: 2 },
  permLabel: { color: Colors.text, fontSize: FontSize.sm },
  adminType: { color: Colors.rolePropertyAdmin, fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.md, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: BorderRadius.md, padding: 3 },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  tabActive: { backgroundColor: Colors.bgElevated },
  tabText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  tabTextActive: { color: Colors.text },
  scrollArea: { flex: 1, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  emptyCard: { padding: Spacing.xxxl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
  residentCard: { marginBottom: Spacing.sm },
  residentRow: { flexDirection: 'row', alignItems: 'center' },
  residentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  residentAvatarText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  residentInfo: { flex: 1 },
  residentName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  residentEmail: { color: Colors.textSecondary, fontSize: FontSize.sm },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  statusBadge: { fontSize: FontSize.xs, fontWeight: '600' },
  toggleBtn: { padding: Spacing.sm },
  auditCard: { marginBottom: Spacing.xs, padding: Spacing.md },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  auditTime: { color: Colors.textSecondary, fontSize: FontSize.xs },
  auditAction: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', marginTop: Spacing.xs, textTransform: 'capitalize' },
  auditReason: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  auditAdmin: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2, fontStyle: 'italic' },
});
