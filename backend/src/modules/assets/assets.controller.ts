import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditEntryPublicDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { AssetsService } from './assets.service.js';
import { ArchiveAssetDto } from './dto/archive-asset.dto.js';
import { AssetDetailDto, AssetListItemDto, CreatedAssetsDto } from './dto/asset.dto.js';
import { AssetQueryDto } from './dto/asset-query.dto.js';
import { AssetStatisticsDto } from './dto/asset-statistics.dto.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Daftar barang dengan pencarian dan filter' })
  list(@Query() q: AssetQueryDto): Promise<Paginated<AssetListItemDto>> {
    return this.assets.list(q);
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Statistik inventaris (tanpa barang arsip)' })
  @ApiOkResponse({ type: AssetStatisticsDto })
  statistics(): Promise<AssetStatisticsDto> {
    return this.assets.statistics();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_CREATE)
  @ApiOperation({ summary: 'Tambah barang (Asset Code dan QR dibuat otomatis)' })
  @ApiCreatedResponse({ type: CreatedAssetsDto })
  create(@Body() dto: CreateAssetDto, @CurrentUser() actor: AuthUser): Promise<CreatedAssetsDto> {
    return this.assets.create(dto, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Detail barang' })
  @ApiOkResponse({ type: AssetDetailDto })
  get(@Param('id', ParseUuid) id: string): Promise<AssetDetailDto> {
    return this.assets.get(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @ApiOperation({ summary: 'Ubah data barang' })
  @ApiOkResponse({ type: AssetDetailDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateAssetDto): Promise<AssetDetailDto> {
    return this.assets.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSETS_ARCHIVE)
  @ApiOperation({ summary: 'Arsipkan barang (soft delete)' })
  @ApiOkResponse({ type: AssetDetailDto })
  archive(
    @Param('id', ParseUuid) id: string,
    @Body() dto: ArchiveAssetDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AssetDetailDto> {
    return this.assets.archive(id, dto.reason, actor);
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSETS_ARCHIVE)
  @ApiOperation({ summary: 'Keluarkan barang dari arsip' })
  @ApiOkResponse({ type: AssetDetailDto })
  unarchive(@Param('id', ParseUuid) id: string): Promise<AssetDetailDto> {
    return this.assets.unarchive(id);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Riwayat barang (audit log modul assets dan qr)' })
  history(
    @Param('id', ParseUuid) id: string,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<AuditEntryPublicDto>> {
    return this.assets.history(id, q);
  }
}
