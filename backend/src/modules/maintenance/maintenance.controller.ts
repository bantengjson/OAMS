import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import {
  CancelMaintenanceDto,
  CompleteMaintenanceDto,
  MaintenanceDto,
  MaintenanceQueryDto,
  ReportMaintenanceDto,
  StartMaintenanceDto,
} from './dto/maintenance.dto.js';
import { MaintenanceService } from './maintenance.service.js';

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Daftar pemeliharaan (terbaru dulu)' })
  list(@Query() q: MaintenanceQueryDto): Promise<Paginated<MaintenanceDto>> {
    return this.maintenance.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Detail pemeliharaan' })
  @ApiOkResponse({ type: MaintenanceDto })
  get(@Param('id', ParseUuid) id: string): Promise<MaintenanceDto> {
    return this.maintenance.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_REPORT)
  @ApiOperation({ summary: 'Laporkan kerusakan barang' })
  @ApiCreatedResponse({ type: MaintenanceDto })
  report(@Body() dto: ReportMaintenanceDto, @CurrentUser() actor: AuthUser): Promise<MaintenanceDto> {
    return this.maintenance.report(dto, actor);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MAINTENANCE_MANAGE)
  @ApiOperation({ summary: 'Mulai perbaikan; status barang menjadi Dalam perbaikan' })
  @ApiOkResponse({ type: MaintenanceDto })
  start(
    @Param('id', ParseUuid) id: string,
    @Body() dto: StartMaintenanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MaintenanceDto> {
    return this.maintenance.start(id, dto, actor);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MAINTENANCE_MANAGE)
  @ApiOperation({ summary: 'Selesaikan perbaikan; status barang dipulihkan' })
  @ApiOkResponse({ type: MaintenanceDto })
  complete(
    @Param('id', ParseUuid) id: string,
    @Body() dto: CompleteMaintenanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MaintenanceDto> {
    return this.maintenance.complete(id, dto, actor);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MAINTENANCE_MANAGE)
  @ApiOperation({ summary: 'Batalkan laporan atau perbaikan' })
  @ApiOkResponse({ type: MaintenanceDto })
  cancel(
    @Param('id', ParseUuid) id: string,
    @Body() dto: CancelMaintenanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MaintenanceDto> {
    return this.maintenance.cancel(id, dto.reason, actor);
  }
}
