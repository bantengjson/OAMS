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

/** Modules only Super Admin (audit_logs.view_all) may read. */
export const RESTRICTED_AUDIT_MODULES: readonly string[] = ['auth', 'users', 'roles', 'settings'];
