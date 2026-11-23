'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FilterSelect } from '@/components/ui/select-panel';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { STATUS_FILTER_OPTIONS } from '@/lib/filter-options';
import { applyApiError, getErrorMessage } from '@/lib/api/form-errors';
import { formatDateTime } from '@/lib/utils';
import type { MasterDataQuery, Paginated } from '@/types/api';

export interface MasterDataRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface MasterDataApi<Row extends MasterDataRow, Input> {
  list(query: MasterDataQuery): Promise<Paginated<Row>>;
  create(input: Input): Promise<Row>;
  update(id: string, input: Partial<Input>): Promise<Row>;
  deactivate(id: string): Promise<Row>;
  activate(id: string): Promise<Row>;
}

interface Labels {
  /** "Kategori" */
  singular: string;
  title: string;
  description: string;
  codeHint: string;
}

const CODE_PATTERN = /^[A-Z0-9_]{2,20}$/;

const schema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(CODE_PATTERN, 'Huruf besar, angka, garis bawah; 2-20 karakter')),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(150),
  description: z.string().trim().max(1000).optional(),
});

type FormValues = { code: string; name: string; description?: string };

export function MasterDataPage<Row extends MasterDataRow, Input extends FormValues>({
  api,
  queryKey,
  labels,
  withDescription,
  canManage,
}: {
  api: MasterDataApi<Row, Input>;
  queryKey: string;
  labels: Labels;
  withDescription: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null | 'new'>(null);
  const [toggling, setToggling] = useState<Row | null>(null);

  const query: MasterDataQuery = {
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
  };
  const list = useQuery({ queryKey: [queryKey, query], queryFn: () => api.list(query) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [queryKey] });
    void queryClient.invalidateQueries({ queryKey: ['count'] });
  };

  const toggle = useMutation({
    mutationFn: (row: Row) => (row.isActive ? api.deactivate(row.id) : api.activate(row.id)),
    onSuccess: (_, row) => {
      toast.success(`${labels.singular} ${row.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setToggling(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rows = list.data?.data ?? [];
  const colSpan = withDescription ? 6 : 5;
  const lower = labels.singular.toLowerCase();

  return (
    <>
      <PageHeader
        title={labels.title}
        description={labels.description}
        actions={
          canManage ? (
            <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
              Tambah {lower}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kode atau nama..."
            className="pl-9"
            aria-label="Cari"
          />
        </div>
        <FilterSelect
          className="w-full sm:w-44"
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
          neutral="all"
          options={STATUS_FILTER_OPTIONS}
        />
      </div>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}

      <Table>
        <THead>
          <TR>
            <TH className="w-36">Kode</TH>
            <TH>Nama</TH>
            {withDescription ? <TH className="hidden md:table-cell">Deskripsi</TH> : null}
            <TH className="w-28">Status</TH>
            <TH className="hidden w-44 lg:table-cell">Diperbarui</TH>
            <TH className="w-32 text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={colSpan}>Memuat...</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={colSpan}>Tidak ada data.</TableMessage>
          ) : (
            rows.map((row) => (
              <TR key={row.id}>
                <TD className="font-mono text-xs">{row.code}</TD>
                <TD className="font-medium">{row.name}</TD>
                {withDescription ? (
                  <TD className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                    {row.description || '-'}
                  </TD>
                ) : null}
                <TD>
                  <StatusBadge active={row.isActive} />
                </TD>
                <TD className="hidden text-muted-foreground lg:table-cell">
                  {formatDateTime(row.updatedAt)}
                </TD>
                <TD className="text-right">
                  {canManage ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(row)}
                        aria-label={`Ubah ${row.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToggling(row)}
                        aria-label={`${row.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${row.name}`}
                      >
                        <Power
                          className={row.isActive ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-success'}
                        />
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
        title={editing && editing !== 'new' ? `Ubah ${lower}` : `Tambah ${lower}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" form="master-data-form">
              Simpan
            </Button>
          </>
        }
      >
        {editing !== null ? (
          <MasterDataForm
            key={editing === 'new' ? 'new' : editing.id}
            row={editing === 'new' ? null : editing}
            api={api}
            labels={labels}
            withDescription={withDescription}
            onSaved={() => {
              setEditing(null);
              invalidate();
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
        title={toggling?.isActive ? `Nonaktifkan ${lower}?` : `Aktifkan ${lower}?`}
        confirmLabel={toggling?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {toggling?.isActive
          ? `${labels.singular} "${toggling?.name}" tidak akan bisa dipilih lagi, tetapi data lama tetap tersimpan.`
          : `${labels.singular} "${toggling?.name}" akan bisa dipilih kembali.`}
      </ConfirmDialog>
    </>
  );
}

/** Mounted fresh for every open (keyed by row), so defaults come straight from props. */
function MasterDataForm<Row extends MasterDataRow, Input extends FormValues>({
  row,
  api,
  labels,
  withDescription,
  onSaved,
}: {
  row: Row | null;
  api: MasterDataApi<Row, Input>;
  labels: Labels;
  withDescription: boolean;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: row?.code ?? '',
      name: row?.name ?? '',
      description: row?.description ?? '',
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      code: values.code,
      name: values.name,
      ...(withDescription
        ? { description: values.description?.trim() ? values.description : null }
        : {}),
    } as unknown as Input;
    try {
      if (row) await api.update(row.id, payload);
      else await api.create(payload);
      toast.success(`${labels.singular} disimpan.`);
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['code', 'name', 'description']));
    }
  });

  return (
    <form id="master-data-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Field>
        <Label htmlFor="md-code" required>
          Kode
        </Label>
        <Input
          id="md-code"
          className="font-mono uppercase"
          aria-invalid={Boolean(errors.code)}
          {...form.register('code')}
        />
        <FieldHint>{labels.codeHint}</FieldHint>
        <FieldError>{errors.code?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="md-name" required>
          Nama
        </Label>
        <Input id="md-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>
      {withDescription ? (
        <Field>
          <Label htmlFor="md-description">Deskripsi</Label>
          <Textarea id="md-description" rows={3} {...form.register('description')} />
          <FieldError>{errors.description?.message}</FieldError>
        </Field>
      ) : null}
    </form>
  );
}
