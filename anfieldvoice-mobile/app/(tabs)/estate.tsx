// ============================================================================
// AnfieldVoice — Estate Management (Body Corp / Super Admin)
// Full control: apartment overview, PA assignment, audit, invitations
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
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import * as api from '../../src/api/client';
import type { Apartment, Resident, AuditEntry, Invitation } from '../../src/types';

export default function EstateScreen() {
  const [apartments, setApartments] = useState<(Apartment & { residentCount?: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedApt, setExpandedApt] = useState<number | null>(null);
  const [residents, setResidents] = useState<Record<number, Resident[]>>({});
  const [propertyAdmins, setPropertyAdmins] = useState<Record<number, Array<{assignment_id: number; user_id: number; full_name: string; email: string; is_resident: boolean; admin_type: string}>>>({});
  const [auditLogs, setAuditLogs] = useState<Record<number, AuditEntry[]>>({});
  const [invitations, setInvitations] = useState<Record<number, Invitation[]>>({});
  const [showPAModal, setShowPAModal] = useState(false);
  const [paAptId, setPaAptId] = useState(0);
  const [paUserId, setPaUserId] = useState('');
  const [paIsResident, setPaIsResident] = useState(false);
  const [paLoading, setPaLoading] = useState(false);
  const [paTab, setPaTab] = useState<'PAs' | 'Invitations'>('PAs');

  const loadData = useCallback(async () => {
    const result = await api.getMyApartments();
    if (!result.data) return;
    const withCounts = await Promise.all(
      result.data.map(async (apt) => {
        const res = await api.getResidents(apt.apartment_id);
        return { ...apt, residentCount: res.data?.length ?? 0 };
      })
    );
    setApartments(withCounts);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (expandedApt) await loadAptDetails(expandedApt);
    setRefreshing(false);
  };

  const loadAptDetails = async (aptId: number) => {
    const [res, pa, aud, inv] = await Promise.all([
      api.getResidents(aptId),
      api.getPropertyAdmins(aptId),
      api.getAuditLog(aptId),
      api.getInvitations(aptId),
    ]);
    if (res.data) setResidents(p => ({ ...p, [aptId]: res.data! }));
    if (pa.data) setPropertyAdmins(p => ({ ...p, [aptId]: pa.data!.map(a => ({...a, user_id: a.user_id, full_name: a.full_name || 'Unknown', email: a.email || ''})) }));
    if (aud.data) setAuditLogs(p => ({ ...p, [aptId]: aud.data! }));
    if (inv.data) setInvitations(p => ({ ...p, [aptId]: inv.data! }));
  };

  const toggleExpand = async (aptId: number) => {
    if (expandedApt === aptId) {
      setExpandedApt(null);
      return;
    }
    setExpandedApt(aptId);
    setPaTab('PAs');
    await loadAptDetails(aptId);
  };

  const handleAssignPA = async () => {
    if (!paUserId.trim()) { Alert.alert('Error', 'User ID is required'); return; }
    setPaLoading(true);
    const result = await api.assignPropertyAdmin({
      user_id: parseInt(paUserId.trim(), 10),
      apartment_id: paAptId,
      is_resident: paIsResident,
      reason: 'Assigned via mobile estate',
    });
    setPaLoading(false);
    if (result.error) { Alert.alert('Error', result.error); return; }
    setShowPAModal(false);
    setPaUserId('');
    setPaIsResident(false);
    Alert.alert('Success', 'Property administrator assigned');
  };

  const handleRevokePA = async (aptId: number, userId: number, name: string) => {
    Alert.alert('Revoke PA', `Remove admin rights from ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          const result = await api.revokePropertyAdmin(aptId, userId, 'Revoked via mobile estate');
          if (result.error) { Alert.alert('Error', result.error); return; }
          loadAptDetails(aptId);
        },
      },
    ]);
  };

  const totalResidents = apartments.reduce((s, a) => s + (a.residentCount || 0), 0);
  const totalCapacity = apartments.reduce((s, a) => s + a.max_residents, 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="business" label="Apartments" value={apartments.length} color={Colors.primary} />
        <StatCard icon="people" label="Residents" value={totalResidents} color={Colors.success} />
        <StatCard icon="home" label="Capacity" value={`${totalResidents}/${totalCapacity}`} color={Colors.rolePropertyAdmin} />
      </View>

      {/* Apartment List */}
      <Text style={styles.sectionTitle}>Apartment Overview</Text>
      {apartments.map((apt) => (
        <View key={apt.apartment_id}>
          <TouchableOpacity onPress={() => toggleExpand(apt.apartment_id)} activeOpacity={0.7}>
            <Card style={styles.aptCard}>
              <View style={styles.aptRow}>
                <View style={[styles.aptDot, { backgroundColor: (apt.residentCount || 0) > 0 ? Colors.success : Colors.textSecondary }]} />
                <View style={styles.aptInfo}>
                  <Text style={styles.aptName}>{apt.building ? `${apt.building} ` : ''}{apt.unit_number}</Text>
                  <Text style={styles.aptOccupancy}>{apt.residentCount} / {apt.max_residents} residents</Text>
                </View>
                <View style={styles.occupancyBar}>
                  <View style={[styles.occupancyFill, { width: `${Math.min(((apt.residentCount || 0) / apt.max_residents) * 100, 100)}%` }]} />
                </View>
                <Ionicons name={expandedApt === apt.apartment_id ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} style={{ marginLeft: Spacing.md }} />
              </View>
            </Card>
          </TouchableOpacity>

          {expandedApt === apt.apartment_id && (
            <View style={styles.expandedSection}>
              {/* Tab bar */}
              <View style={styles.estateTabs}>
                {(['PAs', 'Residents', 'Audit', 'Invitations'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.estateTab, paTab === t && styles.estateTabActive]}
                    onPress={() => setPaTab(t)}
                  >
                    <Text style={[styles.estateTabText, paTab === t && styles.estateTabTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* PA management */}
              {paTab === 'PAs' && (
                <View style={styles.tabContent}>
                  <Button
                    title="+ Assign Property Admin"
                    onPress={() => { setPaAptId(apt.apartment_id); setShowPAModal(true); }}
                    size="sm"
                    style={{ marginBottom: Spacing.md }}
                  />
                  {(!propertyAdmins[apt.apartment_id] || propertyAdmins[apt.apartment_id].length === 0) ? (
                    <Text style={styles.emptyText}>No property administrators assigned</Text>
                  ) : (
                    propertyAdmins[apt.apartment_id].map(pa => (
                      <View key={pa.assignment_id} style={styles.paRow}>
                        <View style={styles.paAvatar}>
                          <Text style={styles.paAvatarText}>{pa.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paName}>{pa.full_name}</Text>
                          <Text style={styles.paEmail}>{pa.email} · {pa.is_resident ? 'Resident PA' : 'Non-resident PA'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRevokePA(apt.apartment_id, pa.user_id, pa.full_name)}>
                          <Ionicons name="close-circle-outline" size={24} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Residents */}
              {paTab === 'Residents' && (
                <View style={styles.tabContent}>
                  {(residents[apt.apartment_id] || []).length === 0 ? (
                    <Text style={styles.emptyText}>No residents</Text>
                  ) : (residents[apt.apartment_id] || []).map(r => (
                    <View key={r.user_id} style={styles.paRow}>
                      <View style={styles.paAvatar}>
                        <Text style={styles.paAvatarText}>{r.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paName}>{r.full_name} {r.is_primary ? '⭐' : ''}</Text>
                        <Text style={styles.paEmail}>{r.email}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                        <Text style={[styles.statusBadge, { color: r.is_active ? Colors.success : Colors.error }]}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Audit */}
              {paTab === 'Audit' && (
                <View style={styles.tabContent}>
                  {(auditLogs[apt.apartment_id] || []).length === 0 ? (
                    <Text style={styles.emptyText}>No activity recorded</Text>
                  ) : (auditLogs[apt.apartment_id] || []).slice(0, 20).map(e => (
                    <View key={e.audit_id} style={styles.auditRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.auditAction}>{e.action.replace(/_/g, ' ')}</Text>
                        <Text style={styles.auditMeta}>
                          {e.admin_name ? `by ${e.admin_name}` : ''} · {new Date(e.created_at).toLocaleString()}
                          {e.reason ? ` · ${e.reason}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Invitations */}
              {paTab === 'Invitations' && (
                <View style={styles.tabContent}>
                  {(invitations[apt.apartment_id] || []).length === 0 ? (
                    <Text style={styles.emptyText}>No pending invitations</Text>
                  ) : (invitations[apt.apartment_id] || []).map(i => (
                    <View key={i.invitation_id} style={styles.paRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paName}>{i.email}</Text>
                        <Text style={styles.paEmail}>Status: {i.status} · Expires {new Date(i.expires_at).toLocaleDateString()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ))}

      {/* PA Assignment Modal */}
      <Modal visible={showPAModal} transparent animationType="fade" onRequestClose={() => setShowPAModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Assign Property Administrator</Text>
            <Text style={styles.modalSubtext}>Grant admin rights for this apartment.</Text>

            <Text style={styles.inputLabel}>User ID *</Text>
            <TextInput style={styles.input} value={paUserId} onChangeText={setPaUserId}
              placeholder="Enter user ID" placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad" />

            <TouchableOpacity style={styles.checkRow} onPress={() => setPaIsResident(!paIsResident)}>
              <Ionicons name={paIsResident ? 'checkbox' : 'square-outline'} size={22} color={paIsResident ? Colors.primary : Colors.textSecondary} />
              <Text style={styles.checkLabel}>Also a resident of this apartment</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowPAModal(false)} style={{ flex: 1 }} />
              <Button title="Assign" onPress={handleAssignPA} loading={paLoading} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 60 }} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.lg },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.xl },
  statCard: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 1 },
  statValue: { fontSize: FontSize.xl, fontWeight: '700' },
  statLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '500' },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, marginTop: Spacing.lg },
  aptCard: { marginBottom: Spacing.sm },
  aptRow: { flexDirection: 'row', alignItems: 'center' },
  aptDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.md },
  aptInfo: { flex: 1 },
  aptName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  aptOccupancy: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  occupancyBar: { width: 60, height: 6, backgroundColor: Colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  occupancyFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  expandedSection: { marginLeft: Spacing.lg + 10, marginBottom: Spacing.md },
  estateTabs: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  estateTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.bgCard },
  estateTabActive: { backgroundColor: Colors.primary },
  estateTabText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  estateTabTextActive: { color: Colors.white },
  tabContent: { paddingLeft: Spacing.xs },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  paRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  paAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  paAvatarText: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '700' },
  paName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  paEmail: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 1 },
  statusBadge: { fontSize: FontSize.xs, fontWeight: '600' },
  auditRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  auditAction: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', textTransform: 'capitalize' },
  auditMeta: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.bg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xxl, paddingBottom: Spacing.xxxl + Spacing.xl },
  modalTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  modalSubtext: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  inputLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.lg, color: Colors.text, fontSize: FontSize.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  checkLabel: { color: Colors.text, fontSize: FontSize.md },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxl },
});
