'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AuditLogTable({ rows, loading }: { rows: AuditLog[]; loading: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-8" />
          <TH className="w-44">Waktu</TH>
          <TH>Pelaku</TH>
          <TH>Aksi</TH>
          <TH className="hidden md:table-cell">Modul</TH>
          <TH className="hidden lg:table-cell">Objek</TH>
          <TH className="hidden xl:table-cell">IP</TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={7}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={7}>Tidak ada aktivitas pada rentang ini.</TableMessage>
        ) : (
          rows.map((row) => {
            const open = openId === row.id;
            return (
              <Fragment key={row.id}>
                <TR className="cursor-pointer" onClick={() => setOpenId(open ? null : row.id)}>
                  <TD className="text-muted-foreground">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.createdAt)}</TD>
                  <TD>
                    {row.actor ? (
                      <>
                        <p className="font-medium">{row.actor.fullName}</p>
                        <p className="text-xs text-muted-foreground">{row.actor.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sistem / anonim</span>
                    )}
                  </TD>
                  <TD>
                    <code className="text-xs">{row.action}</code>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <Badge variant="outline">{row.module}</Badge>
                  </TD>
                  <TD className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">
                    {row.entityId ?? '-'}
                  </TD>
                  <TD className="hidden text-muted-foreground xl:table-cell">{row.ip ?? '-'}</TD>
                </TR>
                {open ? (
                  <tr className="bg-muted/30">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sebelum</p>
                          <Json value={row.before} />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sesudah</p>
                          <Json value={row.after} />
                        </div>
                      </div>
                      {row.userAgent ? (
                        <p className="mt-3 truncate text-xs text-muted-foreground">Perangkat: {row.userAgent}</p>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })
        )}
      </TBody>
    </Table>
  );
}
