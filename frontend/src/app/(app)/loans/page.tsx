'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PageSpinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { ExtendLoanDialog } from '@/features/loans/extend-loan-dialog';
import { LoanTable } from '@/features/loans/loan-table';
import { ReturnLoanDialog } from '@/features/loans/return-loan-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import type { LoanQuery } from '@/lib/api/loans';
import { useAuth } from '@/lib/auth/use-auth';
import { LOAN_STATE_LABEL } from '@/lib/operation-labels';
import { LOAN_STATES } from '@/types/api';
import type { Loan, LoanState } from '@/types/api';

export default function LoansPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <LoansContent />
    </Suspense>
  );
}

function LoansContent() {
  const { hasPermission } = useAuth();
  const search = useSearchParams();
  const requested = search.get('state');
  const [state, setState] = useState<LoanState>(
    requested && (LOAN_STATES as readonly string[]).includes(requested) ? (requested as LoanState) : 'active',
  );
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Loan | null>(null);
  const [extending, setExtending] = useState<Loan | null>(null);

  const query: LoanQuery = { page, pageSize: 20, state, search: debounced || undefined };
  const list = useQuery({ queryKey: ['loans', query], queryFn: () => loansApi.list(query) });
  const canManage = hasPermission('loans.manage');

  return (
    <>
      <PageHeader
        title="Peminjaman"
        description="Barang kantor yang dipinjam karyawan atau orang dekat karyawan. Yang terlambat tampil paling atas."
        actions={
          canManage ? (
            <Link href="/loans/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Catat peminjaman</Button>
            </Link>
          ) : null
        }
      />

      <Tabs<LoanState>
        value={state}
        onChange={(s) => {
          setState(s);
          setPage(1);
        }}
        items={LOAN_STATES.map((s) => ({ key: s, label: LOAN_STATE_LABEL[s] }))}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Cari barang atau nama peminjam..."
          className="pl-9"
          aria-label="Cari peminjaman"
        />
      </div>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <LoanTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canManage={canManage}
        onReturn={setReturning}
        onExtend={setExtending}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}

      {returning ? <ReturnLoanDialog loan={returning} open onClose={() => setReturning(null)} /> : null}
      {extending ? <ExtendLoanDialog loan={extending} open onClose={() => setExtending(null)} /> : null}
    </>
  );
}
