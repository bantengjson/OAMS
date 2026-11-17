import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './common/audit/audit.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AppConfigModule } from './config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'login', ttl: 60_000, limit: 5 }],
      errorMessage: 'Terlalu banyak percobaan login. Coba lagi dalam satu menit.',
    }),
    AuthModule,
    RolesModule,
    UsersModule,
    CategoriesModule,
    DepartmentsModule,
    HealthModule,
  ],
})
export class AppModule {}
