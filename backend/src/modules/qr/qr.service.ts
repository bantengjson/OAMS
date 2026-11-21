import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { SettingsService } from '../../common/settings/settings.service.js';
import type { AssetLabel } from '../../generated/prisma/client.js';
import { AssetFilesService } from '../assets/asset-files.service.js';
import { MSG_DISPOSED } from '../assets/asset-state.guard.js';
import type { StoredFile } from '../assets/asset-files.service.js';
import { assetDetailInclude, qrUrl, toAssetDetail } from '../assets/assets.mapper.js';
import { ASSET_ARCHIVED, AssetsService } from '../assets/assets.service.js';
import type { AssetDetailDto } from '../assets/dto/asset.dto.js';
import type { PublicAssetDto } from './dto/public-asset.dto.js';
import type { BulkQrResultDto, QrFormat, QrInfoDto } from './dto/qr.dto.js';
import { toPublicAsset } from './public-asset.mapper.js';
import { generatePublicToken, PUBLIC_TOKEN_PATTERN, requirePublicBaseUrl } from './qr-token.js';

export const QR_PUBLIC_NOT_FOUND = 'QR Code tidak dikenal atau sudah tidak aktif.';
const MODULE = 'qr';

export interface QrDownload {
  body: Buffer | string;
  mime: string;
  fileName: string;
}

export type PublicLookupResult = PublicAssetDto | (AssetDetailDto & { isPublicView: false });

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly assets: AssetsService,
    private readonly files: AssetFilesService,
  ) {}

  async info(assetId: string): Promise<QrInfoDto> {
    await this.assets.getRow(assetId);
    const label = await this.ensureLabel(assetId);
    return this.toInfo(label, await this.settings.getPublicBaseUrl());
  }

  async regenerate(assetId: string): Promise<QrInfoDto> {
    const asset = await this.assets.getRow(assetId);
    if (asset.archivedAt) throw new BadRequestException(ASSET_ARCHIVED);
    await this.assertNotDisposed(assetId);
    await this.ensureLabel(assetId);
    const label = await this.prisma.assetLabel.update({
      where: { assetId },
      data: {
        publicToken: generatePublicToken(),
        isActive: true,
        generatedAt: new Date(),
        printedCount: 0,
        lastPrintedAt: null,
        revokedAt: null,
      },
    });
    await this.audit.record({ action: 'qr.regenerated', module: MODULE, entityId: assetId });
    return this.toInfo(label, await this.settings.getPublicBaseUrl());
  }

  async setActive(assetId: string, isActive: boolean): Promise<QrInfoDto> {
    await this.assets.getRow(assetId);
    if (isActive) await this.assertNotDisposed(assetId);
    await this.ensureLabel(assetId);
    const label = await this.prisma.assetLabel.update({
      where: { assetId },
      data: { isActive, revokedAt: isActive ? null : new Date() },
    });
    await this.audit.record({
      action: isActive ? 'qr.activated' : 'qr.deactivated',
      module: MODULE,
      entityId: assetId,
    });
    return this.toInfo(label, await this.settings.getPublicBaseUrl());
  }

  async download(assetId: string, format: QrFormat, size: number): Promise<QrDownload> {
    const asset = await this.assets.getRow(assetId);
    const label = await this.ensureLabel(assetId);
    const url = qrUrl(requirePublicBaseUrl(await this.settings.getPublicBaseUrl()), label.publicToken);
    const options = { margin: 1, errorCorrectionLevel: 'M' as const, width: size };
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { ...options, type: 'svg' });
      return { body: svg, mime: 'image/svg+xml', fileName: `${asset.assetCode}.svg` };
    }
    const png = await QRCode.toBuffer(url, { ...options, type: 'png' });
    return { body: png, mime: 'image/png', fileName: `${asset.assetCode}.png` };
  }

  /** Print data for a set of assets; missing labels are created, inactive ones reactivated. */
  async bulkGenerate(assetIds: string[], opts: { activateInactive: boolean } = { activateInactive: true }): Promise<BulkQrResultDto> {
    const baseUrl = requirePublicBaseUrl(await this.settings.getPublicBaseUrl());
    const unique = Array.from(new Set(assetIds));
    const rows = await this.prisma.asset.findMany({
      where: { id: { in: unique } },
      select: { id: true, assetCode: true, name: true, archivedAt: true, status: true, label: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const result: BulkQrResultDto = { items: [], skipped: [] };
    for (const id of unique) {
      const row = byId.get(id);
      if (!row) {
        result.skipped.push({ assetId: id, reason: 'Barang tidak ditemukan.' });
        continue;
      }
      if (row.archivedAt) {
        result.skipped.push({ assetId: id, reason: 'Barang diarsipkan.' });
        continue;
      }
      if (row.status === 'DISPOSED') {
        result.skipped.push({ assetId: id, reason: MSG_DISPOSED });
        continue;
      }
      let label = row.label ?? (await this.ensureLabel(id));
      if (!label.isActive && !opts.activateInactive) {
        result.skipped.push({ assetId: id, reason: 'QR barang ini dinonaktifkan.', inactiveLabel: true });
        continue;
      }
      if (!label.isActive) {
        label = await this.prisma.assetLabel.update({
          where: { assetId: id },
          data: { isActive: true, revokedAt: null },
        });
        await this.audit.record({ action: 'qr.activated', module: MODULE, entityId: id });
      }
      result.items.push({
        assetId: id,
        assetCode: row.assetCode,
        name: row.name,
        token: label.publicToken,
        url: qrUrl(baseUrl, label.publicToken),
      });
    }
    return result;
  }

  /** A disposed asset's sticker stays off until the disposal is reverted. */
  private async assertNotDisposed(assetId: string): Promise<void> {
    const active = await this.prisma.assetDisposal.findFirst({ where: { assetId, revertedAt: null }, select: { id: true } });
    if (active) throw new ConflictException(MSG_DISPOSED);
  }

  async markPrinted(assetIds: string[]): Promise<{ updated: number }> {
    const unique = Array.from(new Set(assetIds));
    const labels = await this.prisma.assetLabel.findMany({
      where: { assetId: { in: unique }, asset: { archivedAt: null } },
      select: { assetId: true },
    });
    const now = new Date();
    await this.prisma.assetLabel.updateMany({
      where: { assetId: { in: labels.map((l) => l.assetId) } },
      data: { printedCount: { increment: 1 }, lastPrintedAt: now },
    });
    for (const { assetId } of labels) {
      await this.audit.record({ action: 'qr.printed', module: MODULE, entityId: assetId });
    }
    return { updated: labels.length };
  }

  /** Anonymous visitors get the public subset; staff with assets.view get the full detail. */
  async publicByToken(token: string, user?: AuthUser): Promise<PublicLookupResult> {
    const label = await this.liveLabel(token);
    const paths = await this.assets.pathIndex();
    const detail = toAssetDetail(label.asset, paths, await this.settings.getPublicBaseUrl());
    if (user?.permissions.includes(PERMISSIONS.ASSETS_VIEW)) {
      // `detail` is a fresh plain object from the mapper; tag it instead of spreading a class type
      return Object.assign(detail, { isPublicView: false as const });
    }
    return toPublicAsset(detail);
  }

  async publicPhoto(token: string, variant: 'full' | 'thumb'): Promise<StoredFile> {
    const label = await this.liveLabel(token);
    const file = await this.files.primaryPhotoFile(label.assetId, variant);
    if (!file) throw new NotFoundException('Foto tidak ditemukan.');
    return file;
  }

  // ---------------------------------------------------------------- helpers

  private async liveLabel(token: string) {
    if (!PUBLIC_TOKEN_PATTERN.test(token)) throw new NotFoundException(QR_PUBLIC_NOT_FOUND);
    const label = await this.prisma.assetLabel.findUnique({
      where: { publicToken: token },
      include: { asset: { include: assetDetailInclude } },
    });
    if (!label || !label.isActive || label.asset.archivedAt) {
      throw new NotFoundException(QR_PUBLIC_NOT_FOUND);
    }
    return label;
  }

  private async ensureLabel(assetId: string): Promise<AssetLabel> {
    const existing = await this.prisma.assetLabel.findUnique({ where: { assetId } });
    if (existing) return existing;
    const created = await this.prisma.assetLabel.create({
      data: { assetId, publicToken: generatePublicToken() },
    });
    await this.audit.record({ action: 'qr.generated', module: MODULE, entityId: assetId });
    return created;
  }

  private toInfo(label: AssetLabel, baseUrl: string): QrInfoDto {
    return {
      token: label.publicToken,
      url: qrUrl(baseUrl, label.publicToken),
      isActive: label.isActive,
      generatedAt: label.generatedAt,
      printedCount: label.printedCount,
      lastPrintedAt: label.lastPrintedAt,
    };
  }
}
