import type { Employee, EmployeeDetail, EmployeeLookup, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface EmployeeQuery extends PageQuery {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface EmployeeInput {
  fullName: string;
  employeeNumber?: string | null;
  departmentId?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
}

export const employeesApi = {
  list: (query: EmployeeQuery = {}) => api.get<Paginated<Employee>>('/employees', { query }),
  /** Active employees for pickers; available to every staff member. */
  lookup: (search?: string) => api.get<EmployeeLookup[]>('/employees/lookup', { query: { search } }),
  get: (id: string) => api.get<EmployeeDetail>(`/employees/${id}`),
  create: (input: EmployeeInput) => api.post<Employee>('/employees', input),
  update: (id: string, input: Partial<EmployeeInput> & { isActive?: boolean }) =>
    api.patch<Employee>(`/employees/${id}`, input),
};
