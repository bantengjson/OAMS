import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  KeyRound,
  PackagePlus,
  PackageX,
  Pencil,
  QrCode,
  Shield,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ASSET_ACTION_LABEL } from '@/features/assets/asset-history';
import type { Tone } from '@/lib/tones';
import type { AuditLog } from '@/types/api';

export interface DashboardBlocks {
  users: boolean;
  operations: { mutations: boolean; loans: boolean; maintenance: boolean };
  activity: boolean;
}

/** Which dashboard blocks the signed-in user may see; nothing is fetched for a hidden block. */
export function dashboardBlocks(can: (perm: string) => boolean): DashboardBlocks {
  return {
    users: can('users.manage'),
    operations: { mutations: can('mutations.view'), loans: can('loans.view'), maintenance: can('assets.view') },
    activity: can('audit_logs.view_all') || can('audit_logs.view_operational'),
  };
}

/** The acquisition-year chart only says something with at least two years that have assets. */
export function showYearChart(rows: { year: number; count: number }[]): boolean {
  return rows.filter((r) => r.count > 0).length >= 2;
}

/** Icon and colour per audit module; shared with the Audit Log page. */
export const ACTIVITY_MODULE_STYLE: Record<string, { tone: Tone; icon: LucideIcon }> = {
  assets: { tone: 'slate', icon: Pencil },
  qr: { tone: 'teal', icon: QrCode },
  assignments: { tone: 'violet', icon: UserCheck },
  condition_logs: { tone: 'green', icon: ClipboardCheck },
  mutations: { tone: 'violet', icon: ArrowLeftRight },
  loans: { tone: 'blue', icon: HandCoins },
  stock_opnames: { tone: 'teal', icon: ClipboardList },
  maintenance: { tone: 'orange', icon: Wrench },
  disposals: { tone: 'slate', icon: PackageX },
  users: { tone: 'blue', icon: Users },
  roles: { tone: 'violet', icon: Shield },
  auth: { tone: 'slate', icon: KeyRound },
};
const FALLBACK_STYLE = { tone: 'slate' as Tone, icon: Pencil };

/** Per-action overrides where the module colour would mislead. */
const ACTION_STYLE: Record<string, { tone: Tone; icon: LucideIcon }> = {
  'asset.created': { tone: 'teal', icon: PackagePlus },
  'maintenance.reported': { tone: 'amber', icon: AlertTriangle },
};

export function activityStyle(module: string, action: string): { tone: Tone; icon: LucideIcon } {
  return ACTION_STYLE[action] ?? ACTIVITY_MODULE_STYLE[module] ?? FALLBACK_STYLE;
}

const STATUS_OF: Record<string, { label: string; tone: Tone }> = {
  'mutation.requested': { label: 'Menunggu', tone: 'amber' },
  'mutation.approved': { label: 'Disetujui', tone: 'green' },
  'mutation.rejected': { label: 'Ditolak', tone: 'red' },
  'loan.created': { label: 'Dipinjam', tone: 'violet' },
  'maintenance.reported': { label: 'Dilaporkan', tone: 'amber' },
};

/** Audit modules shown in Aktivitas terbaru; each is fetched separately so bulk QR or opname entries cannot crowd them out. */
export const ACTIVITY_MODULES = ['assets', 'mutations', 'loans', 'maintenance', 'disposals'] as const;
const DASHBOARD_MODULES = new Set<string>(ACTIVITY_MODULES);

export interface ActivityRow {
  id: string;
  at: string;
  label: string;
  tone: Tone;
  icon: LucideIcon;
  actor: string;
  assetId: string | null;
  assetText: string | null;
  status: { label: string; tone: Tone } | null;
}

function assetTextOf(...sources: unknown[]): string | null {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const o = src as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : null;
    const code = typeof o.assetCode === 'string' ? o.assetCode : null;
    if (name || code) return [name, code].filter(Boolean).join(' · ');
  }
  return null;
}

/** An audit entry as a dashboard activity row; `null` for entries that are not about assets. */
export function toActivityRow(log: AuditLog): ActivityRow | null {
  if (!DASHBOARD_MODULES.has(log.module)) return null;
  const style = activityStyle(log.module, log.action);
  return {
    id: log.id,
    at: log.createdAt,
    label: ASSET_ACTION_LABEL[log.action] ?? log.action,
    tone: style.tone,
    icon: style.icon,
    actor: log.actor?.fullName ?? 'Sistem',
    assetId: log.entityId,
    assetText: assetTextOf(log.after, log.before),
    status: STATUS_OF[log.action] ?? null,
  };
}

/** Newest asset activity across the per-module pages, without duplicates, cut to `limit` rows. */
export function mergeActivity(perModule: AuditLog[][], limit: number): ActivityRow[] {
  const byId = new Map<string, ActivityRow>();
  for (const entry of perModule.flat()) {
    const row = toActivityRow(entry);
    if (row && !byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/**
 * Bars for the acquisition-year chart: every year between the first and last one (empty years
 * included, so the axis is even), at most `max` bars; older years fold into one "≤year" bar.
 */
export function yearChartRows(
  rows: { year: number; count: number }[],
  max = 8,
): { key: string; label: string; value: number }[] {
  if (rows.length === 0) return [];
  const byYear = new Map(rows.map((r) => [r.year, r.count]));
  const first = Math.min(...rows.map((r) => r.year));
  const last = Math.max(...rows.map((r) => r.year));
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i).map((y) => ({
    key: String(y),
    label: String(y),
    value: byYear.get(y) ?? 0,
  }));
  if (all.length <= max) return all;
  const kept = all.slice(all.length - (max - 1));
  const older = all.slice(0, all.length - (max - 1));
  const lastOlder = older[older.length - 1].label;
  return [{ key: 'older', label: `≤${lastOlder}`, value: older.reduce((s, r) => s + r.value, 0) }, ...kept];
}
