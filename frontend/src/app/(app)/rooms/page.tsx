'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { roomSchema } from '@/features/item-types/item-type-form.schema';
import { nextLetter } from '@/features/item-types/room-letter';
import type { RoomFormValues } from '@/features/item-types/item-type-form.schema';
import { applyApiError, getErrorMessage } from '@/lib/api/form-errors';
import { roomsApi } from '@/lib/api/rooms';
import { useAuth } from '@/lib/auth/use-auth';
import type { Room } from '@/types/api';

export default function RoomsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('locations.manage');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Room | null | 'new'>(null);
  const [toggling, setToggling] = useState<Room | null>(null);
  const list = useQuery({ queryKey: ['rooms', 'all'], queryFn: () => roomsApi.list() });
  const rooms = list.data ?? [];
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['rooms'] });

  const toggle = useMutation({
    mutationFn: (room: Room) => (room.isActive ? roomsApi.deactivate(room.id) : roomsApi.activate(room.id)),
    onSuccess: (_, room) => {
      toast.success(`Ruangan ${room.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setToggling(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Ruangan"
        description="Huruf ruangan menjadi bagian kode barang yang didaftarkan di ruangan itu dan tidak pernah berubah."
        actions={
          canManage ? (
            <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
              Tambah ruangan
            </Button>
          ) : null
        }
      />
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <Table>
        <THead>
          <TR>
            <TH className="w-20">Huruf</TH>
            <TH>Nama ruangan</TH>
            <TH className="w-28">Status</TH>
            <TH className="w-28 text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={4}>Memuat...</TableMessage>
          ) : rooms.length === 0 ? (
            <TableMessage colSpan={4}>Belum ada ruangan.</TableMessage>
          ) : (
            rooms.map((room) => (
              <TR key={room.id}>
                <TD className="font-mono text-sm font-semibold">{room.code}</TD>
                <TD className="font-medium">{room.name}</TD>
                <TD>
                  <StatusBadge active={room.isActive} />
                </TD>
                <TD className="text-right">
                  {canManage ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(room)} aria-label={`Ubah ${room.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToggling(room)}
                        aria-label={`${room.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${room.name}`}
                      >
                        <Power className={room.isActive ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-success'} />
                      </Button>
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== 'new' ? `Ubah ruangan ${editing.code}` : 'Tambah ruangan'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" form="room-form">
              Simpan
            </Button>
          </>
        }
      >
        {editing !== null ? (
          <RoomForm
            key={editing === 'new' ? 'new' : editing.id}
            room={editing === 'new' ? null : editing}
            nextCode={nextLetter(rooms.map((r) => r.code))}
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
        title={toggling?.isActive ? 'Nonaktifkan ruangan?' : 'Aktifkan ruangan?'}
        confirmLabel={toggling?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {toggling?.isActive
          ? `Ruangan ${toggling?.code} tidak bisa dipilih untuk barang baru. Barang yang sudah ada tetap tercatat.`
          : `Ruangan ${toggling?.code} akan bisa dipilih kembali.`}
      </ConfirmDialog>
    </>
  );
}

function RoomForm({ room, nextCode, onSaved }: { room: Room | null; nextCode: string; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RoomFormValues>({ resolver: zodResolver(roomSchema), defaultValues: { name: room?.name ?? '' } });
  const submit = form.handleSubmit(async ({ name }) => {
    setFormError(null);
    try {
      if (room) await roomsApi.rename(room.id, name);
      else await roomsApi.create(name);
      toast.success('Ruangan disimpan.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['name']));
    }
  });
  return (
    <form id="room-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Field>
        <Label>Huruf ruangan</Label>
        <p className="font-mono text-lg font-semibold">{room ? room.code : nextCode}</p>
        <FieldHint>{room ? 'Huruf tidak bisa diubah.' : 'Diberikan otomatis.'}</FieldHint>
      </Field>
      <Field>
        <Label htmlFor="room-name" required>
          Nama ruangan
        </Label>
        <Input id="room-name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
        <FieldError>{form.formState.errors.name?.message}</FieldError>
      </Field>
    </form>
  );
}
