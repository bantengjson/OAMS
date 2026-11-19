import { daysBetween, daysOverdue, isoDateOnly, jakartaToday } from './jakarta.js';

describe('jakartaToday', () => {
  it('returns the Asia/Jakarta calendar date, not UTC', () => {
    // 19 Nov 17:30 UTC is already 20 Nov 00:30 in Jakarta (UTC+7)
    expect(jakartaToday(new Date('2026-11-19T17:30:00Z'))).toBe('2026-11-20');
    expect(jakartaToday(new Date('2026-11-19T16:30:00Z'))).toBe('2026-11-19');
  });
});

describe('isoDateOnly', () => {
  it('formats a date-only value as YYYY-MM-DD', () => {
    expect(isoDateOnly(new Date('2026-11-15T00:00:00Z'))).toBe('2026-11-15');
  });
});

describe('daysBetween', () => {
  it('counts calendar days from the first to the second date', () => {
    expect(daysBetween('2026-11-15', '2026-11-19')).toBe(4);
    expect(daysBetween('2026-11-19', '2026-11-15')).toBe(-4);
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
  });
});

describe('daysOverdue', () => {
  it('counts days past the due date in Jakarta time', () => {
    expect(daysOverdue(new Date('2026-11-15T00:00:00Z'), new Date('2026-11-19T01:00:00Z'))).toBe(4);
  });

  it('is zero when the due date is today or later', () => {
    expect(daysOverdue(new Date('2026-11-25T00:00:00Z'), new Date('2026-11-19T01:00:00Z'))).toBe(0);
    expect(daysOverdue(new Date('2026-11-19T00:00:00Z'), new Date('2026-11-19T01:00:00Z'))).toBe(0);
  });
});
