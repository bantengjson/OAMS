import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import {
  CreateLocationDto,
  LocationDto,
  LocationQueryDto,
  LocationTreeNodeDto,
  LocationTreeQueryDto,
  UpdateLocationDto,
} from './dto/location.dto.js';
import { LocationsService } from './locations.service.js';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Daftar lokasi (datar, dengan filter)' })
  list(@Query() q: LocationQueryDto): Promise<Paginated<LocationDto>> {
    return this.locations.list(q);
  }

  @Get('tree')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Pohon lokasi Kantor → Gedung → Lantai → Ruangan' })
  @ApiOkResponse({ type: [LocationTreeNodeDto] })
  tree(@Query() q: LocationTreeQueryDto): Promise<LocationTreeNodeDto[]> {
    return this.locations.tree(q.includeInactive ?? false);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Detail lokasi' })
  @ApiOkResponse({ type: LocationDto })
  get(@Param('id', ParseUuid) id: string): Promise<LocationDto> {
    return this.locations.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Tambah lokasi' })
  @ApiCreatedResponse({ type: LocationDto })
  create(@Body() dto: CreateLocationDto): Promise<LocationDto> {
    return this.locations.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Ubah lokasi (tipe tidak dapat diubah)' })
  @ApiOkResponse({ type: LocationDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateLocationDto): Promise<LocationDto> {
    return this.locations.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Nonaktifkan lokasi (anak harus nonaktif dulu)' })
  @ApiOkResponse({ type: LocationDto })
  deactivate(@Param('id', ParseUuid) id: string): Promise<LocationDto> {
    return this.locations.setActive(id, false);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Aktifkan lokasi (induk harus aktif)' })
  @ApiOkResponse({ type: LocationDto })
  activate(@Param('id', ParseUuid) id: string): Promise<LocationDto> {
    return this.locations.setActive(id, true);
  }
}
