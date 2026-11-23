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
import {
  ArchiveGroupItemDto,
  CreateGroupItemDto,
  GroupItemDto,
  GroupItemQueryDto,
  UpdateGroupItemDto,
} from './dto/group-item.dto.js';
import { GroupItemsService } from './group-items.service.js';

@ApiTags('group-items')
@ApiBearerAuth()
@Controller('group-items')
export class GroupItemsController {
  constructor(private readonly items: GroupItemsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Daftar barang kelompok' })
  list(@Query() q: GroupItemQueryDto): Promise<Paginated<GroupItemDto>> {
    return this.items.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOkResponse({ type: GroupItemDto })
  get(@Param('id', ParseUuid) id: string): Promise<GroupItemDto> {
    return this.items.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_CREATE)
  @ApiOperation({ summary: 'Tambah barang kelompok' })
  @ApiCreatedResponse({ type: GroupItemDto })
  create(@Body() dto: CreateGroupItemDto, @CurrentUser() actor: AuthUser): Promise<GroupItemDto> {
    return this.items.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @ApiOperation({ summary: 'Ubah jumlah/kondisi/ruangan (alasan wajib)' })
  @ApiOkResponse({ type: GroupItemDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateGroupItemDto): Promise<GroupItemDto> {
    return this.items.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSETS_ARCHIVE)
  @ApiOperation({ summary: 'Arsipkan barang kelompok' })
  @ApiOkResponse({ type: GroupItemDto })
  archive(@Param('id', ParseUuid) id: string, @Body() dto: ArchiveGroupItemDto): Promise<GroupItemDto> {
    return this.items.archive(id, dto.reason);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Riwayat perubahan barang kelompok' })
  history(@Param('id', ParseUuid) id: string, @Query() q: PaginationQueryDto): Promise<Paginated<AuditEntryPublicDto>> {
    return this.items.history(id, q);
  }
}
