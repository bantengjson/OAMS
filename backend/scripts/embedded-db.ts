import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export interface EmbeddedDatabaseOptions {
  /** Port to listen on; a free port is picked when omitted. */
  port?: number;
  /** Where the cluster files live. */
  dataDir: string;
  /** Keep the data between runs (dev) or wipe it on stop (tests). */
  persistent: boolean;
  /** Database name to create. Defaults to `oams`. */
  database?: string;
  /** Silence postgres log output. Defaults to true. */
  quiet?: boolean;
}

export interface EmbeddedDatabase {
  url: string;
  port: number;
  stop(): Promise<void>;
}

export const EMBEDDED_DB_USER = 'postgres';
export const EMBEDDED_DB_PASSWORD = 'postgres';

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Starts a real PostgreSQL cluster from the `embedded-postgres` binaries. Used
 * for local development (persistent) and for the e2e suite (throwaway).
 */
export async function startEmbeddedDatabase(
  options: EmbeddedDatabaseOptions,
): Promise<EmbeddedDatabase> {
  const port = options.port ?? (await findFreePort());
  const database = options.database ?? 'oams';
  const quiet = options.quiet ?? true;

  const pg = new EmbeddedPostgres({
    databaseDir: options.dataDir,
    user: EMBEDDED_DB_USER,
    password: EMBEDDED_DB_PASSWORD,
    port,
    persistent: options.persistent,
    autoRehydrateSymlinks: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: quiet ? () => undefined : (message) => console.log(String(message)),
    onError: quiet ? () => undefined : (message) => console.error(String(message)),
  });

  const alreadyInitialised = existsSync(join(options.dataDir, 'PG_VERSION'));
  if (!alreadyInitialised) {
    await pg.initialise();
  }
  await pg.start();

  try {
    await pg.createDatabase(database);
  } catch (error) {
    if (!/already exists/i.test(String(error))) {
      await pg.stop();
      throw error;
    }
  }

  const url = `postgresql://${EMBEDDED_DB_USER}:${EMBEDDED_DB_PASSWORD}@127.0.0.1:${port}/${database}`;
  return {
    url,
    port,
    stop: () => pg.stop(),
  };
}
