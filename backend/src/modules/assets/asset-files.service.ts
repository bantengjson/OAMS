import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { StorageService } from '../../common/files/storage.service.js';
import {
  detectUpload,
  FILE_REQUIRED_MESSAGE,
  sanitizeOriginalName,
} from '../../common/files/upload-validation.js';
import type { UploadedFileLike } from '../../common/files/upload-validation.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { toAssetDocument, toAssetPhoto } from './assets.mapper.js';
import { ASSET_ARCHIVED, AssetsService } from './assets.service.js';
import type { AssetDocumentDto, AssetPhotoDto } from './dto/asset.dto.js';

const MODULE = 'assets';
export const PHOTO_NOT_FOUND = 'Foto tidak ditemukan.';
export const DOCUMENT_NOT_FOUND = 'Dokumen tidak ditemukan.';

export interface StoredFile {
  path: string;
  mime: string;
  originalName: string;
}

const photoDir = (assetId: string) => `assets/${assetId}/photos`;
const documentDir = (assetId: string) => `assets/${assetId}/documents`;
/** Decode guard: a small compressed file can still describe a huge bitmap. */
const MAX_INPUT_PIXELS = 50_000_000;
const thumbName = (fileName: string) => fileName.replace(/\.webp$/, '.thumb.webp');

@Injectable()
export class AssetFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly assets: AssetsService,
  ) {}

  // ------------------------------------------------------------------ photos

  async addPhoto(
    assetId: string,
    file: UploadedFileLike | undefined,
    caption: string | undefined,
    actor: AuthUser,
  ): Promise<AssetPhotoDto> {
    if (!file) throw new BadRequestException(FILE_REQUIRED_MESSAGE);
    await this.writableAsset(assetId);
    await detectUpload(file.buffer, 'photo');

    // Normalise: auto-rotate from EXIF, cap size, re-encode as WebP (metadata dropped).
    const full = await sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const dir = photoDir(assetId);
    const { fileName } = await this.storage.save(dir, 'webp', full.data);
    await this.storage.saveAs(dir, thumbName(fileName), thumb);

    let row;
    try {
      // Count and insert in one transaction so two first uploads cannot both become primary.
      row = await this.prisma.$transaction(
        async (tx) => {
          const isPrimary = (await tx.assetPhoto.count({ where: { assetId } })) === 0;
          return tx.assetPhoto.create({
            data: {
              assetId,
              fileName,
              originalName: sanitizeOriginalName(file.originalname),
              mimeType: 'image/webp',
              sizeBytes: full.data.length,
              width: full.info.width,
              height: full.info.height,
              isPrimary,
              caption: caption || null,
              uploadedById: actor.id,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      // No row, no files: never leave orphans in the uploads folder.
      await this.storage.remove(dir, fileName);
      await this.storage.remove(dir, thumbName(fileName));
      throw error;
    }
    const isPrimary = row.isPrimary;
    await this.audit.record({
      action: 'asset.photo_added',
      module: MODULE,
      entityId: assetId,
      after: { photoId: row.id, originalName: row.originalName, isPrimary, caption: row.caption },
    });
    return toAssetPhoto(assetId, row);
  }

  async photoFile(assetId: string, photoId: string, variant: 'full' | 'thumb'): Promise<StoredFile> {
    const photo = await this.prisma.assetPhoto.findFirst({ where: { id: photoId, assetId } });
    if (!photo) throw new NotFoundException(PHOTO_NOT_FOUND);
    const name = variant === 'thumb' ? thumbName(photo.fileName) : photo.fileName;
    if (!this.storage.exists(photoDir(assetId), name)) throw new NotFoundException(PHOTO_NOT_FOUND);
    return { path: this.storage.resolve(photoDir(assetId), name), mime: photo.mimeType, originalName: photo.originalName };
  }

  /** Primary photo for the public QR page; null when the asset has none. */
  async primaryPhotoFile(assetId: string, variant: 'full' | 'thumb'): Promise<StoredFile | null> {
    const photo = await this.prisma.assetPhoto.findFirst({
      where: { assetId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (!photo) return null;
    return this.photoFile(assetId, photo.id, variant);
  }

  async setPrimary(assetId: string, photoId: string): Promise<AssetPhotoDto> {
    await this.writableAsset(assetId);
    const photo = await this.prisma.assetPhoto.findFirst({ where: { id: photoId, assetId } });
    if (!photo) throw new NotFoundException(PHOTO_NOT_FOUND);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.assetPhoto.updateMany({ where: { assetId, isPrimary: true }, data: { isPrimary: false } }),
      this.prisma.assetPhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
    ]);
    await this.audit.record({
      action: 'asset.photo_primary',
      module: MODULE,
      entityId: assetId,
      after: { photoId },
    });
    return toAssetPhoto(assetId, updated);
  }

  async removePhoto(assetId: string, photoId: string): Promise<void> {
    await this.writableAsset(assetId);
    const photo = await this.prisma.assetPhoto.findFirst({ where: { id: photoId, assetId } });
    if (!photo) throw new NotFoundException(PHOTO_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      await tx.assetPhoto.delete({ where: { id: photoId } });
      if (photo.isPrimary) {
        const next = await tx.assetPhoto.findFirst({ where: { assetId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.assetPhoto.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
    await this.storage.remove(photoDir(assetId), photo.fileName);
    await this.storage.remove(photoDir(assetId), thumbName(photo.fileName));
    await this.audit.record({
      action: 'asset.photo_removed',
      module: MODULE,
      entityId: assetId,
      before: { photoId, originalName: photo.originalName },
    });
  }

  // -------------------------------------------------------------- documents

  async addDocument(
    assetId: string,
    file: UploadedFileLike | undefined,
    title: string | undefined,
    actor: AuthUser,
  ): Promise<AssetDocumentDto> {
    if (!file) throw new BadRequestException(FILE_REQUIRED_MESSAGE);
    await this.writableAsset(assetId);
    const { mime, ext } = await detectUpload(file.buffer, 'document');
    const { fileName } = await this.storage.save(documentDir(assetId), ext, file.buffer);
    const row = await this.prisma.assetDocument.create({
      data: {
        assetId,
        fileName,
        originalName: sanitizeOriginalName(file.originalname),
        mimeType: mime,
        sizeBytes: file.buffer.length,
        title: title || null,
        uploadedById: actor.id,
      },
    });
    await this.audit.record({
      action: 'asset.document_added',
      module: MODULE,
      entityId: assetId,
      after: { documentId: row.id, title: row.title, originalName: row.originalName },
    });
    return toAssetDocument(assetId, row);
  }

  async documentFile(assetId: string, documentId: string): Promise<StoredFile> {
    const doc = await this.prisma.assetDocument.findFirst({ where: { id: documentId, assetId } });
    if (!doc) throw new NotFoundException(DOCUMENT_NOT_FOUND);
    if (!this.storage.exists(documentDir(assetId), doc.fileName)) throw new NotFoundException(DOCUMENT_NOT_FOUND);
    return {
      path: this.storage.resolve(documentDir(assetId), doc.fileName),
      mime: doc.mimeType,
      originalName: doc.originalName,
    };
  }

  async removeDocument(assetId: string, documentId: string): Promise<void> {
    await this.writableAsset(assetId);
    const doc = await this.prisma.assetDocument.findFirst({ where: { id: documentId, assetId } });
    if (!doc) throw new NotFoundException(DOCUMENT_NOT_FOUND);
    await this.prisma.assetDocument.delete({ where: { id: documentId } });
    await this.storage.remove(documentDir(assetId), doc.fileName);
    await this.audit.record({
      action: 'asset.document_removed',
      module: MODULE,
      entityId: assetId,
      before: { documentId, title: doc.title, originalName: doc.originalName },
    });
  }

  private async writableAsset(assetId: string): Promise<void> {
    const row = await this.assets.getRow(assetId);
    if (row.archivedAt) throw new BadRequestException(ASSET_ARCHIVED);
  }
}
