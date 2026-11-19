import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, Validate, ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { jakartaToday } from '../../../common/dates/jakarta.js';
import { AssetCondition } from '../../../generated/prisma/client.js';
import { IsCalendarDate, emptyToNull, enumMessage } from './create-asset.dto.js';

/** `YYYY-MM-DD` not later than today on the Jakarta calendar. */
@ValidatorConstraint({ name: 'notAfterToday', async: false })
export class NotAfterToday implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value <= jakartaToday();
  }
  defaultMessage(): string {
    return 'Tanggal pemeriksaan tidak boleh di masa depan';
  }
}

export class CreateConditionLogDto {
  @ApiProperty({ enum: AssetCondition })
  @IsEnum(AssetCondition, { message: enumMessage('Kondisi', AssetCondition) })
  condition!: AssetCondition;

  @ApiPropertyOptional({ nullable: true, example: 'Engsel longgar, perlu dikencangkan' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Catatan maksimal 2000 karakter' })
  notes?: string | null;

  @ApiPropertyOptional({ example: '2026-11-19', description: 'Default: hari ini (Asia/Jakarta)' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal pemeriksaan harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Tanggal pemeriksaan tidak valid' })
  @Validate(NotAfterToday)
  checkedAt?: string | null;
}
