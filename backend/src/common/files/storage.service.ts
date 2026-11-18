import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';

/**
 * Local-disk file storage under `UPLOADS_DIR`. Paths handed in are always
 * validated to stay inside the root; file names are generated here.
 */
@Injectable()
export class StorageService {
  readonly root: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(env: EnvService) {
    const configured = env.get('UPLOADS_DIR');
    this.root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  /** Absolute path of a file, guaranteed to be inside the storage root. */
  resolve(relativeDir: string, fileName: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(fileName)) throw new Error(`Nama berkas tidak valid: ${fileName}`);
    const full = resolve(this.root, relativeDir, fileName);
    if (!full.startsWith(this.root + sep)) throw new Error('Lokasi berkas di luar folder penyimpanan.');
    return full;
  }

  exists(relativeDir: string, fileName: string): boolean {
    return existsSync(this.resolve(relativeDir, fileName));
  }

  async save(
    relativeDir: string,
    ext: string,
    buffer: Buffer,
  ): Promise<{ fileName: string; absolutePath: string }> {
    const fileName = `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
    return { fileName, absolutePath: await this.saveAs(relativeDir, fileName, buffer) };
  }

  async saveAs(relativeDir: string, fileName: string, buffer: Buffer): Promise<string> {
    const full = this.resolve(relativeDir, fileName);
    await mkdir(join(this.root, relativeDir), { recursive: true });
    await writeFile(full, buffer);
    return full;
  }

  async remove(relativeDir: string, fileName: string): Promise<void> {
    try {
      await rm(this.resolve(relativeDir, fileName), { force: true });
    } catch (error) {
      this.logger.warn(`Gagal menghapus berkas ${relativeDir}/${fileName}: ${String(error)}`);
    }
  }
}
