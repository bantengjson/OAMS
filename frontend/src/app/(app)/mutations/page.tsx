'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { HeaderPill, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PageSpinner } from '@/components/ui/spinner';
import { StatusChips } from '@/components/ui/status-chips';
import { MutationDecisionDialog } from '@/features/mutations/mutation-decision-dialog';
import type { DecisionMode } from '@/features/mutations/mutation-decision-dialog';
import { MutationTable } from '@/features/mutations/mutation-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useListCounts } from '@/hooks/use-list-counts';
import { getErrorMessage } from '@/lib/api/form-errors';
import { mutationsApi } from '@/lib/api/mutations';
import type { MutationQuery } from '@/lib/api/mutations';
import { useAuth } from '@/lib/auth/use-auth';
import { chipItems } from '@/lib/list-chips';
import { MUTATION_STATUS_LABEL, MUTATION_STATUS_TONE } from '@/lib/operation-labels';
import { MUTATION_STATUSES } from '@/types/api';
import type { Mutation, MutationStatus } from '@/types/api';

type StatusFilter = '' | MutationStatus;
type ChipKey = 'ALL' | MutationStatus;
const CHIP_KEYS: ChipKey[] = [...MUTATION_STATUSES, 'ALL'];

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
  const counts = useListCounts('mutations', CHIP_KEYS, async (k) =>
    (await mutationsApi.list({ page: 1, pageSize: 1, status: k === 'ALL' ? undefined : k })).meta.total,
  );
  const chips = chipItems(
    CHIP_KEYS.map((k) => ({ key: k, label: k === 'ALL' ? 'Semua' : MUTATION_STATUS_LABEL[k], tone: k === 'ALL' ? ('blue' as const) : MUTATION_STATUS_TONE[k] })),
    counts,
  );

  return (
    <>
      <PageHeader
        title="Mutasi barang"
        description="Pergantian penanggung jawab barang. Berlaku setelah disetujui Admin."
        meta={counts.PENDING ? <HeaderPill>{counts.PENDING} menunggu</HeaderPill> : null}
        actions={
          hasPermission('mutations.request') ? (
            <Link href="/mutations/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>{canApprove ? 'Ganti penanggung jawab' : 'Ajukan mutasi'}</Button>
            </Link>
          ) : null
        }
      />

      <StatusChips<ChipKey>
        items={chips}
        value={status || 'ALL'}
        onChange={(k) => {
          setStatus(k === 'ALL' ? '' : k);
          setPage(1);
        }}
      />

      <FilterBar>
        <div className="relative min-w-[240px] flex-1">
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
      </FilterBar>

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
