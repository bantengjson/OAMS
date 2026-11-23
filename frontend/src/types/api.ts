/** Mirrors of the backend DTOs (backend/src/modules/**). Keep in step by hand. */

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  departmentId: string | null;
  /** API path of the profile photo, or null (initials are shown). */
  avatarUrl: string | null;
  lastLoginAt: string | null;
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

export type Golongan = 'BG' | 'NG';

/** Item type ("Jenis Barang"), numbered per golongan; the API path stays /categories. */
export interface Category {
  id: string;
  /** e.g. NG-012 */
  code: string;
  golongan: Golongan;
  number: number;
  /** Counted goods (Barang Kelompok), no QR. */
  isGroup: boolean;
  name: string;
  /** e.g. "NG 012 · Kursi Merah" */
  label: string;
  description: string | null;
  isActive: boolean;
  /** Used by items: golongan, number and isGroup are locked. */
  inUse: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  /** Room letter, e.g. "A"; never changes. */
  code: string;
  name: string;
  isActive: boolean;
  inUse: boolean;
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
  username: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
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

/** Audit row as returned by GET /assets/:id/history: no client IP or device. */
export type AssetHistoryEntry = Omit<AuditLog, 'ip' | 'userAgent'>;

// ---------------------------------------------------------------- Tahap 2

export const OWNERSHIP_TYPES = ['OFFICE', 'THIRD_PARTY'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];
export const ACQUISITION_METHODS = ['PURCHASE', 'GRANT', 'LOAN', 'OTHER'] as const;
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];
export const ASSET_CONDITIONS = ['GOOD', 'NEEDS_REPAIR', 'DAMAGED'] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export const ASSET_STATUSES = [
  'AVAILABLE',
  'IN_USE',
  'STORED',
  'BORROWED',
  'UNDER_MAINTENANCE',
  'MISSING',
  'DISPOSED',
  'RETURNED',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface AssetRef {
  id: string;
  code: string;
  name: string;
}

export interface AssetLocationRef extends AssetRef {
  type: LocationType;
  path: string;
}

export interface AssetUserRef {
  id: string;
  fullName: string;
}

export interface AssetEmployeeRef {
  id: string;
  fullName: string;
  department: { id: string; name: string } | null;
}

export interface AssetPhoto {
  id: string;
  isPrimary: boolean;
  caption: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  createdAt: string;
  /** Set when the photo documents a condition check. */
  conditionLogId: string | null;
  /** Set when the photo documents a repair report (backend field may be absent on old rows). */
  maintenanceId?: string | null;
  urls: { full: string; thumb: string };
}

export interface AssetDocument {
  id: string;
  title: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export interface AssetLabel {
  token: string;
  isActive: boolean;
  url: string;
  printedCount: number;
  lastPrintedAt: string | null;
  generatedAt: string;
}

export interface AssetListItem {
  id: string;
  assetCode: string;
  name: string;
  category: AssetRef;
  /** Optional: single-office setups leave it empty and the UI hides it. */
  location: AssetLocationRef | null;
  department: AssetRef | null;
  responsibleEmployee: AssetEmployeeRef | null;
  brand: string | null;
  model: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  ownershipType: OwnershipType;
  hasPhoto: boolean;
  isArchived: boolean;
  updatedAt: string;
}

export interface AssetDetail extends AssetListItem {
  serialNumber: string | null;
  description: string | null;
  acquisitionMethod: AcquisitionMethod;
  acquisitionDate: string | null;
  purchasePrice: string | null;
  vendor: string | null;
  notes: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archivedBy: AssetUserRef | null;
  createdBy: AssetUserRef | null;
  createdAt: string;
  photos: AssetPhoto[];
  documents: AssetDocument[];
  label: AssetLabel | null;
  activeLoan: AssetActiveLoan | null;
  pendingMutation: AssetPendingMutation | null;
  openMaintenance: { id: string; status: 'REPORTED' | 'IN_PROGRESS'; description: string; reportedAt: string } | null;
  activeDisposal: { id: string; reason: DisposalReason; disposedAt: string } | null;
}

export interface AssetActiveLoan {
  id: string;
  borrowerName: string;
  loanedAt: string;
  dueAt: string;
  isOverdue: boolean;
}

export interface AssetPendingMutation {
  id: string;
  requestedAt: string;
  requestedBy: AssetUserRef;
  toLocation: { id: string; name: string; path: string } | null;
  changesResponsible: boolean;
  toResponsibleEmployee: { id: string; fullName: string } | null;
}

export interface CountByRef {
  id: string;
  name: string;
  count: number;
}

export interface AssetStatistics {
  total: number;
  active: number;
  archived: number;
  byStatus: Record<AssetStatus, number>;
  byCondition: Record<AssetCondition, number>;
  byCategory: CountByRef[];
  byOffice: CountByRef[];
  byAcquisitionYear: { year: number; count: number }[];
  withoutAcquisitionYear: number;
  pendingMutations: number;
  activeLoans: number;
  overdueLoans: number;
  disposed: number;
  openMaintenance: number;
  inMaintenance: number;
  openOpname: { id: string; name: string; scanned: number; total: number } | null;
}

export interface PublicAsset {
  assetCode: string;
  name: string;
  category: { name: string };
  brand: string | null;
  model: string | null;
  location: { name: string; path: string } | null;
  status: AssetStatus;
  condition: AssetCondition;
  hasPhoto: boolean;
}

export type PublicLookup = PublicAsset | (AssetDetail & { isPublicView: false });

export interface QrInfo {
  token: string;
  url: string;
  isActive: boolean;
  generatedAt: string;
  printedCount: number;
  lastPrintedAt: string | null;
}

export interface BulkQrItem {
  assetId: string;
  assetCode: string;
  name: string;
  token: string;
  url: string;
}

export interface BulkQrResult {
  items: BulkQrItem[];
  /** inactiveLabel: skipped because its QR label is deactivated (only with activateInactive false). */
  skipped: { assetId: string; reason: string; inactiveLabel?: boolean }[];
}

export interface UserLookupItem {
  id: string;
  fullName: string;
  email: string;
  department: { name: string } | null;
}

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_INVENTARIS: 'Admin Inventaris',
  PETUGAS_INVENTARIS: 'Petugas Inventaris',
  VIEWER: 'Viewer',
};

// ---------------------------------------------------------------- Tahap 3

export interface Employee {
  id: string;
  employeeNumber: string | null;
  fullName: string;
  department: { id: string; code: string; name: string } | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  user: { id: string; fullName: string; email: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDetail extends Employee {
  assetCount: number;
  activeLoanCount: number;
}

export interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeNumber: string | null;
  department: { id: string; name: string } | null;
}

export const MUTATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type MutationStatus = (typeof MUTATION_STATUSES)[number];

export interface MutationLocationRef {
  id: string;
  name: string;
  path: string;
}

export interface Mutation {
  id: string;
  status: MutationStatus;
  asset: { id: string; assetCode: string; name: string };
  fromLocation: MutationLocationRef | null;
  toLocation: MutationLocationRef | null;
  changesResponsible: boolean;
  fromResponsibleEmployee: { id: string; fullName: string } | null;
  toResponsibleEmployee: { id: string; fullName: string } | null;
  reason: string;
  requestedBy: AssetUserRef;
  requestedAt: string;
  decidedBy: AssetUserRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export const LOAN_STATES = ['active', 'overdue', 'returned', 'all'] as const;
export type LoanState = (typeof LOAN_STATES)[number];
export type LoanStatus = 'ACTIVE' | 'RETURNED';
export const BORROWER_TYPES = ['EMPLOYEE', 'EXTERNAL'] as const;
export type BorrowerType = (typeof BORROWER_TYPES)[number];

export interface Loan {
  id: string;
  status: LoanStatus;
  asset: { id: string; assetCode: string; name: string };
  borrowerType: BorrowerType;
  borrowerEmployee: { id: string; fullName: string } | null;
  borrowerName: string;
  borrowerDepartment: { id: string; name: string } | null;
  borrowerContact: string | null;
  guarantorEmployee: { id: string; fullName: string } | null;
  purpose: string | null;
  loanedAt: string;
  dueAt: string;
  returnedAt: string | null;
  returnCondition: AssetCondition | null;
  returnNotes: string | null;
  previousStatus: AssetStatus;
  isOverdue: boolean;
  overdueDays: number;
  recordedBy: AssetUserRef;
  returnedBy: AssetUserRef | null;
  createdAt: string;
}

export type ConditionSource = 'CREATE' | 'MANUAL' | 'LOAN_RETURN' | 'OPNAME' | 'MAINTENANCE';

export interface ConditionLog {
  id: string;
  condition: AssetCondition;
  previousCondition: AssetCondition | null;
  notes: string | null;
  checkedAt: string;
  source: ConditionSource;
  loanId: string | null;
  checkedBy: AssetUserRef;
  photos: AssetPhoto[];
  createdAt: string;
}

export type AssignmentSource = 'CREATE' | 'MUTATION';

export interface Assignment {
  id: string;
  fromEmployee: { id: string; fullName: string } | null;
  toEmployee: { id: string; fullName: string } | null;
  source: AssignmentSource;
  mutationId: string | null;
  note: string | null;
  changedBy: AssetUserRef;
  createdAt: string;
}

// ---------------------------------------------------------------- Tahap 4

export const MAINTENANCE_STATUSES = ['REPORTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export interface MaintenanceRecord {
  id: string;
  status: MaintenanceStatus;
  asset: { id: string; assetCode: string; name: string };
  description: string;
  reportedBy: AssetUserRef;
  reportedAt: string;
  technician: string | null;
  startedAt: string | null;
  startedBy: AssetUserRef | null;
  completedAt: string | null;
  completedBy: AssetUserRef | null;
  cost: string | null;
  technicianNotes: string | null;
  resultCondition: AssetCondition | null;
  previousStatus: AssetStatus | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  photos: AssetPhoto[];
}

export const DISPOSAL_REASONS = ['BROKEN', 'LOST', 'SOLD', 'DONATED', 'OTHER'] as const;
export type DisposalReason = (typeof DISPOSAL_REASONS)[number];

export interface Disposal {
  id: string;
  asset: { id: string; assetCode: string; name: string };
  reason: DisposalReason;
  disposedAt: string;
  description: string;
  value: string | null;
  recipient: string | null;
  previousStatus: AssetStatus;
  labelWasActive: boolean;
  disposedBy: AssetUserRef;
  createdAt: string;
  revertedAt: string | null;
  revertedBy: AssetUserRef | null;
  revertReason: string | null;
  documents: AssetDocument[];
}

export type OpnameStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export const OPNAME_RESULTS = [
  'PENDING',
  'MATCHED',
  'CONDITION_DIFFERS',
  'NOT_FOUND',
  'UNREGISTERED',
  'ON_LOAN',
  'IN_MAINTENANCE',
  'REMOVED',
] as const;
export type OpnameResult = (typeof OPNAME_RESULTS)[number];
export const OPNAME_REPORT_RESULTS = ['MATCHED', 'CONDITION_DIFFERS', 'NOT_FOUND', 'UNREGISTERED', 'ON_LOAN', 'IN_MAINTENANCE'] as const;
export type OpnameReportResult = (typeof OPNAME_REPORT_RESULTS)[number];

export interface StockOpname {
  id: string;
  name: string;
  notes: string | null;
  status: OpnameStatus;
  plannedDate: string;
  officers: AssetUserRef[];
  counts: Record<OpnameResult, number>;
  total: number;
  scanned: number;
  createdBy: AssetUserRef;
  createdAt: string;
  closedBy: AssetUserRef | null;
  closedAt: string | null;
  cancelledAt: string | null;
}

export interface OpnameItem {
  id: string;
  asset: { id: string; assetCode: string; name: string; category: { name: string } } | null;
  expectedCondition: AssetCondition | null;
  expectedStatus: AssetStatus | null;
  observedCondition: AssetCondition | null;
  result: OpnameResult;
  scannedAt: string | null;
  scannedBy: AssetUserRef | null;
  rawValue: string | null;
  note: string | null;
  conditionAppliedAt: string | null;
}

export interface ScanResult {
  item: OpnameItem;
  alreadyScanned: boolean;
}

export interface OpnameReport {
  session: StockOpname;
  groups: Record<OpnameReportResult, OpnameItem[]>;
}
