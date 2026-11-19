import type { Mutation, MutationStatus, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface MutationQuery extends PageQuery {
  status?: MutationStatus;
  assetId?: string;
  requestedById?: string;
  search?: string;
}

export interface MutationInput {
  assetId: string;
  toLocationId?: string | null;
  changesResponsible?: boolean;
  toResponsibleEmployeeId?: string | null;
  reason: string;
}

export const mutationsApi = {
  list: (query: MutationQuery = {}) => api.get<Paginated<Mutation>>('/mutations', { query }),
  get: (id: string) => api.get<Mutation>(`/mutations/${id}`),
  /** Approvers' own requests come back already APPROVED. */
  create: (input: MutationInput) => api.post<Mutation>('/mutations', input),
  approve: (id: string, note?: string) => api.post<Mutation>(`/mutations/${id}/approve`, note ? { note } : {}),
  reject: (id: string, note: string) => api.post<Mutation>(`/mutations/${id}/reject`, { note }),
  cancel: (id: string) => api.post<Mutation>(`/mutations/${id}/cancel`),
};
