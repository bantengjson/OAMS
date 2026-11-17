/**
 * Menjalankan PostgreSQL lokal untuk pengembangan tanpa Docker.
 *
 *   npm run dev:db
 *
 * Data disimpan di backend/.pgdata (di-gitignore) dan tetap ada antar sesi.
 * Hentikan dengan Ctrl+C.
 */
import { resolve } from 'node:path';
import { startEmbeddedDatabase } from './embedded-db.js';

const PORT = Number(process.env.DEV_DB_PORT ?? 5433);
const DATA_DIR = resolve(import.meta.dirname, '..', '.pgdata');

async function main() {
  console.log(`Menyiapkan PostgreSQL lokal di port ${PORT} (data: ${DATA_DIR}) ...`);
  const db = await startEmbeddedDatabase({
    port: PORT,
    dataDir: DATA_DIR,
    persistent: true,
    quiet: false,
  });
  console.log('');
  console.log('PostgreSQL siap. Gunakan di backend/.env:');
  console.log(`DATABASE_URL=${db.url}`);
  console.log('');
  console.log('Tekan Ctrl+C untuk berhenti.');

  const shutdown = async () => {
    console.log('\nMenghentikan PostgreSQL ...');
    await db.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('Gagal menjalankan database lokal:', error);
  process.exit(1);
});
