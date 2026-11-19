import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EmployeeLookupQueryDto, EmployeeQueryDto } from './dto/employee-query.dto.js';
import { EmployeeDetailDto, EmployeeDto, EmployeeLookupDto } from './dto/employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Daftar pegawai' })
  list(@Query() q: EmployeeQueryDto): Promise<Paginated<EmployeeDto>> {
    return this.employees.list(q);
  }

  @Get('lookup')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Cari pegawai aktif (untuk pemilih penanggung jawab/peminjam)' })
  @ApiOkResponse({ type: [EmployeeLookupDto] })
  lookup(@Query() q: EmployeeLookupQueryDto): Promise<EmployeeLookupDto[]> {
    return this.employees.lookup(q.search);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Detail pegawai beserta jumlah barang dan pinjaman aktif' })
  @ApiOkResponse({ type: EmployeeDetailDto })
  get(@Param('id', ParseUuid) id: string): Promise<EmployeeDetailDto> {
    return this.employees.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'Tambah pegawai' })
  @ApiCreatedResponse({ type: EmployeeDto })
  create(@Body() dto: CreateEmployeeDto): Promise<EmployeeDto> {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'Ubah pegawai (termasuk menonaktifkan)' })
  @ApiOkResponse({ type: EmployeeDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateEmployeeDto): Promise<EmployeeDto> {
    return this.employees.update(id, dto);
  }
}
