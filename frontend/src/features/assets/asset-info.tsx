'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACQUISITION_LABEL, formatRupiah, OWNERSHIP_LABEL } from '@/lib/asset-labels';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { AssetDetail } from '@/types/api';
import { AssetConditionBadge, AssetStatusBadge } from './asset-table';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children ?? '-'}</dd>
    </>
  );
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '-');

export function AssetInfo({ asset }: { asset: AssetDetail }) {
  const { hasPermission } = useAuth();
  const canEmployees = hasPermission('employees.manage');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="border-b border-border pb-3"><CardTitle>Identitas</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <Row label="Kode barang"><span className="font-mono">{asset.assetCode}</span></Row>
            <Row label="Nama">{asset.name}</Row>
            <Row label="Jenis">
              {asset.category.golongan} {String(asset.category.number).padStart(3, '0')} · {asset.category.name}
            </Row>
            <Row label="Ruangan">{asset.room ? `${asset.room.code} · ${asset.room.name}` : '-'}</Row>
            <Row label="Spesifikasi">{dash(asset.specification)}</Row>
            <Row label="Tahun pengadaan">{asset.acquisitionYear ?? 'TT (belum diketahui)'}</Row>
            <Row label="Sumber">{asset.source ?? 'Pembelian'}</Row>
            <Row label="Nomor seri / polisi"><span className="font-mono">{dash(asset.serialNumber)}</span></Row>
            <Row label="Deskripsi">{dash(asset.description)}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3"><CardTitle>Kondisi dan status</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <Row label="Status"><AssetStatusBadge status={asset.status} /></Row>
            <Row label="Kondisi"><AssetConditionBadge condition={asset.condition} /></Row>
            <Row label="Unit kerja">{asset.department ? `${asset.department.name} (${asset.department.code})` : '-'}</Row>
            <Row label="Penanggung jawab">
              {asset.responsibleEmployee ? (
                <>
                  {canEmployees ? (
                    <Link href={`/employees/${asset.responsibleEmployee.id}`} className="text-primary hover:underline">
                      {asset.responsibleEmployee.fullName}
                    </Link>
                  ) : (
                    asset.responsibleEmployee.fullName
                  )}
                  {asset.responsibleEmployee.department ? (
                    <span className="text-muted-foreground"> · {asset.responsibleEmployee.department.name}</span>
                  ) : null}
                </>
              ) : (
                '-'
              )}
            </Row>
            <Row label="Catatan internal">{dash(asset.notes)}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3"><CardTitle>Perolehan dan kepemilikan</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <Row label="Kepemilikan">{OWNERSHIP_LABEL[asset.ownershipType]}</Row>
            <Row label="Metode">{ACQUISITION_LABEL[asset.acquisitionMethod]}</Row>
            <Row label="Tanggal perolehan">{asset.acquisitionDate ? formatDate(asset.acquisitionDate) : '-'}</Row>
            <Row label="Harga perolehan">{formatRupiah(asset.purchasePrice)}</Row>
            <Row label="Penyedia">{dash(asset.vendor)}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3"><CardTitle>Pencatatan</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <Row label="Dibuat">{formatDateTime(asset.createdAt)}{asset.createdBy ? ` oleh ${asset.createdBy.fullName}` : ''}</Row>
            <Row label="Diperbarui">{formatDateTime(asset.updatedAt)}</Row>
            {asset.isArchived ? (
              <>
                <Row label="Diarsipkan">{formatDateTime(asset.archivedAt)}{asset.archivedBy ? ` oleh ${asset.archivedBy.fullName}` : ''}</Row>
                <Row label="Alasan arsip">{dash(asset.archiveReason)}</Row>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
