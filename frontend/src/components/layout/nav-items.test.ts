import { NAV_ITEMS, visibleNavItems } from './nav-items';

const ALL_PERMISSIONS = [
  'dashboard.view',
  'assets.view',
  'assets.create',
  'assets.update',
  'assets.archive',
  'qr.generate',
  'qr.scan',
  'mutations.view',
  'mutations.request',
  'mutations.approve',
  'loans.view',
  'loans.manage',
  'conditions.record',
  'employees.manage',
  'stock_opnames.manage',
  'stock_opnames.execute',
  'maintenance.manage',
  'maintenance.report',
  'reports.view',
  'reports.full',
  'users.manage',
  'roles.view',
  'roles.manage',
  'master_data.view',
  'categories.manage',
  'locations.manage',
  'departments.manage',
  'settings.manage',
  'settings.limited',
  'audit_logs.view_all',
  'audit_logs.view_operational',
];

const VIEWER = [
  'dashboard.view',
  'assets.view',
  'qr.scan',
  'mutations.view',
  'loans.view',
  'reports.view',
  'master_data.view',
];

const PETUGAS = [
  'dashboard.view',
  'assets.view',
  'qr.scan',
  'mutations.view',
  'mutations.request',
  'loans.view',
  'loans.manage',
  'conditions.record',
  'stock_opnames.execute',
  'maintenance.report',
  'reports.view',
  'master_data.view',
];

const ADMIN_INVENTARIS = ALL_PERMISSIONS.filter(
  (p) => !['users.manage', 'roles.manage', 'settings.manage', 'audit_logs.view_all'].includes(p),
);

const hasAny = (held: string[]) => (codes: readonly string[]) =>
  codes.length === 0 || codes.some((c) => held.includes(c));

const labels = (held: string[]) => visibleNavItems(NAV_ITEMS, hasAny(held)).map((i) => i.label);

describe('visibleNavItems', () => {
  it('shows a VIEWER the dashboard, inventory, scanner, mutations, loans and profile', () => {
    expect(labels(VIEWER)).toEqual(['Dashboard', 'Inventaris', 'Scan QR', 'Mutasi', 'Peminjaman', 'Profil']);
  });

  it('shows a PETUGAS the same as a viewer (no printing, no master data)', () => {
    expect(labels(PETUGAS)).toEqual(['Dashboard', 'Inventaris', 'Scan QR', 'Mutasi', 'Peminjaman', 'Profil']);
  });

  it('shows a SUPER_ADMIN every item, in menu order', () => {
    expect(labels(ALL_PERMISSIONS)).toEqual([
      'Dashboard',
      'Inventaris',
      'Scan QR',
      'Cetak QR',
      'Mutasi',
      'Peminjaman',
      'Pengguna',
      'Role & Izin',
      'Kategori',
      'Unit Kerja',
      'Pegawai',
      'Audit Log',
      'Profil',
    ]);
  });

  it('shows ADMIN_INVENTARIS everything except Pengguna', () => {
    expect(labels(ADMIN_INVENTARIS)).toEqual([
      'Dashboard',
      'Inventaris',
      'Scan QR',
      'Cetak QR',
      'Mutasi',
      'Peminjaman',
      'Role & Izin',
      'Kategori',
      'Unit Kerja',
      'Pegawai',
      'Audit Log',
      'Profil',
    ]);
  });

  it('shows Audit Log to anyone holding either audit permission', () => {
    expect(labels(['audit_logs.view_operational'])).toContain('Audit Log');
    expect(labels(['audit_logs.view_all'])).toContain('Audit Log');
    expect(labels([])).toEqual(['Profil']);
  });

  it('every item has a unique href', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
