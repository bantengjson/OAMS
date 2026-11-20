'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { MaintenanceActionDialog, type MaintenanceMode } from '@/features/maintenance/maintenance-action-dialog';
import { MaintenanceTable } from '@/features/maintenance/maintenance-table';
import { getErrorMessage } from '@/lib/api/form-errors';
import { maintenanceApi } from '@/lib/api/maintenance';
import { useAuth } from '@/lib/auth/use-auth';
import type { MaintenanceRecord } from '@/types/api';

export function AssetMaintenanceTab({ assetId }: { assetId: string }) {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ record: MaintenanceRecord; mode: MaintenanceMode } | null>(null);
  const list = useQuery({
    queryKey: ['maintenance', { assetId, page }],
    queryFn: () => maintenanceApi.list({ assetId, page, pageSize: 20 }),
  });

  if (list.isError) return <Alert variant="error">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="flex flex-col gap-4">
      <MaintenanceTable
        rows={list.data?.data ?? []}
        loading={list.isPending}
        canManage={hasPermission('maintenance.manage')}
        onAction={(record, mode) => setAction({ record, mode })}
        showAsset={false}
      />
      {list.data ? <Pagination meta={list.data.meta} onPageChange={setPage} /> : null}
      {action ? <MaintenanceActionDialog record={action.record} mode={action.mode} onClose={() => setAction(null)} /> : null}
    </div>
  );
}
