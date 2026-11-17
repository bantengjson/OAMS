import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Pelaku aktivitas' })
  @IsOptional()
  @IsUUID('all', { message: 'actorId tidak valid' })
  actorId?: string;

  @ApiPropertyOptional({ example: 'categories' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @ApiPropertyOptional({ example: 'category.created' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ description: 'ID objek yang terkait' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Mulai (inklusif)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'from harus berupa tanggal ISO 8601' })
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Sampai (inklusif)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'to harus berupa tanggal ISO 8601' })
  to?: Date;
}
