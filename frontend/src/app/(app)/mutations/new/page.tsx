'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { MutationForm } from '@/features/mutations/mutation-form';
import { toMutationPayload } from '@/features/mutations/mutation-form.schema';
import { mutationsApi } from '@/lib/api/mutations';
import { useAuth } from '@/lib/auth/use-auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NewMutationPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <NewMutationContent />
    </Suspense>
  );
}

function NewMutationContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const search = useSearchParams();
  const assetId = search.get('assetId');
  const canApprove = hasPermission('mutations.approve');

  if (!hasPermission('mutations.request')) {
    return (
      <>
        <PageHeader title="Ajukan mutasi" />
        <Alert variant="error">Anda tidak memiliki izin untuk mengajukan mutasi.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={canApprove ? 'Pindahkan barang' : 'Ajukan mutasi'}
        description={
          canApprove
            ? 'Sebagai penyetuju, perpindahan Anda langsung berlaku dan tercatat sebagai mutasi yang disetujui.'
            : 'Pengajuan menunggu persetujuan Admin; lokasi barang belum berubah sampai disetujui.'
        }
      />
      <MutationForm
        initialAssetId={assetId && UUID.test(assetId) ? assetId : undefined}
        canApprove={canApprove}
        onCancel={() => router.back()}
        onSubmit={async (values) => {
          const created = await mutationsApi.create(toMutationPayload(values));
          void queryClient.invalidateQueries({ queryKey: ['mutations'] });
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          toast.success(created.status === 'APPROVED' ? 'Mutasi disetujui dan barang dipindahkan.' : 'Pengajuan mutasi dikirim.');
          router.push(`/mutations/${created.id}`);
        }}
      />
    </>
  );
}
