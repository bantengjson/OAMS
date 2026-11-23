import { PUBLIC_TOKEN_PATTERN } from '../qr/qr-token.js';

/** Office codes (`NG.A/012/DPC/2023-01`, `BG/004/DPC/2023-01`, `…/TT-01`) and the old `INV-2026-0001`. */
const ASSET_CODE = /^(?:(?:BG|NG)(?:\.[A-Z0-9_]{1,20})?\/\d{3}\/[A-Z0-9]{2,10}\/(?:\d{4}|TT)-\d{2,}|INV-\d{4}-\d{4,})$/;
const TOKEN_IN_PATH = /\/a\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/;

/**
 * What a scanner or a person typed during stock opname: the QR URL, a bare
 * `/a/<token>` path, the bare token, or the printed asset code.
 */
export function parseScanValue(raw: string): { token: string } | { assetCode: string } | null {
  const text = raw.trim();
  if (!text) return null;
  if (PUBLIC_TOKEN_PATTERN.test(text)) return { token: text };
  const upper = text.toUpperCase();
  if (ASSET_CODE.test(upper)) return { assetCode: upper };
  const match = TOKEN_IN_PATH.exec(text);
  return match ? { token: match[1] } : null;
}
