import { Module } from '@nestjs/common';
import { AuditModule } from './common/audit/audit.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AppConfigModule } from './config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [AppConfigModule, PrismaModule, AuditModule, HealthModule],
})
export class AppModule {}
