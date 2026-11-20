'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { usersApi } from '@/lib/api/users';
import { jakartaToday } from '@/lib/dates';
import type { UserLookupItem } from '@/types/api';

/** Opens a stock opname session; the server snapshots every live asset when it is created. */
export function CreateOpnameDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [plannedDate, setPlannedDate] = useState(jakartaToday());
  const [notes, setNotes] = useState('');
  const [officers, setOfficers] = useState<UserLookupItem[]>([]);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ['users', 'lookup', debounced],
    queryFn: () => usersApi.lookup(debounced || undefined),
  });
  const chosen = new Set(officers.map((o) => o.id));

  const act = useMutation({
    mutationFn: () =>
      stockOpnamesApi.create({
        name: name.trim(),
        plannedDate,
        notes: notes.trim() || null,
        officerIds: officers.map((o) => o.id),
      }),
    onSuccess: (session) => {
      toast.success('Sesi stock opname dibuka.');
      void queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      void queryClient.invalidateQueries({ queryKey: ['assets', 'statistics'] });
      router.push(`/stock-opnames/${session.id}`);
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Buka sesi stock opname"
      description="Semua barang aktif dicatat saat sesi dibuka. Barang yang terdaftar sesudahnya tidak ikut dihitung."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending} disabled={!name.trim() || !plannedDate}>
            Buka sesi
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field>
          <Label htmlFor="so-name" required>Nama sesi</Label>
          <Input id="so-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mis. Opname akhir tahun 2026" />
        </Field>
        <Field>
          <Label htmlFor="so-date" required>Tanggal</Label>
          <Input id="so-date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="so-notes">Catatan</Label>
          <Textarea id="so-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
        </Field>
        <Field>
          <Label htmlFor="so-officer-search">Petugas</Label>
          {officers.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {officers.map((o) => (
                <li key={o.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                  {o.fullName}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Hapus ${o.fullName}`}
                    onClick={() => setOfficers((prev) => prev.filter((p) => p.id !== o.id))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            id="so-officer-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Cari nama pengguna..."
            autoComplete="off"
          />
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
            {users.isPending ? (
              <li className="px-3 py-2 text-muted-foreground">Memuat...</li>
            ) : (users.data ?? []).length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">Tidak ada pengguna.</li>
            ) : (
              users.data!.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={chosen.has(u.id)}
                      onChange={(e) =>
                        setOfficers((prev) => (e.target.checked ? [...prev, u] : prev.filter((p) => p.id !== u.id)))
                      }
                    />
                    <span className="min-w-0 truncate">{u.fullName}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{u.department?.name ?? ''}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <FieldHint>Kosongkan bila semua pengguna dengan izin stock opname boleh memindai.</FieldHint>
        </Field>
      </div>
    </Dialog>
  );
}
