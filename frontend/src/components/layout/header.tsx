'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { activeNavItem, NAV_ITEMS } from './nav-items';
import { UserMenu } from './user-menu';

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const active = activeNavItem(NAV_ITEMS, pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:px-8">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="truncate text-base font-semibold lg:text-lg">{active?.label ?? 'OAMS'}</h1>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
