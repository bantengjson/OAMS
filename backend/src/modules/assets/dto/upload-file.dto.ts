import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';

export class UploadPhotoDto {
  @ApiPropertyOptional({ example: 'Tampak depan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  caption?: string;
}

export class UploadDocumentDto {
  @ApiPropertyOptional({ example: 'Faktur pembelian' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title?: string;
}
