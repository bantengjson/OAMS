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
      <PageHeader title="Tambah barang" description="Isi data barang; kode barang dan QR Code dibuat otomatis untuk setiap unit." />
      <AssetForm
        submitLabel="Simpan barang"
        onCancel={() => router.push('/assets')}
        onSubmit={async (values, type) => {
          const created = await assetsApi.create(toAssetPayload(values, type));
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          void queryClient.invalidateQueries({ queryKey: ['count'] });
          if (created.units.length === 1) {
            toast.success(`Barang ${created.assetCode} tersimpan.`);
            router.push(`/assets/${created.id}`);
            return;
          }
          const ids = created.units.map((u) => u.id);
          toast.success(`${created.units.length} barang ditambahkan (${created.units[0].assetCode} s.d. ${created.units[ids.length - 1].assetCode}).`, {
            action: { label: 'Cetak QR', onClick: () => router.push(`/qr/print?ids=${ids.join(',')}`) },
            duration: 10_000,
          });
          router.push('/assets');
        }}
      />
    </>
  );
}
