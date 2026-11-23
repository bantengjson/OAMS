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
  /** Every page (the office list has more than one page of types). */
  listAll: async (query: Omit<CategoryQuery, 'page' | 'pageSize'> = {}): Promise<Category[]> => {
    const out: Category[] = [];
    for (let page = 1; ; page += 1) {
      const res = await api.get<Paginated<Category>>('/categories', { query: { ...query, page, pageSize: 100 } });
      out.push(...res.data);
      if (page >= res.meta.totalPages) return out;
    }
  },
  get: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (input: CategoryInput) => api.post<Category>('/categories', input),
  update: (id: string, input: Partial<CategoryInput>) => api.patch<Category>(`/categories/${id}`, input),
  deactivate: (id: string) => api.post<Category>(`/categories/${id}/deactivate`),
  activate: (id: string) => api.post<Category>(`/categories/${id}/activate`),
};
