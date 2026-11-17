'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api/form-errors';
import { rolesApi } from '@/lib/api/roles';
import { usersApi } from '@/lib/api/users';
import type { User } from '@/types/api';

export function UserRolesDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title="Atur role"
      description={user ? `${user.fullName} · ${user.email}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="user-roles-form">
            Simpan
          </Button>
        </>
      }
    >
      {user ? <RolesPicker key={user.id} user={user} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function RolesPicker({ user, onSaved }: { user: User; onSaved: () => void }) {
  const roles = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const [selected, setSelected] = useState<string[]>(() => user.roles.map((r) => r.code));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => usersApi.setRoles(user.id, selected),
    onSuccess: () => {
      toast.success('Role pengguna diperbarui.');
      onSaved();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <form
      id="user-roles-form"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length > 0) save.mutate();
      }}
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {roles.isPending ? (
        <p className="text-sm text-muted-foreground">Memuat role...</p>
      ) : (
        roles.data?.map((role) => (
          <label key={role.code} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input"
              checked={selected.includes(role.code)}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked ? [...prev, role.code] : prev.filter((c) => c !== role.code),
                )
              }
            />
            <span>
              <span className="font-medium">{role.name}</span>
              {role.description ? (
                <span className="block text-xs text-muted-foreground">{role.description}</span>
              ) : null}
            </span>
          </label>
        ))
      )}
      {selected.length === 0 ? (
        <p className="text-xs text-destructive">Pilih minimal satu role.</p>
      ) : null}
      {save.isPending ? <p className="text-xs text-muted-foreground">Menyimpan...</p> : null}
    </form>
  );
}
