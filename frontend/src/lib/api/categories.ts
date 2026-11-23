import type { Category, Golongan, MasterDataQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface CategoryInput {
  golongan: Golongan;
  /** Empty = next free number in the golongan. */
  number?: number;
  name: string;
  isGroup?: boolean;
  description?: string | null;
}

export interface CategoryQuery extends MasterDataQuery {
  golongan?: Golongan;
  isGroup?: boolean;
}

export const categoriesApi = {
  list: (query: CategoryQuery = {}) => api.get<Paginated<Category>>('/categories', { query }),
  get: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (input: CategoryInput) => api.post<Category>('/categories', input),
  update: (id: string, input: Partial<CategoryInput>) => api.patch<Category>(`/categories/${id}`, input),
  deactivate: (id: string) => api.post<Category>(`/categories/${id}/deactivate`),
  activate: (id: string) => api.post<Category>(`/categories/${id}/activate`),
};
