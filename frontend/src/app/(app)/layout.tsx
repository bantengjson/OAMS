import type { ReactNode } from 'react';
import { AppShell, RequireAuth } from '@/components/layout/app-shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
