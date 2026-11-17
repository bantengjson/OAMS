import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { EnvService } from '../../config/env.service.js';
import { AuthUserLoader } from './auth-user.loader.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: env.get('JWT_ACCESS_TTL_SECONDS') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthUserLoader,
    PasswordService,
    RefreshTokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthUserLoader, PasswordService, RefreshTokenService],
})
export class AuthModule {}
