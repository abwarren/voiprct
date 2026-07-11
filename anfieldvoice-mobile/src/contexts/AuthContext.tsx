// ============================================================================
// AnfieldVoice — Auth Context
// Manages authentication state across the entire app
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as api from '../api/client';
import type { UserProfile, RoleName } from '../types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  roles: RoleName[];
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  roles: [],
  login: async () => null,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<RoleName[]>([]);

  const isAuthenticated = user !== null;

  const refreshProfile = useCallback(async () => {
    const result = await api.getMyProfile();
    if (result.data) {
      setUser(result.data);
      setRoles(result.data.roles.map(r => r.role_name));
    }
  }, []);

  // Check if user is already logged in on app start
  useEffect(() => {
    (async () => {
      try {
        const token = await api.getStoredToken();
        if (token) {
          await refreshProfile();
        }
      } catch {
        await api.clearStoredToken();
      } finally {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }
    })();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const result = await api.login(email, password);
    if (result.error) {
      return result.error;
    }
    await refreshProfile();
    return null;
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    setUser(null);
    setRoles([]);
    await api.clearStoredToken();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, user, roles, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
