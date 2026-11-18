import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';

export const ASSET_CODE_PREFIX = 'INV';
export const ASSET_CODE_MIN_DIGITS = 4;

/** `INV-2026-0007`; the number grows past four digits instead of wrapping. */
export function formatAssetCode(year: number, sequence: number): string {
  return `${ASSET_CODE_PREFIX}-${year}-${String(sequence).padStart(ASSET_CODE_MIN_DIGITS, '0')}`;
}

const jakartaYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
});

/** Calendar year in Asia/Jakarta, so codes roll over at local midnight, not UTC. */
export function jakartaYear(date: Date = new Date()): number {
  return Number(jakartaYearFormatter.format(date));
}

/**
 * Per-year sequence backed by `asset_code_sequences`. The upsert-and-return
 * runs inside the caller's transaction, so concurrent creations serialize on
 * the row and a rolled-back creation never burns a number.
 */
@Injectable()
export class AssetCodeService {
  async next(tx: Prisma.TransactionClient, year: number = jakartaYear()): Promise<string> {
    const rows = await tx.$queryRaw<{ last_number: number }[]>`
      INSERT INTO asset_code_sequences (year, last_number)
      VALUES (${year}, 1)
      ON CONFLICT (year)
      DO UPDATE SET last_number = asset_code_sequences.last_number + 1
      RETURNING last_number
    `;
    const sequence = rows[0]?.last_number;
    if (!sequence) throw new Error('Gagal membuat nomor urut Asset Code.');
    return formatAssetCode(year, sequence);
  }
}
