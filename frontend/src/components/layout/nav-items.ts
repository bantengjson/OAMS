import {
  Boxes,
  Building2,
  LayoutDashboard,
  MapPin,
  Printer,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
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
  { href: '/users', label: 'Pengguna', icon: Users, section: 'Administrasi', permissions: ['users.manage'] },
  { href: '/roles', label: 'Role & Izin', icon: ShieldCheck, section: 'Administrasi', permissions: ['roles.view'] },
  { href: '/categories', label: 'Kategori', icon: Tags, section: 'Data Master', permissions: ['categories.manage'] },
  { href: '/locations', label: 'Lokasi', icon: MapPin, section: 'Data Master', permissions: ['locations.manage'] },
  { href: '/departments', label: 'Unit Kerja', icon: Building2, section: 'Data Master', permissions: ['departments.manage'] },
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
