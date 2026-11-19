'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import type { Loan } from '@/types/api';
import { LoanStateBadge } from './loan-state-badge';

export function LoanTable({
  rows,
  loading,
  canManage,
  onReturn,
  onExtend,
  showAsset = true,
}: {
  rows: Loan[];
  loading: boolean;
  canManage: boolean;
  onReturn: (loan: Loan) => void;
  onExtend: (loan: Loan) => void;
  showAsset?: boolean;
}) {
  const cols = showAsset ? 6 : 5;
  return (
    <Table>
      <THead>
        <TR>
          {showAsset ? <TH>Barang</TH> : null}
          <TH>Peminjam</TH>
          <TH className="hidden w-56 md:table-cell">Pinjam → rencana kembali</TH>
          <TH className="w-36">Status</TH>
          <TH className="hidden lg:table-cell">Keperluan</TH>
          <TH className="w-44"><span className="sr-only">Aksi</span></TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={cols}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={cols}>Tidak ada peminjaman yang cocok.</TableMessage>
        ) : (
          rows.map((l) => (
            <TR key={l.id}>
              {showAsset ? (
                <TD>
                  <Link href={`/assets/${l.asset.id}`} className="font-medium hover:underline">{l.asset.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{l.asset.assetCode}</p>
                </TD>
              ) : null}
              <TD>
                <Link href={`/loans/${l.id}`} className="font-medium hover:underline">{l.borrowerName}</Link>
                <p className="text-xs text-muted-foreground">
                  {l.borrowerType === 'EXTERNAL'
                    ? `Bukan karyawan · penjamin: ${l.guarantorEmployee?.fullName ?? '-'}`
                    : l.borrowerDepartment?.name ?? 'Karyawan'}
                </p>
              </TD>
              <TD className="hidden text-muted-foreground md:table-cell">
                {formatDate(l.loanedAt)} → <span className={l.isOverdue ? 'text-destructive' : undefined}>{formatDate(l.dueAt)}</span>
                {l.returnedAt ? <p className="text-xs">Kembali {formatDate(l.returnedAt)}</p> : null}
              </TD>
              <TD><LoanStateBadge loan={l} /></TD>
              <TD className="hidden max-w-xs truncate text-muted-foreground lg:table-cell" title={l.purpose ?? undefined}>
                {l.purpose ?? '-'}
              </TD>
              <TD>
                {canManage && l.status === 'ACTIVE' ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" onClick={() => onReturn(l)}>Kembalikan</Button>
                    <Button size="sm" variant="outline" onClick={() => onExtend(l)}>Perpanjang</Button>
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
