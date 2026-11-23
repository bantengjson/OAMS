/**
 * One-off import of the office inventory (Tahap: format inventaris kantor).
 *
 *   Preview (writes nothing):  tsx src/database/import-office/cli.ts --data <import-data.json> --report <out.xlsx>
 *   Write (after the owner approved the preview):
 *                              tsx src/database/import-office/cli.ts --data <import-data.json> --report <out.xlsx> --write
 *   In the container:          node dist/database/import-office/cli.js ...
 *
 * The data file is produced from the office workbook by the git-ignored merge tool; it is never committed.
 */
import 'dotenv/config';
import { readFileSync, rmSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { jakartaToday } from '../../common/dates/jakarta.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { applyImport, readOrg } from './apply.js';
import { planImport } from './plan.js';
import { writePreview } from './preview-xlsx.js';
import type { ImportData } from './types.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const dataPath = arg('data');
  const reportPath = arg('report');
  if (!dataPath || !reportPath) throw new Error('Pakai: --data <import-data.json> --report <pratinjau.xlsx> [--write]');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diisi.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as ImportData;
    const plan = planImport(data);
    await writePreview(plan, await readOrg(prisma), reportPath);
    console.log(
      `Pratinjau: ${plan.units.length} unit (${plan.units.filter((u) => u.disposed).length} dilepas), ` +
        `${plan.groups.length} barang kelompok, ${plan.types.length} jenis, ${plan.checks.length} daftar periksa → ${reportPath}`,
    );
    if (!process.argv.includes('--write')) {
      console.log('Belum ada yang ditulis. Jalankan lagi dengan --write setelah pratinjau disetujui.');
      return;
    }
    const actorEmail = arg('actor');
    const actor = await prisma.user.findFirst({
      where: actorEmail ? { email: actorEmail } : { roles: { some: { role: { code: 'SUPER_ADMIN' } } }, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!actor) throw new Error('Super Admin tidak ditemukan.');
    const result = await applyImport(prisma, plan, { actorId: actor.id, today: jakartaToday() });
    // Photos and documents of the wiped test assets.
    const uploads = process.env.UPLOADS_DIR ?? './uploads';
    rmSync(resolve(isAbsolute(uploads) ? uploads : resolve(process.cwd(), uploads), 'assets'), { recursive: true, force: true });
    console.log(`Impor selesai: ${JSON.stringify(result)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
