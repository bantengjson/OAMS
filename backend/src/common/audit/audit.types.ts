export interface AuditEntry {
  /** e.g. `user.created`, `auth.login`, `location.deactivated` */
  action: string;
  /** e.g. `users`, `auth`, `locations` */
  module: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Explicit override; otherwise taken from the request context. */
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  actorId?: string;
  module?: string;
  action?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  /** Modules hidden from the caller (operational scope). */
  excludeModules?: string[];
  /** Restrict to these modules (e.g. an asset's own history). */
  modules?: string[];
}

export interface AuditActorDto {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditLogDto {
  id: string;
  actor: AuditActorDto | null;
  action: string;
  module: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Audit row without client metadata, for callers that are not audit-log viewers. */
export type AuditEntryPublicDto = Omit<AuditLogDto, 'ip' | 'userAgent'>;

/** Modules only Super Admin (audit_logs.view_all) may read. */
export const RESTRICTED_AUDIT_MODULES: readonly string[] = ['auth', 'users', 'roles', 'settings'];
