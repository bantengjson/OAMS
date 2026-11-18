import type { AuditLog, PageQuery, Paginated, User } from '@/types/api';
import { api } from './client';

export interface UserQuery extends PageQuery {
  search?: string;
  isActive?: boolean;
  roleCode?: string;
}

export interface CreateUserInput {
  email: string;
  username?: string | null;
  fullName: string;
  password: string;
  roleCodes: string[];
  departmentId?: string | null;
  phone?: string | null;
}

export interface UpdateUserInput {
  username?: string | null;
  fullName?: string;
  phone?: string | null;
  departmentId?: string | null;
}

export const usersApi = {
  list: (query: UserQuery = {}) => api.get<Paginated<User>>('/users', { query }),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (input: CreateUserInput) => api.post<User>('/users', input),
  update: (id: string, input: UpdateUserInput) => api.patch<User>(`/users/${id}`, input),
  deactivate: (id: string) => api.post<User>(`/users/${id}/deactivate`),
  activate: (id: string) => api.post<User>(`/users/${id}/activate`),
  resetPassword: (id: string, newPassword: string) =>
    api.post<void>(`/users/${id}/reset-password`, { newPassword }),
  setRoles: (id: string, roleCodes: string[]) => api.put<User>(`/users/${id}/roles`, { roleCodes }),
  activity: (id: string, query: PageQuery = {}) =>
    api.get<Paginated<AuditLog>>(`/users/${id}/activity`, { query }),
};
