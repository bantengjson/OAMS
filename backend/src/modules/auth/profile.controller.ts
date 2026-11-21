import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { UploadedFileLike } from '../../common/files/upload-validation.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { MAX_AVATAR_BYTES, ProfileService } from './profile.service.js';

/** Own profile (any signed-in user) and profile photos (visible to every signed-in user). */
@ApiTags('auth')
@ApiBearerAuth()
@Controller()
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch('auth/me')
  @ApiOperation({ summary: 'Ganti nama tampilan sendiri' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<AuthUser> {
    return this.profile.updateName(user, dto.fullName);
  }

  @Post('auth/me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Unggah foto profil (jpeg/png/webp, maks 5 MB; dipotong persegi 256x256)' })
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileLike | undefined): Promise<AuthUser> {
    return this.profile.setAvatar(user, file);
  }

  @Delete('auth/me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus foto profil (kembali ke inisial)' })
  removeAvatar(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.profile.removeAvatar(user);
  }

  @Get('users/:id/avatar')
  @ApiOperation({ summary: 'Berkas foto profil pengguna' })
  async avatar(@Param('id', ParseUuid) id: string, @Res() res: Response): Promise<void> {
    const path = await this.profile.avatarFile(id);
    res.setHeader('Content-Type', 'image/webp');
    // The URL carries a version, so a long private cache is safe.
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.sendFile(path, { dotfiles: 'allow' });
  }
}
