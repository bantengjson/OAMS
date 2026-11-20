import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';
import {
  AssetCondition,
  OpnameResult,
  type AssetStatus,
  type OpnameStatus,
} from '../../../generated/prisma/client.js';
import { IsCalendarDate, emptyToNull, enumMessage } from '../../assets/dto/create-asset.dto.js';

export class OpnameUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class StockOpnameDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ enum: ['OPEN', 'CLOSED', 'CANCELLED'] }) status!: OpnameStatus;
  @ApiProperty({ example: '2026-11-20' }) plannedDate!: string;
  @ApiProperty({ type: [OpnameUserRefDto], description: 'Kosong = semua pemegang stock_opnames.execute' })
  officers!: OpnameUserRefDto[];
  @ApiProperty({ type: Object, description: 'Jumlah baris per hasil' }) counts!: Record<OpnameResult, number>;
  @ApiProperty({ description: 'Barang yang harus ditemukan (tanpa tidak terdaftar dan tidak dihitung)' }) total!: number;
  @ApiProperty({ description: 'Sesuai + kondisi berbeda' }) scanned!: number;
  @ApiProperty({ type: OpnameUserRefDto }) createdBy!: OpnameUserRefDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: OpnameUserRefDto, nullable: true }) closedBy!: OpnameUserRefDto | null;
  @ApiProperty({ nullable: true }) closedAt!: Date | null;
  @ApiProperty({ nullable: true }) cancelledAt!: Date | null;
}

export class OpnameItemAssetDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: { name: string };
}

export class OpnameItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: OpnameItemAssetDto, nullable: true }) asset!: OpnameItemAssetDto | null;
  @ApiProperty({ nullable: true }) expectedCondition!: AssetCondition | null;
  @ApiProperty({ nullable: true }) expectedStatus!: AssetStatus | null;
  @ApiProperty({ nullable: true }) observedCondition!: AssetCondition | null;
  @ApiProperty() result!: OpnameResult;
  @ApiProperty({ nullable: true }) scannedAt!: Date | null;
  @ApiProperty({ type: OpnameUserRefDto, nullable: true }) scannedBy!: OpnameUserRefDto | null;
  @ApiProperty({ nullable: true }) rawValue!: string | null;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ nullable: true }) conditionAppliedAt!: Date | null;
}

export class ScanResultDto {
  @ApiProperty({ type: OpnameItemDto }) item!: OpnameItemDto;
  @ApiProperty({ description: 'true bila barang ini sudah dihitung sebelumnya' }) alreadyScanned!: boolean;
}

export const REPORT_RESULTS = [
  'MATCHED',
  'CONDITION_DIFFERS',
  'NOT_FOUND',
  'UNREGISTERED',
  'ON_LOAN',
  'IN_MAINTENANCE',
] as const;
export type ReportResult = (typeof REPORT_RESULTS)[number];

export class OpnameReportDto {
  @ApiProperty({ type: StockOpnameDto }) session!: StockOpnameDto;
  @ApiProperty({ type: Object }) groups!: Record<ReportResult, OpnameItemDto[]>;
}

export class CreateStockOpnameDto {
  @ApiProperty({ example: 'Opname Desember 2026' })
  @Transform(trim)
  @IsString({ message: 'Nama sesi wajib diisi' })
  @IsNotEmpty({ message: 'Nama sesi wajib diisi' })
  @MaxLength(150, { message: 'Nama sesi maksimal 150 karakter' })
  name!: string;

  @ApiProperty({ example: '2026-12-01' })
  @Transform(trim)
  @IsString({ message: 'Tanggal wajib diisi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Tanggal tidak valid' })
  plannedDate!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Catatan maksimal 2000 karakter' })
  notes?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Akun petugas; kosong = semua petugas' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'Petugas tidak valid' })
  officerIds?: string[];
}

export class ScanDto {
  @ApiProperty({ description: 'Isi QR (URL), token, atau kode inventaris' })
  @Transform(trim)
  @IsString({ message: 'Kode atau QR wajib diisi' })
  @IsNotEmpty({ message: 'Kode atau QR wajib diisi' })
  @MaxLength(500)
  value!: string;
}

export class ConfirmItemDto {
  @ApiProperty({ enum: AssetCondition })
  @IsEnum(AssetCondition, { message: enumMessage('Kondisi', AssetCondition) })
  observedCondition!: AssetCondition;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Catatan maksimal 2000 karakter' })
  note?: string | null;
}

/** Item lists are one row per asset and read on a phone in one go, so pages are large. */
export class OpnameItemQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page harus bilangan bulat' })
  @Min(1, { message: 'page minimal 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize harus bilangan bulat' })
  @Min(1, { message: 'pageSize minimal 1' })
  @Max(2000, { message: 'pageSize maksimal 2000' })
  pageSize: number = 500;

  @ApiPropertyOptional({ enum: OpnameResult })
  @IsOptional()
  @IsIn(Object.values(OpnameResult), { message: 'Hasil tidak valid' })
  result?: OpnameResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
