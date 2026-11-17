/**
 * Seed data dasar OAMS: permission, role, kategori awal, dan Super Admin.
 * Idempoten: aman dijalankan berulang kali (juga saat container start).
 */
import argon2 from 'argon2';
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
} from '../common/auth/permissions.catalog.js';
import type { PrismaClient } from '../generated/prisma/client.js';

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
  // 1. Permissions. Remember which codes are new in this run: only those are
  //    granted to roles that already exist, so a grant an admin revoked through
  //    the UI is never silently re-added on the next deploy.
  const existingPermissionCodes = new Set(
    (await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code),
  );
  const newPermissionCodes = new Set(
    PERMISSION_DEFINITIONS.filter((d) => !existingPermissionCodes.has(d.code)).map((d) => d.code),
  );
  for (const def of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { module: def.module, description: def.description },
      create: { code: def.code, module: def.module, description: def.description },
    });
  }
  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // 2. Roles. A brand-new role gets its full baseline; an existing role only
  //    receives permissions introduced in this run. Grants and revocations
  //    made through the UI are left alone.
  for (const def of ROLE_DEFINITIONS) {
    const existingRole = await prisma.role.findUnique({ where: { code: def.code } });
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code: def.code, name: def.name, description: def.description, isSystem: true },
    });
    const baseline = def.permissions === 'ALL' ? ALL_PERMISSION_CODES : def.permissions;
    const codes = existingRole ? baseline.filter((c) => newPermissionCodes.has(c)) : baseline;
    if (codes.length === 0) continue;
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

export function readSeedOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): SeedOptions {
  const adminEmail = env.SEED_ADMIN_EMAIL;
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const adminName = env.SEED_ADMIN_NAME ?? 'Super Admin';
  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi untuk seed.');
  }
  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD minimal 8 karakter.');
  }
  return { adminEmail, adminPassword, adminName };
}
