/**
 * Seed data dasar OAMS: permission, role, kategori awal, dan Super Admin.
 * Idempoten: aman dijalankan berulang kali.
 *
 *   npm run prisma:seed       (membaca SEED_ADMIN_* dari backend/.env)
 */
import 'dotenv/config';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
} from '../src/common/auth/permissions.catalog.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

export const INITIAL_CATEGORIES: readonly { code: string; name: string }[] = [
  { code: 'ELEKTRONIK', name: 'Elektronik' },
  { code: 'KOMPUTER_IT', name: 'Komputer dan IT' },
  { code: 'FURNITURE', name: 'Furniture' },
  { code: 'ADMINISTRASI', name: 'Peralatan Administrasi' },
  { code: 'RAPAT', name: 'Peralatan Rapat' },
  { code: 'INFRASTRUKTUR', name: 'Infrastruktur' },
  { code: 'KENDARAAN', name: 'Kendaraan' },
  { code: 'KEBERSIHAN', name: 'Peralatan Kebersihan' },
  { code: 'LAINNYA', name: 'Lainnya' },
];

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function seed(prisma: PrismaClient, opts: SeedOptions): Promise<void> {
  // 1. Permissions
  for (const def of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { module: def.module, description: def.description },
      create: { code: def.code, module: def.module, description: def.description },
    });
  }
  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // 2. Roles and their baseline permissions. Existing extra grants made through
  //    the UI are kept; only missing baseline grants are added.
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code: def.code, name: def.name, description: def.description, isSystem: true },
    });
    const codes = def.permissions === 'ALL' ? ALL_PERMISSION_CODES : def.permissions;
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({
        roleId: role.id,
        permissionId: permissionIdByCode.get(code)!,
      })),
      skipDuplicates: true,
    });
  }

  // 3. Initial categories
  for (const cat of INITIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: { code: cat.code, name: cat.name },
    });
  }

  // 4. Super Admin. Never resets an existing user's password.
  const email = opts.adminEmail.trim().toLowerCase();
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  const admin =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        fullName: opts.adminName,
        passwordHash: await hashPassword(opts.adminPassword),
      },
    }));
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });
}

function readSeedOptionsFromEnv(): SeedOptions {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Super Admin';
  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi untuk seed.');
  }
  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD minimal 8 karakter.');
  }
  return { adminEmail, adminPassword, adminName };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diatur.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await seed(prisma, readSeedOptionsFromEnv());
    console.log('Seed selesai.');
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' && resolve(process.argv[1]) === import.meta.filename;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Seed gagal:', error);
    process.exit(1);
  });
}
