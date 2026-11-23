import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { RoomDto, RoomQueryDto, SaveRoomDto } from './dto/room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Daftar ruangan (A, B, …)' })
  @ApiOkResponse({ type: [RoomDto] })
  list(@Query() q: RoomQueryDto): Promise<RoomDto[]> {
    return this.rooms.list(q);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Tambah ruangan; hurufnya otomatis' })
  @ApiCreatedResponse({ type: RoomDto })
  create(@Body() dto: SaveRoomDto): Promise<RoomDto> {
    return this.rooms.create(dto.name);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Ganti nama ruangan (huruf tetap)' })
  @ApiOkResponse({ type: RoomDto })
  rename(@Param('id', ParseUuid) id: string, @Body() dto: SaveRoomDto): Promise<RoomDto> {
    return this.rooms.rename(id, dto.name);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Nonaktifkan ruangan' })
  @ApiOkResponse({ type: RoomDto })
  deactivate(@Param('id', ParseUuid) id: string): Promise<RoomDto> {
    return this.rooms.setActive(id, false);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LOCATIONS_MANAGE)
  @ApiOperation({ summary: 'Aktifkan ruangan' })
  @ApiOkResponse({ type: RoomDto })
  activate(@Param('id', ParseUuid) id: string): Promise<RoomDto> {
    return this.rooms.setActive(id, true);
  }
}
