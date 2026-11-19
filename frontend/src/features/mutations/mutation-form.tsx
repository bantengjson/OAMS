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
import { LocationSelect } from '@/features/assets/location-select';
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
  const moveLocation = useWatch({ control: form.control, name: 'moveLocation' });
  const changeResponsible = useWatch({ control: form.control, name: 'changeResponsible' });
  const releaseResponsible = useWatch({ control: form.control, name: 'releaseResponsible' });

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
          <CardDescription>Lokasi dan penanggung jawab saat ini ditampilkan sebagai acuan.</CardDescription>
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
          <CardTitle>Perubahan yang diajukan</CardTitle>
          <CardDescription>Pilih satu atau keduanya.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...form.register('moveLocation')} />
            Pindah lokasi
          </label>
          <FieldError>{errors.moveLocation?.message}</FieldError>
          {moveLocation ? (
            <Field className="pl-6">
              <Label htmlFor="toLocationId" required>Lokasi tujuan</Label>
              <LocationSelect id="toLocationId" aria-invalid={Boolean(errors.toLocationId)} {...form.register('toLocationId')} />
              {shownAsset ? <FieldHint>Saat ini: {shownAsset.location.path}</FieldHint> : null}
              <FieldError>{errors.toLocationId?.message}</FieldError>
            </Field>
          ) : null}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...form.register('changeResponsible')} />
            Ganti penanggung jawab
          </label>
          {changeResponsible ? (
            <div className="flex flex-col gap-3 pl-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...form.register('releaseResponsible')} />
                Lepaskan tanpa penanggung jawab baru
              </label>
              {!releaseResponsible ? (
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
                  {shownAsset ? (
                    <FieldHint>Saat ini: {shownAsset.responsibleEmployee?.fullName ?? 'tidak ada'}</FieldHint>
                  ) : null}
                  <FieldError>{errors.toResponsibleEmployeeId?.message}</FieldError>
                </Field>
              ) : null}
            </div>
          ) : null}

          <Field>
            <Label htmlFor="reason" required>Alasan</Label>
            <Textarea id="reason" rows={3} placeholder="Mis. ruang rapat lantai 1 butuh proyektor tetap" {...form.register('reason')} />
            <FieldError>{errors.reason?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Batal</Button>
        <Button type="submit" loading={isSubmitting} disabled={Boolean(blocked)}>
          {canApprove ? 'Pindahkan sekarang' : 'Ajukan mutasi'}
        </Button>
      </div>
    </form>
  );
}
