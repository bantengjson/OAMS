import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { maxUploadBytes } from '../../common/files/upload-validation.js';
import type { UploadedFileLike } from '../../common/files/upload-validation.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { AssetFilesService } from './asset-files.service.js';
import type { StoredFile } from './asset-files.service.js';
import { AssetDocumentDto, AssetPhotoDto } from './dto/asset.dto.js';
import { UploadDocumentDto, UploadPhotoDto } from './dto/upload-file.dto.js';

/** `dotfiles: 'allow'`: the storage root is ours, even when it starts with a dot (tests). */
const SEND_OPTIONS = { dotfiles: 'allow' as const };

function sendInline(res: Response, file: StoredFile): void {
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(file.path, SEND_OPTIONS);
}

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets/:id')
export class AssetFilesController {
  constructor(private readonly files: AssetFilesService) {}

  // ------------------------------------------------------------------ photos

  @Post('photos')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes('photo') } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Unggah foto barang (jpeg/png/webp, maks 10 MB)' })
  @ApiCreatedResponse({ type: AssetPhotoDto })
  addPhoto(
    @Param('id', ParseUuid) id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadPhotoDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AssetPhotoDto> {
    return this.files.addPhoto(id, file, dto.caption, actor);
  }

  @Get('photos/:photoId/file')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Berkas foto (variant=full|thumb)' })
  async photoFile(
    @Param('id', ParseUuid) id: string,
    @Param('photoId', ParseUuid) photoId: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    sendInline(res, await this.files.photoFile(id, photoId, variant === 'thumb' ? 'thumb' : 'full'));
  }

  @Post('photos/:photoId/primary')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @ApiOperation({ summary: 'Jadikan foto utama' })
  @ApiOkResponse({ type: AssetPhotoDto })
  setPrimary(
    @Param('id', ParseUuid) id: string,
    @Param('photoId', ParseUuid) photoId: string,
  ): Promise<AssetPhotoDto> {
    return this.files.setPrimary(id, photoId);
  }

  @Delete('photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @ApiOperation({ summary: 'Hapus foto' })
  async removePhoto(
    @Param('id', ParseUuid) id: string,
    @Param('photoId', ParseUuid) photoId: string,
  ): Promise<void> {
    await this.files.removePhoto(id, photoId);
  }

  // -------------------------------------------------------------- documents

  @Post('documents')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes('document') } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Unggah dokumen barang (pdf/docx/xlsx/jpeg/png, maks 20 MB)' })
  @ApiCreatedResponse({ type: AssetDocumentDto })
  addDocument(
    @Param('id', ParseUuid) id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AssetDocumentDto> {
    return this.files.addDocument(id, file, dto.title, actor);
  }

  @Get('documents/:documentId/file')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Unduh dokumen' })
  async documentFile(
    @Param('id', ParseUuid) id: string,
    @Param('documentId', ParseUuid) documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.files.documentFile(id, documentId);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.download(file.path, file.originalName, SEND_OPTIONS);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @ApiOperation({ summary: 'Hapus dokumen' })
  async removeDocument(
    @Param('id', ParseUuid) id: string,
    @Param('documentId', ParseUuid) documentId: string,
  ): Promise<void> {
    await this.files.removeDocument(id, documentId);
  }
}
