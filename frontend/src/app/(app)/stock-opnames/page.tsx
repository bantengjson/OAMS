'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CreateOpnameDialog } from '@/features/stock-opnames/create-opname-dialog';
import { opnameProgress } from '@/features/stock-opnames/opname-summary';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { useAuth } from '@/lib/auth/use-auth';
import { OPNAME_STATUS_LABEL, OPNAME_STATUS_VARIANT } from '@/lib/operation-labels';
import { formatDate } from '@/lib/utils';

export default function StockOpnamesPage() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const query = { page, pageSize: 20 };
  const list = useQuery({ queryKey: ['stock-opnames', query], queryFn: () => stockOpnamesApi.list(query) });
  const rows = list.data?.data ?? [];
  const hasOpen = rows.some((r) => r.status === 'OPEN');

  return (
    <>
      <PageHeader
        title="Stock opname"
        description="Hitung fisik barang dengan memindai stikernya, lalu bandingkan dengan catatan."
        actions={
          hasPermission('stock_opnames.manage') ? (
            <Button
              onClick={() => setCreating(true)}
              disabled={hasOpen}
              title={hasOpen ? 'Tutup sesi yang berjalan dulu' : undefined}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Buka sesi
            </Button>
          ) : null
        }
      />
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <Table>
        <THead>
          <TR>
            <TH>Nama</TH>
            <TH className="hidden w-32 sm:table-cell">Tanggal</TH>
            <TH className="w-28">Status</TH>
            <TH className="w-24 text-right">Progres</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={4}>Memuat...</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={4}>Belum ada sesi stock opname.</TableMessage>
          ) : (
            rows.map((r) => {
              const p = opnameProgress(r.counts);
              return (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/stock-opnames/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    <p className="text-xs text-muted-foreground sm:hidden">{formatDate(r.plannedDate)}</p>
                  </TD>
                  <TD className="hidden text-muted-foreground sm:table-cell">{formatDate(r.plannedDate)}</TD>
                  <TD><Badge variant={OPNAME_STATUS_VARIANT[r.status]}>{OPNAME_STATUS_LABEL[r.status]}</Badge></TD>
                  <TD className="text-right tabular-nums">{p.scanned}/{p.total}</TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
      {creating ? <CreateOpnameDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}
