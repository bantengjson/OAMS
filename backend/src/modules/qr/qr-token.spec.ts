import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { generatePublicToken, PUBLIC_TOKEN_PATTERN, requirePublicBaseUrl } from './qr-token.js';

describe('qr-token', () => {
  it('generates 43-character base64url tokens', () => {
    const token = generatePublicToken();
    expect(token).toMatch(PUBLIC_TOKEN_PATTERN);
    expect(generatePublicToken()).not.toBe(token);
  });

  it('refuses to build QR content without a public base URL', () => {
    expect(() => requirePublicBaseUrl('')).toThrow(BadRequestException);
    expect(() => requirePublicBaseUrl('   ')).toThrow(/PUBLIC_BASE_URL/);
    expect(requirePublicBaseUrl('https://inventaris.kantor.go.id')).toBe('https://inventaris.kantor.go.id');
  });
});
