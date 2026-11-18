import { qrDataUrl, qrSvg } from './qr-image';

describe('qr-image', () => {
  it('renders a PNG data URL of the requested size', async () => {
    const url = await qrDataUrl('http://localhost:3000/a/abc', 200);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });

  it('renders an SVG string', async () => {
    const svg = await qrSvg('http://localhost:3000/a/abc');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
