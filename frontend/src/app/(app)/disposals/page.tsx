'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { HeaderPill, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { StatusChips } from '@/components/ui/status-chips';
import { DisposalTable } from '@/features/disposals/disposal-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useListCounts } from '@/hooks/use-list-counts';
import { disposalsApi, type DisposalQuery } from '@/lib/api/disposals';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import { chipItems } from '@/lib/list-chips';
import { DISPOSAL_REASON_LABEL, DISPOSAL_REASON_TONE } from '@/lib/operation-labels';
import { DISPOSAL_REASONS } from '@/types/api';
import type { DisposalReason } from '@/types/api';

type ChipKey = 'ALL' | DisposalReason;
const CHIP_KEYS: ChipKey[] = ['ALL', ...DISPOSAL_REASONS];

export default function DisposalsPage() {
  const { hasPermission } = useAuth();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [reason, setReason] = useState<'' | DisposalReason>('');
  const [includeReverted, setIncludeReverted] = useState(false);
  const [page, setPage] = useState(1);
  const query: DisposalQuery = {
    page,
    pageSize: 20,
    search: debounced || undefined,
    reason: reason || undefined,
    includeReverted: includeReverted || undefined,
  };
  const list = useQuery({ queryKey: ['disposals', query], queryFn: () => disposalsApi.list(query) });
  const counts = useListCounts(
    'disposals',
    CHIP_KEYS,
    async (k) =>
      (await disposalsApi.list({ page: 1, pageSize: 1, reason: k === 'ALL' ? undefined : k, includeReverted: includeReverted || undefined }))
        .meta.total,
    includeReverted,
  );
  const chips = chipItems(
    CHIP_KEYS.map((k) => ({ key: k, label: k === 'ALL' ? 'Semua' : DISPOSAL_REASON_LABEL[k], tone: k === 'ALL' ? ('blue' as const) : DISPOSAL_REASON_TONE[k] })),
    counts,
  );

  return (
    <>
      <PageHeader
        title="Pelepasan barang"
        description="Barang yang dikeluarkan dari inventaris: rusak total, hilang, dijual, atau dihibahkan."
        meta={counts.ALL !== undefined ? <HeaderPill>{counts.ALL} {includeReverted ? 'catatan' : 'dilepas'}</HeaderPill> : null}
        actions={
          hasPermission('disposals.manage') ? (
            <Link href="/disposals/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Lepaskan barang</Button>
            </Link>
          ) : null
        }
      />
      <StatusChips<ChipKey>
        items={chips}
        value={reason || 'ALL'}
        label="Saring menurut alasan"
        onChange={(k) => {
          setReason(k === 'ALL' ? '' : k);
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
            placeholder="Cari barang atau penerima..."
            className="pl-9"
            aria-label="Cari pelepasan"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-body">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={includeReverted}
            onChange={(e) => {
              setIncludeReverted(e.target.checked);
              setPage(1);
            }}
          />
          Tampilkan yang dibatalkan
        </label>
      </FilterBar>
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <DisposalTable rows={list.data?.data ?? []} loading={list.isPending} />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
    </>
  );
}
