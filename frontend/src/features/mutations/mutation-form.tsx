'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { roomsApi } from '@/lib/api/rooms';
import { EmployeeLookup } from '@/features/employees/employee-lookup';
import { assetsApi } from '@/lib/api/assets';
import { applyApiError } from '@/lib/api/form-errors';
import type { AssetListItem } from '@/types/api';
import { AssetPicker } from './asset-picker';
import { emptyMutationForm, mutationFormSchema } from './mutation-form.schema';
import type { MutationFormValues } from './mutation-form.schema';

const FIELDS = Object.keys(emptyMutationForm) as (keyof MutationFormValues)[];

export function MutationForm({
  initialAssetId,
  canApprove,
  onSubmit,
  onCancel,
}: {
  initialAssetId?: string;
  /** Approvers' own requests are applied immediately; the button says so. */
  canApprove: boolean;
  onSubmit: (values: MutationFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [asset, setAsset] = useState<AssetListItem | null>(null);
  const [employeeLabel, setEmployeeLabel] = useState<string | null>(null);
  const form = useForm<MutationFormValues>({
    resolver: zodResolver(mutationFormSchema),
    defaultValues: { ...emptyMutationForm, assetId: initialAssetId ?? '' },
  });
  const { errors, isSubmitting } = form.formState;
  const responsibleMode = useWatch({ control: form.control, name: 'responsibleMode' });
  const rooms = useQuery({ queryKey: ['rooms', 'active'], queryFn: () => roomsApi.list({ isActive: true }), staleTime: 60_000 });

  // Preselected asset (from ?assetId=): load it once to show its current state.
  const preselected = useQuery({
    queryKey: ['assets', 'detail', initialAssetId],
    queryFn: () => assetsApi.get(initialAssetId!),
    enabled: Boolean(initialAssetId) && asset === null,
  });
  const shownAsset = asset ?? (preselected.data && preselected.data.id === initialAssetId ? preselected.data : null);
  const blocked = shownAsset?.isArchived
    ? 'Barang ini diarsipkan dan tidak bisa dimutasi.'
    : shownAsset?.status === 'BORROWED'
      ? 'Barang sedang dipinjam. Catat pengembaliannya dulu sebelum mengajukan mutasi.'
      : null;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(applyApiError(error, form.setError, FIELDS));
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Barang</CardTitle>
          <CardDescription>Ruangan dan penanggung jawab saat ini ditampilkan sebagai acuan. Kode barang tidak berubah.</CardDescription>
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
        <CardHeader>
          <CardTitle>Perubahan</CardTitle>
          <CardDescription>
            {shownAsset
              ? `Saat ini: ruangan ${shownAsset.room ? `${shownAsset.room.code} · ${shownAsset.room.name}` : '-'}, penanggung jawab ${shownAsset.responsibleEmployee?.fullName ?? 'tidak ada'}.`
              : 'Pilih barang terlebih dahulu.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="toLocationId">Pindah ke ruangan</Label>
            <Select id="toLocationId" aria-invalid={Boolean(errors.toLocationId)} {...form.register('toLocationId')}>
              <option value="">Tidak pindah ruangan</option>
              {rooms.data
                ?.filter((r) => r.id !== shownAsset?.room?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                ))}
            </Select>
            <FieldError>{errors.toLocationId?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="responsibleMode">Penanggung jawab</Label>
            <Select id="responsibleMode" {...form.register('responsibleMode')}>
              <option value="keep">Tetap</option>
              <option value="change">Ganti penanggung jawab</option>
              <option value="release">Lepaskan tanpa penanggung jawab</option>
            </Select>
          </Field>
          {responsibleMode === 'change' ? (
            <Field>
              <Label htmlFor="toResponsibleEmployeeId" required>Penanggung jawab baru</Label>
              <Controller
                control={form.control}
                name="toResponsibleEmployeeId"
                render={({ field }) => (
                  <EmployeeLookup
                    id="toResponsibleEmployeeId"
                    value={field.value}
                    label={employeeLabel}
                    invalid={Boolean(errors.toResponsibleEmployeeId)}
                    onChange={(id, label) => {
                      field.onChange(id);
                      setEmployeeLabel(label);
                    }}
                  />
                )}
              />
              <FieldHint>Dipilih dari daftar pegawai aktif.</FieldHint>
              <FieldError>{errors.toResponsibleEmployeeId?.message}</FieldError>
            </Field>
          ) : null}

          <Field>
            <Label htmlFor="reason" required>Alasan</Label>
            <Textarea id="reason" rows={3} placeholder="Mis. serah terima karena rotasi tugas" {...form.register('reason')} />
            <FieldError>{errors.reason?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Batal</Button>
        <Button type="submit" loading={isSubmitting} disabled={Boolean(blocked)}>
          {canApprove ? 'Ganti sekarang' : 'Ajukan mutasi'}
        </Button>
      </div>
    </form>
  );
}
