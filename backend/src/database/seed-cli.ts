/**
 * CLI entry for the seed. Compiled to dist/database/seed-cli.js so the
 * production image can run it without dev tooling.
 *
 *   node dist/database/seed-cli.js      (production)
 *   npm run prisma:seed                 (development, via tsx)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { readSeedOptionsFromEnv, seed } from './seed.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diatur.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  await seed(prisma, readSeedOptionsFromEnv());
  console.log('Seed selesai.');
} catch (error) {
  console.error('Seed gagal:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
