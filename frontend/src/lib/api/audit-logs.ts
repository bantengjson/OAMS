import type { AuditLog, PageQuery, Paginated } from '@/types/api';
import { api } from './client';

export interface AuditLogQuery extends PageQuery {
  actorId?: string;
  module?: string;
  action?: string;
  entityId?: string;
  from?: string;
  to?: string;
}

export const auditLogsApi = {
  list: (query: AuditLogQuery = {}) => api.get<Paginated<AuditLog>>('/audit-logs', { query }),
};
