import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export const LOAN_STATES = ['active', 'overdue', 'returned', 'all'] as const;
export type LoanState = (typeof LOAN_STATES)[number];

export class LoanQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LOAN_STATES, default: 'active' })
  @IsOptional()
  @IsIn(LOAN_STATES, { message: `state harus salah satu dari: ${LOAN_STATES.join(', ')}` })
  state: LoanState = 'active';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  assetId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  borrowerEmployeeId?: string;

  @ApiPropertyOptional({ description: 'Cari pada kode/nama barang atau nama peminjam' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
