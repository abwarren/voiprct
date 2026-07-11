// ============================================================================
// AnfieldVoice — Visitors Tab (Slice 3 + Slice 4)
// Visitor PIN management + expected arrivals for residents & property admins
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import VisitorPinModal from '../../src/components/VisitorPinModal';
import ExpectedArrivalModal from '../../src/components/ExpectedArrivalModal';
import * as api from '../../src/api/client';
import type { Apartment } from '../../src/types';

export default function VisitorsScreen() {
  const { roles } = useAuth();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedApt, setSelectedApt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);

  const loadData = useCallback(async () => {
    const result = await api.getMyApartments();
    if (result.data) {
      setApartments(result.data);
      if (result.data.length > 0 && !selectedApt) {
        setSelectedApt(result.data[0].apartment_id);
      }
    }
  }, [selectedApt]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Apartment Selector */}
      {apartments.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aptTabs}>
          {apartments.map((apt) => (
            <TouchableOpacity
              key={apt.apartment_id}
              style={[styles.aptTab, selectedApt === apt.apartment_id && styles.aptTabActive]}
              onPress={() => setSelectedApt(apt.apartment_id)}
            >
              <Text style={[styles.aptTabText, selectedApt === apt.apartment_id && styles.aptTabTextActive]}>
                {apt.building ? apt.building[0] : ''}{apt.unit_number}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!selectedApt ? (
        <View style={styles.emptyState}>
          <Ionicons name="key-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No apartment selected</Text>
        </View>
      ) : (
        <>
          <View style={styles.actionButtons}>
            <Button
              title="Generate PIN"
              onPress={() => setShowPinModal(true)}
              icon={<Ionicons name="key" size={18} color={Colors.white} />}
              style={{ flex: 1 }}
            />
            <Button
              title="Schedule Arrival"
              onPress={() => setShowArrivalModal(true)}
              variant="secondary"
              icon={<Ionicons name="calendar" size={18} color={Colors.text} />}
              style={{ flex: 1 }}
            />
          </View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.hintText}>
            Generate a one-time PIN for visitors, or pre-register an expected arrival so security is notified.
          </Text>
        </>
      )}

      {/* Modals */}
      <VisitorPinModal
        visible={showPinModal}
        apartmentId={selectedApt || 0}
        onClose={() => setShowPinModal(false)}
      />
      <ExpectedArrivalModal
        visible={showArrivalModal}
        apartmentId={selectedApt || 0}
        onClose={() => setShowArrivalModal(false)}
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  aptTabs: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    opacity: 0.8,
  },
});
