'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { LoanForm } from '@/features/loans/loan-form';
import { toLoanPayload } from '@/features/loans/loan-form.schema';
import { loansApi } from '@/lib/api/loans';
import { useAuth } from '@/lib/auth/use-auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NewLoanPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <NewLoanContent />
    </Suspense>
  );
}

function NewLoanContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const search = useSearchParams();
  const assetId = search.get('assetId');

  if (!hasPermission('loans.manage')) {
    return (
      <>
        <PageHeader title="Catat peminjaman" />
        <Alert variant="error">Anda tidak memiliki izin untuk mencatat peminjaman.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Catat peminjaman"
        description="Dicatat saat barang diserahkan. Karyawan dipilih dari daftar pegawai; orang luar wajib punya karyawan penjamin."
      />
      <LoanForm
        initialAssetId={assetId && UUID.test(assetId) ? assetId : undefined}
        onCancel={() => router.back()}
        onSubmit={async (values) => {
          const created = await loansApi.create(toLoanPayload(values));
          void queryClient.invalidateQueries({ queryKey: ['loans'] });
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          toast.success('Peminjaman dicatat.');
          router.push(`/loans/${created.id}`);
        }}
      />
    </>
  );
}
