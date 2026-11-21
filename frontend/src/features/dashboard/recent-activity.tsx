'use client';

import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { IconChip } from '@/components/ui/icon-chip';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { auditLogsApi } from '@/lib/api/audit-logs';
import { formatDateTime } from '@/lib/utils';
import { ACTIVITY_MODULES, mergeActivity } from './dashboard-model';

const SHOWN = 8;

/** Latest asset-related audit entries; only rendered for holders of an audit-log permission. */
export function RecentActivity() {
  // One small page per module, so a burst of QR prints or opname confirmations cannot push them out.
  const pages = useQueries({
    queries: ACTIVITY_MODULES.map((module) => ({
      queryKey: ['dashboard', 'activity', module],
      queryFn: () => auditLogsApi.list({ module, pageSize: SHOWN }),
    })),
  });
  const logs = { isPending: pages.some((p) => p.isPending), isError: pages.every((p) => p.isError) };
  const rows = mergeActivity(pages.map((p) => p.data?.data ?? []), SHOWN);

  return (
    <section className="flex flex-col gap-0">
      <div className="flex items-center justify-between gap-3 rounded-t-card border border-b-0 border-border bg-card px-5 py-3.5">
        <h3 className="text-base font-semibold text-foreground">Aktivitas terbaru</h3>
        <Link href="/audit-logs" className="text-[13px] font-medium text-primary hover:underline">
          Buka audit log →
        </Link>
      </div>
      <Table wrapperClassName="rounded-t-none [&_th]:rounded-none">
        <THead>
          <TR>
            <TH className="w-36">Waktu</TH>
            <TH>Aktivitas</TH>
            <TH className="hidden md:table-cell">Barang</TH>
            <TH className="hidden sm:table-cell">Oleh</TH>
            <TH className="w-28">Status</TH>
          </TR>
        </THead>
        <TBody>
          {logs.isPending ? (
            <TableMessage colSpan={5}>Memuat...</TableMessage>
          ) : logs.isError ? (
            <TableMessage colSpan={5}>Aktivitas tidak dapat dimuat.</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={5}>Belum ada aktivitas barang.</TableMessage>
          ) : (
            rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TD>
                <TD>
                  <span className="flex items-center gap-2.5 font-medium text-foreground">
                    <IconChip icon={r.icon} tone={r.tone} size="sm" />
                    {r.label}
                  </span>
                </TD>
                <TD className="hidden md:table-cell">
                  {r.assetId ? (
                    <Link href={`/assets/${r.assetId}`} className="hover:text-primary hover:underline">
                      {r.assetText ?? 'Lihat barang'}
                    </Link>
                  ) : (
                    '-'
                  )}
                </TD>
                <TD className="hidden sm:table-cell">{r.actor}</TD>
                <TD>{r.status ? <Badge tone={r.status.tone}>{r.status.label}</Badge> : <span className="text-muted-foreground">—</span>}</TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </section>
  );
}
