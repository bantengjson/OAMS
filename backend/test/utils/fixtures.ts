import type { Category, Location } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/common/prisma/prisma.service.js';

export interface TestTypes {
  /** NG 900 "Barang Uji": an ordinary item type that needs a room. */
  ng: Category;
  /** BG 900 "Kendaraan Uji": a vehicle type (no room). */
  bg: Category;
  /** NG 001: land & building (no room); reused when the database already has one. */
  land: Category;
  /** NG 901 "Piring Uji": a group (counted) type. */
  group: Category;
  /** Seeded rooms A and B. */
  roomA: Location;
  roomB: Location;
}

async function ensureType(
  prisma: PrismaService,
  golongan: 'BG' | 'NG',
  number: number,
  name: string,
  isGroup = false,
): Promise<Category> {
  const code = `${golongan}-${String(number).padStart(3, '0')}`;
  return prisma.category.upsert({
    where: { golongan_number: { golongan, number } },
    update: {},
    create: { code, golongan, number, name, isGroup },
  });
}

/** Idempotent item types and rooms for e2e tests (names are invented, never office data). */
export async function testTypes(prisma: PrismaService): Promise<TestTypes> {
  const [ng, bg, land, group] = [
    await ensureType(prisma, 'NG', 900, 'Barang Uji'),
    await ensureType(prisma, 'BG', 900, 'Kendaraan Uji'),
    await ensureType(prisma, 'NG', 1, 'Tanah Uji'),
    await ensureType(prisma, 'NG', 901, 'Piring Uji', true),
  ];
  const roomA = await prisma.location.findUniqueOrThrow({ where: { code: 'A' } });
  const roomB = await prisma.location.findUniqueOrThrow({ where: { code: 'B' } });
  return { ng, bg, land, group, roomA, roomB };
}

/** A further ordinary NG type, for tests that need two different types. */
export function extraType(prisma: PrismaService, number: number, name: string, isActive = true): Promise<Category> {
  const code = `NG-${String(number).padStart(3, '0')}`;
  return prisma.category.upsert({
    where: { golongan_number: { golongan: 'NG', number } },
    update: {},
    create: { code, golongan: 'NG', number, name, isActive },
  });
}
