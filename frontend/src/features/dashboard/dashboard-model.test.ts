import { describe, expect, it } from 'vitest';
import type { AuditLog } from '@/types/api';
import { ACTIVITY_MODULES, dashboardBlocks, mergeActivity, showYearChart, toActivityRow, yearChartRows } from './dashboard-model';

const can = (perms: string[]) => (p: string) => perms.includes(p);

const log = (over: Partial<AuditLog>): AuditLog => ({
  id: 'l1',
  actor: { id: 'u1', fullName: 'Super Admin', email: 'a@x' },
  action: 'asset.updated',
  module: 'assets',
  entityId: 'asset-1',
  before: null,
  after: null,
  ip: null,
  userAgent: null,
  createdAt: '2026-11-21T03:00:00.000Z',
  ...over,
});

describe('dashboardBlocks', () => {
  it('shows a viewer only what their permissions allow', () => {
    const b = dashboardBlocks(can(['assets.view', 'loans.view', 'mutations.view']));
    expect(b.users).toBe(false);
    expect(b.activity).toBe(false);
    expect(b.operations).toEqual({ mutations: true, loans: true, maintenance: true });
  });

  it('shows everything to a super admin', () => {
    const b = dashboardBlocks(
      can(['users.manage', 'assets.view', 'loans.view', 'mutations.view', 'audit_logs.view_all']),
    );
    expect(b).toEqual({ users: true, activity: true, operations: { mutations: true, loans: true, maintenance: true } });
  });

  it('accepts the operational audit permission for the activity panel', () => {
    expect(dashboardBlocks(can(['audit_logs.view_operational'])).activity).toBe(true);
  });
});

describe('showYearChart', () => {
  it('needs at least two years with assets', () => {
    expect(showYearChart([])).toBe(false);
    expect(showYearChart([{ year: 2025, count: 3 }])).toBe(false);
    expect(showYearChart([{ year: 2024, count: 1 }, { year: 2025, count: 0 }])).toBe(false);
    expect(showYearChart([{ year: 2024, count: 1 }, { year: 2025, count: 2 }])).toBe(true);
  });
});

describe('toActivityRow', () => {
  it('drops modules that are not about assets', () => {
    expect(toActivityRow(log({ module: 'auth', action: 'auth.login' }))).toBeNull();
    expect(toActivityRow(log({ module: 'users', action: 'user.created' }))).toBeNull();
  });

  it('labels an approved mutation with its asset and a green status', () => {
    const row = toActivityRow(
      log({ module: 'mutations', action: 'mutation.approved', after: { name: 'Printer', assetCode: 'INV-2026-0001' } }),
    );
    expect(row).toMatchObject({
      label: 'Mutasi disetujui',
      assetText: 'Printer · INV-2026-0001',
      assetId: 'asset-1',
      actor: 'Super Admin',
      status: { label: 'Disetujui', tone: 'green' },
      tone: 'violet',
    });
  });

  it('falls back to the raw action and no asset text when the entry has none', () => {
    const row = toActivityRow(log({ module: 'loans', action: 'loan.extended', after: { loanId: 'x' } }));
    expect(row).toMatchObject({ label: 'loan.extended', assetText: null, status: null, tone: 'blue' });
  });
});

describe('mergeActivity', () => {
  it('keeps the newest asset entries even when another module floods the log', () => {
    const at = (m: string, min: number) => log({ id: `${m}-${min}`, module: m, action: `${m}.x`, createdAt: new Date(Date.UTC(2026, 10, 21, 3, min)).toISOString() });
    const perModule = [
      [at('mutations', 50), at('mutations', 10)],
      [at('loans', 40)],
      [at('assets', 30), at('assets', 5)],
    ];
    const rows = mergeActivity(perModule, 3);
    expect(rows.map((r) => r.id)).toEqual(['mutations-50', 'loans-40', 'assets-30']);
  });

  it('asks one page per dashboard module', () => {
    expect([...ACTIVITY_MODULES].sort()).toEqual(['assets', 'disposals', 'loans', 'maintenance', 'mutations']);
  });
});

describe('yearChartRows', () => {
  it('fills missing years so the axis is evenly spaced', () => {
    expect(yearChartRows([{ year: 2022, count: 2 }, { year: 2024, count: 5 }]).map((r) => [r.label, r.value])).toEqual([
      ['2022', 2],
      ['2023', 0],
      ['2024', 5],
    ]);
  });

  it('keeps the last years and folds older ones into one bar', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ year: 2015 + i, count: 1 }));
    const out = yearChartRows(rows, 8);
    expect(out).toHaveLength(8);
    expect(out[0]).toMatchObject({ label: '≤2019', value: 5 });
    expect(out[7]).toMatchObject({ label: '2026', value: 1 });
  });
});
