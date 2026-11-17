'use client';

import { MasterDataPage } from '@/features/master-data/master-data-page';
import { categoriesApi } from '@/lib/api/categories';
import { useAuth } from '@/lib/auth/use-auth';

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterDataPage
      api={categoriesApi}
      queryKey="categories"
      withDescription
      canManage={hasPermission('categories.manage')}
      labels={{
        singular: 'Kategori',
        title: 'Kategori Barang',
        description: 'Pengelompokan barang inventaris, misalnya Elektronik atau Furniture.',
        codeHint: 'Contoh: KOMPUTER_IT. Huruf besar, angka, dan garis bawah.',
      }}
    />
  );
}
