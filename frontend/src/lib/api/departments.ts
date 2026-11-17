import type { Department, MasterDataQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface DepartmentInput {
  code: string;
  name: string;
}

export const departmentsApi = {
  list: (query: MasterDataQuery = {}) => api.get<Paginated<Department>>('/departments', { query }),
  get: (id: string) => api.get<Department>(`/departments/${id}`),
  create: (input: DepartmentInput) => api.post<Department>('/departments', input),
  update: (id: string, input: Partial<DepartmentInput>) =>
    api.patch<Department>(`/departments/${id}`, input),
  deactivate: (id: string) => api.post<Department>(`/departments/${id}/deactivate`),
  activate: (id: string) => api.post<Department>(`/departments/${id}/activate`),
};
