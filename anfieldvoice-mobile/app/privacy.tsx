// ============================================================================
// AnfieldVoice — Privacy Policy Screen
// ============================================================================

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Privacy Policy', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />

      <View style={styles.header}>
        <Text style={styles.badge}>PRIVACY POLICY</Text>
        <Text style={styles.title}>AnfieldVoice Privacy Policy</Text>
        <Text style={styles.date}>Last updated: July 2026</Text>
      </View>

      <Section title="1. Information We Collect">
        <Text style={styles.body}>
          We collect only the information necessary for estate management: your name, email address, phone number, apartment unit, role assignments, and administrative activity logs.
        </Text>
        <Text style={styles.body}>
          We do not collect location data, device identifiers, photos, or contacts from your device.
        </Text>
      </Section>

      <Section title="2. How We Use Your Information">
        <Bullet text="Authenticate you and grant appropriate access to estate features" />
        <Bullet text="Enable resident communications (gate calls, visitor management)" />
        <Bullet text="Maintain an immutable audit trail for estate security and compliance" />
        <Bullet text="Facilitate tenant management by property administrators" />
      </Section>

      <Section title="3. Data Sharing">
        <Text style={styles.body}>
          We do not sell your personal data. Your information is shared only within your estate with appropriate role-based access controls.
        </Text>
      </Section>

      <Section title="4. Your Rights (POPIA)">
        <Text style={styles.body}>
          Under South Africa&apos;s Protection of Personal Information Act, you have the right to access, correct, and delete your personal data. You can delete your account at any time from the Profile screen.
        </Text>
      </Section>

      <Section title="5. Account Deletion">
        <Text style={styles.body}>
          When you delete your account, your name, email, and phone number are permanently anonymized. Your password is invalidated, you are removed from all apartment rosters, and your property administrator assignments are revoked. Audit trail references are retained with anonymized identifiers for estate compliance.
        </Text>
      </Section>

      <Section title="6. Security">
        <Bullet text="Encrypted passwords (bcrypt)" />
        <Bullet text="JWT-based session tokens stored securely on your device" />
        <Bullet text="Immutable audit logs that cannot be altered" />
        <Bullet text="Role-based access controls enforcing least-privilege principles" />
      </Section>

      <Section title="7. Open Source">
        <Text style={styles.body}>
          AnfieldVoice is built on open-source software: FastAPI, React Native, Expo, PostgreSQL, and others under MIT, Apache 2.0, and BSD licenses. Full license texts are available on request.
        </Text>
      </Section>

      <Section title="8. Contact">
        <Bullet text="Red Cape Technologies (Pty) Ltd — Reg 2022/762895/07" />
        <Bullet text="Email: privacy@redcapetech.co.za" />
        <Bullet text="Director: Russell Miller — 083 700 0441" />
      </Section>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        <Text style={styles.backText}>Back to Profile</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
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
    paddingVertical: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  badge: {
    color: Colors.primaryLight,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  date: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
    marginRight: Spacing.md,
    opacity: 0.6,
  },
  bulletText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  backText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
