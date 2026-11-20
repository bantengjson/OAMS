import type { Disposal, DisposalReason, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface DisposalQuery extends PageQuery {
  reason?: DisposalReason;
  search?: string;
  includeReverted?: boolean;
}

export interface DisposalInput {
  assetId: string;
  reason: DisposalReason;
  disposedAt: string;
  description: string;
  value?: number | null;
  recipient?: string | null;
}

export const disposalsApi = {
  list: (query: DisposalQuery = {}) => api.get<Paginated<Disposal>>('/disposals', { query }),
  get: (id: string) => api.get<Disposal>(`/disposals/${id}`),
  create: (input: DisposalInput) => api.post<Disposal>('/disposals', input),
  revert: (id: string, reason: string) => api.post<Disposal>(`/disposals/${id}/revert`, { reason }),
};
