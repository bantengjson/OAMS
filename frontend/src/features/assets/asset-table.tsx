'use client';

import { ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CONDITION_LABEL, CONDITION_VARIANT, STATUS_LABEL, STATUS_VARIANT } from '@/lib/asset-labels';
import type { AssetListItem } from '@/types/api';

export function AssetStatusBadge({ status }: { status: AssetListItem['status'] }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function AssetConditionBadge({ condition }: { condition: AssetListItem['condition'] }) {
  return <Badge variant={CONDITION_VARIANT[condition]}>{CONDITION_LABEL[condition]}</Badge>;
}

export function AssetTable({ rows, loading }: { rows: AssetListItem[]; loading: boolean }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-40">Kode</TH>
          <TH>Nama</TH>
          <TH className="hidden md:table-cell">Kategori</TH>
          <TH className="hidden lg:table-cell">Lokasi</TH>
          <TH className="w-32">Status</TH>
          <TH className="hidden w-32 xl:table-cell">Kondisi</TH>
          <TH className="hidden xl:table-cell">Penanggung jawab</TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={7}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={7}>Tidak ada barang yang cocok.</TableMessage>
        ) : (
          rows.map((a) => (
            <TR key={a.id}>
              <TD className="font-mono text-xs">
                <Link href={`/assets/${a.id}`} className="text-primary hover:underline">
                  {a.assetCode}
                </Link>
              </TD>
              <TD>
                <Link href={`/assets/${a.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  {a.hasPhoto ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-label="Ada foto" /> : null}
                  <span className="truncate">{a.name}</span>
                  {a.isArchived ? <Badge variant="muted">Arsip</Badge> : null}
                </Link>
                <p className="text-xs text-muted-foreground md:hidden">{a.category.name} · {a.location.name}</p>
              </TD>
              <TD className="hidden text-muted-foreground md:table-cell">{a.category.name}</TD>
              <TD className="hidden max-w-xs truncate text-muted-foreground lg:table-cell" title={a.location.path}>
                {a.location.path}
              </TD>
              <TD><AssetStatusBadge status={a.status} /></TD>
              <TD className="hidden xl:table-cell"><AssetConditionBadge condition={a.condition} /></TD>
              <TD className="hidden text-muted-foreground xl:table-cell">{a.responsibleUser?.fullName ?? '-'}</TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
