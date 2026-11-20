import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { trim } from '../../../common/dto/transforms.js';
import {
  AssetCondition,
  MaintenanceStatus,
  type AssetStatus,
} from '../../../generated/prisma/client.js';
import { AssetPhotoDto } from '../../assets/dto/asset.dto.js';
import { MAX_PURCHASE_PRICE, emptyToNull, enumMessage, toNumberOrNull } from '../../assets/dto/create-asset.dto.js';

export class MaintenanceUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class MaintenanceDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: MaintenanceStatus }) status!: MaintenanceStatus;
  @ApiProperty() asset!: { id: string; assetCode: string; name: string };
  @ApiProperty() description!: string;
  @ApiProperty({ type: MaintenanceUserRefDto }) reportedBy!: MaintenanceUserRefDto;
  @ApiProperty() reportedAt!: Date;
  @ApiProperty({ nullable: true }) technician!: string | null;
  @ApiProperty({ nullable: true }) startedAt!: Date | null;
  @ApiProperty({ type: MaintenanceUserRefDto, nullable: true }) startedBy!: MaintenanceUserRefDto | null;
  @ApiProperty({ nullable: true }) completedAt!: Date | null;
  @ApiProperty({ type: MaintenanceUserRefDto, nullable: true }) completedBy!: MaintenanceUserRefDto | null;
  @ApiProperty({ nullable: true, example: '250000.00' }) cost!: string | null;
  @ApiProperty({ nullable: true }) technicianNotes!: string | null;
  @ApiProperty({ nullable: true }) resultCondition!: AssetCondition | null;
  @ApiProperty({ nullable: true }) previousStatus!: AssetStatus | null;
  @ApiProperty({ nullable: true }) cancelledAt!: Date | null;
  @ApiProperty({ nullable: true }) cancelReason!: string | null;
  @ApiProperty({ type: [AssetPhotoDto] }) photos!: AssetPhotoDto[];
}

export class ReportMaintenanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Barang tidak valid' })
  assetId!: string;

  @ApiProperty({ example: 'Kertas sering macet' })
  @Transform(trim)
  @IsString({ message: 'Deskripsi kerusakan wajib diisi' })
  @IsNotEmpty({ message: 'Deskripsi kerusakan wajib diisi' })
  @MaxLength(2000, { message: 'Deskripsi maksimal 2000 karakter' })
  description!: string;
}

export class StartMaintenanceDto {
  @ApiPropertyOptional({ nullable: true, example: 'Bengkel Maju' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150, { message: 'Teknisi maksimal 150 karakter' })
  technician?: string | null;

  @ApiPropertyOptional({ description: 'Default: sekarang' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsISO8601({}, { message: 'Waktu mulai tidak valid' })
  startedAt?: string | null;
}

export class CompleteMaintenanceDto {
  @ApiPropertyOptional({ description: 'Default: sekarang' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsISO8601({}, { message: 'Waktu selesai tidak valid' })
  completedAt?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 250000 })
  @IsOptional()
  @Transform(toNumberOrNull)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Biaya harus berupa angka' })
  @Min(0, { message: 'Biaya tidak boleh negatif' })
  @Max(MAX_PURCHASE_PRICE, { message: 'Biaya melebihi batas (13 digit)' })
  cost?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Catatan teknisi maksimal 2000 karakter' })
  technicianNotes?: string | null;

  @ApiPropertyOptional({ enum: AssetCondition, nullable: true, description: 'Kondisi setelah perbaikan' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEnum(AssetCondition, { message: enumMessage('Kondisi', AssetCondition) })
  resultCondition?: AssetCondition | null;
}

export class CancelMaintenanceDto {
  @ApiProperty({ example: 'Ternyata tidak rusak' })
  @Transform(trim)
  @IsString({ message: 'Alasan pembatalan wajib diisi' })
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @MaxLength(2000, { message: 'Alasan maksimal 2000 karakter' })
  reason!: string;
}

export class MaintenanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsOptional()
  @IsEnum(MaintenanceStatus, { message: 'Status tidak valid' })
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  assetId?: string;

  @ApiPropertyOptional({ description: 'Cari pada kode/nama barang atau deskripsi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
