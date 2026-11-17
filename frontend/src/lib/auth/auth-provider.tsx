'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/lib/api/auth';
import { setAccessToken, setUnauthorizedHandler } from '@/lib/api/client';
import type { AuthUser } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  hasPermission(code: string): boolean;
  hasAnyPermission(codes: readonly string[]): boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface State {
  status: AuthStatus;
  user: AuthUser | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null });

  // Silent session restore: the refresh cookie decides whether we are logged in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await authApi.refresh();
      if (cancelled) return;
      if (session) setState({ status: 'authenticated', user: session.user });
      else setState({ status: 'anonymous', user: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: 'anonymous', user: null }));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    setAccessToken(session.accessToken);
    setState({ status: 'authenticated', user: session.user });
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // the cookie may already be gone; local state is what matters here
    } finally {
      setAccessToken(null);
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const held = new Set(state.user?.permissions ?? []);
    return {
      status: state.status,
      user: state.user,
      login,
      logout,
      hasPermission: (code) => held.has(code),
      hasAnyPermission: (codes) => codes.length === 0 || codes.some((c) => held.has(c)),
    };
  }, [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
