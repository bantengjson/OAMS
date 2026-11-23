'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FilterSelect } from '@/components/ui/select-panel';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ResetPasswordDialog } from '@/features/users/reset-password-dialog';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { UserRolesDialog } from '@/features/users/user-roles-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { STATUS_FILTER_OPTIONS } from '@/lib/filter-options';
import { getErrorMessage } from '@/lib/api/form-errors';
import { rolesApi } from '@/lib/api/roles';
import { usersApi } from '@/lib/api/users';
import type { UserQuery } from '@/lib/api/users';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDateTime } from '@/lib/utils';
import type { User } from '@/types/api';

export default function UsersPage() {
  const { user: me, hasPermission } = useAuth();
  if (!hasPermission('users.manage')) {
    return (
      <>
        <PageHeader title="Pengguna" />
        <Alert variant="error">Anda tidak memiliki izin untuk mengelola pengguna.</Alert>
      </>
    );
  }
  return <UsersAdmin meId={me?.id ?? null} />;
}

function UsersAdmin({ meId }: { meId: string | null }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [roleCode, setRoleCode] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null | 'new'>(null);
  const [rolesFor, setRolesFor] = useState<User | null>(null);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);

  const query: UserQuery = {
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    roleCode: roleCode || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
  };
  const list = useQuery({ queryKey: ['users', query], queryFn: () => usersApi.list(query) });
  const roles = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
    void queryClient.invalidateQueries({ queryKey: ['count'] });
    void queryClient.invalidateQueries({ queryKey: ['roles'] });
  };

  const toggle = useMutation({
    mutationFn: (u: User) => (u.isActive ? usersApi.deactivate(u.id) : usersApi.activate(u.id)),
    onSuccess: (_, u) => {
      toast.success(`Pengguna ${u.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setToggling(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun yang dapat masuk ke OAMS beserta role masing-masing."
        actions={
          <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
            Tambah pengguna
          </Button>
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
            placeholder="Cari nama atau email..."
            className="pl-9"
            aria-label="Cari pengguna"
          />
        </div>
        <FilterSelect
          className="w-full sm:w-52"
          label="Role"
          value={roleCode}
          onChange={(v) => {
            setRoleCode(v);
            setPage(1);
          }}
          options={(roles.data ?? []).map((r) => ({ value: r.code, label: r.name }))}
        />
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
            <TH>Nama</TH>
            <TH className="hidden md:table-cell">Email</TH>
            <TH>Role</TH>
            <TH className="hidden lg:table-cell">Unit kerja</TH>
            <TH className="w-24">Status</TH>
            <TH className="hidden w-44 xl:table-cell">Login terakhir</TH>
            <TH className="w-16 text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {list.isPending ? (
            <TableMessage colSpan={7}>Memuat...</TableMessage>
          ) : rows.length === 0 ? (
            <TableMessage colSpan={7}>Tidak ada pengguna.</TableMessage>
          ) : (
            rows.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={u.fullName} avatarUrl={u.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.username ? `@${u.username}` : ''}
                        <span className="md:hidden">{u.username ? ' · ' : ''}{u.email}</span>
                      </p>
                    </div>
                  </div>
                </TD>
                <TD className="hidden text-muted-foreground md:table-cell">{u.email}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.code}>{r.name}</Badge>
                    ))}
                  </div>
                </TD>
                <TD className="hidden text-muted-foreground lg:table-cell">{u.department?.name ?? '-'}</TD>
                <TD>
                  <StatusBadge active={u.isActive} />
                </TD>
                <TD className="hidden text-muted-foreground xl:table-cell">{formatDateTime(u.lastLoginAt)}</TD>
                <TD className="text-right">
                  <DropdownMenu
                    align="end"
                    triggerLabel={`Aksi untuk ${u.fullName}`}
                    trigger={
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                    items={[
                      { label: 'Ubah data', icon: Pencil, onSelect: () => setEditing(u) },
                      { label: 'Atur role', icon: ShieldCheck, onSelect: () => setRolesFor(u) },
                      { label: 'Reset password', icon: KeyRound, onSelect: () => setResetFor(u) },
                      {
                        label: u.isActive ? 'Nonaktifkan' : 'Aktifkan',
                        icon: Power,
                        destructive: u.isActive,
                        disabled: u.id === meId,
                        onSelect: () => setToggling(u),
                      },
                    ]}
                  />
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}

      <UserFormDialog
        open={editing !== null}
        user={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          invalidate();
        }}
      />
      <UserRolesDialog
        user={rolesFor}
        onClose={() => setRolesFor(null)}
        onSaved={() => {
          setRolesFor(null);
          invalidate();
        }}
      />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} onSaved={() => setResetFor(null)} />
      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) toggle.mutate(toggling);
        }}
        loading={toggle.isPending}
        destructive={toggling?.isActive ?? false}
        title={toggling?.isActive ? 'Nonaktifkan pengguna?' : 'Aktifkan pengguna?'}
        confirmLabel={toggling?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {toggling?.isActive
          ? `${toggling?.fullName} tidak akan bisa masuk dan semua sesinya dicabut. Riwayat aktivitasnya tetap tersimpan.`
          : `${toggling?.fullName} akan bisa masuk kembali.`}
      </ConfirmDialog>
    </>
  );
}
