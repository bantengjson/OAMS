import { describe, expect, it } from 'vitest';
import { parseScannedValue } from './scan';

const TOKEN = 'zMBLt_pn3k-Iopsuw8BXjgBCL_GEmN1cOVKd0j7q9Tk'; // 43 base64url chars

describe('parseScannedValue', () => {
  it('accepts a full URL ending in /a/<token>', () => {
    expect(parseScannedValue(`https://inventaris.kantor.go.id/a/${TOKEN}`)).toEqual({ token: TOKEN });
    expect(parseScannedValue(`http://localhost:3000/a/${TOKEN}?x=1`)).toEqual({ token: TOKEN });
  });

  it('accepts a path and a bare token, trimming whitespace', () => {
    expect(parseScannedValue(`/a/${TOKEN}`)).toEqual({ token: TOKEN });
    expect(parseScannedValue(`  ${TOKEN}\n`)).toEqual({ token: TOKEN });
  });

  it('rejects anything else', () => {
    expect(parseScannedValue('')).toBeNull();
    expect(parseScannedValue('https://example.com/other')).toBeNull();
    expect(parseScannedValue('INV-2026-0001')).toBeNull();
    expect(parseScannedValue(`/a/${TOKEN.slice(0, 20)}`)).toBeNull();
    expect(parseScannedValue(`/a/${TOKEN}/extra`)).toBeNull();
  });
});
