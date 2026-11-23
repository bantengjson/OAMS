import { Injectable } from '@nestjs/common';
import { ASSET_CODE_ORG_KEY, DEFAULT_ASSET_CODE_ORG } from '../../common/office.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** The parts of an office asset code, e.g. NG.A/012/DPC/2023-01. */
export interface CodeParts {
  golongan: 'BG' | 'NG';
  /** Room letter; null for vehicles (BG) and land & building (NG 001). */
  roomCode: string | null;
  typeNumber: number;
  /** Organisation part, "DPC" by default. */
  org: string;
  /** Acquisition year; null is written as "TT" (tanpa tahun). */
  year: number | null;
}

/** Everything before the unit number: `NG.A/012/DPC/2023`, `BG/004/DPC/2023`, `NG.J/012/DPC/TT`. */
export function codePrefix(p: CodeParts): string {
  const head = p.roomCode ? `${p.golongan}.${p.roomCode}` : p.golongan;
  return `${head}/${String(p.typeNumber).padStart(3, '0')}/${p.org}/${p.year ?? 'TT'}`;
}

/** `NG.A/012/DPC/2023-01`; the unit number grows to three digits after 99 instead of wrapping. */
export function formatAssetCode(prefix: string, unit: number): string {
  return `${prefix}-${String(unit).padStart(2, '0')}`;
}

export const ORG_INVALID = 'Kode organisasi harus 2-10 huruf atau angka tanpa spasi.';

/** Upper-cased organisation code, or null when it is not 2-10 letters/digits. */
export function normalizeOrg(value: string): string | null {
  const v = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,10}$/.test(v) ? v : null;
}

const jakartaYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
});

/** Calendar year in Asia/Jakarta, so year checks roll over at local midnight, not UTC. */
export function jakartaYear(date: Date = new Date()): number {
  return Number(jakartaYearFormatter.format(date));
}

/**
 * Unit numbers per code prefix, backed by `asset_code_sequences`. The
 * upsert-and-return runs inside the caller's transaction, so concurrent
 * creations serialize on the row and a rolled-back creation never burns a number.
 */
@Injectable()
export class AssetCodeService {
  async next(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
    const rows = await tx.$queryRaw<{ last_number: number }[]>`
      INSERT INTO asset_code_sequences (prefix, last_number)
      VALUES (${prefix}, 1)
      ON CONFLICT (prefix)
      DO UPDATE SET last_number = asset_code_sequences.last_number + 1
      RETURNING last_number
    `;
    const unit = rows[0]?.last_number;
    if (!unit) throw new Error('Gagal membuat nomor urut kode barang.');
    return formatAssetCode(prefix, unit);
  }

  /** The organisation part of new codes (setting `asset_code_org`, default DPC). */
  async org(tx: Pick<Prisma.TransactionClient, 'systemSetting'>): Promise<string> {
    const row = await tx.systemSetting.findUnique({ where: { key: ASSET_CODE_ORG_KEY } });
    return typeof row?.value === 'string' && row.value ? row.value : DEFAULT_ASSET_CODE_ORG;
  }
}
