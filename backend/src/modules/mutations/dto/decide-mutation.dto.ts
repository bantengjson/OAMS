import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';

export class ApproveMutationDto {
  @ApiPropertyOptional({ example: 'Disetujui, barang sudah dipindahkan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000, { message: 'Catatan maksimal 2000 karakter' })
  note?: string;
}

export class RejectMutationDto {
  @ApiProperty({ example: 'Ruang tujuan sudah penuh' })
  @Transform(trim)
  @IsString({ message: 'Alasan penolakan wajib diisi' })
  @IsNotEmpty({ message: 'Alasan penolakan wajib diisi' })
  @MaxLength(2000, { message: 'Alasan penolakan maksimal 2000 karakter' })
  note!: string;
}
