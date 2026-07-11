// ============================================================================
// AnfieldVoice — Tenant Management (Property Admin)
// Manage residents across assigned apartments
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import * as api from '../../src/api/client';
import type { Apartment, Resident } from '../../src/types';

export default function ResidentsScreen() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedApt, setSelectedApt] = useState<number | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addReason, setAddReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadData() {
    const aptResult = await api.getMyApartments();
    if (aptResult.data) {
      setApartments(aptResult.data);
      if (aptResult.data.length > 0 && !selectedApt) {
        setSelectedApt(aptResult.data[0].apartment_id);
      }
    }
  }

  async function loadResidents() {
    if (!selectedApt) return;
    const result = await api.getResidents(selectedApt);
    if (result.data) {
      setResidents(result.data);
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedApt) loadResidents(); }, [selectedApt]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (selectedApt) await loadResidents();
    setRefreshing(false);
  };

  async function handleAddResident() {
    if (!selectedApt) return;
    if (!addEmail.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    setLoading(true);
    const result = await api.addResident(selectedApt, {
      email: addEmail.trim(),
      full_name: addName.trim() || undefined,
      reason: addReason.trim() || undefined,
    });
    setLoading(false);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      setShowAddModal(false);
      setAddEmail('');
      setAddName('');
      setAddReason('');
      loadResidents();
    }
  }

  async function handleRemoveResident(resident: Resident) {
    if (!selectedApt) return;
    Alert.alert(
      'Remove Resident',
      `Remove ${resident.full_name} from this apartment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await api.removeResident(selectedApt, resident.user_id);
            if (result.error) {
              Alert.alert('Error', result.error);
            } else {
              loadResidents();
            }
          },
        },
      ]
    );
  }

  async function handleToggleStatus(resident: Resident) {
    if (!selectedApt) return;
    const action = resident.is_active ? 'deactivate' : 'activate';
    const label = resident.is_active ? 'Suspend' : 'Activate';
    Alert.alert(
      `${label} Resident`,
      `${label} ${resident.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: resident.is_active ? 'destructive' : 'default',
          onPress: async () => {
            const result = resident.is_active
              ? await api.deactivateResident(selectedApt, resident.user_id)
              : await api.activateResident(selectedApt, resident.user_id);
            if (result.error) {
              Alert.alert('Error', result.error);
            } else {
              loadResidents();
            }
          },
        },
      ]
    );
  }

  const selectedAptInfo = apartments.find(a => a.apartment_id === selectedApt);

  return (
    <View style={styles.container}>
      {/* Apartment Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aptTabs}>
        {apartments.map((apt) => (
          <TouchableOpacity
            key={apt.apartment_id}
            style={[
              styles.aptTab,
              selectedApt === apt.apartment_id && styles.aptTabActive,
            ]}
            onPress={() => setSelectedApt(apt.apartment_id)}
          >
            <Text style={[
              styles.aptTabText,
              selectedApt === apt.apartment_id && styles.aptTabTextActive,
            ]}>
              {apt.building ? apt.building[0] : ''}{apt.unit_number}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {selectedAptInfo && (
          <Text style={styles.aptTitle}>
            {selectedAptInfo.building} {selectedAptInfo.unit_number}
            {'  '}
            <Text style={styles.aptCapacity}>
              ({residents.length}/{selectedAptInfo.max_residents})
            </Text>
          </Text>
        )}

        {/* Residents */}
        {residents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No residents yet</Text>
            <Text style={styles.emptySubtext}>Tap below to add the first resident</Text>
          </Card>
        ) : (
          residents.map((resident) => (
            <Card key={resident.resident_id} style={styles.residentCard}>
              <View style={styles.residentRow}>
                <View style={styles.residentAvatar}>
                  <Text style={styles.residentAvatarText}>
                    {resident.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.residentInfo}>
                  <Text style={styles.residentName}>{resident.full_name}</Text>
                  <Text style={styles.residentEmail}>{resident.email}</Text>
                  <View style={styles.residentMeta}>
                    {resident.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                    <Text style={[
                      styles.statusText,
                      { color: resident.is_active ? Colors.success : Colors.error },
                    ]}>
                      {resident.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.residentActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: resident.is_active ? Colors.warning + '20' : Colors.success + '20' }]}
                    onPress={() => handleToggleStatus(resident)}
                  >
                    <Ionicons
                      name={resident.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={22}
                      color={resident.is_active ? Colors.warning : Colors.success}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleRemoveResident(resident)}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Add Resident Button */}
        <Button
          title="Invite New Resident"
          onPress={() => setShowAddModal(true)}
          variant="primary"
          size="lg"
          icon={<Ionicons name="person-add" size={20} color={Colors.white} />}
          style={styles.addButton}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Resident Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Invite Resident</Text>
            <Text style={styles.modalSubtext}>
              Send an invitation to {selectedAptInfo?.building} {selectedAptInfo?.unit_number}
            </Text>

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              value={addEmail}
              onChangeText={setAddEmail}
              placeholder="newresident@example.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={addName}
              onChangeText={setAddName}
              placeholder="Optional"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Reason (audit trail)</Text>
            <TextInput
              style={styles.input}
              value={addReason}
              onChangeText={setAddReason}
              placeholder="e.g., New tenant moving in"
              placeholderTextColor={Colors.textSecondary}
            />

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowAddModal(false)} style={{ flex: 1 }} />
              <Button
                title="Send Invite"
                onPress={handleAddResident}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  aptTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 56,
  },
  aptTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  aptTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  aptTabText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  aptTabTextActive: {
    color: Colors.white,
  },
  list: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  aptTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  aptCapacity: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '400',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    opacity: 0.7,
  },
  residentCard: {
    marginBottom: Spacing.sm,
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  residentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  residentAvatarText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  residentInfo: {
    flex: 1,
  },
  residentName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  residentEmail: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  residentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: Colors.rolePropertyAdmin + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  primaryBadgeText: {
    color: Colors.rolePropertyAdmin,
    fontSize: 10,
    fontWeight: '600',
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  removeBtn: {
    padding: Spacing.sm,
  },
  residentActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    paddingBottom: Spacing.xxxl + Spacing.xl,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  modalSubtext: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
});
