// ============================================================================
// AnfieldVoice — Profile Screen
// User info, roles, settings, account deletion
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { RoleBadge } from '../../src/components/RoleBadge';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/api/client';

export default function ProfileScreen() {
  const { user, roles, logout } = useAuth();
  const router = useRouter();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Type DELETE to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    const result = await api.deleteMyAccount(
      deleteReason.trim() || undefined,
    );
    setIsDeleting(false);

    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }

    Alert.alert(
      'Account Deleted',
      result.data?.message || 'Your account has been deleted.',
      [
        {
          text: 'OK',
          onPress: () => {
            setDeleteModalVisible(false);
            setDeleteConfirmText('');
            setDeleteReason('');
            logout();
          },
        },
      ],
    );
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user.full_name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {user.phone && <Text style={styles.phone}>{user.phone}</Text>}
      </View>

      {/* Roles */}
      <Text style={styles.sectionTitle}>Your Roles</Text>
      <Card style={styles.rolesCard}>
        <View style={styles.rolesList}>
          {roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </View>
      </Card>

      {/* Account Info */}
      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon="person-outline" label="User ID" value={`#${user.user_id}`} />
        <InfoRow icon="calendar-outline" label="Member Since" value={new Date(user.created_at).toLocaleDateString()} />
        <InfoRow icon="checkmark-circle" label="Status" value={user.is_active ? 'Active' : 'Inactive'} valueColor={user.is_active ? Colors.success : Colors.error} />
      </Card>

      {/* App Info */}
      <Text style={styles.sectionTitle}>About</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon="information-circle" label="Version" value="1.0.0" />
        <InfoRow icon="shield-outline" label="Provider" value="Red Cape Technologies" />
        <InfoRow icon="code-slash" label="Open Source" value="Licensed under MIT" />
      </Card>

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setDeleteModalVisible(true)}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.error} />
        <Text style={styles.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.push('/privacy')}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.footerText}>
          AnfieldVoice v1.0.0 — Red Cape Technologies (Pty) Ltd
        </Text>
      </View>

      <View style={{ height: 60 }} />

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="warning" size={40} color={Colors.error} style={{ marginBottom: Spacing.lg }} />

            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalBody}>
              This will permanently anonymize your personal data. You will lose access
              to all apartments and properties. This action cannot be undone.
            </Text>

            <Text style={styles.modalLabel}>
              Reason (optional)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tell us why you're leaving..."
              placeholderTextColor={Colors.textSecondary}
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.modalLabel}>
              Type <Text style={{ fontWeight: '800', color: Colors.error }}>DELETE</Text> to confirm
            </Text>
            <TextInput
              style={[styles.modalInput, deleteConfirmText === 'DELETE' && { borderColor: Colors.error }]}
              placeholder="Type DELETE"
              placeholderTextColor={Colors.textSecondary}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteConfirmText('');
                  setDeleteReason('');
                }}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  (deleteConfirmText !== 'DELETE' || isDeleting) && { opacity: 0.5 },
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Permanently Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  email: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  phone: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
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
  rolesCard: {
    marginBottom: Spacing.sm,
  },
  rolesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoCard: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginLeft: Spacing.md,
    flex: 1,
  },
  infoValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  logoutBtn: {
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  deleteBtnText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    gap: Spacing.xs,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    opacity: 0.6,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  modalBody: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  modalLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  modalInput: {
    width: '100%',
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    minHeight: 44,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  modalDeleteBtn: {
    flex: 1.5,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  modalDeleteText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
