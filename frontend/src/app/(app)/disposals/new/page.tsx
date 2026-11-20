'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { DisposalForm } from '@/features/disposals/disposal-form';
import { toDisposalPayload } from '@/features/disposals/disposal-form.schema';
import { disposalsApi } from '@/lib/api/disposals';
import { useAuth } from '@/lib/auth/use-auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NewDisposalPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <NewDisposalContent />
    </Suspense>
  );
}

function NewDisposalContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const assetId = useSearchParams().get('assetId');

  if (!hasPermission('disposals.manage')) {
    return (
      <>
        <PageHeader title="Lepaskan barang" />
        <Alert variant="error">Anda tidak memiliki izin untuk melepas barang.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Lepaskan barang"
        description="Status barang menjadi Dihapuskan dan QR-nya dinonaktifkan. Bisa dibatalkan bila keliru."
      />
      <DisposalForm
        initialAssetId={assetId && UUID.test(assetId) ? assetId : undefined}
        onCancel={() => router.back()}
        onSubmit={async (values) => {
          const created = await disposalsApi.create(toDisposalPayload(values));
          void queryClient.invalidateQueries({ queryKey: ['disposals'] });
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          toast.success('Barang dilepas dari inventaris.');
          router.push(`/disposals/${created.id}`);
        }}
      />
    </>
  );
}
