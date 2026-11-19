import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { Forbidden } from '../../../common/dto/forbidden.validator.js';
import { trim } from '../../../common/dto/transforms.js';
import { AcquisitionMethod, AssetStatus, OwnershipType } from '../../../generated/prisma/client.js';
import {
  CREATABLE_STATUSES,
  IsCalendarDate,
  MAX_PURCHASE_PRICE,
  STATUS_LOAN_MANAGED,
  emptyToNull,
  enumMessage,
  toNumberOrNull,
} from './create-asset.dto.js';

/** Like IsOptional, but `null` is still validated (and refused) on fields required at creation. */
const IfPresent = () => ValidateIf((_object, value) => value !== undefined);

export const LOCKED_BY_MUTATION = 'Ubah lewat mutasi';
export const LOCKED_BY_CONDITION = 'Ubah lewat pemeriksaan kondisi';

/**
 * Editable asset fields. Location, responsible employee and condition are
 * deliberately *not* editable here: they change only through a mutation or a
 * condition check, so the keys are declared to be refused with a clear message.
 */
export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IfPresent()
  @Transform(trim)
  @IsString({ message: 'Nama barang wajib diisi' })
  @IsNotEmpty({ message: 'Nama barang wajib diisi' })
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IfPresent()
  @IsUUID('all', { message: 'Kategori tidak valid' })
  categoryId?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  brand?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  model?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  serialNumber?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: OwnershipType })
  @IfPresent()
  @IsEnum(OwnershipType, { message: enumMessage('Jenis kepemilikan', OwnershipType) })
  ownershipType?: OwnershipType;

  @ApiPropertyOptional({ enum: AcquisitionMethod })
  @IfPresent()
  @IsEnum(AcquisitionMethod, { message: enumMessage('Metode perolehan', AcquisitionMethod) })
  acquisitionMethod?: AcquisitionMethod;

  @ApiPropertyOptional({ example: '2026-01-15', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal perolehan harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate)
  acquisitionDate?: string | null;

  @ApiPropertyOptional({ example: 15000000, nullable: true })
  @IsOptional()
  @Transform(toNumberOrNull)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Harga perolehan harus berupa angka' })
  @Min(0, { message: 'Harga perolehan tidak boleh negatif' })
  @Max(MAX_PURCHASE_PRICE, { message: 'Harga perolehan melebihi batas (13 digit)' })
  purchasePrice?: number | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  vendor?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Unit kerja tidak valid' })
  departmentId?: string | null;

  @ApiPropertyOptional({ enum: CREATABLE_STATUSES })
  @IfPresent()
  @IsIn(CREATABLE_STATUSES, { message: STATUS_LOAN_MANAGED })
  status?: AssetStatus;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  notes?: string | null;

  // ---- refused keys: present only to produce a per-field 400 ----

  @ApiPropertyOptional({ description: 'Ditolak: ubah lewat mutasi' })
  @IsOptional()
  @Validate(Forbidden, [LOCKED_BY_MUTATION])
  locationId?: unknown;

  @ApiPropertyOptional({ description: 'Ditolak: ubah lewat mutasi' })
  @IsOptional()
  @Validate(Forbidden, [LOCKED_BY_MUTATION])
  responsibleEmployeeId?: unknown;

  @ApiPropertyOptional({ description: 'Ditolak: ubah lewat pemeriksaan kondisi' })
  @IsOptional()
  @Validate(Forbidden, [LOCKED_BY_CONDITION])
  condition?: unknown;
}
