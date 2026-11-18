'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import type { AssetDetail } from '@/types/api';

export function ArchiveDialog({
  asset,
  open,
  onClose,
}: {
  asset: AssetDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const unarchive = asset.isArchived;

  const mutation = useMutation({
    mutationFn: () => (unarchive ? assetsApi.unarchive(asset.id) : assetsApi.archive(asset.id, reason.trim() || undefined)),
    onSuccess: () => {
      toast.success(unarchive ? 'Barang dikeluarkan dari arsip.' : 'Barang diarsipkan.');
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['count'] });
      setReason('');
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={unarchive ? 'Keluarkan dari arsip?' : 'Arsipkan barang?'}
      description={`${asset.assetCode} · ${asset.name}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button
            variant={unarchive ? 'primary' : 'destructive'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            {unarchive ? 'Keluarkan dari arsip' : 'Arsipkan'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {unarchive ? (
          <p>Barang akan kembali tampil di daftar dan bisa diubah lagi. Kode inventaris tetap sama.</p>
        ) : (
          <>
            <p>
              Barang disembunyikan dari daftar dan tidak bisa diubah. Datanya, kode inventaris, dan riwayatnya tetap
              tersimpan; QR Code-nya tidak lagi menampilkan informasi.
            </p>
            <Field>
              <Label htmlFor="archive-reason">Alasan</Label>
              <Textarea id="archive-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <FieldHint>Opsional, dicatat di riwayat.</FieldHint>
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
