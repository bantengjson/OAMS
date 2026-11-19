import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { AssetCondition } from '../../../generated/prisma/client.js';
import { emptyToNull, enumMessage } from '../../assets/dto/create-asset.dto.js';

export class ReturnLoanDto {
  @ApiPropertyOptional({ example: '2026-11-25T09:30:00+07:00', description: 'Default: sekarang' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsISO8601({}, { message: 'Waktu pengembalian tidak valid' })
  returnedAt?: string | null;

  @ApiPropertyOptional({ enum: AssetCondition, nullable: true, description: 'Kosong = kondisi tidak diperiksa' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEnum(AssetCondition, { message: enumMessage('Kondisi', AssetCondition) })
  condition?: AssetCondition | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Catatan maksimal 2000 karakter' })
  notes?: string | null;
}
