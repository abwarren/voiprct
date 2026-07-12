// ============================================================================
// AnfieldVoice — Directory Screen (Slice 7)
// Search for neighbours by exact unit number only.
// You must know the unit to find them — no browseable list.
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import * as api from '../../src/api/client';

export default function DirectoryScreen() {
  const [unit, setUnit] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    apartment?: { building?: string; unit_number: string; apartment_id: number };
    residents: Array<{ full_name: string; user_id: number; is_primary: boolean }>;
  } | null>(null);

  const handleSearch = async () => {
    if (!unit.trim()) { Alert.alert('Error', 'Enter a unit number'); return; }
    setSearching(true);
    try {
      const res = await api.directorySearch(unit.trim());
      if (res.data) setResult(res.data);
    } catch (err) {
      Alert.alert('Error', String(err));
    }
    setSearching(false);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Find a Neighbour</Text>
        <Text style={styles.subtitle}>
          Enter the exact unit number to find a resident you already know.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. 12 or A5"
          placeholderTextColor={Colors.textSecondary}
          value={unit}
          onChangeText={(t) => { setUnit(t); setResult(null); }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          <Ionicons name="search" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {searching && (
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {result && !searching && (
        <View style={styles.resultArea}>
          {result.found && result.apartment ? (
            <Card style={styles.resultCard}>
              <View style={styles.aptBadge}>
                <Ionicons name="business" size={20} color={Colors.primary} />
                <Text style={styles.aptName}>
                  {result.apartment.building ? `${result.apartment.building} ` : ''}{result.apartment.unit_number}
                </Text>
              </View>

              <Text style={styles.residentsTitle}>
                Residents ({result.residents.length})
              </Text>

              {result.residents.length === 0 ? (
                <Text style={styles.emptyText}>No active residents</Text>
              ) : (
                result.residents.map((r) => (
                  <View key={r.user_id} style={styles.residentRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {r.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.residentName}>
                        {r.full_name} {r.is_primary ? '⭐' : ''}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          ) : (
            <Card style={styles.resultCard}>
              <View style={styles.notFound}>
                <Ionicons name="search-outline" size={40} color={Colors.textSecondary} />
                <Text style={styles.notFoundText}>No unit found</Text>
                <Text style={styles.notFoundSubtext}>
                  "{unit}" doesn't match any active unit. Check the number and try again.
                </Text>
              </View>
            </Card>
          )}
        </View>
      )}

      {!result && !searching && (
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.hintText}>
            Only shows residents who are active in their apartment. Contact requires a pre-existing relationship — you need to know their unit number to look them up.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.lg },
  header: { paddingVertical: Spacing.xl },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs, lineHeight: 20 },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  input: {
    flex: 1, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.lg, color: Colors.text, fontSize: FontSize.lg,
    fontWeight: '600', letterSpacing: 2,
  },
  searchBtn: {
    width: 50, height: 50, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  loadingState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },
  resultArea: { marginBottom: Spacing.lg },
  resultCard: { marginBottom: Spacing.md },
  aptBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  aptName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  residentsTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  residentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  residentName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  notFound: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  notFoundText: { color: Colors.textSecondary, fontSize: FontSize.lg, fontWeight: '600' },
  notFoundSubtext: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  hint: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.lg, alignItems: 'flex-start' },
  hintText: { color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
});
