import type { PermissionGroup, Role } from '@/types/api';
import { api } from './client';

export const rolesApi = {
  list: () => api.get<Role[]>('/roles'),
  get: (id: string) => api.get<Role>(`/roles/${id}`),
  permissions: () => api.get<PermissionGroup[]>('/permissions'),
  setPermissions: (id: string, permissions: string[]) =>
    api.put<Role>(`/roles/${id}/permissions`, { permissions }),
};
