'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { ExtendLoanDialog } from '@/features/loans/extend-loan-dialog';
import { LoanStateBadge } from '@/features/loans/loan-state-badge';
import { ReturnLoanDialog } from '@/features/loans/return-loan-dialog';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import { CONDITION_LABEL, STATUS_LABEL } from '@/lib/asset-labels';
import { useAuth } from '@/lib/auth/use-auth';
import { BORROWER_TYPE_LABEL } from '@/lib/operation-labels';
import { formatDate, formatDateTime } from '@/lib/utils';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '-'}</dd>
    </>
  );
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [returning, setReturning] = useState(false);
  const [extending, setExtending] = useState(false);
  const loan = useQuery({ queryKey: ['loans', 'detail', id], queryFn: () => loansApi.get(id) });

  if (loan.isPending) return <PageSpinner />;
  if (loan.isError) return <Alert variant="error">{getErrorMessage(loan.error)}</Alert>;
  const l = loan.data;
  const canManage = hasPermission('loans.manage');
  const canEmployees = hasPermission('employees.manage');
  const employeeLink = (e: { id: string; fullName: string } | null) =>
    e ? (canEmployees ? <Link href={`/employees/${e.id}`} className="text-primary hover:underline">{e.fullName}</Link> : e.fullName) : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/loans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar peminjaman
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{l.asset.assetCode}</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              <Link href={`/assets/${l.asset.id}`} className="hover:underline">{l.asset.name}</Link>
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <LoanStateBadge loan={l} />
              <span>dipinjam {l.borrowerName} sejak {formatDate(l.loanedAt)}</span>
            </div>
          </div>
          {canManage && l.status === 'ACTIVE' ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setReturning(true)}>Kembalikan</Button>
              <Button variant="outline" onClick={() => setExtending(true)}>Perpanjang</Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Peminjam</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Jenis">{BORROWER_TYPE_LABEL[l.borrowerType]}</Row>
              <Row label="Nama">{l.borrowerEmployee ? employeeLink(l.borrowerEmployee) : l.borrowerName}</Row>
              <Row label="Unit kerja">{l.borrowerDepartment?.name}</Row>
              <Row label="Kontak">{l.borrowerContact}</Row>
              {l.borrowerType === 'EXTERNAL' ? <Row label="Penjamin">{employeeLink(l.guarantorEmployee)}</Row> : null}
              <Row label="Keperluan">{l.purpose}</Row>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Waktu dan pengembalian</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Tanggal pinjam">{formatDate(l.loanedAt)}</Row>
              <Row label="Rencana kembali">
                <span className={l.isOverdue ? 'text-destructive' : undefined}>
                  {formatDate(l.dueAt)}{l.isOverdue ? ` (terlambat ${l.overdueDays} hari)` : ''}
                </span>
              </Row>
              <Row label="Dicatat oleh">{l.recordedBy.fullName}</Row>
              <Row label="Status sebelum">{STATUS_LABEL[l.previousStatus]}</Row>
              <Row label="Dikembalikan">{l.returnedAt ? `${formatDateTime(l.returnedAt)} · ${l.returnedBy?.fullName ?? ''}` : null}</Row>
              <Row label="Kondisi kembali">{l.returnCondition ? CONDITION_LABEL[l.returnCondition] : l.returnedAt ? 'Tidak diperiksa' : null}</Row>
              <Row label="Catatan kembali">{l.returnNotes}</Row>
            </dl>
          </CardContent>
        </Card>
      </div>

      {returning ? <ReturnLoanDialog loan={l} open onClose={() => setReturning(false)} onDone={() => void loan.refetch()} /> : null}
      {extending ? <ExtendLoanDialog loan={l} open onClose={() => setExtending(false)} onDone={() => void loan.refetch()} /> : null}
    </>
  );
}
