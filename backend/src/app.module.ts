import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './common/audit/audit.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AppConfigModule } from './config/config.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    // Per-address limits only; they stay loose because an office shares one NAT
    // address. Brute force on a single account is stopped by LoginAttemptLimiter.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'login', ttl: 60_000, limit: 30 },
        { name: 'auth', ttl: 60_000, limit: 60 },
      ],
      errorMessage: 'Terlalu banyak percobaan login. Coba lagi dalam satu menit.',
    }),
    AuthModule,
    RolesModule,
    UsersModule,
    CategoriesModule,
    DepartmentsModule,
    LocationsModule,
    AuditLogsModule,
    HealthModule,
  ],
})
export class AppModule {}
