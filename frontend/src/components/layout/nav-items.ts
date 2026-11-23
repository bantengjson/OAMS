import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Building2,
  HandCoins,
  IdCard,
  PackageX,
  LayoutDashboard,
  Printer,
  ScanLine,
  ScrollText,
  Wrench,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
  DoorOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavSection = 'Utama' | 'Inventaris' | 'Data Master' | 'Administrasi' | 'Akun';

export const NAV_SECTIONS: readonly NavSection[] = [
  'Utama',
  'Inventaris',
  'Data Master',
  'Administrasi',
  'Akun',
];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  /** Any one of these grants access; empty/undefined means everyone. */
  permissions?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Utama', permissions: ['dashboard.view'] },
  { href: '/assets', label: 'Inventaris', icon: Boxes, section: 'Inventaris', permissions: ['assets.view'] },
  { href: '/scan', label: 'Scan QR', icon: ScanLine, section: 'Inventaris', permissions: ['qr.scan'] },
  { href: '/qr/print', label: 'Cetak QR', icon: Printer, section: 'Inventaris', permissions: ['qr.generate'] },
  { href: '/mutations', label: 'Mutasi', icon: ArrowLeftRight, section: 'Inventaris', permissions: ['mutations.view'] },
  { href: '/loans', label: 'Peminjaman', icon: HandCoins, section: 'Inventaris', permissions: ['loans.view'] },
  {
    href: '/stock-opnames',
    label: 'Stock Opname',
    icon: ClipboardList,
    section: 'Inventaris',
    permissions: ['stock_opnames.execute', 'stock_opnames.manage'],
  },
  { href: '/maintenance', label: 'Pemeliharaan', icon: Wrench, section: 'Inventaris', permissions: ['assets.view'] },
  { href: '/disposals', label: 'Pelepasan', icon: PackageX, section: 'Inventaris', permissions: ['disposals.manage'] },
  { href: '/users', label: 'Pengguna', icon: Users, section: 'Administrasi', permissions: ['users.manage'] },
  { href: '/roles', label: 'Role & Izin', icon: ShieldCheck, section: 'Administrasi', permissions: ['roles.view'] },
  { href: '/categories', label: 'Jenis Barang', icon: Tags, section: 'Data Master', permissions: ['categories.manage'] },
  { href: '/rooms', label: 'Ruangan', icon: DoorOpen, section: 'Data Master', permissions: ['locations.manage'] },
  { href: '/departments', label: 'Unit Kerja', icon: Building2, section: 'Data Master', permissions: ['departments.manage'] },
  { href: '/employees', label: 'Pegawai', icon: IdCard, section: 'Data Master', permissions: ['employees.manage'] },
  {
    href: '/audit-logs',
    label: 'Audit Log',
    icon: ScrollText,
    section: 'Administrasi',
    permissions: ['audit_logs.view_all', 'audit_logs.view_operational'],
  },
  { href: '/profile', label: 'Profil', icon: UserCircle, section: 'Akun' },
];

export function visibleNavItems(
  items: readonly NavItem[],
  hasAnyPermission: (codes: readonly string[]) => boolean,
): NavItem[] {
  return items.filter((item) => hasAnyPermission(item.permissions ?? []));
}

/** The nav item whose href prefixes the current path, longest match first. */
export function activeNavItem(items: readonly NavItem[], pathname: string): NavItem | undefined {
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
