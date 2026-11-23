import { buildReportSections } from './inventory-report.js';
import type { ReportGroup, ReportUnit } from './inventory-report.js';

const unit = (extra: Partial<ReportUnit> = {}): ReportUnit => ({
  golongan: 'NG',
  typeNumber: 2,
  typeName: 'Komputer',
  roomCode: 'A',
  roomName: 'Sekretariat',
  year: 2025,
  specification: 'LG Dell',
  condition: 'GOOD',
  present: true,
  source: null,
  ...extra,
});

const group = (extra: Partial<ReportGroup> = {}): ReportGroup => ({
  golongan: 'NG',
  typeNumber: 110,
  typeName: 'Piring',
  roomCode: 'I',
  roomName: 'Dapur',
  year: null,
  specification: null,
  source: null,
  good: 78,
  needsRepair: 0,
  damaged: 2,
  ...extra,
});

describe('buildReportSections', () => {
  it('writes mixed years and specifications like the office sheet', () => {
    const units = [
      unit(),
      unit(),
      unit({ year: 2020, specification: 'Lenovo' }),
      unit({ year: 2020, specification: 'Lenovo', condition: 'DAMAGED' }),
    ];
    const [, ng, roomA] = buildReportSections(units, [], 'per-room');
    expect(ng.title).toBe('B. INVENTARIS BARANG TIDAK BERGERAK/TETAP (KODE: NG)');
    expect(roomA.title).toBe('RUANG SEKRETARIAT (KODE: A)');
    expect(roomA.rows).toEqual([
      {
        no: '002',
        name: 'Komputer',
        qty: 4,
        years: '2025 (2), 2020 (2)',
        specs: 'LG Dell (2), Lenovo (2)',
        good: 3,
        needsRepair: 0,
        damaged: 1,
        keterangan: 'Ada',
        source: '',
      },
    ]);
  });

  it('writes a single value plainly and an unknown year as empty', () => {
    const [, , roomA] = buildReportSections([unit({ year: null, specification: null, source: 'Hibah Ibu' })], [], 'per-room');
    expect(roomA.rows[0]).toMatchObject({ qty: 1, years: '', specs: '', source: 'Hibah Ibu' });
  });

  it('lists disposed units in a separate "Tidak Ada" row', () => {
    const [, , roomA] = buildReportSections([unit(), unit({ present: false })], [], 'per-room');
    expect(roomA.rows.map((r) => [r.keterangan, r.qty])).toEqual([
      ['Ada', 1],
      ['Tidak Ada', 1],
    ]);
  });

  it('puts vehicles first, then land without a room, then rooms in letter order', () => {
    const units = [
      unit({ roomCode: 'B', roomName: 'Ketua', typeNumber: 41, typeName: 'TV' }),
      unit({ golongan: 'BG', typeNumber: 4, typeName: 'Mobil Ambulan', roomCode: null, roomName: null }),
      unit({ typeNumber: 1, typeName: 'Tanah dan Bangunan', roomCode: null, roomName: null }),
      unit(),
    ];
    const sections = buildReportSections(units, [group()], 'per-room');
    expect(sections.map((s) => s.title)).toEqual([
      'A. INVENTARIS BARANG BERGERAK (KODE: BG)',
      'B. INVENTARIS BARANG TIDAK BERGERAK/TETAP (KODE: NG)',
      'RUANG SEKRETARIAT (KODE: A)',
      'RUANG KETUA (KODE: B)',
      'RUANG DAPUR (KODE: I)',
    ]);
    expect(sections[0].rows[0]).toMatchObject({ no: '004', name: 'Mobil Ambulan' });
    expect(sections[1].rows[0]).toMatchObject({ no: '001', name: 'Tanah dan Bangunan' });
  });

  it('adds group items to their room with their counts', () => {
    const sections = buildReportSections([], [group()], 'per-room');
    const dapur = sections.find((s) => s.title === 'RUANG DAPUR (KODE: I)')!;
    expect(dapur.rows[0]).toMatchObject({ no: '110', name: 'Piring', qty: 80, good: 78, damaged: 2, keterangan: 'Ada' });
  });

  it('overall mode collapses rooms into one row per type', () => {
    const units = [unit(), unit({ roomCode: 'C', roomName: 'Bendahara', year: 2020 })];
    const sections = buildReportSections(units, [group(), group({ roomCode: 'A', roomName: 'Sekretariat', good: 5, damaged: 0 })], 'overall');
    expect(sections.map((s) => s.title)).toEqual([
      'A. INVENTARIS BARANG BERGERAK (KODE: BG)',
      'B. INVENTARIS BARANG TIDAK BERGERAK/TETAP (KODE: NG)',
    ]);
    expect(sections[1].rows).toEqual([
      expect.objectContaining({ no: '002', qty: 2, years: '2025 (1), 2020 (1)' }),
      expect.objectContaining({ no: '110', qty: 85, good: 83, damaged: 2 }),
    ]);
  });
});
