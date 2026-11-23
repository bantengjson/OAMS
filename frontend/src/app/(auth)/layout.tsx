import { Boxes } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-card">
          <Boxes className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-semibold leading-tight text-foreground">OAMS</p>
          <p className="text-sm text-muted-foreground">Office Asset Management System</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">DPC PDI Perjuangan Kota Surabaya</p>
    </main>
  );
}
