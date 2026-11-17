import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import type { TestProject } from 'vitest/node';
import { seed } from '../prisma/seed.js';
import { startEmbeddedDatabase } from '../scripts/embedded-db.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TEST_ADMIN } from './utils/test-admin.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const backendRoot = resolve(import.meta.dirname, '..');

/**
 * Boots one throwaway PostgreSQL for the whole e2e run, applies the committed
 * migrations and the seed, and hands the connection string to the test files.
 */
export default async function globalSetup(project: TestProject) {
  const dataDir = mkdtempSync(join(tmpdir(), 'oams-e2e-pg-'));
  const db = await startEmbeddedDatabase({ dataDir, persistent: false });

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: db.url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db.url }) });
  try {
    await seed(prisma, {
      adminEmail: TEST_ADMIN.email,
      adminPassword: TEST_ADMIN.password,
      adminName: TEST_ADMIN.fullName,
    });
  } finally {
    await prisma.$disconnect();
  }

  project.provide('databaseUrl', db.url);

  return async () => {
    await db.stop();
    rmSync(dataDir, { recursive: true, force: true });
  };
}
