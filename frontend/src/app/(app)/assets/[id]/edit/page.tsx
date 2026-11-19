'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { AssetForm } from '@/features/assets/asset-form';
import { fromAssetDetail, toAssetUpdatePayload } from '@/features/assets/asset-form.schema';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

export default function EditAssetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const asset = useQuery({ queryKey: ['assets', 'detail', id], queryFn: () => assetsApi.get(id) });

  if (!hasPermission('assets.update')) {
    return (
      <>
        <PageHeader title="Ubah barang" />
        <Alert variant="error">Anda tidak memiliki izin untuk mengubah barang.</Alert>
      </>
    );
  }
  if (asset.isPending) return <PageSpinner />;
  if (asset.isError) return <Alert variant="error">{getErrorMessage(asset.error)}</Alert>;
  if (asset.data.isArchived) {
    return (
      <>
        <PageHeader title={`Ubah ${asset.data.assetCode}`} />
        <Alert variant="info">Barang ini diarsipkan. Keluarkan dari arsip terlebih dahulu untuk mengubah datanya.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Ubah ${asset.data.assetCode}`} description={asset.data.name} />
      <AssetForm
        key={asset.data.updatedAt}
        mode="edit"
        initial={fromAssetDetail(asset.data)}
        initialResponsibleLabel={asset.data.responsibleEmployee?.fullName ?? null}
        locked={{
          assetId: id,
          locationPath: asset.data.location.path,
          responsibleLabel: asset.data.responsibleEmployee?.fullName ?? null,
          condition: asset.data.condition,
          isBorrowed: asset.data.activeLoan !== null,
        }}
        submitLabel="Simpan perubahan"
        onCancel={() => router.push(`/assets/${id}`)}
        onSubmit={async (values) => {
          await assetsApi.update(id, toAssetUpdatePayload(values));
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          toast.success('Perubahan tersimpan.');
          router.push(`/assets/${id}`);
        }}
      />
    </>
  );
}
