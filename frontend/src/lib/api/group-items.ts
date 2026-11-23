import type { AssetHistoryEntry, GroupItem, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface GroupItemQuery extends PageQuery {
  search?: string;
  locationId?: string;
  categoryId?: string;
  includeArchived?: boolean;
}

export interface GroupItemInput {
  categoryId: string;
  locationId: string;
  name: string;
  acquisitionYear: number;
  specification?: string | null;
  source?: string | null;
  notes?: string | null;
  qtyGood: number;
  qtyNeedsRepair: number;
  qtyDamaged: number;
}

export type GroupItemUpdate = Partial<Omit<GroupItemInput, 'categoryId'>> & { reason: string };

export const groupItemsApi = {
  list: (query: GroupItemQuery = {}) => api.get<Paginated<GroupItem>>('/group-items', { query }),
  create: (input: GroupItemInput) => api.post<GroupItem>('/group-items', input),
  update: (id: string, input: GroupItemUpdate) => api.patch<GroupItem>(`/group-items/${id}`, input),
  archive: (id: string, reason: string) => api.post<GroupItem>(`/group-items/${id}/archive`, { reason }),
  history: (id: string, query: PageQuery = {}) => api.get<Paginated<AssetHistoryEntry>>(`/group-items/${id}/history`, { query }),
};
