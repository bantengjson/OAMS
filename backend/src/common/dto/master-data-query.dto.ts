import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto.js';
import { toBoolean } from './transforms.js';

export class MasterDataQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari pada kode atau nama' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive harus true atau false' })
  isActive?: boolean;
}

interface TextFilter {
  contains: string;
  mode: 'insensitive';
}

export interface MasterDataWhere {
  isActive?: boolean;
  OR?: ({ code: TextFilter } | { name: TextFilter })[];
}

/** Shared where-clause for code/name master data (categories, departments). */
export function masterDataWhere(q: MasterDataQueryDto): MasterDataWhere {
  const where: MasterDataWhere = {};
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.search) {
    where.OR = [
      { code: { contains: q.search, mode: 'insensitive' } },
      { name: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
