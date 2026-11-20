import { parseScanValue } from './scan-value.js';

const TOKEN = 'bQYaD8BYuxNqJFdNk077SETZpDcVsWLtVn3Kf8ZdmCQ';

describe('parseScanValue', () => {
  it('accepts a bare token', () => {
    expect(parseScanValue(TOKEN)).toEqual({ token: TOKEN });
  });

  it('accepts the QR URL and a bare /a/ path', () => {
    expect(parseScanValue(`https://100.89.220.43/a/${TOKEN}`)).toEqual({ token: TOKEN });
    expect(parseScanValue(`http://localhost:3000/a/${TOKEN}?x=1`)).toEqual({ token: TOKEN });
    expect(parseScanValue(`/a/${TOKEN}`)).toEqual({ token: TOKEN });
  });

  it('accepts an asset code typed in any case, trimmed', () => {
    expect(parseScanValue(' inv-2026-0007 ')).toEqual({ assetCode: 'INV-2026-0007' });
    expect(parseScanValue('INV-2026-12345')).toEqual({ assetCode: 'INV-2026-12345' });
  });

  it('rejects anything else', () => {
    expect(parseScanValue('hello')).toBeNull();
    expect(parseScanValue('')).toBeNull();
    expect(parseScanValue('https://example.com/other')).toBeNull();
    expect(parseScanValue('INV-26-1')).toBeNull();
  });
});
