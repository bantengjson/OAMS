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
import { maintenanceApi } from '@/lib/api/maintenance';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { ASSET_CONDITIONS } from '@/types/api';
import type { AssetCondition, MaintenanceRecord } from '@/types/api';

export type MaintenanceMode = 'start' | 'complete' | 'cancel';

const TITLE: Record<MaintenanceMode, string> = {
  start: 'Mulai perbaikan',
  complete: 'Selesaikan perbaikan',
  cancel: 'Batalkan pemeliharaan',
};
const SUCCESS: Record<MaintenanceMode, string> = {
  start: 'Perbaikan dimulai; status barang menjadi Dalam perbaikan.',
  complete: 'Perbaikan selesai; status barang dipulihkan.',
  cancel: 'Pemeliharaan dibatalkan.',
};

export function MaintenanceActionDialog({
  record,
  mode,
  onClose,
}: {
  record: MaintenanceRecord;
  mode: MaintenanceMode;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [technician, setTechnician] = useState(record.technician ?? '');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState<'' | AssetCondition>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const costInvalid = cost.trim() !== '' && !/^\d+(\.\d{1,2})?$/.test(cost.trim());
  const act = useMutation({
    mutationFn: () => {
      if (mode === 'start') return maintenanceApi.start(record.id, { technician: technician.trim() || null });
      if (mode === 'complete') {
        return maintenanceApi.complete(record.id, {
          cost: cost.trim() ? Number(cost) : null,
          technicianNotes: notes.trim() || null,
          resultCondition: condition || null,
        });
      }
      return maintenanceApi.cancel(record.id, reason.trim());
    },
    onSuccess: () => {
      toast.success(SUCCESS[mode]);
      void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const disabled = (mode === 'cancel' && !reason.trim()) || (mode === 'complete' && costInvalid);

  return (
    <Dialog
      open
      onClose={onClose}
      title={TITLE[mode]}
      description={`${record.asset.assetCode} · ${record.asset.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'primary'}
            onClick={() => act.mutate()}
            loading={act.isPending}
            disabled={disabled}
          >
            {TITLE[mode]}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <p className="text-muted-foreground">Kerusakan: {record.description}</p>
        {mode === 'start' ? (
          <Field>
            <Label htmlFor="mt-technician">Teknisi atau bengkel</Label>
            <Input id="mt-technician" value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Opsional" />
            <FieldHint>Barang tidak bisa dipinjam atau dimutasi selama diperbaiki.</FieldHint>
          </Field>
        ) : null}
        {mode === 'complete' ? (
          <>
            <Field>
              <Label htmlFor="mt-cost">Biaya (Rp)</Label>
              <Input id="mt-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Mis. 250000" />
              <FieldHint>{costInvalid ? 'Angka saja, tanpa titik atau koma ribuan.' : 'Opsional.'}</FieldHint>
            </Field>
            <Field>
              <Label htmlFor="mt-condition">Kondisi setelah perbaikan</Label>
              <FieldSelect
                id="mt-condition"
                value={condition}
                onChange={(v) => setCondition(v as '' | AssetCondition)}
                placeholder="Tidak diperiksa"
                emptyLabel="Tidak diperiksa"
                what="kondisi"
                options={ASSET_CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
              />
              <FieldHint>Bila diisi, kondisi barang ikut berubah dan tercatat di riwayat kondisi.</FieldHint>
            </Field>
            <Field>
              <Label htmlFor="mt-notes">Catatan teknisi</Label>
              <Textarea id="mt-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </>
        ) : null}
        {mode === 'cancel' ? (
          <Field>
            <Label htmlFor="mt-reason" required>Alasan pembatalan</Label>
            <Textarea id="mt-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <FieldHint>Bila perbaikan sudah dimulai, status barang dipulihkan.</FieldHint>
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
