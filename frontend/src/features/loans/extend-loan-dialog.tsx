'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import { shiftDays } from '@/lib/dates';
import { formatDate } from '@/lib/utils';
import type { Loan } from '@/types/api';

export function ExtendLoanDialog({
  loan,
  open,
  onClose,
  onDone,
}: {
  loan: Pick<Loan, 'id' | 'asset' | 'dueAt' | 'loanedAt'> | null;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [dueAt, setDueAt] = useState(() => (loan ? shiftDays(loan.dueAt, 7) : ''));
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: () => loansApi.update(loan!.id, { dueAt }),
    onSuccess: () => {
      toast.success('Rencana kembali diperpanjang.');
      void queryClient.invalidateQueries({ queryKey: ['loans'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
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
      title="Perpanjang peminjaman"
      description={loan ? `${loan.asset.assetCode} · ${loan.asset.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending} disabled={!dueAt}>Simpan</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field>
          <Label htmlFor="extend-due">Rencana kembali baru</Label>
          <Input id="extend-due" type="date" value={dueAt} min={loan?.loanedAt} onChange={(e) => setDueAt(e.target.value)} />
          {loan ? <FieldHint>Saat ini: {formatDate(loan.dueAt)}</FieldHint> : null}
        </Field>
      </div>
    </Dialog>
  );
}
