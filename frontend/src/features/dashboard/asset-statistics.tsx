'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, ClipboardList, Clock, HandCoins, PackageX, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarList, ColumnChart, DonutChart } from '@/components/ui/charts';
import { IconChip } from '@/components/ui/icon-chip';
import { MetricStrip } from '@/components/ui/metric-strip';
import type { Metric } from '@/components/ui/metric-strip';
import { getErrorMessage } from '@/lib/api/form-errors';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { useCategoryTone } from '@/hooks/use-category-tone';
import { CONDITION_TONE, FLOW_TONE } from '@/lib/tones';
import { ASSET_CONDITIONS } from '@/types/api';
import type { AssetStatistics } from '@/types/api';
import type { DashboardBlocks } from './dashboard-model';
import { showYearChart, yearChartRows } from './dashboard-model';

const toneVar = (tone: string) => `var(--tone-${tone})`;

/** Operational metrics in one strip, plus the running stock-opname session when there is one. */
export function OperationsPanel({
  stats,
  blocks,
  canOpname,
}: {
  stats: UseQueryResult<AssetStatistics>;
  blocks: DashboardBlocks;
  canOpname: boolean;
}) {
  const s = stats.data;
  const items: Metric[] = [];
  if (blocks.operations.mutations) {
    items.push({ key: 'mut', label: 'Mutasi menunggu', value: s?.pendingMutations, icon: ArrowLeftRight, tone: FLOW_TONE.mutation, href: '/mutations?status=PENDING' });
  }
  if (blocks.operations.loans) {
    items.push(
      { key: 'loan', label: 'Peminjaman aktif', value: s?.activeLoans, icon: HandCoins, tone: FLOW_TONE.loan, href: '/loans' },
      { key: 'late', label: 'Peminjaman terlambat', value: s?.overdueLoans, icon: Clock, tone: FLOW_TONE.overdue, href: '/loans?state=overdue', alertOnly: true },
    );
  }
  if (blocks.operations.maintenance) {
    items.push(
      { key: 'repair', label: 'Dalam perbaikan', value: s?.inMaintenance, icon: Wrench, tone: FLOW_TONE.maintenance, href: '/maintenance?status=IN_PROGRESS' },
      { key: 'report', label: 'Laporan kerusakan baru', value: s?.openMaintenance, icon: AlertTriangle, tone: FLOW_TONE.damageReport, href: '/maintenance?status=REPORTED', alertOnly: true },
      { key: 'out', label: 'Barang dilepas', value: s?.disposed, icon: PackageX, tone: FLOW_TONE.disposal, href: '/disposals' },
    );
  }
  const opname = canOpname ? s?.openOpname : null;
  return (
    <>
      <MetricStrip title="Operasional" subtitle="Klik untuk membuka daftarnya" items={items} loading={stats.isPending} error={stats.isError} />
      {opname ? (
        <Link
          href={`/stock-opnames/${opname.id}`}
          className="flex items-center gap-3 rounded-card border border-border bg-card px-5 py-3 shadow-card transition-colors hover:bg-[#fafbfc]"
        >
          <IconChip icon={ClipboardList} tone={FLOW_TONE.opname} size="sm" className="h-8 w-8 rounded-lg" />
          <span className="text-sm">
            <span className="font-medium text-foreground">Stock opname berjalan</span>
            <span className="text-muted-foreground"> · {opname.name}</span>
          </span>
          <span className="ml-auto text-sm font-semibold text-tone-teal tabular-nums">
            {opname.scanned}/{opname.total}
          </span>
        </Link>
      ) : null}
    </>
  );
}

/** Condition donut, category bars and the acquisition-year chart; built only from API data. */
export function AnalyticsPanel({ stats }: { stats: UseQueryResult<AssetStatistics> }) {
  const categoryTone = useCategoryTone();
  if (stats.isError) return <Alert variant="error">{getErrorMessage(stats.error)}</Alert>;
  const s = stats.data;
  if (!s) return null;
  const goodPct = s.active > 0 ? Math.round(((s.byCondition.GOOD ?? 0) / s.active) * 100) : 0;
  const years = showYearChart(s.byAcquisitionYear);
  return (
    <div className={years ? 'grid gap-4 lg:grid-cols-2 min-[1440px]:grid-cols-[1fr_1.2fr_1.2fr]' : 'grid gap-4 lg:grid-cols-2'}>
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle>Kondisi barang</CardTitle>
          <span className="text-xs text-muted-foreground">{s.active} aktif</span>
        </CardHeader>
        <CardContent className="pt-4">
          {s.active === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada barang aktif.</p>
          ) : (
            <DonutChart
              center={`${goodPct}%`}
              caption="baik"
              parts={ASSET_CONDITIONS.map((c) => ({
                key: c,
                label: CONDITION_LABEL[c],
                value: s.byCondition[c] ?? 0,
                color: toneVar(CONDITION_TONE[c]),
                href: `/assets?condition=${c}`,
              }))}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle>Per kategori</CardTitle>
          <span className="text-xs text-muted-foreground">8 terbanyak</span>
        </CardHeader>
        <CardContent className="pt-4">
          {s.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada barang.</p>
          ) : (
            <BarList
              rows={s.byCategory.slice(0, 8).map((c) => ({ key: c.id, label: c.name, value: c.count, color: toneVar(categoryTone(c.id)) }))}
            />
          )}
        </CardContent>
      </Card>
      {years ? (
        <Card className="lg:col-span-2 min-[1440px]:col-span-1">
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle>Perolehan per tahun</CardTitle>
            <span className="text-xs text-muted-foreground">jumlah unit</span>
          </CardHeader>
          <CardContent className="pt-4">
            <ColumnChart
              highlightLast
              rows={yearChartRows(s.byAcquisitionYear).map((r) => ({ ...r, color: 'var(--tone-blue)' }))}
            />
            {s.withoutAcquisitionYear > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">{s.withoutAcquisitionYear} barang tanpa tahun perolehan</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
