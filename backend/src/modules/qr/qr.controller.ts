import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { OptionalAuth } from '../../common/auth/optional-auth.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import {
  AssetIdsDto,
  BulkQrResultDto,
  MarkPrintedResultDto,
  QrDownloadQueryDto,
  QrInfoDto,
} from './dto/qr.dto.js';
import { QrService } from './qr.service.js';
import type { PublicLookupResult } from './qr.service.js';

@ApiTags('qr')
@ApiBearerAuth()
@Controller('assets/:id/qr')
export class AssetQrController {
  constructor(private readonly qr: QrService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Informasi QR Code barang' })
  @ApiOkResponse({ type: QrInfoDto })
  info(@Param('id', ParseUuid) id: string): Promise<QrInfoDto> {
    return this.qr.info(id);
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.QR_GENERATE)
  @ApiOperation({ summary: 'Buat token baru (stiker lama tidak berlaku)' })
  @ApiOkResponse({ type: QrInfoDto })
  regenerate(@Param('id', ParseUuid) id: string): Promise<QrInfoDto> {
    return this.qr.regenerate(id);
  }

  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.QR_GENERATE)
  @ApiOperation({ summary: 'Nonaktifkan QR Code' })
  @ApiOkResponse({ type: QrInfoDto })
  deactivate(@Param('id', ParseUuid) id: string): Promise<QrInfoDto> {
    return this.qr.setActive(id, false);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.QR_GENERATE)
  @ApiOperation({ summary: 'Aktifkan kembali QR Code' })
  @ApiOkResponse({ type: QrInfoDto })
  activate(@Param('id', ParseUuid) id: string): Promise<QrInfoDto> {
    return this.qr.setActive(id, true);
  }

  @Get('download')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Unduh QR Code sebagai PNG atau SVG' })
  async download(
    @Param('id', ParseUuid) id: string,
    @Query() q: QrDownloadQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.qr.download(id, q.format, q.size);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.body);
  }
}

@ApiTags('qr')
@Controller('qr')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Post('bulk-generate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.QR_GENERATE)
  @ApiOperation({ summary: 'Data cetak massal untuk daftar barang' })
  @ApiOkResponse({ type: BulkQrResultDto })
  bulkGenerate(@Body() dto: AssetIdsDto): Promise<BulkQrResultDto> {
    return this.qr.bulkGenerate(dto.assetIds);
  }

  @Post('mark-printed')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.QR_GENERATE)
  @ApiOperation({ summary: 'Catat bahwa stiker barang-barang ini sudah dicetak' })
  @ApiOkResponse({ type: MarkPrintedResultDto })
  markPrinted(@Body() dto: AssetIdsDto): Promise<MarkPrintedResultDto> {
    return this.qr.markPrinted(dto.assetIds);
  }

  @Get('public/:token')
  @OptionalAuth()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true })
  @ApiOperation({ summary: 'Halaman publik hasil pindai QR (info dasar; staf melihat detail)' })
  publicLookup(
    @Param('token') token: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<PublicLookupResult> {
    return this.qr.publicByToken(token, user);
  }

  @Get('public/:token/photo')
  @OptionalAuth()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true })
  @ApiOperation({ summary: 'Foto utama barang untuk halaman publik' })
  async publicPhoto(
    @Param('token') token: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.qr.publicPhoto(token, variant === 'thumb' ? 'thumb' : 'full');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(file.path, { dotfiles: 'allow' });
  }
}
