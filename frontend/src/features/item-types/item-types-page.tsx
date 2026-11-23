'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { categoriesApi } from '@/lib/api/categories';
import type { CategoryQuery } from '@/lib/api/categories';
import { applyApiError, getErrorMessage } from '@/lib/api/form-errors';
import { assetCodeOrgApi } from '@/lib/api/rooms';
import type { Category, Golongan } from '@/types/api';
import { itemTypeSchema, orgCodeSchema } from './item-type-form.schema';
import type { ItemTypeFormInput, ItemTypeFormValues } from './item-type-form.schema';

const pad3 = (n: number) => String(n).padStart(3, '0');

/** "Jenis Barang": the office's numbered item types (BG vehicles, NG everything else). */
export function ItemTypesPage({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [golongan, setGolongan] = useState<'' | Golongan>('');
  const [kind, setKind] = useState<'' | 'unit' | 'group'>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Category | null | 'new'>(null);
  const [toggling, setToggling] = useState<Category | null>(null);
  const [editingOrg, setEditingOrg] = useState(false);

  const query: CategoryQuery = {
    page,
    pageSize: 50,
    search: debouncedSearch || undefined,
    golongan: golongan || undefined,
    isGroup: kind === '' ? undefined : kind === 'group',
  };
  const list = useQuery({ queryKey: ['categories', 'types', query], queryFn: () => categoriesApi.list(query) });
  const org = useQuery({ queryKey: ['asset-code-org'], queryFn: assetCodeOrgApi.get });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['categories'] });
  const toggle = useMutation({
    mutationFn: (row: Category) => (row.isActive ? categoriesApi.deactivate(row.id) : categoriesApi.activate(row.id)),
    onSuccess: (_, row) => {
      toast.success(`Jenis barang ${row.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setToggling(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Jenis Barang"
        description="Daftar jenis sesuai format inventaris kantor. Nomor jenis menjadi bagian kode barang dan tidak berubah setelah dipakai."
        actions={
          canManage ? (
            <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
              Tambah jenis
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Format kode:</span>
        <span className="font-mono">NG.A/012/{org.data?.value ?? 'DPC'}/2023-01</span>
        <span className="text-muted-foreground">· Kode organisasi:</span>
        <span className="font-mono font-semibold">{org.data?.value ?? '…'}</span>
        {canManage ? (
          <Button variant="ghost" size="sm" onClick={() => setEditingOrg(true)}>
            Ubah
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama jenis..."
            className="pl-9"
            aria-label="Cari jenis barang"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={golongan}
            onChange={(e) => {
              setGolongan(e.target.value as typeof golongan);
              setPage(1);
            }}
            aria-label="Filter golongan"
          >
            <option value="">Semua golongan</option>
            <option value="BG">BG · Bergerak</option>
            <option value="NG">NG · Tidak bergerak</option>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setPage(1);
            }}
            aria-label="Filter jenis kelompok"
          >
            <option value="">Semua jenis</option>
            <option value="unit">Per unit (ber-QR)</option>
            <option value="group">Barang kelompok</option>
          </Select>
        </div>
      </div>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}

      <Table>
        <THead>
          <TR>
            <TH className="w-24">No</TH>
            <TH>Nama</TH>
            <TH className="hidden w-40 md:table-cell">Golongan</TH>
            <TH className="hidden w-40 md:table-cell">Pencatatan</TH>
            <TH className="w-28">Status</TH>
            <TH className="w-28 text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={6}>Memuat...</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={6}>Belum ada jenis barang.</TableMessage>
          ) : (
            rows.map((row) => (
              <TR key={row.id}>
                <TD className="font-mono text-xs">
                  {row.golongan} {pad3(row.number)}
                </TD>
                <TD className="font-medium">{row.name}</TD>
                <TD className="hidden text-muted-foreground md:table-cell">
                  {row.golongan === 'BG' ? 'Bergerak' : 'Tidak bergerak'}
                </TD>
                <TD className="hidden md:table-cell">
                  {row.isGroup ? <Badge tone="teal">Barang kelompok</Badge> : <span className="text-muted-foreground">Per unit</span>}
                </TD>
                <TD>
                  <StatusBadge active={row.isActive} />
                </TD>
                <TD className="text-right">
                  {canManage ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(row)} aria-label={`Ubah ${row.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToggling(row)}
                        aria-label={`${row.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${row.name}`}
                      >
                        <Power className={row.isActive ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-success'} />
                      </Button>
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== 'new' ? 'Ubah jenis barang' : 'Tambah jenis barang'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" form="item-type-form">
              Simpan
            </Button>
          </>
        }
      >
        {editing !== null ? (
          <ItemTypeForm
            key={editing === 'new' ? 'new' : editing.id}
            row={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              invalidate();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={editingOrg}
        onClose={() => setEditingOrg(false)}
        title="Ubah kode organisasi"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingOrg(false)}>
              Batal
            </Button>
            <Button type="submit" form="org-form">
              Simpan
            </Button>
          </>
        }
      >
        {editingOrg ? (
          <OrgForm
            current={org.data?.value ?? 'DPC'}
            onSaved={() => {
              setEditingOrg(false);
              void queryClient.invalidateQueries({ queryKey: ['asset-code-org'] });
            }}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) toggle.mutate(toggling);
        }}
        loading={toggle.isPending}
        destructive={toggling?.isActive ?? false}
        title={toggling?.isActive ? 'Nonaktifkan jenis barang?' : 'Aktifkan jenis barang?'}
        confirmLabel={toggling?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {toggling?.isActive
          ? `"${toggling?.label}" tidak bisa dipilih untuk barang baru, tetapi barang lama tetap tersimpan.`
          : `"${toggling?.label}" akan bisa dipilih kembali.`}
      </ConfirmDialog>
    </>
  );
}

function ItemTypeForm({ row, onSaved }: { row: Category | null; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ItemTypeFormInput, unknown, ItemTypeFormValues>({
    resolver: zodResolver(itemTypeSchema),
    defaultValues: {
      golongan: row?.golongan ?? 'NG',
      number: row ? String(row.number) : '',
      name: row?.name ?? '',
      isGroup: row?.isGroup ?? false,
    },
  });
  const { errors } = form.formState;
  const locked = Boolean(row?.inUse);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (row) {
        await categoriesApi.update(row.id, locked ? { name: values.name } : values);
      } else {
        await categoriesApi.create(values);
      }
      toast.success('Jenis barang disimpan.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['golongan', 'number', 'name', 'isGroup']));
    }
  });

  return (
    <form id="item-type-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      {locked ? (
        <Alert variant="info">Jenis ini sudah dipakai barang: golongan, nomor, dan pencatatan tidak bisa diubah.</Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="it-golongan" required>
            Golongan
          </Label>
          <Select id="it-golongan" disabled={locked} {...form.register('golongan')}>
            <option value="NG">NG · Tidak bergerak</option>
            <option value="BG">BG · Bergerak (kendaraan)</option>
          </Select>
          <FieldError>{errors.golongan?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="it-number">Nomor jenis</Label>
          <Input id="it-number" inputMode="numeric" disabled={locked} placeholder="Otomatis" {...form.register('number')} />
          <FieldHint>Kosongkan untuk nomor berikutnya.</FieldHint>
          <FieldError>{errors.number?.message}</FieldError>
        </Field>
      </div>
      <Field>
        <Label htmlFor="it-name" required>
          Nama jenis
        </Label>
        <Input id="it-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" disabled={locked} {...form.register('isGroup')} />
        <span>
          <span className="font-medium text-foreground">Barang kelompok</span>
          <span className="block text-muted-foreground">Dihitung jumlahnya tanpa QR, misalnya piring atau sendok.</span>
        </span>
      </label>
    </form>
  );
}

function OrgForm({ current, onSaved }: { current: string; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ value: string }>({ resolver: zodResolver(orgCodeSchema), defaultValues: { value: current } });
  const submit = form.handleSubmit(async ({ value }) => {
    setFormError(null);
    try {
      await assetCodeOrgApi.set(value);
      toast.success('Kode organisasi disimpan. Berlaku untuk kode barang baru.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['value']));
    }
  });
  return (
    <form id="org-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Field>
        <Label htmlFor="org-value" required>
          Kode organisasi
        </Label>
        <Input id="org-value" className="font-mono uppercase" {...form.register('value')} />
        <FieldHint>Hanya untuk barang yang didaftarkan setelah ini. Kode barang lama tidak berubah.</FieldHint>
        <FieldError>{form.formState.errors.value?.message}</FieldError>
      </Field>
    </form>
  );
}
