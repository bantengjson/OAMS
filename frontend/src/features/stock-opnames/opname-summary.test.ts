import { describe, expect, it } from 'vitest';
import type { OpnameResult } from '@/types/api';
import { opnameProgress } from './opname-summary';

function counts(partial: Partial<Record<OpnameResult, number>>): Record<OpnameResult, number> {
  return {
    PENDING: 0,
    MATCHED: 0,
    CONDITION_DIFFERS: 0,
    NOT_FOUND: 0,
    UNREGISTERED: 0,
    ON_LOAN: 0,
    IN_MAINTENANCE: 0,
    REMOVED: 0,
    ...partial,
  };
}

describe('opnameProgress', () => {
  it('counts matched and condition-differs rows as scanned', () => {
    expect(opnameProgress(counts({ PENDING: 7, MATCHED: 30, CONDITION_DIFFERS: 4 }))).toEqual({
      scanned: 34,
      total: 41,
      percent: 83,
    });
  });

  it('leaves removed and unregistered rows out of the total', () => {
    expect(opnameProgress(counts({ MATCHED: 2, PENDING: 2, REMOVED: 5, UNREGISTERED: 3 }))).toEqual({
      scanned: 2,
      total: 4,
      percent: 50,
    });
  });

  it('includes closed-session outcomes in the total', () => {
    expect(opnameProgress(counts({ MATCHED: 1, NOT_FOUND: 1, ON_LOAN: 1, IN_MAINTENANCE: 0 }))).toEqual({
      scanned: 1,
      total: 3,
      percent: 33,
    });
  });

  it('is zero percent for an empty session', () => {
    expect(opnameProgress(counts({ UNREGISTERED: 2 }))).toEqual({ scanned: 0, total: 0, percent: 0 });
  });
});
