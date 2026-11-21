'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, CheckCircle2, RefreshCw, Tags, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderPill, PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { AnalyticsPanel, OperationsPanel } from '@/features/dashboard/asset-statistics';
import { dashboardBlocks } from '@/features/dashboard/dashboard-model';
import { RecentActivity } from '@/features/dashboard/recent-activity';
import { assetsApi } from '@/lib/api/assets';
import { categoriesApi } from '@/lib/api/categories';
import { api } from '@/lib/api/client';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';

const todayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(
    new Date(),
  );

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const blocks = dashboardBlocks(hasPermission);
  const canAssets = hasPermission('assets.view');
  const canMaster = hasPermission('master_data.view');
  const canOpname = hasPermission('stock_opnames.execute') || hasPermission('stock_opnames.manage');

  const health = useQuery({ queryKey: ['dashboard', 'health'], queryFn: () => api.get<{ status: string }>('/health'), retry: false });
  const stats = useQuery({ queryKey: ['assets', 'statistics'], queryFn: assetsApi.statistics, enabled: canAssets });
  const users = useQuery({
    queryKey: ['count', 'users'],
    queryFn: async () => (await usersApi.list({ isActive: true, pageSize: 1 })).meta.total,
    enabled: blocks.users,
  });
  const categories = useQuery({
    queryKey: ['count', 'categories'],
    queryFn: async () => (await categoriesApi.list({ isActive: true, pageSize: 1 })).meta.total,
    enabled: canMaster,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['assets', 'statistics'] });
    void queryClient.invalidateQueries({ queryKey: ['count'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const s = stats.data;
  const activePct = s && s.total > 0 ? Math.round((s.active / s.total) * 100) : 0;
  const systemOk = health.isSuccess;
  const kpiCount = 2 + (blocks.users ? 1 : 0) + (canMaster ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan inventaris DPC PDI Perjuangan"
        actions={
          <>
            <HeaderPill>{todayLabel()}</HeaderPill>
            {health.isPending ? null : (
              <HeaderPill className={systemOk ? 'bg-tone-green-soft text-[#11804f]' : 'bg-tone-red-soft text-[#b83e3e]'}>
                <span className={cn('h-1.5 w-1.5 rounded-full', systemOk ? 'bg-tone-green' : 'bg-tone-red')} aria-hidden="true" />
                {systemOk ? 'Sistem normal' : 'Sistem terganggu'}
              </HeaderPill>
            )}
            <Button variant="outline" size="sm" onClick={refresh} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Muat ulang
            </Button>
          </>
        }
      />

      {canAssets ? (
        <>
          <section
            className={cn(
              'grid gap-4 sm:grid-cols-2',
              kpiCount === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3',
              // An odd last tile spans the row on two-column layouts.
              'sm:[&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1',
            )}
          >
            <StatTile
              label="Total inventaris"
              icon={Boxes}
              tone="blue"
              href="/assets"
              value={s?.total}
              loading={stats.isPending}
              error={stats.isError}
              hint={s ? <><b>{s.active}</b> aktif · {s.archived} diarsipkan · {s.disposed} dilepas</> : null}
            />
            <StatTile
              label="Aset aktif"
              icon={CheckCircle2}
              tone="green"
              href="/assets"
              value={s?.active}
              loading={stats.isPending}
              error={stats.isError}
              hint={s ? <><b>{activePct}%</b> dari total inventaris</> : null}
            />
            {blocks.users ? (
              <StatTile
                label="Pengguna aktif"
                icon={Users}
                tone="violet"
                href="/users"
                value={users.data}
                loading={users.isPending}
                error={users.isError}
                hint="yang bisa masuk ke aplikasi"
              />
            ) : null}
            {canMaster ? (
              <StatTile
                label="Kategori barang"
                icon={Tags}
                tone="amber"
                href={hasPermission('categories.manage') ? '/categories' : undefined}
                value={categories.data}
                loading={categories.isPending}
                error={categories.isError}
                hint="kategori aktif"
              />
            ) : null}
          </section>
          <OperationsPanel stats={stats} blocks={blocks} canOpname={canOpname} />
          <AnalyticsPanel stats={stats} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Statistik inventaris</CardTitle>
            <CardDescription>Akun Anda tidak memiliki izin melihat inventaris.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {blocks.activity ? <RecentActivity /> : null}
    </>
  );
}
