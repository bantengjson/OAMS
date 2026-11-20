'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { OPNAME_RESULT_LABEL, OPNAME_RESULT_VARIANT } from '@/lib/operation-labels';
import { formatDateTime } from '@/lib/utils';
import type { OpnameItem } from '@/types/api';

export function OpnameItemList({ rows, loading, empty }: { rows: OpnameItem[]; loading: boolean; empty: string }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Barang</TH>
          <TH className="hidden md:table-cell">Kondisi</TH>
          <TH className="hidden w-40 sm:table-cell">Dipindai</TH>
          <TH className="w-32">Hasil</TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={4}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={4}>{empty}</TableMessage>
        ) : (
          rows.map((r) => (
            <TR key={r.id}>
              <TD>
                {r.asset ? (
                  <>
                    <Link href={`/assets/${r.asset.id}`} className="font-medium hover:underline">{r.asset.name}</Link>
                    <p className="font-mono text-xs text-muted-foreground">{r.asset.assetCode}</p>
                  </>
                ) : (
                  <p className="break-all font-mono text-xs">{r.rawValue}</p>
                )}
                {r.note ? <p className="text-xs text-muted-foreground">{r.note}</p> : null}
              </TD>
              <TD className="hidden text-muted-foreground md:table-cell">
                {r.expectedCondition ? CONDITION_LABEL[r.expectedCondition] : '-'}
                {r.observedCondition && r.observedCondition !== r.expectedCondition
                  ? ` → ${CONDITION_LABEL[r.observedCondition]}`
                  : ''}
              </TD>
              <TD className="hidden text-muted-foreground sm:table-cell">
                {r.scannedAt ? formatDateTime(r.scannedAt) : '-'}
                {r.scannedBy ? <p className="text-xs">{r.scannedBy.fullName}</p> : null}
              </TD>
              <TD><Badge variant={OPNAME_RESULT_VARIANT[r.result]}>{OPNAME_RESULT_LABEL[r.result]}</Badge></TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
