'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  loading,
  error,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  href?: string;
  loading?: boolean;
  error?: boolean;
}) {
  const body = (
    <Card className="flex items-center gap-4 p-5 transition-colors hover:border-primary/40">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {loading ? <Spinner className="h-5 w-5 text-muted-foreground" /> : error ? '–' : value}
        </p>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
