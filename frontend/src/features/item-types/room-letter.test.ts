import { describe, expect, it } from 'vitest';
import { nextLetter } from './room-letter';

describe('nextLetter', () => {
  it('previews the letter the server will assign', () => {
    expect(nextLetter([])).toBe('A');
    expect(nextLetter('ABCDEFGHIJKLMNO'.split(''))).toBe('P');
    expect(nextLetter('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))).toBe('AA');
  });
});
