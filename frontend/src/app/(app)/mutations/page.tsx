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
import { Select } from '@/components/ui/select';
import { PageSpinner } from '@/components/ui/spinner';
import { MutationDecisionDialog } from '@/features/mutations/mutation-decision-dialog';
import type { DecisionMode } from '@/features/mutations/mutation-decision-dialog';
import { MutationTable } from '@/features/mutations/mutation-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api/form-errors';
import { mutationsApi } from '@/lib/api/mutations';
import type { MutationQuery } from '@/lib/api/mutations';
import { useAuth } from '@/lib/auth/use-auth';
import { MUTATION_STATUS_LABEL } from '@/lib/operation-labels';
import { MUTATION_STATUSES } from '@/types/api';
import type { Mutation, MutationStatus } from '@/types/api';

type StatusFilter = '' | MutationStatus;

export default function MutationsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MutationsContent />
    </Suspense>
  );
}

function MutationsContent() {
  const { user, hasPermission } = useAuth();
  const search = useSearchParams();
  const requested = search.get('status');
  const [status, setStatus] = useState<StatusFilter>(
    requested && (MUTATION_STATUSES as readonly string[]).includes(requested) ? (requested as MutationStatus) : 'PENDING',
  );
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{ mutation: Mutation; mode: DecisionMode } | null>(null);

  const query: MutationQuery = { page, pageSize: 20, status: status || undefined, search: debounced || undefined };
  const list = useQuery({ queryKey: ['mutations', query], queryFn: () => mutationsApi.list(query) });
  const canApprove = hasPermission('mutations.approve');

  return (
    <>
      <PageHeader
        title="Mutasi barang"
        description="Pergantian penanggung jawab barang. Berlaku setelah disetujui Admin."
        actions={
          hasPermission('mutations.request') ? (
            <Link href="/mutations/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>{canApprove ? 'Ganti penanggung jawab' : 'Ajukan mutasi'}</Button>
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kode atau nama barang..."
            className="pl-9"
            aria-label="Cari mutasi"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="Filter status mutasi"
          >
            {MUTATION_STATUSES.map((s) => (
              <option key={s} value={s}>{MUTATION_STATUS_LABEL[s]}</option>
            ))}
            <option value="">Semua status</option>
          </Select>
        </div>
      </div>

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <MutationTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canApprove={canApprove}
        currentUserId={user?.id ?? null}
        onDecide={(mutation, mode) => setDecision({ mutation, mode })}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}

      <MutationDecisionDialog
        mutation={decision?.mutation ?? null}
        mode={decision?.mode ?? 'approve'}
        open={decision !== null}
        onClose={() => setDecision(null)}
      />
    </>
  );
}
