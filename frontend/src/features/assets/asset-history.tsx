'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { AuditLogTable } from '@/features/audit-logs/audit-log-table';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';

export const ASSET_ACTION_LABEL: Record<string, string> = {
  'asset.created': 'Barang didaftarkan',
  'asset.updated': 'Data diubah',
  'asset.archived': 'Diarsipkan',
  'asset.unarchived': 'Dikeluarkan dari arsip',
  'asset.photo_added': 'Foto ditambahkan',
  'asset.photo_removed': 'Foto dihapus',
  'asset.photo_primary': 'Foto utama diganti',
  'asset.document_added': 'Dokumen ditambahkan',
  'asset.document_removed': 'Dokumen dihapus',
  'qr.generated': 'QR Code dibuat',
  'qr.regenerated': 'Token QR diganti',
  'qr.deactivated': 'QR Code dinonaktifkan',
  'qr.activated': 'QR Code diaktifkan',
  'qr.printed': 'Stiker dicetak',
  'asset.assigned': 'Penanggung jawab diganti',
  'asset.condition_recorded': 'Kondisi diperiksa',
  'mutation.requested': 'Mutasi diajukan',
  'mutation.approved': 'Mutasi disetujui',
  'mutation.rejected': 'Mutasi ditolak',
  'mutation.cancelled': 'Mutasi dibatalkan',
  'loan.created': 'Dipinjamkan',
  'loan.updated': 'Peminjaman diubah',
  'loan.returned': 'Dikembalikan',
};

export function AssetHistory({ assetId }: { assetId: string }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['assets', 'history', assetId, page],
    queryFn: () => assetsApi.history(assetId, { page, pageSize: 20 }),
  });

  if (history.isError) return <Alert variant="error">{getErrorMessage(history.error)}</Alert>;
  const rows = (history.data?.data ?? []).map((r) => ({
    ...r,
    action: ASSET_ACTION_LABEL[r.action] ? `${ASSET_ACTION_LABEL[r.action]} (${r.action})` : r.action,
  }));
  return (
    <div className="flex flex-col gap-4">
      <AuditLogTable rows={rows} loading={history.isPending} showClientInfo={false} />
      {history.data ? <Pagination meta={history.data.meta} onPageChange={setPage} /> : null}
    </div>
  );
}
