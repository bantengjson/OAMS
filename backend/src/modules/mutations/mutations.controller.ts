import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { CreateMutationDto } from './dto/create-mutation.dto.js';
import { ApproveMutationDto, RejectMutationDto } from './dto/decide-mutation.dto.js';
import { MutationQueryDto } from './dto/mutation-query.dto.js';
import { MutationDto } from './dto/mutation.dto.js';
import { MutationsService } from './mutations.service.js';

@ApiTags('mutations')
@ApiBearerAuth()
@Controller('mutations')
export class MutationsController {
  constructor(private readonly mutations: MutationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MUTATIONS_VIEW)
  @ApiOperation({ summary: 'Daftar pengajuan mutasi (terbaru dulu)' })
  list(@Query() q: MutationQueryDto): Promise<Paginated<MutationDto>> {
    return this.mutations.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MUTATIONS_VIEW)
  @ApiOperation({ summary: 'Detail mutasi' })
  @ApiOkResponse({ type: MutationDto })
  get(@Param('id', ParseUuid) id: string): Promise<MutationDto> {
    return this.mutations.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MUTATIONS_REQUEST)
  @ApiOperation({ summary: 'Ajukan mutasi; pemegang mutations.approve langsung disetujui' })
  @ApiCreatedResponse({ type: MutationDto })
  request(@Body() dto: CreateMutationDto, @CurrentUser() actor: AuthUser): Promise<MutationDto> {
    return this.mutations.request(dto, actor);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MUTATIONS_APPROVE)
  @ApiOperation({ summary: 'Setujui mutasi: lokasi/penanggung jawab barang berubah saat itu juga' })
  @ApiOkResponse({ type: MutationDto })
  approve(
    @Param('id', ParseUuid) id: string,
    @Body() dto: ApproveMutationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MutationDto> {
    return this.mutations.approve(id, dto.note, actor);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MUTATIONS_APPROVE)
  @ApiOperation({ summary: 'Tolak mutasi dengan alasan' })
  @ApiOkResponse({ type: MutationDto })
  reject(
    @Param('id', ParseUuid) id: string,
    @Body() dto: RejectMutationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MutationDto> {
    return this.mutations.reject(id, dto.note, actor);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MUTATIONS_REQUEST)
  @ApiOperation({ summary: 'Batalkan pengajuan sendiri (atau oleh penyetuju)' })
  @ApiOkResponse({ type: MutationDto })
  cancel(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<MutationDto> {
    return this.mutations.cancel(id, actor);
  }
}
