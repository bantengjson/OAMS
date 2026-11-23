import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import {
  ConfirmItemDto,
  CountGroupLineDto,
  CreateStockOpnameDto,
  OpnameGroupLineDto,
  OpnameItemDto,
  OpnameItemQueryDto,
  OpnameReportDto,
  ScanDto,
  ScanResultDto,
  StockOpnameDto,
} from './dto/stock-opname.dto.js';
import { StockOpnamesService } from './stock-opnames.service.js';

/** Read routes accept `stock_opnames.execute` or `.manage`; the service checks that pair. */
@ApiTags('stock-opnames')
@ApiBearerAuth()
@Controller('stock-opnames')
export class StockOpnamesController {
  constructor(private readonly opnames: StockOpnamesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar sesi stock opname' })
  list(@Query() q: PaginationQueryDto, @CurrentUser() actor: AuthUser): Promise<Paginated<StockOpnameDto>> {
    return this.opnames.list(q, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_MANAGE)
  @ApiOperation({ summary: 'Buka sesi baru; daftar barang aktif dipotret saat itu' })
  @ApiCreatedResponse({ type: StockOpnameDto })
  create(@Body() dto: CreateStockOpnameDto, @CurrentUser() actor: AuthUser): Promise<StockOpnameDto> {
    return this.opnames.create(dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail sesi dengan hitungan per hasil' })
  @ApiOkResponse({ type: StockOpnameDto })
  get(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<StockOpnameDto> {
    return this.opnames.get(id, actor);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Baris sesi; filter hasil dan pencarian' })
  items(
    @Param('id', ParseUuid) id: string,
    @Query() q: OpnameItemQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<Paginated<OpnameItemDto>> {
    return this.opnames.items(id, q, actor);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Laporan sesi per kategori hasil' })
  @ApiOkResponse({ type: OpnameReportDto })
  report(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<OpnameReportDto> {
    return this.opnames.report(id, actor);
  }

  @Post(':id/scan')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_EXECUTE)
  @ApiOperation({ summary: 'Pindai QR / token / kode; barang yang sama tidak dihitung dua kali' })
  @ApiOkResponse({ type: ScanResultDto })
  scan(@Param('id', ParseUuid) id: string, @Body() dto: ScanDto, @CurrentUser() actor: AuthUser): Promise<ScanResultDto> {
    return this.opnames.scan(id, dto.value, actor);
  }

  @Get(':id/group-lines')
  @ApiOperation({ summary: 'Barang kelompok yang dihitung di sesi ini' })
  @ApiOkResponse({ type: [OpnameGroupLineDto] })
  groupLines(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<OpnameGroupLineDto[]> {
    return this.opnames.groupLines(id, actor);
  }

  @Put(':id/group-lines/:lineId')
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_EXECUTE)
  @ApiOperation({ summary: 'Isi hasil hitung barang kelompok (boleh diulang selama sesi terbuka)' })
  @ApiOkResponse({ type: OpnameGroupLineDto })
  countGroupLine(
    @Param('id', ParseUuid) id: string,
    @Param('lineId', ParseUuid) lineId: string,
    @Body() dto: CountGroupLineDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<OpnameGroupLineDto> {
    return this.opnames.countGroupLine(id, lineId, dto, actor);
  }

  @Post(':id/items/:itemId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_EXECUTE)
  @ApiOperation({ summary: 'Konfirmasi kondisi yang terlihat (boleh diulang selama sesi terbuka)' })
  @ApiOkResponse({ type: OpnameItemDto })
  confirm(
    @Param('id', ParseUuid) id: string,
    @Param('itemId', ParseUuid) itemId: string,
    @Body() dto: ConfirmItemDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<OpnameItemDto> {
    return this.opnames.confirm(id, itemId, dto, actor);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_MANAGE)
  @ApiOperation({ summary: 'Tutup sesi; barang belum dipindai dinilai dari keadaannya sekarang' })
  @ApiOkResponse({ type: StockOpnameDto })
  close(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<StockOpnameDto> {
    return this.opnames.close(id, actor);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_MANAGE)
  @ApiOperation({ summary: 'Batalkan sesi yang masih terbuka' })
  @ApiOkResponse({ type: StockOpnameDto })
  cancel(@Param('id', ParseUuid) id: string): Promise<StockOpnameDto> {
    return this.opnames.cancel(id);
  }

  @Post(':id/items/:itemId/apply-condition')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STOCK_OPNAMES_MANAGE)
  @ApiOperation({ summary: 'Terapkan kondisi hasil opname ke barang (sekali per baris)' })
  @ApiOkResponse({ type: OpnameItemDto })
  applyCondition(
    @Param('id', ParseUuid) id: string,
    @Param('itemId', ParseUuid) itemId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<OpnameItemDto> {
    return this.opnames.applyCondition(id, itemId, actor);
  }
}
