'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { MutationDecisionDialog } from '@/features/mutations/mutation-decision-dialog';
import type { DecisionMode } from '@/features/mutations/mutation-decision-dialog';
import { MutationStatusBadge } from '@/features/mutations/mutation-status-badge';
import { getErrorMessage } from '@/lib/api/form-errors';
import { mutationsApi } from '@/lib/api/mutations';
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

export default function MutationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [mode, setMode] = useState<DecisionMode | null>(null);
  const mutation = useQuery({ queryKey: ['mutations', 'detail', id], queryFn: () => mutationsApi.get(id) });

  if (mutation.isPending) return <PageSpinner />;
  if (mutation.isError) return <Alert variant="error">{getErrorMessage(mutation.error)}</Alert>;
  const m = mutation.data;
  const pending = m.status === 'PENDING';
  const canApprove = hasPermission('mutations.approve');
  const mine = m.requestedBy.id === user?.id;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/mutations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar mutasi
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{m.asset.assetCode}</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              <Link href={`/assets/${m.asset.id}`} className="hover:underline">{m.asset.name}</Link>
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <MutationStatusBadge status={m.status} />
              <span className="text-sm text-muted-foreground">Diajukan {formatDateTime(m.requestedAt)} oleh {m.requestedBy.fullName}</span>
            </div>
          </div>
          {pending ? (
            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <>
                  <Button onClick={() => setMode('approve')}>Setujui</Button>
                  <Button variant="outline" onClick={() => setMode('reject')}>Tolak</Button>
                </>
              ) : null}
              {mine || canApprove ? (
                <Button variant="ghost" onClick={() => setMode('cancel')}>Batalkan</Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Perubahan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Lokasi sebelum">{m.fromLocation.path}</Row>
              <Row label="Lokasi sesudah">{m.toLocation ? m.toLocation.path : <span className="text-muted-foreground">tidak berubah</span>}</Row>
              <Row label="PJ sebelum">{m.fromResponsibleEmployee?.fullName ?? '-'}</Row>
              <Row label="PJ sesudah">
                {m.changesResponsible ? (m.toResponsibleEmployee?.fullName ?? <span className="text-muted-foreground">dilepas</span>) : <span className="text-muted-foreground">tidak berubah</span>}
              </Row>
              <Row label="Alasan">{m.reason}</Row>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Linimasa</CardTitle></CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3 text-sm">
              <li>
                <p className="font-medium">Diajukan</p>
                <p className="text-muted-foreground">{formatDateTime(m.requestedAt)} · {m.requestedBy.fullName}</p>
              </li>
              {m.decidedAt ? (
                <li>
                  <p className="font-medium">{m.status === 'REJECTED' ? 'Ditolak' : 'Disetujui'}</p>
                  <p className="text-muted-foreground">{formatDateTime(m.decidedAt)} · {m.decidedBy?.fullName}</p>
                  {m.decisionNote ? <p className="mt-1">{m.decisionNote}</p> : null}
                </li>
              ) : null}
              {m.cancelledAt ? (
                <li>
                  <p className="font-medium">Dibatalkan</p>
                  <p className="text-muted-foreground">{formatDateTime(m.cancelledAt)}</p>
                </li>
              ) : null}
              {pending ? <li className="text-muted-foreground">Menunggu persetujuan Admin.</li> : null}
            </ol>
          </CardContent>
        </Card>
      </div>

      <MutationDecisionDialog
        mutation={m}
        mode={mode ?? 'approve'}
        open={mode !== null}
        onClose={() => setMode(null)}
        onDone={() => void mutation.refetch()}
      />
    </>
  );
}
