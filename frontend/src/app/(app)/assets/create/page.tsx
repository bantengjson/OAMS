'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { AssetForm } from '@/features/assets/asset-form';
import { toAssetPayload } from '@/features/assets/asset-form.schema';
import { assetsApi } from '@/lib/api/assets';
import { useAuth } from '@/lib/auth/use-auth';

export default function CreateAssetPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  if (!hasPermission('assets.create')) {
    return (
      <>
        <PageHeader title="Tambah barang" />
        <Alert variant="error">Anda tidak memiliki izin untuk menambah barang.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tambah barang" description="Isi data barang; kode inventaris dan QR Code dibuat otomatis." />
      <AssetForm
        submitLabel="Simpan barang"
        onCancel={() => router.push('/assets')}
        onSubmit={async (values) => {
          const created = await assetsApi.create(toAssetPayload(values));
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          void queryClient.invalidateQueries({ queryKey: ['count'] });
          toast.success(`Barang ${created.assetCode} tersimpan.`);
          router.push(`/assets/${created.id}`);
        }}
      />
    </>
  );
}
