import type { AuthUser, LoginResponse } from '@/types/api';
import { api, refreshSession } from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  /** Deduplicated; resolves null when no session exists. */
  refresh: () => refreshSession(),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<void>('/auth/change-password', { currentPassword, newPassword }),
};
