/** Mirrors of the backend DTOs (backend/src/modules/**). Keep in step by hand. */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  departmentId: string | null;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface MasterDataQuery extends PageQuery {
  search?: string;
  isActive?: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LocationType = 'OFFICE' | 'BUILDING' | 'FLOOR' | 'ROOM';

export const LOCATION_TYPES: readonly LocationType[] = ['OFFICE', 'BUILDING', 'FLOOR', 'ROOM'];

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  OFFICE: 'Kantor',
  BUILDING: 'Gedung',
  FLOOR: 'Lantai',
  ROOM: 'Ruangan',
};

export interface LocationParent {
  id: string;
  code: string;
  name: string;
  type: LocationType;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  description: string | null;
  isActive: boolean;
  parent: LocationParent | null;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationTreeNode {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  isActive: boolean;
  children: LocationTreeNode[];
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionGroup {
  module: string;
  permissions: { code: string; description: string }[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  department: { id: string; code: string; name: string } | null;
  roles: { code: string; name: string }[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actor: { id: string; fullName: string; email: string } | null;
  action: string;
  module: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_INVENTARIS: 'Admin Inventaris',
  PETUGAS_INVENTARIS: 'Petugas Inventaris',
  VIEWER: 'Viewer',
};
