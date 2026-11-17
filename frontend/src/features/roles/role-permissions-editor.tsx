'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api/form-errors';
import { rolesApi } from '@/lib/api/roles';
import type { Role } from '@/types/api';

const MODULE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  assets: 'Inventaris',
  qr: 'QR Code',
  mutations: 'Mutasi',
  stock_opnames: 'Stock Opname',
  maintenance: 'Pemeliharaan',
  reports: 'Laporan',
  users: 'Pengguna',
  roles: 'Role & Izin',
  master_data: 'Data Master',
  categories: 'Kategori',
  locations: 'Lokasi',
  departments: 'Unit Kerja',
  settings: 'Pengaturan',
  audit_logs: 'Audit Log',
};

export function RolePermissionsEditor({
  role,
  canEdit,
  onSaved,
}: {
  role: Role;
  canEdit: boolean;
  onSaved: () => void;
}) {
  // Mounted with key={role.id} by the page, so state starts from the current role.
  const catalog = useQuery({ queryKey: ['permissions'], queryFn: rolesApi.permissions });
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.permissions));
  const [error, setError] = useState<string | null>(null);

  const locked = role.code === 'SUPER_ADMIN' || !canEdit;
  const dirty =
    selected.size !== role.permissions.length || role.permissions.some((p) => !selected.has(p));

  const save = useMutation({
    mutationFn: () => rolesApi.setPermissions(role.id, Array.from(selected)),
    onSuccess: () => {
      toast.success(`Permission ${role.name} disimpan.`);
      onSaved();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const toggleModule = (codes: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (checked) next.add(c);
        else next.delete(c);
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{role.name}</h3>
        <p className="text-sm text-muted-foreground">{role.description}</p>
        {role.code === 'SUPER_ADMIN' ? (
          <Alert variant="info" className="mt-3">
            Super Admin selalu memiliki seluruh permission dan tidak dapat diubah.
          </Alert>
        ) : !canEdit ? (
          <Alert variant="info" className="mt-3">
            Anda hanya dapat melihat permission. Perubahan dilakukan oleh Super Admin.
          </Alert>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {catalog.isPending ? (
        <p className="text-sm text-muted-foreground">Memuat katalog permission...</p>
      ) : catalog.isError ? (
        <Alert variant="error">{getErrorMessage(catalog.error)}</Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.data?.map((group) => {
            const codes = group.permissions.map((p) => p.code);
            const all = codes.every((c) => selected.has(c));
            const some = !all && codes.some((c) => selected.has(c));
            return (
              <fieldset key={group.module} className="rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={all}
                      ref={(el) => {
                        if (el) el.indeterminate = some;
                      }}
                      disabled={locked}
                      onChange={(e) => toggleModule(codes, e.target.checked)}
                    />
                    {MODULE_LABEL[group.module] ?? group.module}
                  </label>
                </legend>
                <div className="mt-1 flex flex-col gap-1.5">
                  {group.permissions.map((p) => (
                    <label key={p.code} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-input"
                        checked={selected.has(p.code)}
                        disabled={locked}
                        onChange={(e) => toggleModule([p.code], e.target.checked)}
                      />
                      <span>
                        {p.description}
                        <span className="block font-mono text-[11px] text-muted-foreground">{p.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {!locked ? (
        <div className="flex items-center gap-2">
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
            Simpan permission
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set(role.permissions))} disabled={!dirty}>
            Batalkan perubahan
          </Button>
        </div>
      ) : null}
    </div>
  );
}
