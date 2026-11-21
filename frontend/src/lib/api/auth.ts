import type { AuthUser, LoginResponse } from '@/types/api';
import { api, apiUpload, refreshSession } from './client';

export const authApi = {
  /** `identifier` is an email or a username. */
  login: (identifier: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { identifier, password }),
  /** Deduplicated; resolves null when no session exists. */
  refresh: () => refreshSession(),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
  /** Own display name only; username and email stay with Super Admin. */
  updateMe: (fullName: string) => api.patch<AuthUser>('/auth/me', { fullName }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<AuthUser>('/auth/me/avatar', form);
  },
  removeAvatar: () => api.delete<AuthUser>('/auth/me/avatar'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<void>('/auth/change-password', { currentPassword, newPassword }),
};
