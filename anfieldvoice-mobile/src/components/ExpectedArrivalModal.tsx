// ============================================================================
// AnfieldVoice — Expected Arrival Modal (Slice 3)
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Button } from './Button';
import * as api from '../api/client';

interface Props {
  visible: boolean;
  apartmentId: number;
  onClose: () => void;
}

export default function ExpectedArrivalModal({ visible, apartmentId, onClose }: Props) {
  const [visitorName, setVisitorName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [expectedTime, setExpectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!visitorName.trim()) { Alert.alert('Error', 'Visitor name is required'); return; }
    if (!expectedDate || !expectedTime) { Alert.alert('Error', 'Expected date and time are required'); return; }

    setLoading(true);
    try {
      const isoDate = `${expectedDate}T${expectedTime}:00`;
      const res = await api.createExpectedArrival(
        apartmentId, visitorName.trim(), isoDate,
        vehiclePlate.trim() || undefined, notes.trim() || undefined,
      );
      if (res.data) {
        Alert.alert('Success', `Arrival scheduled for ${visitorName}`);
        onClose();
      } else {
        Alert.alert('Error', res.error || 'Failed to schedule arrival');
      }
    } catch (err) {
      Alert.alert('Error', String(err));
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule Arrival</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Visitor Name *</Text>
          <TextInput style={styles.input} placeholder="John Doe"
            placeholderTextColor={Colors.textSecondary}
            value={visitorName} onChangeText={setVisitorName} />

          <Text style={styles.label}>Vehicle Plate</Text>
          <TextInput style={styles.input} placeholder="CA 123-456"
            placeholderTextColor={Colors.textSecondary}
            value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />

          <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} placeholder="2026-07-15"
            placeholderTextColor={Colors.textSecondary}
            value={expectedDate} onChangeText={setExpectedDate} />

          <Text style={styles.label}>Time * (HH:MM)</Text>
          <TextInput style={styles.input} placeholder="14:30"
            placeholderTextColor={Colors.textSecondary}
            value={expectedTime} onChangeText={setExpectedTime} />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { minHeight: 60 }]}
            placeholder="Anything security should know..."
            placeholderTextColor={Colors.textSecondary}
            value={notes} onChangeText={setNotes} multiline />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Button title={loading ? 'Scheduling...' : 'Schedule'} onPress={handleCreate} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xxl,
  },
  content: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.xl,
    padding: Spacing.xxl, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xl,
  },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  label: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md,
  },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxl },
  cancelBtn: {
    flex: 1, padding: Spacing.lg, borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated, alignItems: 'center',
  },
  cancelText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
});
