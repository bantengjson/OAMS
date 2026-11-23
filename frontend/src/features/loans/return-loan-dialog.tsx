'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/ui/select-panel';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { nowForDateTimeInput } from '@/lib/dates';
import { ASSET_CONDITIONS } from '@/types/api';
import type { AssetCondition, Loan } from '@/types/api';

export function ReturnLoanDialog({
  loan,
  currentCondition,
  open,
  onClose,
  onDone,
}: {
  loan: Pick<Loan, 'id' | 'asset' | 'borrowerName'> | null;
  /** Shown as help text so the person can tell whether anything changed. */
  currentCondition?: AssetCondition;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [returnedAt, setReturnedAt] = useState(() => nowForDateTimeInput());
  const [condition, setCondition] = useState<'' | AssetCondition>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: () =>
      loansApi.return(loan!.id, {
        returnedAt: returnedAt ? new Date(returnedAt).toISOString() : null,
        condition: condition || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Barang dikembalikan.');
      void queryClient.invalidateQueries({ queryKey: ['loans'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      setCondition('');
      setNotes('');
      setError(null);
      onDone?.();
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Catat pengembalian"
      description={loan ? `${loan.asset.assetCode} · ${loan.asset.name} · dipinjam ${loan.borrowerName}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending} disabled={!loan}>Kembalikan</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field>
          <Label htmlFor="return-at">Waktu kembali</Label>
          <Input id="return-at" type="datetime-local" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="return-condition">Kondisi saat kembali</Label>
          <FieldSelect
            id="return-condition"
            value={condition}
            onChange={(v) => setCondition(v as '' | AssetCondition)}
            placeholder="Tidak diperiksa"
            emptyLabel="Tidak diperiksa"
            what="kondisi"
            options={ASSET_CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
          />
          <FieldHint>
            {currentCondition ? `Kondisi tercatat saat ini: ${CONDITION_LABEL[currentCondition]}. ` : ''}
            Bila diisi, tercatat sebagai pemeriksaan kondisi dan kondisi barang ikut berubah.
          </FieldHint>
        </Field>
        <Field>
          <Label htmlFor="return-notes">Catatan</Label>
          <Textarea id="return-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
