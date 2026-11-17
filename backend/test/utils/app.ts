import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { RoleCode } from '../../src/common/auth/permissions.catalog.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { TEST_ADMIN, TEST_USER_PASSWORD } from './test-admin.js';

export { TEST_ADMIN, TEST_USER_PASSWORD };

export interface LoginResult {
  accessToken: string;
  /** Full `oams_refresh=...` cookie pair, ready for a `Cookie` header. */
  refreshCookie: string;
  userId: string;
  email: string;
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http(): ReturnType<typeof request>;
  /** Ensures a user holding exactly `role` exists and logs in over HTTP. */
  loginAs(role: RoleCode): Promise<LoginResult>;
  /** Logs in with explicit credentials over HTTP. */
  login(email: string, password: string): Promise<LoginResult>;
  close(): Promise<void>;
}

export function emailForRole(role: RoleCode): string {
  return `${role.toLowerCase()}@test.local`;
}

export function extractCookie(setCookie: string[] | string | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = list.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`Cookie ${name} tidak ditemukan pada respons.`);
  return found.split(';')[0];
}

let forwardedCounter = 0;

/**
 * A fresh client address for each login so the per-IP login rate limiter is
 * only exercised by the test that targets it (`trust proxy` is on).
 */
export function nextForwardedIp(): string {
  forwardedCounter += 1;
  return `10.${(forwardedCounter >> 16) & 255}.${(forwardedCounter >> 8) & 255}.${forwardedCounter & 255}`;
}

export async function createTestApp(): Promise<TestContext> {
  process.env.DATABASE_URL = inject('databaseUrl');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);

  const http = () => request(app.getHttpServer());

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextForwardedIp())
      .send({ email, password });
    if (res.status !== 200) {
      throw new Error(`Login ${email} gagal: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
      accessToken: res.body.accessToken as string,
      refreshCookie: extractCookie(res.headers['set-cookie'], 'oams_refresh'),
      userId: res.body.user.id as string,
      email,
    };
  };

  const loginAs = async (role: RoleCode): Promise<LoginResult> => {
    const email = emailForRole(role);
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
    const passwordHash = await argon2.hash(TEST_USER_PASSWORD, { type: argon2.argon2id });
    const user = await prisma.user.upsert({
      where: { email },
      update: { isActive: true, passwordHash },
      create: { email, fullName: `Pengguna ${role}`, passwordHash },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: { not: roleRow.id } } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRow.id } },
      update: {},
      create: { userId: user.id, roleId: roleRow.id },
    });
    return login(email, TEST_USER_PASSWORD);
  };

  return {
    app,
    prisma,
    http,
    login,
    loginAs,
    close: () => app.close(),
  };
}
