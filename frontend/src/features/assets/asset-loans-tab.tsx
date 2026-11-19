'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { ExtendLoanDialog } from '@/features/loans/extend-loan-dialog';
import { LoanTable } from '@/features/loans/loan-table';
import { ReturnLoanDialog } from '@/features/loans/return-loan-dialog';
import { getErrorMessage } from '@/lib/api/form-errors';
import { loansApi } from '@/lib/api/loans';
import { useAuth } from '@/lib/auth/use-auth';
import type { AssetDetail, Loan } from '@/types/api';

export function AssetLoansTab({ asset }: { asset: AssetDetail }) {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Loan | null>(null);
  const [extending, setExtending] = useState<Loan | null>(null);
  const list = useQuery({
    queryKey: ['loans', { assetId: asset.id, state: 'all', page }],
    queryFn: () => loansApi.list({ assetId: asset.id, state: 'all', page, pageSize: 20 }),
  });

  if (list.isError) return <Alert variant="error">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="flex flex-col gap-4">
      <LoanTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canManage={hasPermission('loans.manage')}
        onReturn={setReturning}
        onExtend={setExtending}
        showAsset={false}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
      {returning ? (
        <ReturnLoanDialog loan={returning} currentCondition={asset.condition} open onClose={() => setReturning(null)} />
      ) : null}
      {extending ? <ExtendLoanDialog loan={extending} open onClose={() => setExtending(null)} /> : null}
    </div>
  );
}
