'use client';

import { Boxes, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';
import { activeNavItem, NAV_ITEMS, NAV_SECTIONS, visibleNavItems } from './nav-items';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();
  const items = visibleNavItems(NAV_ITEMS, hasAnyPermission);
  const active = activeNavItem(items, pathname);

  return (
    <>
      {/* mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        aria-label="Navigasi utama"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground',
          'transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold text-white">OAMS</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-active hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {NAV_SECTIONS.map((section) => {
            const sectionItems = items.filter((i) => i.section === section);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section} className="mt-4 first:mt-1">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {sectionItems.map((item) => {
                    const isActive = active?.href === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-sidebar-active font-medium text-white'
                              : 'text-sidebar-foreground hover:bg-sidebar-active/70 hover:text-white',
                          )}
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <p className="px-5 pb-4 text-[11px] text-sidebar-muted">Tahap 1 · Foundation</p>
      </aside>
    </>
  );
}
