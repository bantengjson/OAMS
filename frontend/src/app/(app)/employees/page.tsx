'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { EmployeeFormDialog } from '@/features/employees/employee-form-dialog';
import { EmployeeTable } from '@/features/employees/employee-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { departmentsApi } from '@/lib/api/departments';
import { employeesApi } from '@/lib/api/employees';
import type { EmployeeQuery } from '@/lib/api/employees';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import type { Employee } from '@/types/api';

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null | 'new'>(null);
  const [toggling, setToggling] = useState<Employee | null>(null);

  const query: EmployeeQuery = {
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    departmentId: departmentId || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
  };
  const list = useQuery({ queryKey: ['employees', query], queryFn: () => employeesApi.list(query) });
  const departments = useQuery({
    queryKey: ['departments', { isActive: true, pageSize: 100 }],
    queryFn: () => departmentsApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['employees'] });

  const toggle = useMutation({
    mutationFn: (e: Employee) => employeesApi.update(e.id, { isActive: !e.isActive }),
    onSuccess: (_, e) => {
      toast.success(`Pegawai ${e.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setToggling(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!hasPermission('master_data.view')) {
    return (
      <>
        <PageHeader title="Pegawai" />
        <Alert variant="error">Anda tidak memiliki izin untuk melihat daftar pegawai.</Alert>
      </>
    );
  }

  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Pegawai"
        description="Daftar karyawan kantor: calon penanggung jawab barang, peminjam, dan penjamin. Terpisah dari akun login."
        actions={
          canManage ? (
            <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
              Tambah pegawai
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
            placeholder="Cari nama atau nomor pegawai..."
            className="pl-9"
            aria-label="Cari pegawai"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter unit kerja"
          >
            <option value="">Semua unit kerja</option>
            {departments.data?.data.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            aria-label="Filter status"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="all">Semua status</option>
          </Select>
        </div>
      </div>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}

      <EmployeeTable
        rows={rows}
        loading={list.isPending}
        canManage={canManage}
        onEdit={(e) => setEditing(e)}
        onToggle={(e) => setToggling(e)}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}

      <EmployeeFormDialog
        open={editing !== null}
        employee={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          invalidate();
        }}
      />
      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) toggle.mutate(toggling);
        }}
        title={toggling?.isActive ? 'Nonaktifkan pegawai?' : 'Aktifkan pegawai?'}
        confirmLabel={toggling?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        destructive={Boolean(toggling?.isActive)}
        loading={toggle.isPending}
      >
        {toggling?.isActive
          ? `${toggling.fullName} tidak akan muncul lagi di pemilih pegawai. Barang yang dipegangnya dan pinjaman aktifnya tidak berubah.`
          : `${toggling?.fullName} akan bisa dipilih kembali sebagai penanggung jawab atau peminjam.`}
      </ConfirmDialog>
    </>
  );
}
