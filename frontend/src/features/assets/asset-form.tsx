'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { categoriesApi } from '@/lib/api/categories';
import { departmentsApi } from '@/lib/api/departments';
import { applyApiError } from '@/lib/api/form-errors';
import {
  ACQUISITION_LABEL,
  CONDITION_LABEL,
  OWNERSHIP_LABEL,
  STATUS_LABEL,
} from '@/lib/asset-labels';
import {
  ACQUISITION_METHODS,
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  OWNERSHIP_TYPES,
} from '@/types/api';
import Link from 'next/link';
import { EmployeeLookup } from '@/features/employees/employee-lookup';
import { FLOW_STATUSES, assetFormSchema, emptyAssetForm } from './asset-form.schema';
import type { AssetFormValues } from './asset-form.schema';
import { AssetConditionBadge } from './asset-table';

const FIELDS = Object.keys(emptyAssetForm) as (keyof AssetFormValues)[];
/** Statuses a person may set by hand; the others belong to loans, repairs and disposals. */
const MANUAL_STATUSES = ASSET_STATUSES.filter((s) => !FLOW_STATUSES.includes(s));

const FLOW_STATUS_HINT: Partial<Record<AssetFormValues['status'], string>> = {
  BORROWED: 'Barang sedang dipinjam; status kembali otomatis saat pengembalian dicatat.',
  UNDER_MAINTENANCE: 'Barang sedang diperbaiki; status kembali otomatis saat perbaikan selesai atau dibatalkan.',
  DISPOSED: 'Barang sudah dilepas; batalkan pelepasan untuk mengembalikannya.',
};

/** What the edit form shows read-only: these change only through a mutation or a condition check. */
export interface LockedAssetFields {
  assetId: string;
  responsibleLabel: string | null;
  condition: AssetFormValues['condition'];
  /** The current status when a loan, repair or disposal owns it: the status select is frozen meanwhile. */
  flowStatus: AssetFormValues['status'] | null;
}

export function AssetForm({
  mode = 'create',
  initial = emptyAssetForm,
  initialResponsibleLabel = null,
  locked,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  mode?: 'create' | 'edit';
  initial?: AssetFormValues;
  initialResponsibleLabel?: string | null;
  /** Required when `mode === 'edit'`. */
  locked?: LockedAssetFields;
  submitLabel: string;
  onSubmit: (values: AssetFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = mode === 'edit';
  const [formError, setFormError] = useState<string | null>(null);
  const [responsibleLabel, setResponsibleLabel] = useState<string | null>(initialResponsibleLabel);
  const form = useForm<AssetFormValues>({ resolver: zodResolver(assetFormSchema), defaultValues: initial });
  const { errors, isSubmitting } = form.formState;

  const categories = useQuery({
    queryKey: ['categories', { isActive: true, pageSize: 100 }],
    queryFn: () => categoriesApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });
  const departments = useQuery({
    queryKey: ['departments', { isActive: true, pageSize: 100 }],
    queryFn: () => departmentsApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });
  // The selects are uncontrolled: when their options arrive after the form mounted, the browser
  // shows the empty option although the form still holds the value. Re-apply it once they load.
  useEffect(() => {
    if (categories.data) form.setValue('categoryId', form.getValues('categoryId'));
  }, [categories.data, form]);
  useEffect(() => {
    if (departments.data) form.setValue('departmentId', form.getValues('departmentId'));
  }, [departments.data, form]);

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
          <CardTitle>Identitas barang</CardTitle>
          <CardDescription>Asset Code dibuat otomatis saat disimpan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field className="md:col-span-2">
            <Label htmlFor="name" required>Nama barang</Label>
            <Input id="name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="categoryId" required>Kategori</Label>
            <Select id="categoryId" aria-invalid={Boolean(errors.categoryId)} {...form.register('categoryId')}>
              <option value="">{categories.isPending ? 'Memuat...' : 'Pilih kategori...'}</option>
              {categories.data?.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <FieldError>{errors.categoryId?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="brand">Merek</Label>
            <Input id="brand" {...form.register('brand')} />
            <FieldError>{errors.brand?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="model">Tipe / model</Label>
            <Input id="model" {...form.register('model')} />
            <FieldError>{errors.model?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="serialNumber">Nomor seri</Label>
            <Input id="serialNumber" className="font-mono" {...form.register('serialNumber')} />
            <FieldError>{errors.serialNumber?.message}</FieldError>
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" rows={3} {...form.register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perolehan dan kepemilikan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field>
            <Label htmlFor="ownershipType" required>Kepemilikan</Label>
            <Select id="ownershipType" {...form.register('ownershipType')}>
              {OWNERSHIP_TYPES.map((v) => (
                <option key={v} value={v}>{OWNERSHIP_LABEL[v]}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="acquisitionMethod" required>Metode perolehan</Label>
            <Select id="acquisitionMethod" {...form.register('acquisitionMethod')}>
              {ACQUISITION_METHODS.map((v) => (
                <option key={v} value={v}>{ACQUISITION_LABEL[v]}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="acquisitionDate">Tanggal perolehan</Label>
            <Input id="acquisitionDate" type="date" aria-invalid={Boolean(errors.acquisitionDate)} {...form.register('acquisitionDate')} />
            <FieldError>{errors.acquisitionDate?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="purchasePrice">Harga perolehan (Rp)</Label>
            <Input id="purchasePrice" inputMode="decimal" placeholder="mis. 1500000" aria-invalid={Boolean(errors.purchasePrice)} {...form.register('purchasePrice')} />
            <FieldHint>Angka saja, tanpa titik atau koma ribuan.</FieldHint>
            <FieldError>{errors.purchasePrice?.message}</FieldError>
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor="vendor">Penyedia / vendor</Label>
            <Input id="vendor" {...form.register('vendor')} />
            <FieldError>{errors.vendor?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unit kerja dan penanggung jawab</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field>
            <Label htmlFor="departmentId">Unit kerja</Label>
            <Select id="departmentId" {...form.register('departmentId')}>
              <option value="">Tidak ada</option>
              {departments.data?.data.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </Select>
            <FieldError>{errors.departmentId?.message}</FieldError>
          </Field>
          {isEdit && locked ? (
            <Field>
              <Label>Penanggung jawab</Label>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
                <span>{locked.responsibleLabel ?? '-'}</span>
                <Link href={`/mutations/new?assetId=${locked.assetId}`} className="text-primary hover:underline">
                  Ubah lewat mutasi
                </Link>
              </div>
            </Field>
          ) : (
            <Field>
              <Label htmlFor="responsibleEmployeeId">Penanggung jawab</Label>
              <Controller
                control={form.control}
                name="responsibleEmployeeId"
                render={({ field }) => (
                  <EmployeeLookup
                    id="responsibleEmployeeId"
                    value={field.value}
                    label={responsibleLabel}
                    invalid={Boolean(errors.responsibleEmployeeId)}
                    clearLabel="Hapus penanggung jawab"
                    onChange={(id, label) => {
                      field.onChange(id);
                      setResponsibleLabel(label);
                    }}
                  />
                )}
              />
              <FieldHint>Dipilih dari daftar pegawai. Setelah tersimpan, pergantian dilakukan lewat mutasi.</FieldHint>
              <FieldError>{errors.responsibleEmployeeId?.message}</FieldError>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kondisi, status, dan catatan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {isEdit && locked ? (
            <Field>
              <Label>Kondisi</Label>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
                <AssetConditionBadge condition={locked.condition} />
                <Link href={`/assets/${locked.assetId}?tab=conditions`} className="text-primary hover:underline">
                  Catat pemeriksaan
                </Link>
              </div>
            </Field>
          ) : (
            <Field>
              <Label htmlFor="condition" required>Kondisi</Label>
              <Select id="condition" {...form.register('condition')}>
                {ASSET_CONDITIONS.map((v) => (
                  <option key={v} value={v}>{CONDITION_LABEL[v]}</option>
                ))}
              </Select>
              {!isEdit ? <FieldHint>Tercatat sebagai pemeriksaan kondisi awal.</FieldHint> : null}
            </Field>
          )}
          <Field>
            <Label htmlFor="status" required>Status operasional</Label>
            <Select id="status" disabled={Boolean(locked?.flowStatus)} {...form.register('status')}>
              {locked?.flowStatus ? <option value={locked.flowStatus}>{STATUS_LABEL[locked.flowStatus]}</option> : null}
              {MANUAL_STATUSES.map((v) => (
                <option key={v} value={v}>{STATUS_LABEL[v]}</option>
              ))}
            </Select>
            {locked?.flowStatus ? (
              <FieldHint>{FLOW_STATUS_HINT[locked.flowStatus] ?? 'Status ini diatur oleh alurnya sendiri.'}</FieldHint>
            ) : (
              <FieldHint>Status Dipinjam, Dalam perbaikan, dan Dihapuskan diatur oleh peminjaman, pemeliharaan, dan pelepasan.</FieldHint>
            )}
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor="notes">Catatan internal</Label>
            <Textarea id="notes" rows={3} {...form.register('notes')} />
            <FieldHint>Tidak ditampilkan pada halaman publik QR.</FieldHint>
            <FieldError>{errors.notes?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Batal
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
