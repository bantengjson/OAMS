'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Printer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { AssetFilters, emptyAssetFilters, toAssetQuery } from '@/features/assets/asset-filters';
import { AssetTable } from '@/features/assets/asset-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

export default function AssetsPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState(emptyAssetFilters);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search);
  const query = { ...toAssetQuery(filters, debouncedSearch), page, pageSize: 20 };
  const list = useQuery({ queryKey: ['assets', query], queryFn: () => assetsApi.list(query) });

  return (
    <>
      <PageHeader
        title="Inventaris"
        description="Seluruh barang kantor beserta kode, status, kondisi, dan penanggung jawabnya."
        actions={
          <>
            {hasPermission('qr.generate') ? (
              <Link href="/qr/print">
                <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />}>Cetak QR</Button>
              </Link>
            ) : null}
            {hasPermission('assets.create') ? (
              <Link href="/assets/create">
                <Button leftIcon={<Plus className="h-4 w-4" />}>Tambah barang</Button>
              </Link>
            ) : null}
          </>
        }
      />
      <AssetFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <AssetTable rows={list.data?.data ?? []} loading={list.isPending} />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
    </>
  );
}
