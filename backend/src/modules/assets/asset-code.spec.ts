import { codePrefix, formatAssetCode, jakartaYear, normalizeOrg } from './asset-code.js';

describe('codePrefix', () => {
  it('writes golongan.room / type / org / year', () => {
    expect(codePrefix({ golongan: 'NG', roomCode: 'A', typeNumber: 12, org: 'DPC', year: 2023 })).toBe('NG.A/012/DPC/2023');
  });

  it('has no room letter for vehicles and land', () => {
    expect(codePrefix({ golongan: 'BG', roomCode: null, typeNumber: 4, org: 'DPC', year: 2023 })).toBe('BG/004/DPC/2023');
    expect(codePrefix({ golongan: 'NG', roomCode: null, typeNumber: 1, org: 'DPC', year: 2019 })).toBe('NG/001/DPC/2019');
  });

  it('writes TT when the year is unknown', () => {
    expect(codePrefix({ golongan: 'NG', roomCode: 'J', typeNumber: 12, org: 'DPC', year: null })).toBe('NG.J/012/DPC/TT');
  });
});

describe('formatAssetCode', () => {
  it('pads the unit number to two digits', () => {
    expect(formatAssetCode('NG.A/012/DPC/2023', 1)).toBe('NG.A/012/DPC/2023-01');
    expect(formatAssetCode('NG.A/012/DPC/2023', 99)).toBe('NG.A/012/DPC/2023-99');
  });

  it('grows to three digits after 99', () => {
    expect(formatAssetCode('NG.I/012/DPC/2023', 100)).toBe('NG.I/012/DPC/2023-100');
  });
});

describe('normalizeOrg', () => {
  it('upper-cases and accepts 2-10 letters or digits', () => {
    expect(normalizeOrg(' dpc ')).toBe('DPC');
    expect(normalizeOrg('DPD2')).toBe('DPD2');
  });

  it('rejects spaces, symbols and wrong lengths', () => {
    expect(normalizeOrg('d p c')).toBeNull();
    expect(normalizeOrg('D/C')).toBeNull();
    expect(normalizeOrg('D')).toBeNull();
    expect(normalizeOrg('ABCDEFGHIJK')).toBeNull();
  });
});

describe('jakartaYear', () => {
  it('uses the Asia/Jakarta calendar year, not UTC', () => {
    // 31 Dec 2026 17:30 UTC is already 1 Jan 2027 00:30 in Jakarta (UTC+7)
    expect(jakartaYear(new Date('2026-12-31T17:30:00Z'))).toBe(2027);
    expect(jakartaYear(new Date('2026-12-31T16:30:00Z'))).toBe(2026);
    expect(jakartaYear(new Date('2026-06-15T12:00:00Z'))).toBe(2026);
  });
});
