/**
 * Katalog role dan permission OAMS. Satu-satunya sumber kebenaran untuk kode
 * permission; di-seed ke database dan dipakai oleh guard serta frontend.
 *
 * Format kode: `modul.aksi`. Matriks hak akses mengikuti blueprint bab 3.5.
 */

export const ROLE_CODES = [
  'SUPER_ADMIN',
  'ADMIN_INVENTARIS',
  'PETUGAS_INVENTARIS',
  'VIEWER',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  ASSETS_VIEW: 'assets.view',
  ASSETS_CREATE: 'assets.create',
  ASSETS_UPDATE: 'assets.update',
  ASSETS_ARCHIVE: 'assets.archive',
  QR_GENERATE: 'qr.generate',
  QR_SCAN: 'qr.scan',
  MUTATIONS_VIEW: 'mutations.view',
  MUTATIONS_REQUEST: 'mutations.request',
  MUTATIONS_APPROVE: 'mutations.approve',
  LOANS_VIEW: 'loans.view',
  LOANS_MANAGE: 'loans.manage',
  CONDITIONS_RECORD: 'conditions.record',
  EMPLOYEES_MANAGE: 'employees.manage',
  STOCK_OPNAMES_MANAGE: 'stock_opnames.manage',
  STOCK_OPNAMES_EXECUTE: 'stock_opnames.execute',
  MAINTENANCE_MANAGE: 'maintenance.manage',
  MAINTENANCE_REPORT: 'maintenance.report',
  REPORTS_VIEW: 'reports.view',
  REPORTS_FULL: 'reports.full',
  USERS_MANAGE: 'users.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  MASTER_DATA_VIEW: 'master_data.view',
  CATEGORIES_MANAGE: 'categories.manage',
  LOCATIONS_MANAGE: 'locations.manage',
  DEPARTMENTS_MANAGE: 'departments.manage',
  SETTINGS_MANAGE: 'settings.manage',
  SETTINGS_LIMITED: 'settings.limited',
  AUDIT_LOGS_VIEW_ALL: 'audit_logs.view_all',
  AUDIT_LOGS_VIEW_OPERATIONAL: 'audit_logs.view_operational',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  code: PermissionCode;
  module: string;
  description: string;
}

const P = PERMISSIONS;

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  { code: P.DASHBOARD_VIEW, module: 'dashboard', description: 'Melihat dashboard' },
  { code: P.ASSETS_VIEW, module: 'assets', description: 'Melihat inventaris' },
  { code: P.ASSETS_CREATE, module: 'assets', description: 'Menambah barang' },
  { code: P.ASSETS_UPDATE, module: 'assets', description: 'Mengubah data barang' },
  { code: P.ASSETS_ARCHIVE, module: 'assets', description: 'Mengarsipkan barang' },
  { code: P.QR_GENERATE, module: 'qr', description: 'Membuat dan mencetak QR Code' },
  { code: P.QR_SCAN, module: 'qr', description: 'Memindai QR Code' },
  { code: P.MUTATIONS_VIEW, module: 'mutations', description: 'Melihat pengajuan mutasi' },
  { code: P.MUTATIONS_REQUEST, module: 'mutations', description: 'Mengajukan mutasi barang' },
  { code: P.MUTATIONS_APPROVE, module: 'mutations', description: 'Menyetujui atau menolak mutasi' },
  { code: P.LOANS_VIEW, module: 'loans', description: 'Melihat peminjaman barang' },
  { code: P.LOANS_MANAGE, module: 'loans', description: 'Mencatat peminjaman dan pengembalian barang' },
  { code: P.CONDITIONS_RECORD, module: 'assets', description: 'Mencatat pemeriksaan kondisi barang' },
  { code: P.EMPLOYEES_MANAGE, module: 'employees', description: 'Mengelola daftar pegawai' },
  { code: P.STOCK_OPNAMES_MANAGE, module: 'stock_opnames', description: 'Mengelola sesi stock opname' },
  { code: P.STOCK_OPNAMES_EXECUTE, module: 'stock_opnames', description: 'Melaksanakan stock opname' },
  { code: P.MAINTENANCE_MANAGE, module: 'maintenance', description: 'Mengelola pemeliharaan' },
  { code: P.MAINTENANCE_REPORT, module: 'maintenance', description: 'Melaporkan kerusakan' },
  { code: P.REPORTS_VIEW, module: 'reports', description: 'Melihat laporan' },
  { code: P.REPORTS_FULL, module: 'reports', description: 'Mengakses seluruh laporan dan ekspor' },
  { code: P.USERS_MANAGE, module: 'users', description: 'Mengelola pengguna' },
  { code: P.ROLES_VIEW, module: 'roles', description: 'Melihat role dan permission' },
  { code: P.ROLES_MANAGE, module: 'roles', description: 'Mengubah permission role' },
  { code: P.MASTER_DATA_VIEW, module: 'master_data', description: 'Melihat kategori, lokasi, unit kerja' },
  { code: P.CATEGORIES_MANAGE, module: 'categories', description: 'Mengelola kategori' },
  { code: P.LOCATIONS_MANAGE, module: 'locations', description: 'Mengelola lokasi' },
  { code: P.DEPARTMENTS_MANAGE, module: 'departments', description: 'Mengelola unit kerja' },
  { code: P.SETTINGS_MANAGE, module: 'settings', description: 'Mengelola konfigurasi sistem' },
  { code: P.SETTINGS_LIMITED, module: 'settings', description: 'Mengelola pengaturan terbatas' },
  { code: P.AUDIT_LOGS_VIEW_ALL, module: 'audit_logs', description: 'Melihat seluruh audit log' },
  { code: P.AUDIT_LOGS_VIEW_OPERATIONAL, module: 'audit_logs', description: 'Melihat audit log operasional' },
];

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = PERMISSION_DEFINITIONS.map(
  (p) => p.code,
);

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  permissions: readonly PermissionCode[] | 'ALL';
}

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Akses penuh terhadap seluruh fitur aplikasi.',
    permissions: 'ALL',
  },
  {
    code: 'ADMIN_INVENTARIS',
    name: 'Admin Inventaris',
    description: 'Mengelola inventaris, master data, mutasi, pemeliharaan, dan stock opname.',
    permissions: ALL_PERMISSION_CODES.filter(
      (code) =>
        ![P.USERS_MANAGE, P.ROLES_MANAGE, P.SETTINGS_MANAGE, P.AUDIT_LOGS_VIEW_ALL].includes(
          code as never,
        ),
    ),
  },
  {
    code: 'PETUGAS_INVENTARIS',
    name: 'Petugas Inventaris',
    description: 'Memeriksa kondisi barang, melaksanakan stock opname, dan mengajukan mutasi.',
    permissions: [
      P.DASHBOARD_VIEW,
      P.ASSETS_VIEW,
      P.QR_SCAN,
      P.MUTATIONS_VIEW,
      P.MUTATIONS_REQUEST,
      P.LOANS_VIEW,
      P.LOANS_MANAGE,
      P.CONDITIONS_RECORD,
      P.STOCK_OPNAMES_EXECUTE,
      P.MAINTENANCE_REPORT,
      P.REPORTS_VIEW,
      P.MASTER_DATA_VIEW,
    ],
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Akses baca terhadap inventaris dan laporan yang diizinkan.',
    permissions: [
      P.DASHBOARD_VIEW,
      P.ASSETS_VIEW,
      P.QR_SCAN,
      P.MUTATIONS_VIEW,
      P.LOANS_VIEW,
      P.REPORTS_VIEW,
      P.MASTER_DATA_VIEW,
    ],
  },
];

export function permissionsForRole(code: RoleCode): readonly PermissionCode[] {
  const def = ROLE_DEFINITIONS.find((r) => r.code === code);
  if (!def) return [];
  return def.permissions === 'ALL' ? ALL_PERMISSION_CODES : def.permissions;
}

export function isPermissionCode(value: string): value is PermissionCode {
  return (ALL_PERMISSION_CODES as readonly string[]).includes(value);
}
