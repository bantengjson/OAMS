'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { FormSelect } from '@/components/ui/select-panel';
import { applyApiError } from '@/lib/api/form-errors';
import { locationsApi } from '@/lib/api/locations';
import { LOCATION_TYPE_LABEL, LOCATION_TYPES } from '@/types/api';
import type { Location, LocationType } from '@/types/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_]{2,20}$/, 'Huruf besar, angka, garis bawah; 2-20 karakter')),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(150),
  type: z.enum(['OFFICE', 'BUILDING', 'FLOOR', 'ROOM']),
  parentId: z.string().optional(),
  description: z.string().trim().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function parentTypeOf(type: LocationType): LocationType | null {
  const index = LOCATION_TYPES.indexOf(type);
  return index <= 0 ? null : LOCATION_TYPES[index - 1];
}

export function childTypeOf(type: LocationType): LocationType | null {
  const index = LOCATION_TYPES.indexOf(type);
  return index < 0 || index === LOCATION_TYPES.length - 1 ? null : LOCATION_TYPES[index + 1];
}

export interface LocationFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: Location) => void;
  /** Editing an existing location; type becomes read-only. */
  location?: Location | null;
  /** Defaults when creating under a selected parent. */
  initialType?: LocationType;
  initialParentId?: string | null;
}

export function LocationFormDialog({
  open,
  onClose,
  onSaved,
  location,
  initialType = 'OFFICE',
  initialParentId = null,
}: LocationFormProps) {
  const title = location
    ? 'Ubah lokasi'
    : `Tambah ${LOCATION_TYPE_LABEL[initialType].toLowerCase()}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="location-form">
            Simpan
          </Button>
        </>
      }
    >
      {open ? (
        <LocationForm
          key={location?.id ?? `new-${initialType}-${initialParentId ?? ''}`}
          location={location ?? null}
          initialType={initialType}
          initialParentId={initialParentId}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function LocationForm({
  location,
  initialType,
  initialParentId,
  onSaved,
}: {
  location: Location | null;
  initialType: LocationType;
  initialParentId: string | null;
  onSaved: (saved: Location) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: location?.code ?? '',
      name: location?.name ?? '',
      type: location?.type ?? initialType,
      parentId: location?.parent?.id ?? initialParentId ?? '',
      description: location?.description ?? '',
    },
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: 'type' });
  const parentType = parentTypeOf(type);

  const parents = useQuery({
    queryKey: ['locations', 'parents', parentType],
    queryFn: () => locationsApi.list({ type: parentType!, isActive: true, pageSize: 100 }),
    enabled: parentType !== null,
  });

  // Keep the preselected parent as an option while the list loads; otherwise the
  // native <select> silently falls back to "" and the default is lost.
  const defaultParentId = location?.parent?.id ?? initialParentId ?? '';
  const loadedOptions = parents.data?.data.map((p) => ({ id: p.id, label: p.path })) ?? [];
  const parentOptions =
    defaultParentId && !loadedOptions.some((o) => o.id === defaultParentId)
      ? [{ id: defaultParentId, label: location?.parent?.name ?? 'Memuat...' }, ...loadedOptions]
      : loadedOptions;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    if (parentType && !values.parentId) {
      form.setError('parentId', {
        message: `Pilih ${LOCATION_TYPE_LABEL[parentType].toLowerCase()} induk`,
      });
      return;
    }
    try {
      const description = values.description?.trim() ? values.description : null;
      const parentId = parentType ? values.parentId : null;
      const saved = location
        ? await locationsApi.update(location.id, {
            code: values.code,
            name: values.name,
            description,
            parentId,
          })
        : await locationsApi.create({
            code: values.code,
            name: values.name,
            type: values.type,
            description,
            parentId,
          });
      toast.success('Lokasi disimpan.');
      onSaved(saved);
    } catch (error) {
      setFormError(
        applyApiError(error, form.setError, ['code', 'name', 'type', 'parentId', 'description']),
      );
    }
  });

  return (
    <form id="location-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <Field>
        <Label htmlFor="loc-type" required>
          Tipe
        </Label>
        <FormSelect
          id="loc-type"
          control={form.control}
          name="type"
          disabled={Boolean(location)}
          what="tipe"
          options={LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABEL[t] }))}
        />
        {location ? <FieldHint>Tipe lokasi tidak dapat diubah.</FieldHint> : null}
      </Field>

      {parentType ? (
        <Field>
          <Label htmlFor="loc-parent" required>
            {LOCATION_TYPE_LABEL[parentType]} induk
          </Label>
          <FormSelect
            id="loc-parent"
            control={form.control}
            name="parentId"
            placeholder={parents.isPending ? 'Memuat...' : 'Pilih...'}
            what="induk"
            options={parentOptions.map((p) => ({ value: p.id, label: p.label }))}
          />
          <FieldError>{errors.parentId?.message}</FieldError>
        </Field>
      ) : null}

      <Field>
        <Label htmlFor="loc-code" required>
          Kode
        </Label>
        <Input
          id="loc-code"
          className="font-mono uppercase"
          aria-invalid={Boolean(errors.code)}
          {...form.register('code')}
        />
        <FieldHint>Contoh: GA_L2_201. Huruf besar, angka, dan garis bawah.</FieldHint>
        <FieldError>{errors.code?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="loc-name" required>
          Nama
        </Label>
        <Input id="loc-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="loc-description">Deskripsi</Label>
        <Textarea id="loc-description" rows={3} {...form.register('description')} />
        <FieldError>{errors.description?.message}</FieldError>
      </Field>
    </form>
  );
}
