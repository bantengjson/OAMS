'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, History, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { FilterSelect, FormSelect } from '@/components/ui/select-panel';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { categoriesApi } from '@/lib/api/categories';
import { applyApiError, getErrorMessage } from '@/lib/api/form-errors';
import { groupItemsApi } from '@/lib/api/group-items';
import type { GroupItemQuery } from '@/lib/api/group-items';
import { roomsApi } from '@/lib/api/rooms';
import { formatDateTime } from '@/lib/utils';
import type { GroupItem } from '@/types/api';

const count = z
  .string()
  .trim()
  .refine((v) => /^\d+$/.test(v), 'Bilangan bulat 0 atau lebih');

export const groupItemSchema = z.object({
  categoryId: z.string().min(1, 'Pilih jenis'),
  locationId: z.string().min(1, 'Pilih ruangan'),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(200),
  acquisitionYear: z.string().trim(),
  specification: z.string().trim().max(500),
  source: z.string().trim().max(300),
  qtyGood: count,
  qtyNeedsRepair: count,
  qtyDamaged: count,
  reason: z.string().trim().max(500),
});
type FormValues = z.infer<typeof groupItemSchema>;

const textOrNull = (v: string) => (v.trim() ? v.trim() : null);

/** Barang Kelompok: counted goods (kitchenware) per type and room, without QR. */
export function GroupItemsPanel({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [roomId, setRoomId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GroupItem | 'new' | null>(null);
  const [viewing, setViewing] = useState<GroupItem | null>(null);
  const [archiving, setArchiving] = useState<GroupItem | null>(null);

  const query: GroupItemQuery = { page, pageSize: 50, search: debounced || undefined, locationId: roomId || undefined };
  const list = useQuery({ queryKey: ['group-items', query], queryFn: () => groupItemsApi.list(query) });
  const rooms = useQuery({ queryKey: ['rooms', 'active'], queryFn: () => roomsApi.list({ isActive: true }), staleTime: 60_000 });
  const roomOptions = (rooms.data ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
  const rows = list.data?.data ?? [];
  const totalUnits = rows.reduce((s, r) => s + r.total, 0);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['group-items'] });
    void queryClient.invalidateQueries({ queryKey: ['assets', 'statistics'] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama atau jenis..."
            className="pl-9"
            aria-label="Cari barang kelompok"
          />
        </div>
        <FilterSelect
          className="w-full sm:w-52"
          label="Ruangan"
          value={roomId}
          onChange={(v) => {
            setRoomId(v);
            setPage(1);
          }}
          panelWidth={288}
          options={roomOptions}
        />
        {canCreate ? (
          <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
            Tambah barang kelompok
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Barang yang dihitung jumlahnya, tanpa QR (mis. piring, sendok). Dihitung ulang saat stock opname.
        {list.data ? ` Halaman ini: ${rows.length} baris · ${totalUnits} unit.` : ''}
      </p>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}

      <Table>
        <THead>
          <TR>
            <TH className="w-44">Kode</TH>
            <TH>Nama</TH>
            <TH className="hidden w-40 md:table-cell">Ruangan</TH>
            <TH className="w-16 text-right">Baik</TH>
            <TH className="hidden w-24 text-right sm:table-cell">Perlu Perbaikan</TH>
            <TH className="w-16 text-right">Rusak</TH>
            <TH className="w-16 text-right">Total</TH>
            <TH className="w-32 text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={8}>Memuat...</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={8}>Belum ada barang kelompok.</TableMessage>
          ) : (
            rows.map((g) => (
              <TR key={g.id}>
                <TD className="whitespace-nowrap font-mono text-xs">{g.code}</TD>
                <TD>
                  <p className="font-medium text-foreground">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.type.name}
                    {g.specification ? ` · ${g.specification}` : ''}
                  </p>
                </TD>
                <TD className="hidden md:table-cell">{g.room.code} · {g.room.name}</TD>
                <TD className="text-right tabular-nums">{g.qtyGood}</TD>
                <TD className="hidden text-right tabular-nums sm:table-cell">{g.qtyNeedsRepair}</TD>
                <TD className="text-right tabular-nums">{g.qtyDamaged}</TD>
                <TD className="text-right font-semibold tabular-nums">{g.total}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(g)} aria-label={`Riwayat ${g.name}`}>
                      <History className="h-4 w-4" />
                    </Button>
                    {canUpdate ? (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(g)} aria-label={`Ubah ${g.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {canArchive ? (
                      <Button variant="ghost" size="icon" onClick={() => setArchiving(g)} aria-label={`Arsipkan ${g.name}`}>
                        <Archive className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
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
        title={editing && editing !== 'new' ? `Ubah ${editing.name}` : 'Tambah barang kelompok'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button type="submit" form="group-item-form">Simpan</Button>
          </>
        }
      >
        {editing !== null ? (
          <GroupItemForm
            key={editing === 'new' ? 'new' : editing.id}
            row={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              invalidate();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `Riwayat ${viewing.name}` : 'Riwayat'}>
        {viewing ? <GroupItemHistory id={viewing.id} /> : null}
      </Dialog>

      <ArchiveDialog row={archiving} onClose={() => setArchiving(null)} onDone={invalidate} />
    </div>
  );
}

function GroupItemForm({ row, onSaved }: { row: GroupItem | null; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const types = useQuery({
    queryKey: ['categories', 'all-pages', { isActive: true, isGroup: true }],
    queryFn: () => categoriesApi.listAll({ isActive: true, isGroup: true }),
    staleTime: 60_000,
  });
  const rooms = useQuery({ queryKey: ['rooms', 'active'], queryFn: () => roomsApi.list({ isActive: true }), staleTime: 60_000 });
  const roomOptions = (rooms.data ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
  const form = useForm<FormValues>({
    resolver: zodResolver(groupItemSchema),
    defaultValues: {
      categoryId: row?.type.id ?? '',
      locationId: row?.room.id ?? '',
      name: row?.name ?? '',
      acquisitionYear: row?.acquisitionYear ? String(row.acquisitionYear) : '',
      specification: row?.specification ?? '',
      source: row?.source ?? '',
      qtyGood: String(row?.qtyGood ?? 0),
      qtyNeedsRepair: String(row?.qtyNeedsRepair ?? 0),
      qtyDamaged: String(row?.qtyDamaged ?? 0),
      reason: '',
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    const year = v.acquisitionYear.trim();
    if (!row && !/^(19|20)\d{2}$/.test(year)) {
      form.setError('acquisitionYear', { message: 'Tahun pengadaan 4 digit, mis. 2023' });
      return;
    }
    if (row && v.reason.trim().length < 3) {
      form.setError('reason', { message: 'Alasan perubahan wajib diisi' });
      return;
    }
    const base = {
      locationId: v.locationId,
      name: v.name.trim(),
      specification: textOrNull(v.specification),
      source: textOrNull(v.source),
      qtyGood: Number(v.qtyGood),
      qtyNeedsRepair: Number(v.qtyNeedsRepair),
      qtyDamaged: Number(v.qtyDamaged),
    };
    try {
      if (row) {
        await groupItemsApi.update(row.id, { ...base, ...(year ? { acquisitionYear: Number(year) } : {}), reason: v.reason.trim() });
      } else {
        await groupItemsApi.create({ ...base, categoryId: v.categoryId, acquisitionYear: Number(year) });
      }
      toast.success('Barang kelompok disimpan.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, Object.keys(form.getValues()) as (keyof FormValues)[]));
    }
  });

  return (
    <form id="group-item-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="gi-type" required>Jenis</Label>
          <FormSelect
            id="gi-type"
            control={form.control}
            name="categoryId"
            disabled={Boolean(row)}
            placeholder={types.isPending ? 'Memuat...' : 'Pilih jenis...'}
            what="jenis"
            options={(types.data ?? []).map((t) => ({ value: t.id, label: t.label }))}
          />
          <FieldError>{errors.categoryId?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="gi-room" required>Ruangan</Label>
          <FormSelect
            id="gi-room"
            control={form.control}
            name="locationId"
            placeholder="Pilih ruangan..."
            what="ruangan"
            options={roomOptions}
          />
          <FieldError>{errors.locationId?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="gi-name" required>Nama</Label>
          <Input id="gi-name" {...form.register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="gi-year" required={!row}>Tahun pengadaan</Label>
          <Input id="gi-year" inputMode="numeric" placeholder="mis. 2023" {...form.register('acquisitionYear')} />
          <FieldError>{errors.acquisitionYear?.message}</FieldError>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <Label htmlFor="gi-good">Baik</Label>
          <Input id="gi-good" inputMode="numeric" {...form.register('qtyGood')} />
          <FieldError>{errors.qtyGood?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="gi-repair">Perlu Perbaikan</Label>
          <Input id="gi-repair" inputMode="numeric" {...form.register('qtyNeedsRepair')} />
          <FieldError>{errors.qtyNeedsRepair?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="gi-damaged">Rusak</Label>
          <Input id="gi-damaged" inputMode="numeric" {...form.register('qtyDamaged')} />
          <FieldError>{errors.qtyDamaged?.message}</FieldError>
        </Field>
      </div>
      <Field>
        <Label htmlFor="gi-spec">Spesifikasi</Label>
        <Input id="gi-spec" {...form.register('specification')} />
      </Field>
      <Field>
        <Label htmlFor="gi-source">Sumber</Label>
        <Input id="gi-source" {...form.register('source')} />
        <FieldHint>Kosongkan bila dibeli.</FieldHint>
      </Field>
      {row ? (
        <Field>
          <Label htmlFor="gi-reason" required>Alasan perubahan</Label>
          <Textarea id="gi-reason" rows={2} placeholder="mis. 2 piring pecah" {...form.register('reason')} />
          <FieldError>{errors.reason?.message}</FieldError>
        </Field>
      ) : null}
    </form>
  );
}

function GroupItemHistory({ id }: { id: string }) {
  const history = useQuery({ queryKey: ['group-items', id, 'history'], queryFn: () => groupItemsApi.history(id, { pageSize: 50 }) });
  if (history.isPending) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (history.isError) return <Alert variant="error">{getErrorMessage(history.error)}</Alert>;
  const label: Record<string, string> = {
    'group_item.created': 'Ditambahkan',
    'group_item.updated': 'Diubah',
    'group_item.archived': 'Diarsipkan',
    'group_item.opname_applied': 'Hasil stock opname',
  };
  const qty = (v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return o.qtyGood === undefined ? '' : `Baik ${o.qtyGood} · Perlu Perbaikan ${o.qtyNeedsRepair} · Rusak ${o.qtyDamaged}`;
  };
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {history.data.data.map((h) => (
        <li key={h.id} className="rounded-md border border-border p-3">
          <p className="font-medium text-foreground">
            {label[h.action] ?? h.action} · <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
            {h.actor ? <span className="text-muted-foreground"> · {h.actor.fullName}</span> : null}
          </p>
          {h.before ? <p className="text-xs text-muted-foreground">Sebelum: {qty(h.before)}</p> : null}
          {h.after ? <p className="text-xs text-muted-foreground">Sesudah: {qty(h.after)}</p> : null}
          {(h.after as { reason?: string } | null)?.reason ? (
            <p className="text-xs">Alasan: {(h.after as { reason: string }).reason}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ArchiveDialog({ row, onClose, onDone }: { row: GroupItem | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const archive = useMutation({
    mutationFn: () => groupItemsApi.archive(row!.id, reason.trim()),
    onSuccess: () => {
      toast.success('Barang kelompok diarsipkan.');
      setReason('');
      onClose();
      onDone();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title={row ? `Arsipkan ${row.name}?` : 'Arsipkan'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button variant="destructive" loading={archive.isPending} disabled={reason.trim().length < 3} onClick={() => archive.mutate()}>
            Arsipkan
          </Button>
        </>
      }
    >
      <Field>
        <Label htmlFor="gi-archive-reason" required>Alasan</Label>
        <Textarea id="gi-archive-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}
