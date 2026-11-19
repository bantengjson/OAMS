import { daysOverdue, jakartaToday } from './dates';

describe('jakartaToday', () => {
  it('returns the Asia/Jakarta calendar date, not UTC', () => {
    expect(jakartaToday(new Date('2026-11-19T17:30:00Z'))).toBe('2026-11-20');
    expect(jakartaToday(new Date('2026-11-19T16:30:00Z'))).toBe('2026-11-19');
  });
});

describe('daysOverdue', () => {
  it('counts calendar days past the due date in Jakarta time', () => {
    expect(daysOverdue('2026-11-15', new Date('2026-11-19T01:00:00Z'))).toBe(4);
  });

  it('is zero when the due date is today or later', () => {
    expect(daysOverdue('2026-11-19', new Date('2026-11-19T01:00:00Z'))).toBe(0);
    expect(daysOverdue('2026-11-25', new Date('2026-11-19T01:00:00Z'))).toBe(0);
  });
});
