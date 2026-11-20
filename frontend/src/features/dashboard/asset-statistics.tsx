'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Archive, ArrowLeftRight, Boxes, CheckCircle2, ClipboardList, HandCoins, Hammer, PackageX, Wrench } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { CONDITION_LABEL, STATUS_LABEL } from '@/lib/asset-labels';
import { useAuth } from '@/lib/auth/use-auth';
import { ASSET_CONDITIONS, ASSET_STATUSES } from '@/types/api';
import { StatCard } from './stat-card';

const STATUS_BAR: Record<string, string> = {
  AVAILABLE: 'bg-success',
  IN_USE: 'bg-primary',
  STORED: 'bg-slate-400',
  BORROWED: 'bg-warning',
  UNDER_MAINTENANCE: 'bg-amber-500',
  MISSING: 'bg-destructive',
  DISPOSED: 'bg-slate-500',
  RETURNED: 'bg-sky-500',
};
const CONDITION_BAR: Record<string, string> = {
  GOOD: 'bg-success',
  MINOR_DAMAGE: 'bg-warning',
  MAJOR_DAMAGE: 'bg-orange-600',
  UNUSABLE: 'bg-destructive',
};

export function BarList({
  rows,
  total,
}: {
  rows: { key: string; label: string; count: number; color: string }[];
  total: number;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        return (
          <li key={r.key} className="text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span>{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} <span className="text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AssetStatisticsPanel() {
  const { hasPermission } = useAuth();
  const canMutations = hasPermission('mutations.view');
  const canLoans = hasPermission('loans.view');
  const canMaintenance = hasPermission('assets.view');
  const canOpname = hasPermission('stock_opnames.execute') || hasPermission('stock_opnames.manage');
  const stats = useQuery({ queryKey: ['assets', 'statistics'], queryFn: assetsApi.statistics });
  const s = stats.data;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total barang" icon={Boxes} href="/assets" value={s?.total} loading={stats.isPending} error={stats.isError} />
        <StatCard label="Aktif" icon={CheckCircle2} href="/assets" value={s?.active} loading={stats.isPending} error={stats.isError} />
        <StatCard label="Diarsipkan" icon={Archive} value={s?.archived} loading={stats.isPending} error={stats.isError} />
        <StatCard label="Dilepas" icon={PackageX} href="/disposals" value={s?.disposed} loading={stats.isPending} error={stats.isError} />
      </div>

      {canMutations || canLoans ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {canMutations ? (
            <StatCard
              label="Mutasi menunggu"
              icon={ArrowLeftRight}
              href="/mutations?status=PENDING"
              value={s?.pendingMutations}
              loading={stats.isPending}
              error={stats.isError}
            />
          ) : null}
          {canLoans ? (
            <>
              <StatCard label="Pinjaman aktif" icon={HandCoins} href="/loans" value={s?.activeLoans} loading={stats.isPending} error={stats.isError} />
              <StatCard
                label="Pinjaman terlambat"
                icon={AlertTriangle}
                href="/loans?state=overdue"
                value={s?.overdueLoans}
                loading={stats.isPending}
                error={stats.isError}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {canMaintenance || (canOpname && s?.openOpname) ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {canMaintenance ? (
            <>
              <StatCard
                label="Dalam perbaikan"
                icon={Wrench}
                href="/maintenance?status=IN_PROGRESS"
                value={s?.inMaintenance}
                loading={stats.isPending}
                error={stats.isError}
              />
              <StatCard
                label="Laporan kerusakan baru"
                icon={Hammer}
                href="/maintenance?status=REPORTED"
                value={s?.openMaintenance}
                loading={stats.isPending}
                error={stats.isError}
              />
            </>
          ) : null}
          {canOpname && s?.openOpname ? (
            <StatCard
              label="Stock opname berjalan"
              icon={ClipboardList}
              href={`/stock-opnames/${s.openOpname.id}`}
              value={`${s.openOpname.scanned}/${s.openOpname.total}`}
              hint={s.openOpname.name}
            />
          ) : null}
        </div>
      ) : null}

      {stats.isError ? <Alert variant="error">{getErrorMessage(stats.error)}</Alert> : null}

      {s ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Per status</CardTitle>
              <CardDescription>Barang aktif menurut status pemakaian.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                total={s.active}
                rows={ASSET_STATUSES.map((k) => ({ key: k, label: STATUS_LABEL[k], count: s.byStatus[k] ?? 0, color: STATUS_BAR[k] }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Per kondisi</CardTitle>
              <CardDescription>Barang aktif menurut kondisi fisik.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                total={s.active}
                rows={ASSET_CONDITIONS.map((k) => ({ key: k, label: CONDITION_LABEL[k], count: s.byCondition[k] ?? 0, color: CONDITION_BAR[k] }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Per kategori</CardTitle>
              <CardDescription>Sepuluh kategori dengan barang aktif terbanyak.</CardDescription>
            </CardHeader>
            <CardContent>
              {s.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada barang.</p>
              ) : (
                <BarList
                  total={s.active}
                  rows={s.byCategory.slice(0, 10).map((c) => ({ key: c.id, label: c.name, count: c.count, color: 'bg-primary' }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
