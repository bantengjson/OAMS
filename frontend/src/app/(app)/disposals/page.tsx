'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { DisposalTable } from '@/features/disposals/disposal-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { disposalsApi, type DisposalQuery } from '@/lib/api/disposals';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import { DISPOSAL_REASON_LABEL } from '@/lib/operation-labels';
import { DISPOSAL_REASONS } from '@/types/api';
import type { DisposalReason } from '@/types/api';

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

  return (
    <>
      <PageHeader
        title="Pelepasan barang"
        description="Barang yang dikeluarkan dari inventaris: rusak total, hilang, dijual, atau dihibahkan."
        actions={
          hasPermission('disposals.manage') ? (
            <Link href="/disposals/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Lepaskan barang</Button>
            </Link>
          ) : null
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
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
        <div className="w-full sm:w-48">
          <Select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as '' | DisposalReason);
              setPage(1);
            }}
            aria-label="Filter alasan"
          >
            <option value="">Semua alasan</option>
            {DISPOSAL_REASONS.map((r) => (
              <option key={r} value={r}>{DISPOSAL_REASON_LABEL[r]}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeReverted}
            onChange={(e) => {
              setIncludeReverted(e.target.checked);
              setPage(1);
            }}
          />
          Tampilkan yang dibatalkan
        </label>
      </div>
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <DisposalTable rows={list.data?.data ?? []} loading={list.isPending} />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
    </>
  );
}
