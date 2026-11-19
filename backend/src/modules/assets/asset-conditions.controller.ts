import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { AssetConditionsService } from './asset-conditions.service.js';
import { AssignmentDto } from './dto/assignment.dto.js';
import { ConditionLogDto } from './dto/condition-log.dto.js';
import { CreateConditionLogDto } from './dto/create-condition-log.dto.js';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets/:id')
export class AssetConditionsController {
  constructor(private readonly conditions: AssetConditionsService) {}

  @Get('condition-logs')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Riwayat pemeriksaan kondisi barang (terbaru dulu)' })
  listLogs(@Param('id', ParseUuid) id: string, @Query() q: PaginationQueryDto): Promise<Paginated<ConditionLogDto>> {
    return this.conditions.listLogs(id, q);
  }

  @Post('condition-logs')
  @RequirePermissions(PERMISSIONS.CONDITIONS_RECORD)
  @ApiOperation({ summary: 'Catat pemeriksaan kondisi; kondisi barang mengikuti hasilnya' })
  @ApiCreatedResponse({ type: ConditionLogDto })
  createLog(
    @Param('id', ParseUuid) id: string,
    @Body() dto: CreateConditionLogDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ConditionLogDto> {
    return this.conditions.create(id, dto, actor);
  }

  @Get('assignments')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Riwayat pergantian penanggung jawab (terbaru dulu)' })
  listAssignments(
    @Param('id', ParseUuid) id: string,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<AssignmentDto>> {
    return this.conditions.listAssignments(id, q);
  }
}
