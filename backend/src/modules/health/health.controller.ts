import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Status layanan dan database' })
  async check() {
    const databaseUp = await this.prisma.ping();
    if (!databaseUp) {
      throw new ServiceUnavailableException('Database tidak dapat dijangkau.');
    }
    return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
  }
}
