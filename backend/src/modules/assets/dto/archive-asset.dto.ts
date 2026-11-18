import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';

export class ArchiveAssetDto {
  @ApiPropertyOptional({ example: 'Rusak total, dihapuskan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
