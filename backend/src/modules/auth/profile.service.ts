import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import sharp from 'sharp';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { AVATAR_DIR } from '../../common/files/avatar.js';
import { StorageService } from '../../common/files/storage.service.js';
import { detectUpload, FILE_REQUIRED_MESSAGE } from '../../common/files/upload-validation.js';
import type { UploadedFileLike } from '../../common/files/upload-validation.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuthUserLoader } from './auth-user.loader.js';

const MODULE = 'users';
export const AVATAR_NOT_FOUND = 'Foto profil tidak ditemukan.';
/** Profile photos are small; anything bigger than this is not worth decoding. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;
/** Decode guard: a small compressed file can still describe a huge bitmap. */
const MAX_INPUT_PIXELS = 50_000_000;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly loader: AuthUserLoader,
  ) {}

  async updateName(user: AuthUser, fullName: string): Promise<AuthUser> {
    await this.prisma.user.update({ where: { id: user.id }, data: { fullName } });
    await this.audit.record({
      action: 'user.profile_updated',
      module: MODULE,
      entityId: user.id,
      before: { fullName: user.fullName },
      after: { fullName },
    });
    return this.reload(user.id);
  }

  async setAvatar(user: AuthUser, file: UploadedFileLike | undefined): Promise<AuthUser> {
    if (!file) throw new BadRequestException(FILE_REQUIRED_MESSAGE);
    await detectUpload(file.buffer, 'photo');
    // Square centre crop, 256x256, re-encoded as WebP: EXIF and other metadata are dropped.
    const data = await sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer();

    const { fileName } = await this.storage.save(AVATAR_DIR, 'webp', data);
    let previous: string | null;
    try {
      previous = await this.swapFileName(user.id, fileName);
    } catch (error) {
      await this.storage.remove(AVATAR_DIR, fileName);
      throw error;
    }
    if (previous) await this.storage.remove(AVATAR_DIR, previous);
    await this.audit.record({
      action: 'user.avatar_updated',
      module: MODULE,
      entityId: user.id,
      after: { replaced: Boolean(previous) },
    });
    return this.reload(user.id);
  }

  async removeAvatar(user: AuthUser): Promise<AuthUser> {
    const previous = await this.swapFileName(user.id, null);
    if (previous) {
      await this.storage.remove(AVATAR_DIR, previous);
      await this.audit.record({ action: 'user.avatar_removed', module: MODULE, entityId: user.id });
    }
    return this.reload(user.id);
  }

  /** Absolute path of a user's photo; 404 when there is none. */
  async avatarFile(userId: string): Promise<string> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarFileName: true } });
    const name = row?.avatarFileName;
    if (!name || !this.storage.exists(AVATAR_DIR, name)) throw new NotFoundException(AVATAR_NOT_FOUND);
    return this.storage.resolve(AVATAR_DIR, name);
  }

  /** Sets the photo file and returns the one it replaced; the row lock keeps two quick uploads from orphaning a file. */
  private swapFileName(userId: string, fileName: string | null): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ avatar_file_name: string | null }[]>`
        SELECT avatar_file_name FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
      if (rows.length === 0) throw new UnauthorizedException();
      await tx.user.update({ where: { id: userId }, data: { avatarFileName: fileName } });
      return rows[0].avatar_file_name;
    });
  }

  private async reload(userId: string): Promise<AuthUser> {
    const fresh = await this.loader.load(userId);
    if (!fresh) throw new UnauthorizedException();
    return fresh;
  }
}
