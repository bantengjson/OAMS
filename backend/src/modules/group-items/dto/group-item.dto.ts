import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { toBoolean, trim } from '../../../common/dto/transforms.js';
import { emptyToNull, YEAR_MESSAGE } from '../../assets/dto/create-asset.dto.js';

const QTY_MESSAGE = 'Jumlah harus bilangan bulat 0 atau lebih';
const REASON_MESSAGE = 'Alasan perubahan wajib diisi (3-500 karakter)';

export class GroupItemTypeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['BG', 'NG'] }) golongan!: 'BG' | 'NG';
  @ApiProperty() number!: number;
  @ApiProperty() name!: string;
}

export class GroupItemRoomDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'I' }) code!: string;
  @ApiProperty({ example: 'Dapur' }) name!: string;
}

/** Counted goods (kitchenware): one row per type + room (+ year/spec/source), no QR. */
export class GroupItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'NG.I/110/DPC/TT', description: 'Kode tanpa nomor unit (hanya tampilan)' }) code!: string;
  @ApiProperty({ type: GroupItemTypeDto }) type!: GroupItemTypeDto;
  @ApiProperty({ type: GroupItemRoomDto }) room!: GroupItemRoomDto;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) specification!: string | null;
  @ApiProperty({ nullable: true }) acquisitionYear!: number | null;
  @ApiProperty({ nullable: true }) source!: string | null;
  @ApiProperty() qtyGood!: number;
  @ApiProperty() qtyNeedsRepair!: number;
  @ApiProperty() qtyDamaged!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ nullable: true }) archivedAt!: Date | null;
  @ApiProperty() updatedAt!: Date;
}

export class GroupItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all')
  locationId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all')
  categoryId?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean()
  includeArchived?: boolean;
}

class QuantityFields {
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt({ message: QTY_MESSAGE }) @Min(0, { message: QTY_MESSAGE }) @Max(100000)
  qtyGood?: number;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt({ message: QTY_MESSAGE }) @Min(0, { message: QTY_MESSAGE }) @Max(100000)
  qtyNeedsRepair?: number;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt({ message: QTY_MESSAGE }) @Min(0, { message: QTY_MESSAGE }) @Max(100000)
  qtyDamaged?: number;
}

export class CreateGroupItemDto extends QuantityFields {
  @ApiProperty({ format: 'uuid', description: 'Jenis Barang Kelompok' })
  @IsUUID('all', { message: 'Jenis barang tidak valid' })
  categoryId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Ruangan wajib diisi' })
  locationId!: string;

  @ApiProperty({ example: 'Piring Makan' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 2023 })
  @IsInt({ message: YEAR_MESSAGE })
  @Min(1900, { message: YEAR_MESSAGE })
  @Max(2100, { message: YEAR_MESSAGE })
  acquisitionYear!: number;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  specification?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300)
  source?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  notes?: string | null;
}

export class UpdateGroupItemDto extends QuantityFields {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all', { message: 'Ruangan tidak valid' })
  locationId?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @IsNotEmpty({ message: 'Nama tidak boleh kosong' }) @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt({ message: YEAR_MESSAGE }) @Min(1900, { message: YEAR_MESSAGE }) @Max(2100, { message: YEAR_MESSAGE })
  acquisitionYear?: number;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  specification?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300)
  source?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({ description: 'Alasan perubahan (wajib)' })
  @Transform(trim)
  @IsString({ message: REASON_MESSAGE })
  @MinLength(3, { message: REASON_MESSAGE })
  @MaxLength(500, { message: REASON_MESSAGE })
  reason!: string;
}

export class ArchiveGroupItemDto {
  @ApiProperty()
  @Transform(trim)
  @IsString({ message: REASON_MESSAGE })
  @MinLength(3, { message: REASON_MESSAGE })
  @MaxLength(500, { message: REASON_MESSAGE })
  reason!: string;
}
