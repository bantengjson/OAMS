'use client';

import { MasterDataPage } from '@/features/master-data/master-data-page';
import { departmentsApi } from '@/lib/api/departments';
import { useAuth } from '@/lib/auth/use-auth';

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterDataPage
      api={departmentsApi}
      queryKey="departments"
      withDescription={false}
      canManage={hasPermission('departments.manage')}
      labels={{
        singular: 'Unit kerja',
        title: 'Unit Kerja',
        description: 'Bagian atau divisi kantor yang menjadi pemakai dan penanggung jawab barang.',
        codeHint: 'Contoh: KEU, TU, HRD.',
      }}
    />
  );
}
