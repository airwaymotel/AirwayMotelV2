'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, Permission } from '@/lib/auth-types';

const TOKEN_KEY = 'airway_session_token';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  isSuperAdmin: boolean;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: async () => {},
  hasPermission: () => false,
  isSuperAdmin: false,
  getToken: () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

// Helper: authenticated fetch (tab-isolated via sessionStorage)
export function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount + poll every 5s for real-time permission sync
  useEffect(() => {
    const checkSession = async () => {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    const interval = setInterval(checkSession, 5000);
    const handleFocus = () => checkSession();
    window.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || 'Login failed' };
      }

      sessionStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return {};
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(TOKEN_KEY);
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission: Permission) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.permissions.includes(permission);
  }, [user]);

  const getToken = useCallback(() => {
    return sessionStorage.getItem(TOKEN_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        isSuperAdmin: user?.role === 'super_admin',
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
