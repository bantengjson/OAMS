'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types/api';
import { Button } from './button';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.total === 0) return null;
  const start = (meta.page - 1) * meta.pageSize + 1;
  const end = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-1 text-[13px] text-muted-foreground sm:flex-row">
      <p>
        Menampilkan <span className="font-medium text-foreground tabular-nums">{start}–{end}</span> dari{' '}
        <span className="font-medium text-foreground tabular-nums">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          leftIcon={<ChevronLeft className="h-4 w-4" />}
        >
          Sebelumnya
        </Button>
        <span className="tabular-nums">
          Hal. {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
