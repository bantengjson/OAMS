/**
 * Seed data dasar OAMS: permission, role, kantor + ruangan A–O, pengaturan kode, dan Super Admin.
 * Idempoten: aman dijalankan berulang kali (juga saat container start).
 */
import argon2 from 'argon2';
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
} from '../common/auth/permissions.catalog.js';
import { ASSET_CODE_ORG_KEY, DEFAULT_ASSET_CODE_ORG, OFFICE_CODE, OFFICE_NAME } from '../common/office.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export { OFFICE_CODE, OFFICE_NAME } from '../common/office.js';

export interface SeedOptions {
  adminEmail: string;
  /** Short login name for the first Super Admin (lower-case), e.g. "admin". */
  adminUsername?: string;
  adminPassword: string;
  adminName: string;
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;


/** The office's rooms; the letter is part of every asset code registered in the room. */
export const OFFICE_ROOMS: readonly { code: string; name: string }[] = [
  { code: 'A', name: 'Sekretariat' },
  { code: 'B', name: 'Ketua, Sekretaris & Bendahara' },
  { code: 'C', name: 'Bendahara' },
  { code: 'D', name: 'Fraksi' },
  { code: 'E', name: 'Rapat Internal' },
  { code: 'F', name: 'Rapat Bersama' },
  { code: 'G', name: 'Data & Pencetakan KTA' },
  { code: 'H', name: 'Mushalla' },
  { code: 'I', name: 'Dapur' },
  { code: 'J', name: 'BBHAR' },
  { code: 'K', name: 'Gudang' },
  { code: 'L', name: 'Balai Kreasi' },
  { code: 'M', name: 'Meja Satgas' },
  { code: 'N', name: 'Ruang Tengah' },
  { code: 'O', name: 'Halaman Parkiran' },
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

  // 3. The office and its rooms A–O (existing names are left as the admin set them).
  const office = await prisma.location.upsert({
    where: { code: OFFICE_CODE },
    update: {},
    create: { code: OFFICE_CODE, name: OFFICE_NAME, type: 'OFFICE' },
  });
  for (const room of OFFICE_ROOMS) {
    await prisma.location.upsert({
      where: { code: room.code },
      update: {},
      create: { code: room.code, name: room.name, type: 'ROOM', parentId: office.id },
    });
  }
  await prisma.systemSetting.upsert({
    where: { key: ASSET_CODE_ORG_KEY },
    update: {},
    create: { key: ASSET_CODE_ORG_KEY, value: DEFAULT_ASSET_CODE_ORG },
  });

  // 4. Super Admin. Never resets an existing user's password; fills in the
  //    username when the account has none yet.
  const email = opts.adminEmail.trim().toLowerCase();
  const username = opts.adminUsername?.trim().toLowerCase() || null;
  if (username && !USERNAME_PATTERN.test(username)) {
    throw new Error(`Username admin tidak valid: ${username}`);
  }
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  const admin =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        username,
        fullName: opts.adminName,
        passwordHash: await hashPassword(opts.adminPassword),
      },
    }));
  if (existing && !existing.username && username) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) await prisma.user.update({ where: { id: admin.id }, data: { username } });
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });
}

export function readSeedOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): SeedOptions {
  const adminEmail = env.SEED_ADMIN_EMAIL;
  const adminUsername = env.SEED_ADMIN_USERNAME || undefined;
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const adminName = env.SEED_ADMIN_NAME ?? 'Super Admin';
  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi untuk seed.');
  }
  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD minimal 8 karakter.');
  }
  return { adminEmail, adminUsername, adminPassword, adminName };
}
