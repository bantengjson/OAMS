'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Tags, Users } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetStatisticsPanel } from '@/features/dashboard/asset-statistics';
import { StatCard } from '@/features/dashboard/stat-card';
import { categoriesApi } from '@/lib/api/categories';
import { departmentsApi } from '@/lib/api/departments';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/auth/use-auth';
import { ROLE_LABEL } from '@/types/api';

function useCount(key: string, enabled: boolean, fetcher: () => Promise<{ meta: { total: number } }>) {
  return useQuery({
    queryKey: ['count', key],
    queryFn: async () => (await fetcher()).meta.total,
    enabled,
  });
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const canUsers = hasPermission('users.manage');
  const canMaster = hasPermission('master_data.view');
  const canAssets = hasPermission('assets.view');

  const users = useCount('users', canUsers, () => usersApi.list({ isActive: true, pageSize: 1 }));
  const categories = useCount('categories', canMaster, () =>
    categoriesApi.list({ isActive: true, pageSize: 1 }),
  );
  const departments = useCount('departments', canMaster, () =>
    departmentsApi.list({ isActive: true, pageSize: 1 }),
  );

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {greeting}, {user?.fullName}
          </CardTitle>
          <CardDescription>
            Anda masuk sebagai {user?.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}.
          </CardDescription>
        </CardHeader>
      </Card>

      {canMaster || canUsers ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {canUsers ? (
            <StatCard
              label="Pengguna aktif"
              icon={Users}
              href="/users"
              value={users.data}
              loading={users.isPending}
              error={users.isError}
            />
          ) : null}
          {canMaster ? (
            <>
              <StatCard
                label="Kategori aktif"
                icon={Tags}
                href={hasPermission('categories.manage') ? '/categories' : undefined}
                value={categories.data}
                loading={categories.isPending}
                error={categories.isError}
              />
              <StatCard
                label="Unit kerja aktif"
                icon={Building2}
                href={hasPermission('departments.manage') ? '/departments' : undefined}
                value={departments.data}
                loading={departments.isPending}
                error={departments.isError}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {canAssets ? (
        <AssetStatisticsPanel />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Statistik inventaris</CardTitle>
            <CardDescription>Akun Anda tidak memiliki izin melihat inventaris.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  );
}
