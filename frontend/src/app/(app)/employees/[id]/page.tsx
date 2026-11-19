'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AssetTable } from '@/features/assets/asset-table';
import { EmployeeFormDialog } from '@/features/employees/employee-form-dialog';
import { assetsApi } from '@/lib/api/assets';
import { employeesApi } from '@/lib/api/employees';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDate } from '@/lib/utils';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value ?? '-'}</dd>
    </>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const employee = useQuery({ queryKey: ['employees', 'detail', id], queryFn: () => employeesApi.get(id) });
  const canAssets = hasPermission('assets.view');
  const canLoans = hasPermission('loans.view');
  const assets = useQuery({
    queryKey: ['assets', { responsibleEmployeeId: id, pageSize: 50 }],
    queryFn: () => assetsApi.list({ responsibleEmployeeId: id, pageSize: 50 }),
    enabled: canAssets,
  });
  const loans = useQuery({
    queryKey: ['loans', { borrowerEmployeeId: id, state: 'active' }],
    queryFn: () => loansApi.list({ borrowerEmployeeId: id, state: 'active', pageSize: 50 }),
    enabled: canLoans,
  });

  if (employee.isPending) return <PageSpinner />;
  if (employee.isError) return <Alert variant="error">{getErrorMessage(employee.error)}</Alert>;
  const e = employee.data;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar pegawai
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{e.fullName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge active={e.isActive} />
              {e.employeeNumber ? <span className="font-mono">{e.employeeNumber}</span> : null}
              {e.department ? <span>· {e.department.name}</span> : null}
            </div>
          </div>
          {hasPermission('employees.manage') ? (
            <Button variant="outline" onClick={() => setEditOpen(true)} leftIcon={<Pencil className="h-4 w-4" />}>
              Ubah
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Data pegawai</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <Row label="Nomor pegawai" value={e.employeeNumber} />
              <Row label="Unit kerja" value={e.department ? `${e.department.name} (${e.department.code})` : null} />
              <Row label="Jabatan" value={e.position} />
              <Row label="Kontak" value={e.phone} />
              <Row label="Email" value={e.email} />
              <Row label="Akun login" value={e.user ? `${e.user.fullName} (${e.user.email})` : 'Tidak ada'} />
              <Row label="Barang dipegang" value={e.assetCount} />
              <Row label="Pinjaman aktif" value={e.activeLoanCount} />
              <Row label="Terdaftar" value={formatDate(e.createdAt)} />
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {canAssets ? (
            <Card>
              <CardHeader>
                <CardTitle>Barang yang dipegang</CardTitle>
                <CardDescription>Barang aktif dengan pegawai ini sebagai penanggung jawab.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {assets.isError ? (
                  <Alert variant="error">{getErrorMessage(assets.error)}</Alert>
                ) : (
                  <AssetTable rows={assets.data?.data ?? []} loading={assets.isPending} />
                )}
              </CardContent>
            </Card>
          ) : null}

          {canLoans ? (
            <Card>
              <CardHeader>
                <CardTitle>Pinjaman aktif</CardTitle>
                <CardDescription>Barang yang sedang dipinjam atas nama pegawai ini.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>Barang</TH>
                      <TH className="w-32">Dipinjam</TH>
                      <TH className="w-40">Rencana kembali</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {loans.isPending ? (
                      <TableMessage colSpan={3}>Memuat...</TableMessage>
                    ) : !loans.data?.data.length ? (
                      <TableMessage colSpan={3}>Tidak ada pinjaman aktif.</TableMessage>
                    ) : (
                      loans.data.data.map((l) => (
                        <TR key={l.id}>
                          <TD>
                            <Link href={`/loans/${l.id}`} className="font-medium hover:underline">
                              {l.asset.assetCode} · {l.asset.name}
                            </Link>
                          </TD>
                          <TD>{formatDate(l.loanedAt)}</TD>
                          <TD className={l.isOverdue ? 'text-destructive' : undefined}>
                            {formatDate(l.dueAt)}
                            {l.isOverdue ? ` (terlambat ${l.overdueDays} hari)` : ''}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <EmployeeFormDialog
        open={editOpen}
        employee={e}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
    </>
  );
}
