'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { AuthImage } from '@/components/ui/auth-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { MaintenanceActionDialog, type MaintenanceMode } from '@/features/maintenance/maintenance-action-dialog';
import { MaintenanceStatusBadge } from '@/features/maintenance/maintenance-status-badge';
import { getErrorMessage } from '@/lib/api/form-errors';
import { maintenanceApi } from '@/lib/api/maintenance';
import { CONDITION_LABEL, STATUS_LABEL, formatRupiah } from '@/lib/asset-labels';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDateTime } from '@/lib/utils';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '-'}</dd>
    </>
  );
}

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [mode, setMode] = useState<MaintenanceMode | null>(null);
  const record = useQuery({ queryKey: ['maintenance', 'detail', id], queryFn: () => maintenanceApi.get(id) });

  if (record.isPending) return <PageSpinner />;
  if (record.isError) return <Alert variant="error">{getErrorMessage(record.error)}</Alert>;
  const r = record.data;
  const open = r.status === 'REPORTED' || r.status === 'IN_PROGRESS';
  const canManage = hasPermission('maintenance.manage');

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/maintenance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke pemeliharaan
        </Link>
        <div className="flex flex-col gap-3 rounded-card border border-l-4 border-border border-l-primary bg-card px-5 py-4 shadow-card sm:flex-row sm:items-start sm:justify-between lg:px-6 lg:py-5">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{r.asset.assetCode}</p>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground lg:text-[26px]">
              <Link href={`/assets/${r.asset.id}`} className="hover:underline">{r.asset.name}</Link>
            </h2>
            <div className="mt-2"><MaintenanceStatusBadge status={r.status} /></div>
          </div>
          {canManage && open ? (
            <div className="flex flex-wrap gap-2">
              {r.status === 'REPORTED' ? (
                <Button onClick={() => setMode('start')}>Mulai perbaikan</Button>
              ) : (
                <Button onClick={() => setMode('complete')}>Selesaikan</Button>
              )}
              <Button variant="outline" onClick={() => setMode('cancel')}>Batalkan</Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Laporan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Kerusakan">{r.description}</Row>
              <Row label="Dilaporkan">{`${formatDateTime(r.reportedAt)} · ${r.reportedBy.fullName}`}</Row>
              <Row label="Status sebelum">{r.previousStatus ? STATUS_LABEL[r.previousStatus] : null}</Row>
            </dl>
            {r.photos.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {r.photos.map((p) => (
                  <AuthImage key={p.id} path={p.urls.thumb} alt="Foto kerusakan" className="h-24 w-24 rounded-md border border-border object-cover" />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Perbaikan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Teknisi">{r.technician}</Row>
              <Row label="Mulai">{r.startedAt ? `${formatDateTime(r.startedAt)} · ${r.startedBy?.fullName ?? ''}` : null}</Row>
              <Row label="Selesai">{r.completedAt ? `${formatDateTime(r.completedAt)} · ${r.completedBy?.fullName ?? ''}` : null}</Row>
              <Row label="Biaya">{r.cost ? formatRupiah(r.cost) : null}</Row>
              <Row label="Kondisi akhir">{r.resultCondition ? CONDITION_LABEL[r.resultCondition] : null}</Row>
              <Row label="Catatan teknisi">{r.technicianNotes}</Row>
              {r.cancelledAt ? <Row label="Dibatalkan">{`${formatDateTime(r.cancelledAt)} · ${r.cancelReason ?? ''}`}</Row> : null}
            </dl>
          </CardContent>
        </Card>
      </div>

      {mode ? (
        <MaintenanceActionDialog
          record={r}
          mode={mode}
          onClose={() => {
            setMode(null);
            void record.refetch();
          }}
        />
      ) : null}
    </>
  );
}
