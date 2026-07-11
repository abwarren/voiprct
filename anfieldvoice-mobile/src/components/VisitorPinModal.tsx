// ============================================================================
// AnfieldVoice — Visitor PIN Generator Modal (Slice 3)
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
  ScrollView,
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

export default function VisitorPinModal({ visible, apartmentId, onClose }: Props) {
  const [visitorName, setVisitorName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expiresIn, setExpiresIn] = useState('24');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pin_code: string; expires_at: string } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.createVisitorPin(
        apartmentId,
        visitorName || undefined,
        purpose || undefined,
        parseInt(expiresIn, 10) || 24,
      );
      if (res.data) setResult(res.data);
      else Alert.alert('Error', res.error || 'Failed to generate PIN');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
    setLoading(false);
  };

  const handleDone = () => {
    setResult(null);
    setVisitorName('');
    setPurpose('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Visitor PIN</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {result ? (
            <View style={styles.resultArea}>
              <View style={styles.pinDisplay}>
                <Text style={styles.pinLabel}>Your PIN</Text>
                <Text style={styles.pinCode}>{result.pin_code}</Text>
                <Text style={styles.pinExpiry}>
                  Expires {new Date(result.expires_at).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.shareHint}>
                Share this PIN with your visitor. Security will verify it at the gate.
              </Text>
              <Button title="Done" onPress={handleDone} />
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.label}>Visitor Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor={Colors.textSecondary}
                value={visitorName}
                onChangeText={setVisitorName}
              />

              <Text style={styles.label}>Purpose (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Delivery, Guest"
                placeholderTextColor={Colors.textSecondary}
                value={purpose}
                onChangeText={setPurpose}
              />

              <Text style={styles.label}>Expires In (hours)</Text>
              <TextInput
                style={styles.input}
                placeholder="24"
                placeholderTextColor={Colors.textSecondary}
                value={expiresIn}
                onChangeText={setExpiresIn}
                keyboardType="number-pad"
              />

              <Button
                title={loading ? 'Generating...' : 'Generate PIN'}
                onPress={handleGenerate}
                disabled={loading}
                style={{ marginTop: Spacing.lg }}
              />
            </ScrollView>
          )}
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
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    width: '100%', maxWidth: 400,
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
  resultArea: { alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  pinDisplay: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.lg,
    padding: Spacing.xxl, alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: Colors.border,
  },
  pinLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  pinCode: {
    color: Colors.success, fontSize: 42, fontWeight: '800',
    letterSpacing: 6, marginVertical: Spacing.sm,
  },
  pinExpiry: { color: Colors.textSecondary, fontSize: FontSize.sm },
  shareHint: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
});
