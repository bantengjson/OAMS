import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';

export class UploadPhotoDto {
  @ApiPropertyOptional({ example: 'Tampak depan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  caption?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Tautkan ke pemeriksaan kondisi barang ini; cukup dengan izin conditions.record',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Pemeriksaan kondisi tidak valid' })
  conditionLogId?: string;
}

export class UploadDocumentDto {
  @ApiPropertyOptional({ example: 'Faktur pembelian' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title?: string;
}
