import QRCode from 'qrcode';

const BASE = { margin: 1, errorCorrectionLevel: 'M' as const };

/** PNG data URL for previews and print sheets (rendered in the browser, no API call). */
export function qrDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, { ...BASE, width: size });
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...BASE, type: 'svg' });
}
