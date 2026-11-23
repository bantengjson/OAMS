import { planImport } from './plan.js';
import type { ImportData, ImportRow } from './types.js';

const row = (extra: Partial<ImportRow> = {}): ImportRow => ({
  golongan: 'NG',
  typeNumber: 2,
  roomCode: 'A',
  name: 'Komputer',
  qty: 1,
  years: 2025,
  specs: null,
  good: 1,
  needsRepair: null,
  damaged: null,
  source: null,
  keterangan: 'Ada',
  group: false,
  notes: [],
  origin: 'Uji baris 1',
  ...extra,
});

const data = (rows: ImportRow[], vehicles: ImportData['vehicles'] = []): ImportData => ({
  types: [{ golongan: 'NG', number: 2, name: 'Komputer', isGroup: false }],
  rooms: [{ code: 'A', name: 'Sekretariat' }],
  rows,
  vehicles,
});

describe('planImport', () => {
  it('pairs mixed years and specifications in written order', () => {
    const plan = planImport(data([row({ qty: 4, years: '2025 (2), 2020 (2)', specs: 'LG Dell (2), Lenovo (2)', good: 4 })]));
    expect(plan.units.map((u) => [u.year, u.specification])).toEqual([
      [2025, 'LG Dell'],
      [2025, 'LG Dell'],
      [2020, 'Lenovo'],
      [2020, 'Lenovo'],
    ]);
    expect(plan.checks).toEqual([]);
  });

  it('reads counts written without spaces or with a full stop', () => {
    const plan = planImport(data([row({ qty: 7, years: '2023 (6). 2025 (1)', good: 7 })]));
    expect(plan.units.map((u) => u.year)).toEqual([2023, 2023, 2023, 2023, 2023, 2023, 2025]);
  });

  it('splits years without counts evenly when the quantity allows', () => {
    expect(planImport(data([row({ qty: 2, years: '2023/2025', good: 2 })])).units.map((u) => u.year)).toEqual([2023, 2025]);
    expect(planImport(data([row({ qty: 2, years: '2022, 2025', good: 2 })])).units.map((u) => u.year)).toEqual([2022, 2025]);
  });

  it('marks an uneven split as TT and lists it', () => {
    const plan = planImport(data([row({ qty: 3, years: '2023/2025', good: 3 })]));
    expect(plan.units.map((u) => u.year)).toEqual([null, null, null]);
    expect(plan.checks).toEqual([expect.objectContaining({ origin: 'Uji baris 1', message: expect.stringContaining('Tahun') })]);
  });

  it('treats a word in the year column as TT and keeps it as specification', () => {
    const plan = planImport(data([row({ qty: 1, years: 'Nagata', specs: null })]));
    expect(plan.units[0]).toMatchObject({ year: null, specification: 'Nagata' });
    expect(plan.checks).toHaveLength(1);
  });

  it('leaves an empty year as TT', () => {
    expect(planImport(data([row({ years: null })])).units[0].year).toBeNull();
  });

  it('splits conditions: first Baik, then Perlu Perbaikan, then Rusak', () => {
    const plan = planImport(data([row({ qty: 6, good: 5, needsRepair: null, damaged: 1 })]));
    expect(plan.units.map((u) => u.condition)).toEqual(['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'DAMAGED']);
  });

  it('ignores a condition split that does not add up, and lists it', () => {
    const plan = planImport(data([row({ qty: 2, good: 5 })]));
    expect(plan.units.map((u) => u.condition)).toEqual(['GOOD', 'GOOD']);
    expect(plan.checks[0].message).toContain('Kondisi');
  });

  it('reads "1 set" and odd quantities as one unit and lists them', () => {
    const set = planImport(data([row({ qty: '1 set' })]));
    expect(set.units).toHaveLength(1);
    expect(set.checks[0].message).toContain('Jumlah');
    const odd = planImport(data([row({ qty: '`', good: null })]));
    expect(odd.units).toHaveLength(1);
    const blank = planImport(data([row({ qty: null, good: null })]));
    expect(blank.units).toHaveLength(1);
    expect(blank.units[0].condition).toBe('GOOD');
  });

  it('gives the remaining count to a single uncounted specification', () => {
    const plan = planImport(data([row({ qty: 4, specs: 'Fantech (1), Lenovo (2), Logitec (!)', good: 4 })]));
    expect(plan.units.map((u) => u.specification)).toEqual(['Fantech', 'Lenovo', 'Lenovo', 'Logitec']);
  });

  it('keeps a specification with words in brackets as one text', () => {
    const plan = planImport(data([row({ qty: 2, specs: 'Bantex (Merah dan Hitam)', good: 2 })]));
    expect(plan.units.map((u) => u.specification)).toEqual(['Bantex (Merah dan Hitam)', 'Bantex (Merah dan Hitam)']);
  });

  it('splits a plain list of names one per unit', () => {
    const plan = planImport(data([row({ qty: 2, specs: 'Sony, Canon', good: 2 })]));
    expect(plan.units.map((u) => u.specification)).toEqual(['Sony', 'Canon']);
  });

  it('records a row marked "Tidak Ada" as released, and keeps the donor', () => {
    const plan = planImport(data([row({ keterangan: 'Tidak Ada', source: 'Sumbangan Bapak Uji' })]));
    expect(plan.units[0]).toMatchObject({ disposed: true, source: 'Sumbangan Bapak Uji' });
  });

  it('turns a group row into one group item with its counts', () => {
    const plan = planImport(data([row({ group: true, typeNumber: 110, roomCode: 'I', name: 'Piring', qty: 80, years: null, good: 78, damaged: 2 })]));
    expect(plan.units).toEqual([]);
    expect(plan.groups).toEqual([
      expect.objectContaining({ typeNumber: 110, roomCode: 'I', name: 'Piring', good: 78, needsRepair: 0, damaged: 2, year: null }),
    ]);
  });

  it('plans vehicles without a room, released ones included', () => {
    const plan = planImport(
      data([], [
        { typeNumber: 4, name: 'Mobil Ambulan', year: 2023, specification: 'Suzuki APV', serialNumber: 'X 1 AB', oldPlates: 'Y 2 CD', source: null, disposed: false, origin: 'BG 004' },
        { typeNumber: 1, name: 'Mobil Ambulan', year: 2015, specification: 'APV', serialNumber: null, oldPlates: null, source: null, disposed: true, origin: 'BG 001' },
      ]),
    );
    expect(plan.units).toEqual([
      expect.objectContaining({ golongan: 'BG', typeNumber: 4, roomCode: null, serialNumber: 'X 1 AB', notes: 'Nomor polisi lama: Y 2 CD', disposed: false }),
      expect.objectContaining({ golongan: 'BG', typeNumber: 1, disposed: true }),
    ]);
  });

  it('carries row notes onto every unit', () => {
    const plan = planImport(data([row({ notes: ['Asuransi DJI Osmo'] })]));
    expect(plan.units[0].notes).toBe('Asuransi DJI Osmo');
  });
});
