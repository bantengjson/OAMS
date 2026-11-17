import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { MasterDataQueryDto } from '../../common/dto/master-data-query.dto.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto, DepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Daftar unit kerja' })
  list(@Query() q: MasterDataQueryDto): Promise<Paginated<DepartmentDto>> {
    return this.departments.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Detail unit kerja' })
  @ApiOkResponse({ type: DepartmentDto })
  get(@Param('id', ParseUuid) id: string): Promise<DepartmentDto> {
    return this.departments.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Tambah unit kerja' })
  @ApiCreatedResponse({ type: DepartmentDto })
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentDto> {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Ubah unit kerja' })
  @ApiOkResponse({ type: DepartmentDto })
  update(
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDto> {
    return this.departments.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Nonaktifkan unit kerja' })
  @ApiOkResponse({ type: DepartmentDto })
  deactivate(@Param('id', ParseUuid) id: string): Promise<DepartmentDto> {
    return this.departments.setActive(id, false);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Aktifkan unit kerja' })
  @ApiOkResponse({ type: DepartmentDto })
  activate(@Param('id', ParseUuid) id: string): Promise<DepartmentDto> {
    return this.departments.setActive(id, true);
  }
}
