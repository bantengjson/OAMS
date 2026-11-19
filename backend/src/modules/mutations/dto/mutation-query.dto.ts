import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { MutationStatus } from '../../../generated/prisma/client.js';

export class MutationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MutationStatus })
  @IsOptional()
  @IsEnum(MutationStatus, { message: 'Status mutasi tidak valid' })
  status?: MutationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  assetId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  requestedById?: string;

  @ApiPropertyOptional({ description: 'Cari pada kode atau nama barang' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
