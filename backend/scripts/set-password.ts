/**
 * Mengatur ulang password satu pengguna dari terminal (mis. admin yang lupa
 * password). Semua sesi pengguna tersebut dicabut.
 *
 *   npm run user:set-password -w backend -- <email-atau-username> <password-baru>
 *
 * Di server (container): docker compose exec backend node dist/scripts/set-password.js ...
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const [identifierArg, password] = process.argv.slice(2);
if (!identifierArg || !password) {
  console.error('Gunakan: set-password <email-atau-username> <password-baru>');
  process.exit(2);
}
if (password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diatur.');
  process.exit(1);
}

const identifier = identifierArg.trim().toLowerCase();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const user = await prisma.user.findUnique({
    where: identifier.includes('@') ? { email: identifier } : { username: identifier },
  });
  if (!user) {
    console.error(`Pengguna tidak ditemukan: ${identifier}`);
    process.exitCode = 1;
  } else {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: { action: 'user.password_reset', module: 'users', entityId: user.id, after: { via: 'cli' } },
      }),
    ]);
    console.log(`Password ${user.email} diperbarui; semua sesinya dicabut.`);
  }
} finally {
  await prisma.$disconnect();
}
