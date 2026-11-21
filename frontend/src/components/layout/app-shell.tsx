'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PageSpinner } from '@/components/ui/spinner';
import { loginRedirect } from '@/lib/auth/login-redirect';
import { useAuth } from '@/lib/auth/use-auth';
import { Header } from './header';
import { Sidebar } from './sidebar';

/** Redirects anonymous visitors to /login, remembering where they wanted to go. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(loginRedirect(pathname, window.location.search));
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageSpinner label="Memeriksa sesi..." />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  // The drawer closes itself when a nav link is clicked (see Sidebar).
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Frozen sidebar: .sidebar-legacy keeps its original colours and font (spec §6). */}
      <div className="sidebar-legacy contents">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
