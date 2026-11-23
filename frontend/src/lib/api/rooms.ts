import type { Room } from '@/types/api';
import { api } from './client';

export const roomsApi = {
  list: (query: { isActive?: boolean } = {}) => api.get<Room[]>('/rooms', { query }),
  create: (name: string) => api.post<Room>('/rooms', { name }),
  rename: (id: string, name: string) => api.patch<Room>(`/rooms/${id}`, { name }),
  deactivate: (id: string) => api.post<Room>(`/rooms/${id}/deactivate`),
  activate: (id: string) => api.post<Room>(`/rooms/${id}/activate`),
};

/** The "DPC" part of asset codes. */
export const assetCodeOrgApi = {
  get: () => api.get<{ value: string }>('/settings/asset-code-org'),
  set: (value: string) => api.put<{ value: string }>('/settings/asset-code-org', { value }),
};
