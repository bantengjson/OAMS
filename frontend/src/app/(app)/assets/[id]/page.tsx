'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowLeftRight,
  ClipboardCheck,
  HandCoins,
  PackageX,
  Pencil,
  Printer,
  Undo2,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { ArchiveDialog } from '@/features/assets/archive-dialog';
import { AssetConditionsTab } from '@/features/assets/asset-conditions-tab';
import { AssetDocuments } from '@/features/assets/asset-documents';
import { AssetLoansTab } from '@/features/assets/asset-loans-tab';
import { ConditionLogDialog } from '@/features/assets/condition-log-dialog';
import { ReturnLoanDialog } from '@/features/loans/return-loan-dialog';
import { AssetHistory } from '@/features/assets/asset-history';
import { AssetInfo } from '@/features/assets/asset-info';
import { AssetMaintenanceTab } from '@/features/assets/asset-maintenance-tab';
import { AssetMutationsTab } from '@/features/assets/asset-mutations-tab';
import { ReportMaintenanceDialog } from '@/features/maintenance/report-maintenance-dialog';
import { AssetPhotos } from '@/features/assets/asset-photos';
import { AssetQrCard } from '@/features/assets/asset-qr-card';
import { AssetConditionBadge, AssetStatusBadge } from '@/features/assets/asset-table';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import { DISPOSAL_REASON_LABEL } from '@/lib/operation-labels';
import { useCategoryTone } from '@/hooks/use-category-tone';
import { FLOW_TONE, STATUS_TONE, TONE_CLASS } from '@/lib/tones';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

type TabKey = 'info' | 'photos' | 'documents' | 'qr' | 'conditions' | 'mutations' | 'loans' | 'maintenance' | 'history';

const TAB_KEYS: readonly TabKey[] = [
  'info',
  'photos',
  'documents',
  'qr',
  'conditions',
  'mutations',
  'loans',
  'maintenance',
  'history',
];

export default function AssetDetailPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <AssetDetailContent />
    </Suspense>
  );
}

function AssetDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const categoryTone = useCategoryTone();
  const search = useSearchParams();
  const requested = search.get('tab');
  const [tab, setTab] = useState<TabKey>(
    requested && (TAB_KEYS as readonly string[]).includes(requested) ? (requested as TabKey) : 'info',
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const asset = useQuery({ queryKey: ['assets', 'detail', id], queryFn: () => assetsApi.get(id) });

  if (asset.isPending) return <PageSpinner />;
  if (asset.isError) return <Alert variant="error">{getErrorMessage(asset.error)}</Alert>;
  const a = asset.data;
  const canEdit = hasPermission('assets.update');
  const canArchive = hasPermission('assets.archive');
  const canGenerate = hasPermission('qr.generate');
  const canRequestMutation = hasPermission('mutations.request');
  const canApproveMutation = hasPermission('mutations.approve');
  const canLoans = hasPermission('loans.manage');
  const canRecordCondition = hasPermission('conditions.record');
  const borrowed = a.activeLoan !== null;
  const inRepair = a.openMaintenance?.status === 'IN_PROGRESS';
  const disposed = a.activeDisposal !== null;
  const live = !a.isArchived && !disposed;
  const canReport = hasPermission('maintenance.report');
  const canDispose = hasPermission('disposals.manage');

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/assets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke inventaris
        </Link>
        <div className="flex flex-col gap-4 rounded-card border border-l-4 border-border border-l-primary bg-card px-5 py-4 shadow-card lg:px-6 lg:py-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[13px] text-muted-foreground">{a.assetCode}</p>
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground lg:text-[26px]">{a.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <AssetStatusBadge status={a.status} />
              <AssetConditionBadge condition={a.condition} />
              {a.isArchived ? <Badge variant="muted">Diarsipkan</Badge> : null}
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-[2px]', TONE_CLASS[categoryTone(a.category.id)].dot)} aria-hidden="true" />
                {a.category.name}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-[60%] xl:justify-end [&_button]:h-8 [&_button]:px-2.5">
            {canGenerate ? (
              <Link href={`/qr/print?ids=${a.id}`}>
                <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />}>Cetak QR</Button>
              </Link>
            ) : null}
            {canLoans && live ? (
              a.activeLoan ? (
                <Button variant="outline" onClick={() => setReturnOpen(true)} leftIcon={<Undo2 className="h-4 w-4" />}>
                  Kembalikan
                </Button>
              ) : a.pendingMutation || inRepair ? (
                <Button
                  variant="outline"
                  disabled
                  title={inRepair ? 'Barang sedang diperbaiki' : 'Selesaikan mutasi yang menunggu dulu'}
                  leftIcon={<HandCoins className="h-4 w-4" />}
                >
                  Catat peminjaman
                </Button>
              ) : (
                <Link href={`/loans/new?assetId=${a.id}`}>
                  <Button variant="outline" leftIcon={<HandCoins className="h-4 w-4" />}>Catat peminjaman</Button>
                </Link>
              )
            ) : null}
            {canReport && live && !a.openMaintenance ? (
              <Button variant="outline" onClick={() => setReportOpen(true)} leftIcon={<Wrench className="h-4 w-4" />}>
                Lapor kerusakan
              </Button>
            ) : null}
            {canRecordCondition && live ? (
              <Button variant="outline" onClick={() => setConditionOpen(true)} leftIcon={<ClipboardCheck className="h-4 w-4" />}>
                Catat kondisi
              </Button>
            ) : null}
            {canRequestMutation && live ? (
              borrowed || inRepair || a.pendingMutation ? (
                <Button
                  variant="outline"
                  disabled
                  title={
                    borrowed
                      ? 'Barang sedang dipinjam'
                      : inRepair
                        ? 'Barang sedang diperbaiki'
                        : 'Sudah ada mutasi yang menunggu persetujuan'
                  }
                  leftIcon={<ArrowLeftRight className="h-4 w-4" />}
                >
                  {canApproveMutation ? 'Ganti PJ' : 'Ajukan mutasi'}
                </Button>
              ) : (
                <Link href={`/mutations/new?assetId=${a.id}`}>
                  <Button variant="outline" leftIcon={<ArrowLeftRight className="h-4 w-4" />}>
                    {canApproveMutation ? 'Ganti PJ' : 'Ajukan mutasi'}
                  </Button>
                </Link>
              )
            ) : null}
            {canEdit && live ? (
              <Link href={`/assets/${a.id}/edit`}>
                <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />}>Ubah</Button>
              </Link>
            ) : null}
            {canDispose && live ? (
              borrowed || inRepair ? (
                <Button
                  variant="outline"
                  disabled
                  title={borrowed ? 'Barang sedang dipinjam' : 'Barang sedang diperbaiki'}
                  leftIcon={<PackageX className="h-4 w-4" />}
                >
                  Lepaskan
                </Button>
              ) : (
                <Link href={`/disposals/new?assetId=${a.id}`}>
                  <Button variant="outline" leftIcon={<PackageX className="h-4 w-4" />}>Lepaskan</Button>
                </Link>
              )
            ) : null}
            {canArchive ? (
              <Button
                variant={a.isArchived ? 'secondary' : 'destructive'}
                onClick={() => setArchiveOpen(true)}
                leftIcon={a.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              >
                {a.isArchived ? 'Buka arsip' : 'Arsipkan'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {a.isArchived ? (
        <Alert tone="slate">
          Barang ini diarsipkan{a.archiveReason ? `: ${a.archiveReason}` : ''}. Data tidak dapat diubah dan QR tidak menampilkan informasi.
        </Alert>
      ) : null}

      {a.activeDisposal ? (
        <Alert variant="error" tone={FLOW_TONE.disposal}>
          Barang sudah dilepas ({DISPOSAL_REASON_LABEL[a.activeDisposal.reason]}, {formatDate(a.activeDisposal.disposedAt)}). QR
          nonaktif dan barang tidak tampil di daftar inventaris aktif.{' '}
          <Link href={`/disposals/${a.activeDisposal.id}`} className="font-medium underline">Lihat pelepasan</Link>
        </Alert>
      ) : null}

      {a.openMaintenance ? (
        <Alert tone={a.openMaintenance.status === 'IN_PROGRESS' ? FLOW_TONE.maintenance : FLOW_TONE.damageReport}>
          {a.openMaintenance.status === 'IN_PROGRESS' ? 'Sedang diperbaiki' : 'Ada laporan kerusakan'}:{' '}
          {a.openMaintenance.description} ({formatDate(a.openMaintenance.reportedAt)}).{' '}
          <Link href={`/maintenance/${a.openMaintenance.id}`} className="font-medium underline">Lihat pemeliharaan</Link>
        </Alert>
      ) : null}

      {a.activeLoan ? (
        <Alert variant={a.activeLoan.isOverdue ? 'error' : 'info'} tone={a.activeLoan.isOverdue ? FLOW_TONE.overdue : STATUS_TONE.BORROWED}>
          Sedang dipinjam oleh {a.activeLoan.borrowerName} sejak {formatDate(a.activeLoan.loanedAt)}, rencana kembali{' '}
          {formatDate(a.activeLoan.dueAt)}
          {a.activeLoan.isOverdue ? ' (terlambat)' : ''}.{' '}
          <Link href={`/loans/${a.activeLoan.id}`} className="font-medium underline">Lihat peminjaman</Link>
        </Alert>
      ) : null}

      {a.pendingMutation ? (
        <Alert tone={FLOW_TONE.mutation}>
          Mutasi menunggu persetujuan sejak {formatDateTime(a.pendingMutation.requestedAt)} (diajukan{' '}
          {a.pendingMutation.requestedBy.fullName}).{' '}
          <Link href={`/mutations/${a.pendingMutation.id}`} className="font-medium underline">
            Lihat pengajuan
          </Link>
        </Alert>
      ) : null}

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'info', label: 'Informasi' },
          { key: 'photos', label: 'Foto', badge: a.photos.length },
          { key: 'documents', label: 'Dokumen', badge: a.documents.length },
          { key: 'qr', label: 'QR Code' },
          { key: 'conditions', label: 'Kondisi' },
          { key: 'mutations', label: 'Mutasi', badge: a.pendingMutation ? 1 : undefined },
          { key: 'loans', label: 'Peminjaman', badge: a.activeLoan ? 1 : undefined },
          { key: 'maintenance', label: 'Pemeliharaan', badge: a.openMaintenance ? 1 : undefined },
          { key: 'history', label: 'Riwayat' },
        ]}
      />
      <TabPanel active={tab === 'info'}><AssetInfo asset={a} /></TabPanel>
      <TabPanel active={tab === 'photos'}><AssetPhotos asset={a} canEdit={canEdit} /></TabPanel>
      <TabPanel active={tab === 'documents'}><AssetDocuments asset={a} canEdit={canEdit} /></TabPanel>
      <TabPanel active={tab === 'qr'}><AssetQrCard asset={a} canGenerate={canGenerate} /></TabPanel>
      <TabPanel active={tab === 'conditions'}><AssetConditionsTab asset={a} canRecord={canRecordCondition} /></TabPanel>
      <TabPanel active={tab === 'mutations'}><AssetMutationsTab assetId={a.id} /></TabPanel>
      <TabPanel active={tab === 'loans'}><AssetLoansTab asset={a} /></TabPanel>
      <TabPanel active={tab === 'maintenance'}><AssetMaintenanceTab assetId={a.id} /></TabPanel>
      <TabPanel active={tab === 'history'}><AssetHistory assetId={a.id} /></TabPanel>

      <ArchiveDialog asset={a} open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      {reportOpen ? (
        <ReportMaintenanceDialog
          asset={{ id: a.id, assetCode: a.assetCode, name: a.name }}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
      {conditionOpen ? (
        <ConditionLogDialog assetId={a.id} currentCondition={a.condition} open onClose={() => setConditionOpen(false)} />
      ) : null}
      {returnOpen && a.activeLoan ? (
        <ReturnLoanDialog
          loan={{ id: a.activeLoan.id, asset: { id: a.id, assetCode: a.assetCode, name: a.name }, borrowerName: a.activeLoan.borrowerName }}
          currentCondition={a.condition}
          open
          onClose={() => setReturnOpen(false)}
        />
      ) : null}
    </>
  );
}
