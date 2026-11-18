import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/** 32 random bytes as base64url: 43 characters, unguessable, URL-safe. */
export function generatePublicToken(): string {
  return randomBytes(32).toString('base64url');
}

export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PUBLIC_BASE_URL_MISSING =
  'Alamat dasar QR belum diatur (PUBLIC_BASE_URL). Atur dulu sebelum membuat atau mencetak QR Code.';

/** QR content must be an absolute URL; a sticker with a relative path scans to nothing. */
export function requirePublicBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim();
  if (!value) throw new BadRequestException(PUBLIC_BASE_URL_MISSING);
  return value;
}
