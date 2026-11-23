'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { groupLineState } from '@/features/group-items/group-items-model';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import type { OpnameGroupLine } from '@/types/api';

const STATE_BADGE = {
  pending: { label: 'Belum dihitung', variant: 'muted' },
  match: { label: 'Sesuai', variant: 'success' },
  diff: { label: 'Selisih', variant: 'warning' },
} as const;

/** Counted goods in this session: officers type the counts per condition; closing applies them. */
export function OpnameGroupLines({ opnameId, canCount }: { opnameId: string; canCount: boolean }) {
  const lines = useQuery({ queryKey: ['stock-opnames', opnameId, 'group-lines'], queryFn: () => stockOpnamesApi.groupLines(opnameId) });
  if (lines.isPending || !lines.data || lines.data.length === 0) return null;
  const done = lines.data.filter((l) => l.counted).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Barang kelompok</CardTitle>
        <CardDescription>
          Hitung jumlahnya per kondisi. Saat sesi ditutup, hasil hitung menjadi jumlah baru; yang belum dihitung tetap seperti
          tercatat. Sudah dihitung {done} dari {lines.data.length}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {lines.data.map((line) => (
          <GroupLineRow key={line.id} opnameId={opnameId} line={line} canCount={canCount} />
        ))}
      </CardContent>
    </Card>
  );
}

function GroupLineRow({ opnameId, line, canCount }: { opnameId: string; line: OpnameGroupLine; canCount: boolean }) {
  const queryClient = useQueryClient();
  const start = line.counted ?? line.expected;
  const [good, setGood] = useState(String(start.good));
  const [repair, setRepair] = useState(String(start.needsRepair));
  const [damaged, setDamaged] = useState(String(start.damaged));
  const [saving, setSaving] = useState(false);
  const state = STATE_BADGE[groupLineState(line)];
  const valid = [good, repair, damaged].every((v) => /^\d+$/.test(v.trim()));

  const save = async () => {
    setSaving(true);
    try {
      await stockOpnamesApi.countGroupLine(opnameId, line.id, { good: Number(good), needsRepair: Number(repair), damaged: Number(damaged) });
      void queryClient.invalidateQueries({ queryKey: ['stock-opnames', opnameId, 'group-lines'] });
      toast.success(`${line.groupItem.name} tersimpan.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const e = line.expected;
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {line.groupItem.name} <Badge variant={state.variant}>{state.label}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          {line.groupItem.code} · {line.groupItem.room.code} {line.groupItem.room.name} · tercatat Baik {e.good}, Perlu Perbaikan{' '}
          {e.needsRepair}, Rusak {e.damaged}
        </p>
      </div>
      {canCount ? (
        <div className="flex items-end gap-2">
          {[
            ['Baik', good, setGood],
            ['Perbaikan', repair, setRepair],
            ['Rusak', damaged, setDamaged],
          ].map(([label, value, set]) => (
            <label key={label as string} className="flex w-20 flex-col text-xs text-muted-foreground">
              {label as string}
              <Input
                inputMode="numeric"
                value={value as string}
                onChange={(ev) => (set as (v: string) => void)(ev.target.value)}
                aria-label={`${label as string} ${line.groupItem.name}`}
              />
            </label>
          ))}
          <Button size="sm" onClick={save} loading={saving} disabled={!valid}>
            Simpan
          </Button>
        </div>
      ) : line.counted ? (
        <p className="text-sm">
          Dihitung: Baik {line.counted.good}, Perlu Perbaikan {line.counted.needsRepair}, Rusak {line.counted.damaged}
        </p>
      ) : null}
    </div>
  );
}
