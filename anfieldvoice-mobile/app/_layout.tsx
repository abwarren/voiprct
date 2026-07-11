// ============================================================================
// AnfieldVoice — Root Layout
// Handles auth state: shows login or redirects to tabs
// ============================================================================

import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { Colors } from '../src/theme';

function PushInit() {
  usePushNotifications();
  return null;
}

function RootLayoutNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      {isAuthenticated && <PushInit />}
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        )}
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});
