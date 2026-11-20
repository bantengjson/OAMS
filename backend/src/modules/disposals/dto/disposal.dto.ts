import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
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
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { toBoolean, trim } from '../../../common/dto/transforms.js';
import { DisposalReason, type AssetStatus } from '../../../generated/prisma/client.js';
import { AssetDocumentDto } from '../../assets/dto/asset.dto.js';
import {
  IsCalendarDate,
  MAX_PURCHASE_PRICE,
  emptyToNull,
  enumMessage,
  toNumberOrNull,
} from '../../assets/dto/create-asset.dto.js';
import { NotAfterToday } from '../../assets/dto/create-condition-log.dto.js';

export class DisposalUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class DisposalDto {
  @ApiProperty() id!: string;
  @ApiProperty() asset!: { id: string; assetCode: string; name: string };
  @ApiProperty({ enum: DisposalReason }) reason!: DisposalReason;
  @ApiProperty({ example: '2026-11-20' }) disposedAt!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ nullable: true, example: '1500000.00' }) value!: string | null;
  @ApiProperty({ nullable: true }) recipient!: string | null;
  @ApiProperty() previousStatus!: AssetStatus;
  @ApiProperty({ description: 'Status QR sebelum dilepas; dipakai saat pembatalan' }) labelWasActive!: boolean;
  @ApiProperty({ type: DisposalUserRefDto }) disposedBy!: DisposalUserRefDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true }) revertedAt!: Date | null;
  @ApiProperty({ type: DisposalUserRefDto, nullable: true }) revertedBy!: DisposalUserRefDto | null;
  @ApiProperty({ nullable: true }) revertReason!: string | null;
  @ApiProperty({ type: [AssetDocumentDto] }) documents!: AssetDocumentDto[];
}

export class CreateDisposalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Barang tidak valid' })
  assetId!: string;

  @ApiProperty({ enum: DisposalReason })
  @IsEnum(DisposalReason, { message: enumMessage('Alasan', DisposalReason) })
  reason!: DisposalReason;

  @ApiProperty({ example: '2026-11-20' })
  @Transform(trim)
  @IsString({ message: 'Tanggal wajib diisi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Tanggal tidak valid' })
  @Validate(NotAfterToday, { message: 'Tanggal tidak boleh di masa depan' })
  disposedAt!: string;

  @ApiProperty({ example: 'Dijual ke pengepul barang bekas' })
  @Transform(trim)
  @IsString({ message: 'Keterangan wajib diisi' })
  @IsNotEmpty({ message: 'Keterangan wajib diisi' })
  @MaxLength(2000, { message: 'Keterangan maksimal 2000 karakter' })
  description!: string;

  @ApiPropertyOptional({ nullable: true, example: 1500000, description: 'Nilai jual' })
  @IsOptional()
  @Transform(toNumberOrNull)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Nilai harus berupa angka' })
  @Min(0, { message: 'Nilai tidak boleh negatif' })
  @Max(MAX_PURCHASE_PRICE, { message: 'Nilai melebihi batas (13 digit)' })
  value?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Pembeli atau penerima hibah' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150, { message: 'Penerima maksimal 150 karakter' })
  recipient?: string | null;
}

export class RevertDisposalDto {
  @ApiProperty({ example: 'Barang ditemukan kembali' })
  @Transform(trim)
  @IsString({ message: 'Alasan pembatalan wajib diisi' })
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @MaxLength(2000, { message: 'Alasan maksimal 2000 karakter' })
  reason!: string;
}

export class DisposalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DisposalReason })
  @IsOptional()
  @IsEnum(DisposalReason, { message: 'Alasan tidak valid' })
  reason?: DisposalReason;

  @ApiPropertyOptional({ description: 'Cari pada kode/nama barang atau penerima' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Sertakan pelepasan yang sudah dibatalkan' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'includeReverted harus true atau false' })
  includeReverted?: boolean;
}
