import { formatAssetCode, jakartaYear } from './asset-code.js';

describe('formatAssetCode', () => {
  it('pads the sequence to four digits', () => {
    expect(formatAssetCode(2026, 1)).toBe('INV-2026-0001');
    expect(formatAssetCode(2026, 42)).toBe('INV-2026-0042');
    expect(formatAssetCode(2026, 9999)).toBe('INV-2026-9999');
  });

  it('grows past four digits without wrapping', () => {
    expect(formatAssetCode(2026, 10000)).toBe('INV-2026-10000');
    expect(formatAssetCode(2027, 123456)).toBe('INV-2027-123456');
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
