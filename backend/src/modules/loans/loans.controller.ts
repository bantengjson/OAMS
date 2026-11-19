import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { CreateLoanDto, UpdateLoanDto } from './dto/create-loan.dto.js';
import { LoanQueryDto } from './dto/loan-query.dto.js';
import { LoanDto } from './dto/loan.dto.js';
import { ReturnLoanDto } from './dto/return-loan.dto.js';
import { LoansService } from './loans.service.js';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'Daftar peminjaman (aktif dulu, paling terlambat di atas)' })
  list(@Query() q: LoanQueryDto): Promise<Paginated<LoanDto>> {
    return this.loans.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'Detail peminjaman' })
  @ApiOkResponse({ type: LoanDto })
  get(@Param('id', ParseUuid) id: string): Promise<LoanDto> {
    return this.loans.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LOANS_MANAGE)
  @ApiOperation({ summary: 'Catat peminjaman; status barang menjadi BORROWED' })
  @ApiCreatedResponse({ type: LoanDto })
  create(@Body() dto: CreateLoanDto, @CurrentUser() actor: AuthUser): Promise<LoanDto> {
    return this.loans.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LOANS_MANAGE)
  @ApiOperation({ summary: 'Perpanjang rencana kembali atau ubah keperluan/kontak (hanya saat aktif)' })
  @ApiOkResponse({ type: LoanDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateLoanDto, @CurrentUser() actor: AuthUser): Promise<LoanDto> {
    return this.loans.update(id, dto, actor);
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LOANS_MANAGE)
  @ApiOperation({ summary: 'Catat pengembalian; status barang dipulihkan, kondisi opsional dicatat' })
  @ApiOkResponse({ type: LoanDto })
  return(@Param('id', ParseUuid) id: string, @Body() dto: ReturnLoanDto, @CurrentUser() actor: AuthUser): Promise<LoanDto> {
    return this.loans.return(id, dto, actor);
  }
}
