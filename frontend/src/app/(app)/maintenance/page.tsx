'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PageSpinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { MaintenanceActionDialog, type MaintenanceMode } from '@/features/maintenance/maintenance-action-dialog';
import { MaintenanceTable } from '@/features/maintenance/maintenance-table';
import { ReportMaintenanceDialog } from '@/features/maintenance/report-maintenance-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api/form-errors';
import { maintenanceApi, type MaintenanceQuery } from '@/lib/api/maintenance';
import { useAuth } from '@/lib/auth/use-auth';
import { MAINTENANCE_STATUS_LABEL } from '@/lib/operation-labels';
import { MAINTENANCE_STATUSES } from '@/types/api';
import type { MaintenanceRecord, MaintenanceStatus } from '@/types/api';

type Tab = MaintenanceStatus | 'ALL';

export default function MaintenancePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MaintenanceContent />
    </Suspense>
  );
}

function MaintenanceContent() {
  const { hasPermission } = useAuth();
  const search = useSearchParams();
  const requested = search.get('status');
  const [tab, setTab] = useState<Tab>(
    requested && (MAINTENANCE_STATUSES as readonly string[]).includes(requested) ? (requested as MaintenanceStatus) : 'REPORTED',
  );
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [page, setPage] = useState(1);
  const [reporting, setReporting] = useState(false);
  const [action, setAction] = useState<{ record: MaintenanceRecord; mode: MaintenanceMode } | null>(null);

  const query: MaintenanceQuery = { page, pageSize: 20, status: tab === 'ALL' ? undefined : tab, search: debounced || undefined };
  const list = useQuery({ queryKey: ['maintenance', query], queryFn: () => maintenanceApi.list(query) });

  return (
    <>
      <PageHeader
        title="Pemeliharaan"
        description="Laporan kerusakan dan perbaikan barang. Selama diperbaiki, barang berstatus Dalam perbaikan."
        actions={
          hasPermission('maintenance.report') ? (
            <Button onClick={() => setReporting(true)} leftIcon={<Plus className="h-4 w-4" />}>Lapor kerusakan</Button>
          ) : null
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={[
          ...MAINTENANCE_STATUSES.map((s) => ({ key: s as Tab, label: MAINTENANCE_STATUS_LABEL[s] })),
          { key: 'ALL' as Tab, label: 'Semua' },
        ]}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Cari barang atau kerusakan..."
          className="pl-9"
          aria-label="Cari pemeliharaan"
        />
      </div>
      {list.isError ? <Alert variant="error">{getErrorMessage(list.error)}</Alert> : null}
      <MaintenanceTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canManage={hasPermission('maintenance.manage')}
        onAction={(record, mode) => setAction({ record, mode })}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
      {reporting ? <ReportMaintenanceDialog onClose={() => setReporting(false)} /> : null}
      {action ? <MaintenanceActionDialog record={action.record} mode={action.mode} onClose={() => setAction(null)} /> : null}
    </>
  );
}
