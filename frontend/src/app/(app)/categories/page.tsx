'use client';

import { ItemTypesPage } from '@/features/item-types/item-types-page';
import { useAuth } from '@/lib/auth/use-auth';

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  return <ItemTypesPage canManage={hasPermission('categories.manage')} />;
}
