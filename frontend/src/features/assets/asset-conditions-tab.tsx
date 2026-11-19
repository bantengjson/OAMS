'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { AuthImage } from '@/components/ui/auth-image';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { CONDITION_SOURCE_LABEL } from '@/lib/operation-labels';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { AssetDetail } from '@/types/api';
import { AssetConditionBadge } from './asset-table';
import { ConditionLogDialog } from './condition-log-dialog';

export function AssetConditionsTab({ asset, canRecord }: { asset: AssetDetail; canRecord: boolean }) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const logs = useQuery({
    queryKey: ['assets', 'condition-logs', asset.id, page],
    queryFn: () => assetsApi.conditionLogs(asset.id, { page, pageSize: 10 }),
  });

  if (logs.isError) return <Alert variant="error">{getErrorMessage(logs.error)}</Alert>;
  const rows = logs.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Kondisi saat ini: <AssetConditionBadge condition={asset.condition} />
        </p>
        {canRecord && !asset.isArchived ? (
          <Button onClick={() => setOpen(true)} leftIcon={<ClipboardCheck className="h-4 w-4" />}>Catat kondisi</Button>
        ) : null}
      </div>

      {logs.isPending ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada pemeriksaan" description="Pemeriksaan kondisi dan pengembalian pinjaman akan tercatat di sini." />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((log) => (
            <li key={log.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <AssetConditionBadge condition={log.condition} />
                  {log.previousCondition && log.previousCondition !== log.condition ? (
                    <span className="text-muted-foreground">sebelumnya {CONDITION_LABEL[log.previousCondition]}</span>
                  ) : null}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {CONDITION_SOURCE_LABEL[log.source]}
                  </span>
                  {log.loanId ? (
                    <Link href={`/loans/${log.loanId}`} className="text-xs text-primary hover:underline">lihat peminjaman</Link>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground" title={formatDateTime(log.createdAt)}>
                  {formatDate(log.checkedAt)} · {log.checkedBy.fullName}
                </p>
              </div>
              {log.notes ? <p className="mt-2 text-sm">{log.notes}</p> : null}
              {log.photos.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {log.photos.map((p) => (
                    <AuthImage
                      key={p.id}
                      path={p.urls.thumb}
                      alt={p.caption ?? 'Foto pemeriksaan'}
                      className="h-20 w-20 rounded-md border border-border object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {logs.data ? <Pagination meta={logs.data.meta} onPageChange={setPage} /> : null}

      {open ? (
        <ConditionLogDialog assetId={asset.id} currentCondition={asset.condition} open={open} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
