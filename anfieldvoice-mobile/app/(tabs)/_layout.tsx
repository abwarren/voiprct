// ============================================================================
// AnfieldVoice — Tab Layout
// Role-based tab visibility
// ============================================================================

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors } from '../../src/theme';

export default function TabLayout() {
  const { roles } = useAuth();
  const isResident = roles.includes('resident');
  const isPropertyAdmin = roles.includes('property_admin');
  const isBodyCorp = roles.includes('body_corp_admin') || roles.includes('super_admin');

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
    >
      {/* Home — everyone sees this */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerTitle: 'AnfieldVoice',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* Gate — residents & security */}
      {(isResident || isPropertyAdmin) && (
        <Tabs.Screen
          name="gate"
          options={{
            title: 'Gate',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="call" size={size} color={color} />
            ),
            tabBarBadge: undefined,
          }}
        />
      )}

      {/* Residents — only property admins and body corp */}
      {(isPropertyAdmin || isBodyCorp) && (
        <Tabs.Screen
          name="residents"
          options={{
            title: 'Tenants',
            headerTitle: 'Tenant Management',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* Estate — only body corp / super admin */}
      {isBodyCorp && (
        <Tabs.Screen
          name="estate"
          options={{
            title: 'Estate',
            headerTitle: 'Estate Management',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* Profile — everyone sees this */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
