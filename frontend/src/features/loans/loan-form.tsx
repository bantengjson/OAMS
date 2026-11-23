'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { FormSelect } from '@/components/ui/select-panel';
import { EmployeeLookup } from '@/features/employees/employee-lookup';
import { AssetPicker } from '@/features/mutations/asset-picker';
import { assetsApi } from '@/lib/api/assets';
import { departmentsApi } from '@/lib/api/departments';
import { applyApiError } from '@/lib/api/form-errors';
import { BORROWER_TYPE_LABEL } from '@/lib/operation-labels';
import { BORROWER_TYPES } from '@/types/api';
import type { AssetListItem } from '@/types/api';
import { defaultLoanDates, emptyLoanForm, loanFormSchema } from './loan-form.schema';
import type { LoanFormValues } from './loan-form.schema';

const FIELDS = Object.keys(emptyLoanForm) as (keyof LoanFormValues)[];

export function LoanForm({
  initialAssetId,
  onSubmit,
  onCancel,
}: {
  initialAssetId?: string;
  onSubmit: (values: LoanFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [asset, setAsset] = useState<AssetListItem | null>(null);
  const [borrowerLabel, setBorrowerLabel] = useState<string | null>(null);
  const [guarantorLabel, setGuarantorLabel] = useState<string | null>(null);
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: { ...emptyLoanForm, ...defaultLoanDates(), assetId: initialAssetId ?? '' },
  });
  const { errors, isSubmitting } = form.formState;
  const borrowerType = useWatch({ control: form.control, name: 'borrowerType' });
  const external = borrowerType === 'EXTERNAL';

  const preselected = useQuery({
    queryKey: ['assets', 'detail', initialAssetId],
    queryFn: () => assetsApi.get(initialAssetId!),
    enabled: Boolean(initialAssetId) && asset === null,
  });
  const shownAsset = asset ?? (preselected.data && preselected.data.id === initialAssetId ? preselected.data : null);
  const departments = useQuery({
    queryKey: ['departments', { isActive: true, pageSize: 100 }],
    queryFn: () => departmentsApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
    enabled: external,
  });
  const blocked = shownAsset?.isArchived
    ? 'Barang ini diarsipkan dan tidak bisa dipinjamkan.'
    : shownAsset?.status === 'BORROWED'
      ? 'Barang ini sedang dipinjam. Catat pengembaliannya dulu.'
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
          <CardDescription>Status barang menjadi Dipinjam sampai pengembalian dicatat.</CardDescription>
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
          <CardTitle>Peminjam</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <fieldset className="flex flex-wrap gap-4 md:col-span-2">
            <legend className="mb-2 text-sm font-medium">Jenis peminjam</legend>
            {BORROWER_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="radio" value={t} className="h-4 w-4" {...form.register('borrowerType')} />
                {BORROWER_TYPE_LABEL[t]}
              </label>
            ))}
          </fieldset>

          {external ? (
            <>
              <Field>
                <Label htmlFor="borrowerName" required>Nama peminjam</Label>
                <Input id="borrowerName" aria-invalid={Boolean(errors.borrowerName)} {...form.register('borrowerName')} />
                <FieldError>{errors.borrowerName?.message}</FieldError>
              </Field>
              <Field>
                <Label htmlFor="borrowerDepartmentId">Unit kerja terkait</Label>
                <FormSelect
                  id="borrowerDepartmentId"
                  control={form.control}
                  name="borrowerDepartmentId"
                  placeholder="Tidak ada"
                  emptyLabel="Tidak ada"
                  what="unit kerja"
                  options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                />
                <FieldHint>Opsional.</FieldHint>
              </Field>
              <Field className="md:col-span-2">
                <Label htmlFor="guarantorEmployeeId" required>Karyawan penjamin</Label>
                <Controller
                  control={form.control}
                  name="guarantorEmployeeId"
                  render={({ field }) => (
                    <EmployeeLookup
                      id="guarantorEmployeeId"
                      value={field.value}
                      label={guarantorLabel}
                      invalid={Boolean(errors.guarantorEmployeeId)}
                      clearLabel="Hapus penjamin"
                      onChange={(id, label) => {
                        field.onChange(id);
                        setGuarantorLabel(label);
                      }}
                    />
                  )}
                />
                <FieldHint>Karyawan yang bertanggung jawab atas barang selama dipinjam.</FieldHint>
                <FieldError>{errors.guarantorEmployeeId?.message}</FieldError>
              </Field>
            </>
          ) : (
            <Field className="md:col-span-2">
              <Label htmlFor="borrowerEmployeeId" required>Nama karyawan</Label>
              <Controller
                control={form.control}
                name="borrowerEmployeeId"
                render={({ field }) => (
                  <EmployeeLookup
                    id="borrowerEmployeeId"
                    value={field.value}
                    label={borrowerLabel}
                    invalid={Boolean(errors.borrowerEmployeeId)}
                    clearLabel="Hapus peminjam"
                    onChange={(id, label) => {
                      field.onChange(id);
                      setBorrowerLabel(label);
                    }}
                  />
                )}
              />
              <FieldHint>Unit kerja diambil dari data pegawai.</FieldHint>
              <FieldError>{errors.borrowerEmployeeId?.message}</FieldError>
            </Field>
          )}

          <Field className="md:col-span-2">
            <Label htmlFor="borrowerContact">Kontak</Label>
            <Input id="borrowerContact" placeholder="Nomor HP, opsional" {...form.register('borrowerContact')} />
            <FieldError>{errors.borrowerContact?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waktu dan keperluan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field>
            <Label htmlFor="loanedAt" required>Tanggal pinjam</Label>
            <Input id="loanedAt" type="date" aria-invalid={Boolean(errors.loanedAt)} {...form.register('loanedAt')} />
            <FieldError>{errors.loanedAt?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="dueAt" required>Rencana kembali</Label>
            <Input id="dueAt" type="date" aria-invalid={Boolean(errors.dueAt)} {...form.register('dueAt')} />
            <FieldError>{errors.dueAt?.message}</FieldError>
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor="purpose">Keperluan</Label>
            <Textarea id="purpose" rows={2} placeholder="Mis. presentasi di kantor cabang" {...form.register('purpose')} />
            <FieldError>{errors.purpose?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Batal</Button>
        <Button type="submit" loading={isSubmitting} disabled={Boolean(blocked)}>Simpan peminjaman</Button>
      </div>
    </form>
  );
}
