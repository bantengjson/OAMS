'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import '@/app/print.css';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { OpnameCounters } from '@/features/stock-opnames/opname-counters';
import { OpnameReportView } from '@/features/stock-opnames/opname-report';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { useAuth } from '@/lib/auth/use-auth';
import { OPNAME_STATUS_LABEL } from '@/lib/operation-labels';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function StockOpnameReportPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const report = useQuery({ queryKey: ['stock-opnames', 'report', id], queryFn: () => stockOpnamesApi.report(id) });

  if (report.isPending) return <PageSpinner />;
  if (report.isError) return <Alert variant="error">{getErrorMessage(report.error)}</Alert>;
  const r = report.data;
  const s = r.session;

  return (
    <div className="print-root report-print flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/stock-opnames/${s.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke sesi
        </Link>
        <Button variant="outline" onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>Cetak</Button>
      </div>

      <header>
        <p className="text-sm text-muted-foreground">Laporan stock opname · DPC PDI Perjuangan</p>
        <h2 className="text-2xl font-semibold tracking-tight">{s.name}</h2>
        <p className="text-sm text-muted-foreground">
          Tanggal {formatDate(s.plannedDate)} · Status {OPNAME_STATUS_LABEL[s.status]}
          {s.closedAt ? ` · Ditutup ${formatDateTime(s.closedAt)}${s.closedBy ? ` oleh ${s.closedBy.fullName}` : ''}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          Petugas: {s.officers.length > 0 ? s.officers.map((o) => o.fullName).join(', ') : 'semua pengguna dengan izin stock opname'}
        </p>
      </header>

      {s.status === 'OPEN' ? (
        <Alert variant="info" className="no-print">Sesi masih berjalan; laporan ini sementara.</Alert>
      ) : null}

      <OpnameCounters counts={s.counts} status={s.status} />
      <OpnameReportView report={r} canApply={hasPermission('stock_opnames.manage')} />
    </div>
  );
}
