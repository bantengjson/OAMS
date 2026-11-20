import type { AssetCondition, MaintenanceRecord, MaintenanceStatus, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface MaintenanceQuery extends PageQuery {
  status?: MaintenanceStatus;
  assetId?: string;
  search?: string;
}

export interface CompleteMaintenanceInput {
  completedAt?: string | null;
  cost?: number | null;
  technicianNotes?: string | null;
  resultCondition?: AssetCondition | null;
}

export const maintenanceApi = {
  list: (query: MaintenanceQuery = {}) => api.get<Paginated<MaintenanceRecord>>('/maintenance', { query }),
  get: (id: string) => api.get<MaintenanceRecord>(`/maintenance/${id}`),
  report: (assetId: string, description: string) =>
    api.post<MaintenanceRecord>('/maintenance', { assetId, description }),
  start: (id: string, input: { technician?: string | null; startedAt?: string | null } = {}) =>
    api.post<MaintenanceRecord>(`/maintenance/${id}/start`, input),
  complete: (id: string, input: CompleteMaintenanceInput) =>
    api.post<MaintenanceRecord>(`/maintenance/${id}/complete`, input),
  cancel: (id: string, reason: string) => api.post<MaintenanceRecord>(`/maintenance/${id}/cancel`, { reason }),
};
