import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { DisposalsService } from './disposals.service.js';
import { CreateDisposalDto, DisposalDto, DisposalQueryDto, RevertDisposalDto } from './dto/disposal.dto.js';

@ApiTags('disposals')
@ApiBearerAuth()
@Controller('disposals')
export class DisposalsController {
  constructor(private readonly disposals: DisposalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Daftar pelepasan barang (yang dibatalkan disembunyikan kecuali diminta)' })
  list(@Query() q: DisposalQueryDto): Promise<Paginated<DisposalDto>> {
    return this.disposals.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Detail pelepasan' })
  @ApiOkResponse({ type: DisposalDto })
  get(@Param('id', ParseUuid) id: string): Promise<DisposalDto> {
    return this.disposals.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DISPOSALS_MANAGE)
  @ApiOperation({ summary: 'Lepas barang dari inventaris; status Dihapuskan dan QR dinonaktifkan' })
  @ApiCreatedResponse({ type: DisposalDto })
  create(@Body() dto: CreateDisposalDto, @CurrentUser() actor: AuthUser): Promise<DisposalDto> {
    return this.disposals.create(dto, actor);
  }

  @Post(':id/revert')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DISPOSALS_MANAGE)
  @ApiOperation({ summary: 'Batalkan pelepasan; status dan QR dipulihkan' })
  @ApiOkResponse({ type: DisposalDto })
  revert(
    @Param('id', ParseUuid) id: string,
    @Body() dto: RevertDisposalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<DisposalDto> {
    return this.disposals.revert(id, dto.reason, actor);
  }
}
