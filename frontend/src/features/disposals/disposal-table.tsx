'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatRupiah } from '@/lib/asset-labels';
import { DISPOSAL_REASON_LABEL } from '@/lib/operation-labels';
import { formatDate } from '@/lib/utils';
import type { Disposal } from '@/types/api';

export function DisposalTable({ rows, loading }: { rows: Disposal[]; loading: boolean }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Barang</TH>
          <TH className="w-32">Alasan</TH>
          <TH className="hidden w-28 md:table-cell">Tanggal</TH>
          <TH className="hidden lg:table-cell">Penerima</TH>
          <TH className="hidden w-32 lg:table-cell">Nilai</TH>
          <TH className="w-28">Status</TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={6}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={6}>Belum ada barang yang dilepas.</TableMessage>
        ) : (
          rows.map((d) => (
            <TR key={d.id}>
              <TD>
                <Link href={`/disposals/${d.id}`} className="font-medium hover:underline">{d.asset.name}</Link>
                <p className="font-mono text-xs text-muted-foreground">{d.asset.assetCode}</p>
              </TD>
              <TD>{DISPOSAL_REASON_LABEL[d.reason]}</TD>
              <TD className="hidden text-muted-foreground md:table-cell">{formatDate(d.disposedAt)}</TD>
              <TD className="hidden text-muted-foreground lg:table-cell">{d.recipient ?? '-'}</TD>
              <TD className="hidden text-muted-foreground lg:table-cell">{d.value ? formatRupiah(d.value) : '-'}</TD>
              <TD>{d.revertedAt ? <Badge variant="muted">Dibatalkan</Badge> : <Badge variant="destructive">Dilepas</Badge>}</TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
