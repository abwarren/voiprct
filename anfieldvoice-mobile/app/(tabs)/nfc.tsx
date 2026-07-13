// ============================================================================
// AnfieldVoice — NFC Phone-as-Tag Screen (Slice 9)
// ============================================================================
// Android: Host Card Emulation (HCE) — phone acts as NFC tag
// iOS: QR code fallback banner (Apple does not allow HCE)
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  getNfcCredentials,
  activatePhoneNfc,
  deactivatePhoneNfc,
  getNfcAccessLog,
} from '../../src/api/client';

export default function NfcScreen() {
  const { user, getToken } = useAuth();
  const [credentials, setCredentials] = useState<any[]>([]);
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const creds = await getNfcCredentials();
      setCredentials(Array.isArray(creds) ? creds : []);
      const log = await getNfcAccessLog(undefined, 20);
      setAccessLog(Array.isArray(log) ? log : []);
    } catch (e) {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activePhone = credentials.find(
    (c: any) => c.credential_type === 'phone' && c.is_active
  );
  const activeTag = credentials.find(
    (c: any) => c.credential_type === 'tag' && c.is_active
  );

  const handleToggle = async () => {
    setActivating(true);
    try {
      if (activePhone) {
        await deactivatePhoneNfc(activePhone.apartment_id);
        Alert.alert('Deactivated', 'Phone NFC has been turned off. Your physical tag is now active.');
      } else {
        const aptId = user?.apartments?.[0]?.apartment_id;
        if (!aptId) {
          Alert.alert('Error', 'No apartment found. Please contact your property admin.');
          return;
        }
        await activatePhoneNfc(aptId);
        Alert.alert('Activated', 'Phone NFC is now active! Hold your phone near the gate reader to enter.');
      }
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00D68F" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D68F" />}
    >
      {/* iOS Fallback Banner */}
      {Platform.OS === 'ios' && (
        <View style={styles.iosBanner}>
          <Text style={styles.iosBannerIcon}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.iosBannerTitle}>iPhone NFC Limited</Text>
            <Text style={styles.iosBannerText}>
              Apple does not support phone-as-tag mode. Use the QR code at the gate reader or your physical tag fob.
            </Text>
          </View>
        </View>
      )}

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>NFC Access</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Phone as Tag</Text>
          <View style={styles.statusValue}>
            <View
              style={[
                styles.dot,
                { backgroundColor: activePhone ? '#00D68F' : '#6B7280' },
              ]}
            />
            <Text style={styles.statusText}>
              {activePhone ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Physical Tag</Text>
          <View style={styles.statusValue}>
            <View
              style={[
                styles.dot,
                { backgroundColor: activeTag ? '#00D68F' : '#6B7280' },
              ]}
            />
            <Text style={styles.statusText}>
              {activeTag ? 'Active' : activePhone ? 'Deactivated' : 'Not registered'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, activePhone ? styles.btnDanger : styles.btnPrimary]}
          onPress={handleToggle}
          disabled={activating}
        >
          {activating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {activePhone ? 'Deactivate Phone NFC' : 'Activate Phone NFC'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Credential Details */}
      {activePhone && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phone Credential</Text>
          <Text style={styles.detailText}>
            Activated: {new Date(activePhone.activated_at).toLocaleDateString()}
          </Text>
          <Text style={styles.hintText}>
            Hold your phone near the gate reader to open the gate.
          </Text>
        </View>
      )}

      {activeTag && !activePhone && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Physical Tag Active</Text>
          <Text style={styles.detailText}>
            Tag UID: {activeTag.tag_uid?.substring(0, 8)}...
          </Text>
          <Text style={styles.hintText}>
            Tap your tag fob at the gate reader to enter.
          </Text>
        </View>
      )}

      {/* Access History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Access</Text>
        {accessLog.length === 0 ? (
          <Text style={styles.emptyText}>No recent access logs</Text>
        ) : (
          accessLog.slice(0, 10).map((entry: any, i: number) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logGate}>{entry.gate_unit}</Text>
              <Text style={[styles.logStatus, entry.granted ? styles.granted : styles.denied]}>
                {entry.granted ? '✅ Granted' : '❌ Denied'}
              </Text>
              <Text style={styles.logTime}>
                {new Date(entry.created_at).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          💡 Your physical tag remains a backup even when phone NFC is active.
          Keep it handy in case your phone battery runs out.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F1A' },
  card: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusLabel: { color: '#9CA3AF', fontSize: 15 },
  statusValue: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggleBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  btnPrimary: { backgroundColor: '#00D68F' },
  btnDanger: { backgroundColor: '#EF4444' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  detailText: { color: '#9CA3AF', fontSize: 14, marginBottom: 4 },
  hintText: { color: '#6B7280', fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  emptyText: { color: '#6B7280', textAlign: 'center', padding: 16 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2A2A3E' },
  logGate: { color: '#fff', fontSize: 14, flex: 1 },
  logStatus: { fontSize: 13, marginHorizontal: 8 },
  granted: { color: '#00D68F' },
  denied: { color: '#EF4444' },
  logTime: { color: '#6B7280', fontSize: 12 },
  noteCard: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: 24, borderLeftWidth: 3, borderLeftColor: '#00D68F' },
  noteText: { color: '#9CA3AF', fontSize: 14, lineHeight: 20 },
  iosBanner: { backgroundColor: '#1E3A5F', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  iosBannerIcon: { fontSize: 24, marginRight: 12 },
  iosBannerTitle: { color: '#60A5FA', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  iosBannerText: { color: '#93C5FD', fontSize: 12, lineHeight: 16 },
});
