'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Printer } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ColumnMenu } from '@/components/ui/column-menu';
import { BulkBar } from '@/components/ui/filter-bar';
import { HeaderPill, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PageSpinner } from '@/components/ui/spinner';
import { StatusChips } from '@/components/ui/status-chips';
import { AssetFilters, toAssetQuery } from '@/features/assets/asset-filters';
import { parseAssetQuery, selectionFor, statusChipItems, toSearchParams } from '@/features/assets/asset-list-state';
import type { AssetListState, ChipKey } from '@/features/assets/asset-list-state';
import { ASSET_COLUMNS, ASSET_DEFAULT_COLUMNS, AssetTable } from '@/features/assets/asset-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import { loadColumnPrefs, saveColumnPrefs } from '@/lib/column-prefs';

const PAGE_SIZE = 20;
const TABLE_ID = 'assets';

export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <AssetsContent />
    </Suspense>
  );
}

function AssetsContent() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = parseAssetQuery(new URLSearchParams(params.toString()));
  const listKey = toSearchParams(state).toString();

  const update = (next: Partial<AssetListState>) => {
    const qs = toSearchParams({ ...state, ...next }).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Typing stays local; the URL (and the query) follow the debounced text.
  const [searchText, setSearchText] = useState(state.search);
  const debounced = useDebouncedValue(searchText);
  useEffect(() => {
    if (debounced.trim() !== state.search) update({ search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced text drives this
  }, [debounced]);

  // Safe to read storage here: this content only renders in the browser (behind the auth check).
  const [visible, setVisible] = useState<Set<string>>(() => loadColumnPrefs(TABLE_ID, ASSET_COLUMNS, ASSET_DEFAULT_COLUMNS));

  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: listKey, ids: [] });
  const selected = selectionFor(selection, listKey);
  const canPrint = hasPermission('qr.generate');

  const query = { ...toAssetQuery(state, state.search), sort: state.sort, order: state.order, page: state.page, pageSize: PAGE_SIZE };
  const list = useQuery({ queryKey: ['assets', query], queryFn: () => assetsApi.list(query) });
  const stats = useQuery({ queryKey: ['assets', 'statistics'], queryFn: assetsApi.statistics });

  const chipValue: ChipKey = state.status || 'ALL';

  return (
    <>
      <PageHeader
        title="Inventaris"
        description="Semua barang milik dan titipan kantor. Klik baris untuk melihat detail."
        meta={stats.data ? <HeaderPill>{stats.data.active} barang aktif</HeaderPill> : null}
        actions={
          <>
            {canPrint ? (
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

      {stats.data ? (
        <StatusChips<ChipKey>
          items={statusChipItems(stats.data)}
          value={chipValue}
          onChange={(key) => update({ status: key === 'ALL' ? '' : key, page: 1 })}
        />
      ) : null}

      <AssetFilters
        value={{ ...state, search: searchText }}
        onChange={(next) => {
          if (next.search !== searchText) {
            setSearchText(next.search);
            return;
          }
          update({ ...next, search: state.search, page: 1 });
        }}
        right={
          <ColumnMenu
            columns={ASSET_COLUMNS}
            visible={visible}
            onChange={(next) => {
              setVisible(next);
              saveColumnPrefs(TABLE_ID, next);
            }}
          />
        }
      />

      {canPrint ? (
        <BulkBar count={selected.length} onClear={() => setSelection({ key: listKey, ids: [] })}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={() => router.push(`/qr/print?ids=${selected.join(',')}`)}
          >
            Cetak QR terpilih
          </Button>
        </BulkBar>
      ) : null}

      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <AssetTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        visible={visible}
        sort={state.sort}
        order={state.order}
        onSort={(sort, order) => update({ sort, order, page: 1 })}
        selection={canPrint ? { ids: selected, onChange: (ids) => setSelection({ key: listKey, ids }) } : undefined}
        canEdit={hasPermission('assets.update')}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={(page) => update({ page })} /> : null}
    </>
  );
}
