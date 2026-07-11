// ============================================================================
// AnfieldVoice — Push Notification Registration Hook (Slice 6)
// Registers Expo push token on app launch, handles incoming notifications
// ============================================================================

import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerPushToken } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

// Configure how notifications are shown when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || registeredRef.current) return;

    const setup = async () => {
      try {
        // Check if device supports push (not simulator or web)
        const isDevice = Device.isDevice;
        if (!isDevice) {
          console.log('[Push] Simulator detected, skipping push registration');
          return;
        }

        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }

        // Get Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: undefined, // auto-detect from app.json
        });

        const token = tokenData.data;
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';

        // Register with backend
        const result = await registerPushToken(platform, token);
        if (result.data) {
          console.log('[Push] Token registered:', result.data.token_id);
          registeredRef.current = true;
        }

        // Android: set notification channel
        if (Platform.OS === 'android') {
          Notifications.setNotificationChannelAsync('gate-calls', {
            name: 'Gate Calls',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 500, 300, 500],
            lightColor: '#2563EB',
          });
          Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
      } catch (err) {
        console.warn('[Push] Setup error:', err);
      }
    };

    setup();
  }, [isAuthenticated, user]);

  // Handle notification taps (e.g., navigate to gate screen)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'incoming_call' && data?.call_id) {
        // Router navigation would go here when we set up deep linking
        console.log('[Push] Notification tapped: incoming_call', data.call_id);
      }
    });

    return () => sub.remove();
  }, []);
}
