'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { MutationDecisionDialog } from '@/features/mutations/mutation-decision-dialog';
import type { DecisionMode } from '@/features/mutations/mutation-decision-dialog';
import { MutationTable } from '@/features/mutations/mutation-table';
import { getErrorMessage } from '@/lib/api/form-errors';
import { mutationsApi } from '@/lib/api/mutations';
import { useAuth } from '@/lib/auth/use-auth';
import type { Mutation } from '@/types/api';

export function AssetMutationsTab({ assetId }: { assetId: string }) {
  const { user, hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{ mutation: Mutation; mode: DecisionMode } | null>(null);
  const list = useQuery({
    queryKey: ['mutations', { assetId, page }],
    queryFn: () => mutationsApi.list({ assetId, page, pageSize: 20 }),
  });

  if (list.isError) return <Alert variant="error">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="flex flex-col gap-4">
      <MutationTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canApprove={hasPermission('mutations.approve')}
        currentUserId={user?.id ?? null}
        onDecide={(mutation, mode) => setDecision({ mutation, mode })}
        showAsset={false}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
      <MutationDecisionDialog
        mutation={decision?.mutation ?? null}
        mode={decision?.mode ?? 'approve'}
        open={decision !== null}
        onClose={() => setDecision(null)}
      />
    </div>
  );
}
