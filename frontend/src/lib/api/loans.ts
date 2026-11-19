import type { AssetCondition, BorrowerType, Loan, LoanState, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface LoanQuery extends PageQuery {
  state?: LoanState;
  assetId?: string;
  borrowerEmployeeId?: string;
  search?: string;
}

export interface LoanInput {
  assetId: string;
  borrowerType: BorrowerType;
  borrowerEmployeeId?: string | null;
  borrowerName?: string | null;
  borrowerDepartmentId?: string | null;
  borrowerContact?: string | null;
  guarantorEmployeeId?: string | null;
  purpose?: string | null;
  loanedAt: string;
  dueAt: string;
}

export interface LoanUpdateInput {
  dueAt?: string;
  purpose?: string | null;
  borrowerContact?: string | null;
}

export interface ReturnLoanInput {
  returnedAt?: string | null;
  condition?: AssetCondition | null;
  notes?: string | null;
}

export const loansApi = {
  list: (query: LoanQuery = {}) => api.get<Paginated<Loan>>('/loans', { query }),
  get: (id: string) => api.get<Loan>(`/loans/${id}`),
  create: (input: LoanInput) => api.post<Loan>('/loans', input),
  update: (id: string, input: LoanUpdateInput) => api.patch<Loan>(`/loans/${id}`, input),
  return: (id: string, input: ReturnLoanInput) => api.post<Loan>(`/loans/${id}/return`, input),
};
