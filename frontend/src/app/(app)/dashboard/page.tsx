'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Tags, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/features/dashboard/stat-card';
import { categoriesApi } from '@/lib/api/categories';
import { departmentsApi } from '@/lib/api/departments';
import { locationsApi } from '@/lib/api/locations';
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

  const users = useCount('users', canUsers, () => usersApi.list({ isActive: true, pageSize: 1 }));
  const categories = useCount('categories', canMaster, () =>
    categoriesApi.list({ isActive: true, pageSize: 1 }),
  );
  const locations = useCount('locations', canMaster, () =>
    locationsApi.list({ isActive: true, pageSize: 1 }),
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                label="Lokasi aktif"
                icon={MapPin}
                href={hasPermission('locations.manage') ? '/locations' : undefined}
                value={locations.data}
                loading={locations.isPending}
                error={locations.isError}
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

      <Card>
        <CardHeader>
          <CardTitle>Statistik inventaris</CardTitle>
          <CardDescription>
            Ringkasan barang, kondisi, status, dan aktivitas terbaru tersedia pada Tahap 2 setelah
            modul inventaris dan QR Code selesai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="info">
            Tahap 1 menyiapkan fondasi: akun pengguna, role dan izin, kategori, lokasi, unit kerja,
            serta audit log.
          </Alert>
        </CardContent>
      </Card>
    </>
  );
}
