'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { describeMutationChange } from '@/lib/operation-labels';
import { formatDateTime } from '@/lib/utils';
import type { Mutation } from '@/types/api';
import type { DecisionMode } from './mutation-decision-dialog';
import { MutationStatusBadge } from './mutation-status-badge';

export function MutationTable({
  rows,
  loading,
  canApprove,
  currentUserId,
  onDecide,
  showAsset = true,
}: {
  rows: Mutation[];
  loading: boolean;
  canApprove: boolean;
  currentUserId: string | null;
  onDecide: (mutation: Mutation, mode: DecisionMode) => void;
  showAsset?: boolean;
}) {
  const cols = showAsset ? 6 : 5;
  return (
    <Table>
      <THead>
        <TR>
          {showAsset ? <TH>Barang</TH> : null}
          <TH>Perubahan</TH>
          <TH className="hidden md:table-cell">Pengaju</TH>
          <TH className="hidden w-40 lg:table-cell">Diajukan</TH>
          <TH className="w-28">Status</TH>
          <TH className="w-44"><span className="sr-only">Aksi</span></TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={cols}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={cols}>Tidak ada mutasi yang cocok.</TableMessage>
        ) : (
          rows.map((m) => {
            const pending = m.status === 'PENDING';
            const mine = m.requestedBy.id === currentUserId;
            return (
              <TR key={m.id}>
                {showAsset ? (
                  <TD>
                    <Link href={`/assets/${m.asset.id}`} className="font-medium hover:underline">
                      {m.asset.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{m.asset.assetCode}</p>
                  </TD>
                ) : null}
                <TD>
                  <Link href={`/mutations/${m.id}`} className="block hover:underline">
                    {describeMutationChange(m).map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </Link>
                  {m.status === 'REJECTED' && m.decisionNote ? (
                    <p className="mt-1 text-xs text-destructive">Ditolak: {m.decisionNote}</p>
                  ) : null}
                </TD>
                <TD className="hidden text-muted-foreground md:table-cell">{m.requestedBy.fullName}</TD>
                <TD className="hidden text-muted-foreground lg:table-cell">{formatDateTime(m.requestedAt)}</TD>
                <TD><MutationStatusBadge status={m.status} /></TD>
                <TD>
                  {pending ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {canApprove ? (
                        <>
                          <Button size="sm" onClick={() => onDecide(m, 'approve')}>Setujui</Button>
                          <Button size="sm" variant="outline" onClick={() => onDecide(m, 'reject')}>Tolak</Button>
                        </>
                      ) : null}
                      {mine && !canApprove ? (
                        <Button size="sm" variant="outline" onClick={() => onDecide(m, 'cancel')}>Batalkan</Button>
                      ) : null}
                    </div>
                  ) : null}
                </TD>
              </TR>
            );
          })
        )}
      </TBody>
    </Table>
  );
}
