'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api/form-errors';
import { mutationsApi } from '@/lib/api/mutations';
import { describeMutationChange } from '@/lib/operation-labels';
import type { Mutation } from '@/types/api';

export type DecisionMode = 'approve' | 'reject' | 'cancel';

const COPY: Record<DecisionMode, { title: string; confirm: string; success: string; body: string }> = {
  approve: {
    title: 'Setujui mutasi?',
    confirm: 'Setujui',
    success: 'Mutasi disetujui dan barang dipindahkan.',
    body: 'Lokasi dan/atau penanggung jawab barang berubah saat itu juga dan tercatat di riwayat.',
  },
  reject: {
    title: 'Tolak mutasi?',
    confirm: 'Tolak',
    success: 'Mutasi ditolak.',
    body: 'Barang tetap di tempatnya. Alasan penolakan ditampilkan kepada pengaju.',
  },
  cancel: {
    title: 'Batalkan pengajuan?',
    confirm: 'Batalkan pengajuan',
    success: 'Pengajuan mutasi dibatalkan.',
    body: 'Pengajuan ditutup tanpa perubahan pada barang. Anda bisa mengajukan lagi nanti.',
  },
};

export function MutationDecisionDialog({
  mutation,
  mode,
  open,
  onClose,
  onDone,
}: {
  mutation: Mutation | null;
  mode: DecisionMode;
  open: boolean;
  onClose: () => void;
  onDone?: (updated: Mutation) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  const act = useMutation({
    mutationFn: () => {
      if (!mutation) throw new Error('no mutation');
      if (mode === 'approve') return mutationsApi.approve(mutation.id, note.trim() || undefined);
      if (mode === 'reject') return mutationsApi.reject(mutation.id, note.trim());
      return mutationsApi.cancel(mutation.id);
    },
    onSuccess: (updated) => {
      toast.success(copy.success);
      void queryClient.invalidateQueries({ queryKey: ['mutations'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      setNote('');
      setError(null);
      onDone?.(updated);
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const noteMissing = mode === 'reject' && !note.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.title}
      description={mutation ? `${mutation.asset.assetCode} · ${mutation.asset.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button
            variant={mode === 'approve' ? 'primary' : 'destructive'}
            onClick={() => act.mutate()}
            loading={act.isPending}
            disabled={noteMissing}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {mutation ? (
          <ul className="list-disc pl-5">
            {describeMutationChange(mutation).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p>{copy.body}</p>
        {mode !== 'cancel' ? (
          <Field>
            <Label htmlFor="decision-note" required={mode === 'reject'}>
              {mode === 'reject' ? 'Alasan penolakan' : 'Catatan'}
            </Label>
            <Textarea id="decision-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            {mode === 'reject' ? (
              <FieldError>{noteMissing && note !== '' ? 'Alasan penolakan wajib diisi' : undefined}</FieldError>
            ) : (
              <FieldHint>Opsional, dicatat di riwayat.</FieldHint>
            )}
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
