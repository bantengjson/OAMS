'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatRupiah } from '@/lib/asset-labels';
import { formatDate } from '@/lib/utils';
import type { MaintenanceRecord } from '@/types/api';
import type { MaintenanceMode } from './maintenance-action-dialog';
import { MaintenanceStatusBadge } from './maintenance-status-badge';

export function MaintenanceTable({
  rows,
  loading,
  canManage,
  onAction,
  showAsset = true,
}: {
  rows: MaintenanceRecord[];
  loading: boolean;
  canManage: boolean;
  onAction: (record: MaintenanceRecord, mode: MaintenanceMode) => void;
  showAsset?: boolean;
}) {
  const cols = showAsset ? 7 : 6;
  return (
    <Table>
      <THead>
        <TR>
          {showAsset ? <TH>Barang</TH> : null}
          <TH>Kerusakan</TH>
          <TH className="hidden w-28 md:table-cell">Dilaporkan</TH>
          <TH className="hidden lg:table-cell">Teknisi</TH>
          <TH className="hidden w-32 lg:table-cell">Biaya</TH>
          <TH className="w-28">Status</TH>
          <TH className="w-48"><span className="sr-only">Aksi</span></TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={cols}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={cols}>Tidak ada data pemeliharaan.</TableMessage>
        ) : (
          rows.map((r) => (
            <TR key={r.id}>
              {showAsset ? (
                <TD>
                  <Link href={`/assets/${r.asset.id}`} className="font-medium hover:underline">{r.asset.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{r.asset.assetCode}</p>
                </TD>
              ) : null}
              <TD>
                <Link href={`/maintenance/${r.id}`} className="line-clamp-2 hover:underline">{r.description}</Link>
                <p className="text-xs text-muted-foreground">oleh {r.reportedBy.fullName}</p>
              </TD>
              <TD className="hidden text-muted-foreground md:table-cell">{formatDate(r.reportedAt)}</TD>
              <TD className="hidden text-muted-foreground lg:table-cell">{r.technician ?? '-'}</TD>
              <TD className="hidden text-muted-foreground lg:table-cell">{r.cost ? formatRupiah(r.cost) : '-'}</TD>
              <TD><MaintenanceStatusBadge status={r.status} /></TD>
              <TD>
                {canManage && (r.status === 'REPORTED' || r.status === 'IN_PROGRESS') ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {r.status === 'REPORTED' ? (
                      <Button size="sm" onClick={() => onAction(r, 'start')}>Mulai</Button>
                    ) : (
                      <Button size="sm" onClick={() => onAction(r, 'complete')}>Selesaikan</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onAction(r, 'cancel')}>Batalkan</Button>
                  </div>
                ) : null}
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
