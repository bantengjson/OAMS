import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { API_PREFIX } from '../../app.setup.js';
import { REFRESH_COOKIE } from '../../common/auth/auth-user.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Public } from '../../common/auth/public.decorator.js';
import { EnvService } from '../../config/env.service.js';
import { AuthService } from './auth.service.js';
import type { AuthTokens } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { IssuedRefreshToken } from './refresh-token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly env: EnvService,
  ) {}

  // Named throttlers are configured in AppModule: 'login' 30/min, 'auth' 60/min per address.
  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ auth: true })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login dengan email dan password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const { tokens, refresh } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, refresh);
    return tokens;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tukar refresh cookie dengan access token baru' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    try {
      const { tokens, refresh } = await this.auth.refresh(this.readRefreshCookie(req));
      this.setRefreshCookie(res, refresh);
      return tokens;
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout dan cabut refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(req));
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil pengguna yang sedang login' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ganti password sendiri (mencabut semua sesi)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE];
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.get('COOKIE_SECURE'),
      sameSite: 'lax' as const,
      path: `/${API_PREFIX}/auth`,
    };
  }

  private setRefreshCookie(res: Response, refresh: IssuedRefreshToken): void {
    res.cookie(REFRESH_COOKIE, refresh.raw, { ...this.cookieOptions(), expires: refresh.expiresAt });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}
