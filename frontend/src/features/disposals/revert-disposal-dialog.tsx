'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { disposalsApi } from '@/lib/api/disposals';
import { getErrorMessage } from '@/lib/api/form-errors';
import type { Disposal } from '@/types/api';

export function RevertDisposalDialog({ disposal, onClose }: { disposal: Disposal; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: () => disposalsApi.revert(disposal.id, reason.trim()),
    onSuccess: () => {
      toast.success('Pelepasan dibatalkan; barang kembali ke inventaris aktif.');
      void queryClient.invalidateQueries({ queryKey: ['disposals'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Batalkan pelepasan?"
      description={`${disposal.asset.assetCode} · ${disposal.asset.name}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending} disabled={!reason.trim()}>
            Batalkan pelepasan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <p>
          Status barang dipulihkan.{' '}
          {disposal.labelWasActive
            ? 'QR Code diaktifkan kembali.'
            : 'QR Code tetap nonaktif karena sudah nonaktif sebelum barang dilepas.'}
        </p>
        <Field>
          <Label htmlFor="rv-reason" required>Alasan</Label>
          <Textarea id="rv-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          <FieldHint>Misalnya: salah pilih barang, barang ditemukan kembali.</FieldHint>
        </Field>
      </div>
    </Dialog>
  );
}
