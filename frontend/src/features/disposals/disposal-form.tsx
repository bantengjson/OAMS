'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AssetPicker } from '@/features/mutations/asset-picker';
import { assetsApi } from '@/lib/api/assets';
import { applyApiError } from '@/lib/api/form-errors';
import { jakartaToday } from '@/lib/dates';
import { DISPOSAL_REASON_LABEL } from '@/lib/operation-labels';
import { DISPOSAL_REASONS } from '@/types/api';
import type { AssetListItem } from '@/types/api';
import { disposalFormSchema, emptyDisposalForm } from './disposal-form.schema';
import type { DisposalFormValues } from './disposal-form.schema';

const FIELDS = Object.keys(emptyDisposalForm) as (keyof DisposalFormValues)[];

export function DisposalForm({
  initialAssetId,
  onSubmit,
  onCancel,
}: {
  initialAssetId?: string;
  onSubmit: (values: DisposalFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [asset, setAsset] = useState<AssetListItem | null>(null);
  const [confirming, setConfirming] = useState<DisposalFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const schema = useMemo(() => disposalFormSchema(), []);
  const form = useForm<DisposalFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...emptyDisposalForm, disposedAt: jakartaToday(), assetId: initialAssetId ?? '' },
  });
  const { errors } = form.formState;

  const preselected = useQuery({
    queryKey: ['assets', 'detail', initialAssetId],
    queryFn: () => assetsApi.get(initialAssetId!),
    enabled: Boolean(initialAssetId) && asset === null,
  });
  const shownAsset = asset ?? (preselected.data && preselected.data.id === initialAssetId ? preselected.data : null);
  const blocked = shownAsset?.isArchived
    ? 'Barang ini diarsipkan.'
    : shownAsset?.status === 'DISPOSED'
      ? 'Barang ini sudah dilepas.'
      : shownAsset?.status === 'BORROWED'
        ? 'Barang sedang dipinjam. Catat pengembaliannya dulu.'
        : shownAsset?.status === 'UNDER_MAINTENANCE'
          ? 'Barang sedang diperbaiki. Selesaikan atau batalkan perbaikannya dulu.'
          : null;

  const confirm = async () => {
    if (!confirming) return;
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(confirming);
    } catch (error) {
      setFormError(applyApiError(error, form.setError, FIELDS));
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  };

  return (
    <form onSubmit={form.handleSubmit((v) => setConfirming(v))} className="flex flex-col gap-6" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Barang</CardTitle>
          <CardDescription>Barang yang dilepas keluar dari inventaris aktif; riwayatnya tetap tersimpan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Controller
            control={form.control}
            name="assetId"
            render={({ field }) => (
              <AssetPicker
                id="assetId"
                value={shownAsset}
                invalid={Boolean(errors.assetId)}
                onChange={(a) => {
                  setAsset(a);
                  field.onChange(a?.id ?? '');
                }}
              />
            )}
          />
          <FieldError>{errors.assetId?.message}</FieldError>
          {blocked ? <Alert variant="info">{blocked}</Alert> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pelepasan</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field>
            <Label htmlFor="reason" required>Alasan</Label>
            <Select id="reason" {...form.register('reason')}>
              {DISPOSAL_REASONS.map((r) => (
                <option key={r} value={r}>{DISPOSAL_REASON_LABEL[r]}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="disposedAt" required>Tanggal</Label>
            <Input id="disposedAt" type="date" max={jakartaToday()} {...form.register('disposedAt')} />
            <FieldError>{errors.disposedAt?.message}</FieldError>
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor="description" required>Keterangan</Label>
            <Textarea id="description" rows={3} placeholder="Mis. layar pecah, tidak ekonomis diperbaiki" {...form.register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="value">Nilai jual (Rp)</Label>
            <Input id="value" inputMode="decimal" placeholder="Opsional" {...form.register('value')} />
            <FieldHint>Angka saja, tanpa titik atau koma ribuan.</FieldHint>
            <FieldError>{errors.value?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="recipient">Pembeli / penerima</Label>
            <Input id="recipient" placeholder="Opsional" {...form.register('recipient')} />
            <FieldError>{errors.recipient?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
        <Button type="submit" variant="destructive" disabled={Boolean(blocked)}>Lepaskan barang</Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={confirm}
        title="Lepaskan barang ini?"
        confirmLabel="Ya, lepaskan"
        destructive
        loading={saving}
      >
        Barang akan keluar dari inventaris aktif dan QR-nya dinonaktifkan. Pelepasan masih bisa dibatalkan dari halaman
        detail pelepasan.
      </ConfirmDialog>
    </form>
  );
}
