import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyImport, IMPORT_ALREADY_DONE, IMPORT_MARKER_KEY, readOrg } from '../src/database/import-office/apply.js';
import { planImport } from '../src/database/import-office/plan.js';
import { writePreview } from '../src/database/import-office/preview-xlsx.js';
import type { ImportData } from '../src/database/import-office/types.js';
import { createTestApp } from './utils/app.js';
import type { TestContext } from './utils/app.js';

// Invented rows only; the office data never enters the repository.
const DATA: ImportData = {
  types: [
    { golongan: 'BG', number: 4, name: 'Mobil Uji', isGroup: false },
    { golongan: 'NG', number: 1, name: 'Tanah Uji Impor', isGroup: false },
    { golongan: 'NG', number: 2, name: 'Komputer Uji', isGroup: false },
    { golongan: 'NG', number: 110, name: 'Piring Uji Impor', isGroup: true },
  ],
  rooms: [
    { code: 'A', name: 'Sekretariat' },
    { code: 'I', name: 'Dapur' },
  ],
  rows: [
    {
      golongan: 'NG', typeNumber: 1, roomCode: null, name: 'Tanah dan Bangunan', qty: 1, years: 2019, specs: null,
      good: 1, needsRepair: null, damaged: null, source: null, keterangan: 'Ada', group: false, notes: [], origin: 'uji 1',
    },
    {
      golongan: 'NG', typeNumber: 2, roomCode: 'A', name: 'Komputer', qty: 3, years: '2025 (2), 2020 (1)', specs: 'Dell (2), Lenovo (1)',
      good: 2, needsRepair: null, damaged: 1, source: null, keterangan: 'Ada', group: false, notes: [], origin: 'uji 2',
    },
    {
      golongan: 'NG', typeNumber: 110, roomCode: 'I', name: 'Piring', qty: 80, years: null, specs: null,
      good: 80, needsRepair: null, damaged: null, source: null, keterangan: 'Ada', group: true, notes: [], origin: 'uji 3',
    },
  ],
  vehicles: [
    { typeNumber: 4, name: 'Mobil Uji', year: 2023, specification: 'APV', serialNumber: 'L 1 UJI', oldPlates: null, source: 'Hibah Uji', disposed: true, origin: 'uji BG' },
  ],
};

describe('office import (e2e)', () => {
  let ctx: TestContext;
  let actorId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    actorId = (await ctx.loginAs('SUPER_ADMIN')).userId;
    await ctx.prisma.systemSetting.deleteMany({ where: { key: IMPORT_MARKER_KEY } });
  });

  afterAll(async () => {
    // Later suites create their own data; leave the marker off so nothing else depends on it.
    await ctx.prisma.systemSetting.deleteMany({ where: { key: IMPORT_MARKER_KEY } });
    await ctx.close();
  });

  it('preview writes nothing', async () => {
    const before = await ctx.prisma.asset.count();
    const path = join(mkdtempSync(join(tmpdir(), 'oams-import-')), 'pratinjau.xlsx');
    await writePreview(planImport(DATA), await readOrg(ctx.prisma), path);
    expect(existsSync(path)).toBe(true);
    expect(await ctx.prisma.asset.count()).toBe(before);
  });

  it('write creates units with office codes', async () => {
    const result = await applyImport(ctx.prisma, planImport(DATA), { actorId, today: '2026-11-23' });
    expect(result).toEqual({ units: 5, groups: 1, disposed: 1, types: 4, rooms: 2 });

    const assets = await ctx.prisma.asset.findMany({ orderBy: { assetCode: 'asc' }, include: { label: true } });
    expect(assets.map((a) => a.assetCode)).toEqual([
      'BG/004/DPC/2023-01',
      'NG.A/002/DPC/2020-01',
      'NG.A/002/DPC/2025-01',
      'NG.A/002/DPC/2025-02',
      'NG/001/DPC/2019-01',
    ]);
    const car = assets[0];
    expect(car).toMatchObject({ status: 'DISPOSED', serialNumber: 'L 1 UJI', source: 'Hibah Uji', acquisitionMethod: 'GRANT' });
    expect(car.label?.isActive).toBe(false);
    expect(await ctx.prisma.assetDisposal.count({ where: { assetId: car.id, reason: 'OTHER' } })).toBe(1);
    const pcs = assets.filter((a) => a.assetCode.startsWith('NG.A/002'));
    expect(pcs.map((a) => [a.acquisitionYear, a.specification, a.condition])).toEqual([
      [2020, 'Lenovo', 'DAMAGED'],
      [2025, 'Dell', 'GOOD'],
      [2025, 'Dell', 'GOOD'],
    ]);
    expect(await ctx.prisma.assetConditionLog.count()).toBe(5);

    const plates = await ctx.prisma.groupItem.findMany({ include: { location: true } });
    expect(plates).toEqual([expect.objectContaining({ name: 'Piring', qtyGood: 80, location: expect.objectContaining({ code: 'I' }) })]);

    // New units continue the counters the import left.
    const next = await ctx.prisma.assetCodeSequence.findUniqueOrThrow({ where: { prefix: 'NG.A/002/DPC/2025' } });
    expect(next.lastNumber).toBe(2);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'import.office' } })).toBe(1);
  });

  it('refuses to run when office data already exists', async () => {
    await expect(applyImport(ctx.prisma, planImport(DATA), { actorId, today: '2026-11-23' })).rejects.toThrow(IMPORT_ALREADY_DONE);
    expect(await ctx.prisma.asset.count()).toBe(5);
  });
});
