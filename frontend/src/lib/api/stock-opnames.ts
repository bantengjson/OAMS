import type {
  AssetCondition,
  OpnameItem,
  OpnameReport,
  OpnameResult,
  PageQuery,
  Paginated,
  ScanResult,
  StockOpname,
} from '@/types/api';
import { api } from './client';

export interface OpnameInput {
  name: string;
  plannedDate: string;
  notes?: string | null;
  officerIds?: string[];
}

export interface OpnameItemQuery extends PageQuery {
  result?: OpnameResult;
  search?: string;
}

export const stockOpnamesApi = {
  list: (query: PageQuery = {}) => api.get<Paginated<StockOpname>>('/stock-opnames', { query }),
  get: (id: string) => api.get<StockOpname>(`/stock-opnames/${id}`),
  create: (input: OpnameInput) => api.post<StockOpname>('/stock-opnames', input),
  items: (id: string, query: OpnameItemQuery = {}) =>
    api.get<Paginated<OpnameItem>>(`/stock-opnames/${id}/items`, { query: { pageSize: 2000, ...query } }),
  scan: (id: string, value: string) => api.post<ScanResult>(`/stock-opnames/${id}/scan`, { value }),
  confirm: (id: string, itemId: string, observedCondition: AssetCondition, note?: string | null) =>
    api.post<OpnameItem>(`/stock-opnames/${id}/items/${itemId}/confirm`, { observedCondition, note }),
  close: (id: string) => api.post<StockOpname>(`/stock-opnames/${id}/close`),
  cancel: (id: string) => api.post<StockOpname>(`/stock-opnames/${id}/cancel`),
  applyCondition: (id: string, itemId: string) =>
    api.post<OpnameItem>(`/stock-opnames/${id}/items/${itemId}/apply-condition`),
  report: (id: string) => api.get<OpnameReport>(`/stock-opnames/${id}/report`),
};
