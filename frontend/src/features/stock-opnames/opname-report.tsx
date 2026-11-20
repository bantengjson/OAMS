'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { OPNAME_RESULT_LABEL, OPNAME_RESULT_VARIANT } from '@/lib/operation-labels';
import { formatDateTime } from '@/lib/utils';
import { OPNAME_REPORT_RESULTS } from '@/types/api';
import type { OpnameItem, OpnameReport as Report, OpnameReportResult } from '@/types/api';

const GROUP_HINT: Record<OpnameReportResult, string> = {
  MATCHED: 'Ditemukan dengan kondisi sesuai catatan.',
  CONDITION_DIFFERS: 'Ditemukan, tetapi kondisinya berbeda dari catatan.',
  NOT_FOUND: 'Tidak dipindai sampai sesi ditutup.',
  UNREGISTERED: 'Dipindai tetapi tidak termasuk dalam sesi.',
  ON_LOAN: 'Tidak dipindai karena sedang dipinjam.',
  IN_MAINTENANCE: 'Tidak dipindai karena sedang diperbaiki.',
};

function cond(c: OpnameItem['expectedCondition']) {
  return c ? CONDITION_LABEL[c] : '-';
}

/** The printable report: one section per opname result, in a fixed order. */
export function OpnameReportView({ report, canApply }: { report: Report; canApply: boolean }) {
  const queryClient = useQueryClient();
  const apply = useMutation({
    mutationFn: (itemId: string) => stockOpnamesApi.applyCondition(report.session.id, itemId),
    onSuccess: () => {
      toast.success('Kondisi barang diperbarui.');
      void queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const closed = report.session.status === 'CLOSED';

  return (
    <div className="flex flex-col gap-6">
      {OPNAME_REPORT_RESULTS.map((key) => {
        const rows = report.groups[key] ?? [];
        return (
          <section key={key} className="report-section flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{OPNAME_RESULT_LABEL[key]}</h3>
              <Badge variant={OPNAME_RESULT_VARIANT[key]}>{rows.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{GROUP_HINT[key]}</p>
            {rows.length === 0 ? null : (
              <div className="relative overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Kode</th>
                      <th className="px-3 py-2 font-medium">Barang</th>
                      <th className="px-3 py-2 font-medium">Tercatat</th>
                      <th className="px-3 py-2 font-medium">Ditemukan</th>
                      <th className="px-3 py-2 font-medium">Dipindai</th>
                      <th className="px-3 py-2 font-medium">Catatan</th>
                      {key === 'CONDITION_DIFFERS' && canApply && closed ? (
                        <th className="no-print px-3 py-2"><span className="sr-only">Aksi</span></th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.asset?.assetCode ?? '-'}</td>
                        <td className="px-3 py-2">
                          {r.asset ? r.asset.name : <span className="break-all font-mono text-xs">{r.rawValue}</span>}
                        </td>
                        <td className="px-3 py-2">{cond(r.expectedCondition)}</td>
                        <td className="px-3 py-2">{cond(r.observedCondition)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          {r.scannedAt ? formatDateTime(r.scannedAt) : '-'}
                          {r.scannedBy ? <div>{r.scannedBy.fullName}</div> : null}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.note ?? ''}</td>
                        {key === 'CONDITION_DIFFERS' && canApply && closed ? (
                          <td className="no-print px-3 py-2 text-right">
                            {r.conditionAppliedAt ? (
                              <span className="text-xs text-muted-foreground">Diterapkan</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={apply.isPending && apply.variables === r.id}
                                disabled={apply.isPending}
                                onClick={() => apply.mutate(r.id)}
                              >
                                Terapkan kondisi
                              </Button>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
