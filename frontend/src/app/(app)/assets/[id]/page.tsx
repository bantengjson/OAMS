'use client';

import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { ArchiveDialog } from '@/features/assets/archive-dialog';
import { AssetDocuments } from '@/features/assets/asset-documents';
import { AssetHistory } from '@/features/assets/asset-history';
import { AssetInfo } from '@/features/assets/asset-info';
import { AssetPhotos } from '@/features/assets/asset-photos';
import { AssetQrCard } from '@/features/assets/asset-qr-card';
import { AssetConditionBadge, AssetStatusBadge } from '@/features/assets/asset-table';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

type TabKey = 'info' | 'photos' | 'documents' | 'qr' | 'history';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<TabKey>('info');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const asset = useQuery({ queryKey: ['assets', 'detail', id], queryFn: () => assetsApi.get(id) });

  if (asset.isPending) return <PageSpinner />;
  if (asset.isError) return <Alert variant="error">{getErrorMessage(asset.error)}</Alert>;
  const a = asset.data;
  const canEdit = hasPermission('assets.update');
  const canArchive = hasPermission('assets.archive');
  const canGenerate = hasPermission('qr.generate');

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/assets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke inventaris
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted-foreground">{a.assetCode}</p>
            <h2 className="truncate text-2xl font-semibold tracking-tight">{a.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AssetStatusBadge status={a.status} />
              <AssetConditionBadge condition={a.condition} />
              {a.isArchived ? <Badge variant="muted">Diarsipkan</Badge> : null}
              <span className="text-sm text-muted-foreground">{a.category.name} · {a.location.path}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canGenerate ? (
              <Link href={`/qr/print?ids=${a.id}`}>
                <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />}>Cetak QR</Button>
              </Link>
            ) : null}
            {canEdit && !a.isArchived ? (
              <Link href={`/assets/${a.id}/edit`}>
                <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />}>Ubah</Button>
              </Link>
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
        <Alert variant="info">
          Barang ini diarsipkan{a.archiveReason ? `: ${a.archiveReason}` : ''}. Data tidak dapat diubah dan QR tidak menampilkan informasi.
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
          { key: 'history', label: 'Riwayat' },
        ]}
      />
      <TabPanel active={tab === 'info'}><AssetInfo asset={a} /></TabPanel>
      <TabPanel active={tab === 'photos'}><AssetPhotos asset={a} canEdit={canEdit} /></TabPanel>
      <TabPanel active={tab === 'documents'}><AssetDocuments asset={a} canEdit={canEdit} /></TabPanel>
      <TabPanel active={tab === 'qr'}><AssetQrCard asset={a} canGenerate={canGenerate} /></TabPanel>
      <TabPanel active={tab === 'history'}><AssetHistory assetId={a.id} /></TabPanel>

      <ArchiveDialog asset={a} open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    </>
  );
}
