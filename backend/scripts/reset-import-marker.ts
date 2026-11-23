/**
 * Clears the office-import marker so the import can run again on a development database.
 * Never run this against the office's own data: the import's next run wipes the inventory.
 *
 *   npx tsx scripts/reset-import-marker.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { IMPORT_MARKER_KEY } from '../src/database/import-office/apply.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const { count } = await prisma.systemSetting.deleteMany({ where: { key: IMPORT_MARKER_KEY } });
console.log(count > 0 ? 'Penanda impor dihapus; impor bisa dijalankan lagi.' : 'Penanda impor tidak ada.');
await prisma.$disconnect();
