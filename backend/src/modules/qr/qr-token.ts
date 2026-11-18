import { randomBytes } from 'node:crypto';

/** 32 random bytes as base64url: 43 characters, unguessable, URL-safe. */
export function generatePublicToken(): string {
  return randomBytes(32).toString('base64url');
}

export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
