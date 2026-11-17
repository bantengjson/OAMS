import type { Category, MasterDataQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface CategoryInput {
  code: string;
  name: string;
  description?: string | null;
}

export const categoriesApi = {
  list: (query: MasterDataQuery = {}) => api.get<Paginated<Category>>('/categories', { query }),
  get: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (input: CategoryInput) => api.post<Category>('/categories', input),
  update: (id: string, input: Partial<CategoryInput>) =>
    api.patch<Category>(`/categories/${id}`, input),
  deactivate: (id: string) => api.post<Category>(`/categories/${id}/deactivate`),
  activate: (id: string) => api.post<Category>(`/categories/${id}/activate`),
};
